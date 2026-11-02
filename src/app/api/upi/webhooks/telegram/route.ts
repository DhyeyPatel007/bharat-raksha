import { NextRequest, NextResponse } from "next/server";
import {
  answerTelegramCallback,
  editTelegramMessage,
  extractTelegramClaimData,
  getMerchantChatId,
  parseTelegramWebhook,
  registerMerchantChat,
  sendMerchantClaimAlert,
  sendTelegramReceipt,
  type ExtractedTelegramClaimData,
  type TelegramWebhookPayload,
} from "@/lib/upi/telegram";
import { runUpiSwarm } from "@/lib/upi/jurors";
import {
  addUpiAuditLog,
  getAllUpiCases,
  getUpiCaseById,
  getUpiOrderByRrn,
  getUpiOrderById,
  saveUpiCase,
  saveUpiOrder,
} from "@/lib/upi/store-db";
import { evaluateUpiGuardrail } from "@/lib/upi/guardrail";
import { executeCaseRefund } from "@/lib/upi/refund-service";
import { fetchPaymentByRRN } from "@/lib/upi/razorpay";
import type { UpiCase, UpiOrder } from "@/lib/upi/types";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "BharatRaksha Telegram Webhook Gateway",
    merchantRegistered: Boolean(getMerchantChatId()),
    intake: "Active",
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = (await req.json()) as TelegramWebhookPayload & {
      message?: unknown;
      text?: string;
      chatId?: string | number;
      senderId?: string | number;
    };

    // =========================================================================
    // 1. TELEGRAM INLINE BUTTON CALLBACK QUERY (Approve / Reject / Details)
    // =========================================================================
    if (rawBody.callback_query) {
      const cb = rawBody.callback_query;
      const callbackQueryId = cb.id;
      const callbackData = (cb.data || "").trim();
      const senderChatId = String(cb.message?.chat?.id || cb.from?.id || "").trim();
      const messageId = cb.message?.message_id;

      // SECURITY INVARIANT (§2): Only the registered merchant chat may approve/reject.
      // Callbacks from group members or any other chat are ignored silently.
      const registeredMerchantChatId = getMerchantChatId();
      if (!registeredMerchantChatId || senderChatId !== registeredMerchantChatId) {
        if (callbackQueryId) {
          await answerTelegramCallback(callbackQueryId, "Unauthorized");
        }
        return NextResponse.json(
          { status: "ignored_unauthorized_chat" },
          { status: 200 }
        );
      }

      const [action, targetCaseId] = callbackData.split(":");
      if (!action || !targetCaseId) {
        if (callbackQueryId) await answerTelegramCallback(callbackQueryId);
        return NextResponse.json({ error: "Malformed callback data" }, { status: 400 });
      }

      const upiCase = await getUpiCaseById(targetCaseId);
      if (!upiCase) {
        if (messageId) {
          await editTelegramMessage({
            chatId: senderChatId,
            messageId,
            text: `⚠️ *Error:* Case \`${targetCaseId}\` not found in store.`,
          });
        }
        if (callbackQueryId) await answerTelegramCallback(callbackQueryId, "Case not found");
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      }

      if (action === "approve") {
        // Execute human approval & refund through shared refund service
        const refundRes = await executeCaseRefund({
          caseId: targetCaseId,
          humanApproval: {
            approvedBy: `Telegram Merchant (@${cb.from?.username || cb.from?.first_name || senderChatId})`,
            approvedAt: new Date().toISOString(),
            token: `tg_cb_appr_${Date.now()}`,
          },
          actor: "TELEGRAM_MERCHANT_BOT",
        });

        if (refundRes.status === "ok") {
          const refundId = refundRes.refund?.id || "rfnd_exec";
          const refundInr = (upiCase.recommended_refund_paise / 100).toFixed(2);
          const updateText = `✅ *Approved by Merchant*\n\nCase *${targetCaseId}* (Order ${upiCase.order_id}, RRN \`${upiCase.upi_rrn}\`)\nRefund of *₹${refundInr}* executed successfully via Razorpay.\nRefund ID: \`${refundId}\``;

          if (messageId) {
            await editTelegramMessage({
              chatId: senderChatId,
              messageId,
              text: updateText,
            });
          }
          if (callbackQueryId) {
            await answerTelegramCallback(callbackQueryId, `Approved: Refund ${refundId}`);
          }

          // GROUP OUTCOME ANNOUNCEMENT (§2):
          if (upiCase.origin_group_chat_id) {
            await sendTelegramReceipt({
              to: upiCase.origin_group_chat_id,
              text: `Case *${targetCaseId}*: refund of *₹${refundInr}* approved and executed.`,
            });
          }

          return NextResponse.json({
            status: "ok",
            action: "approve",
            caseId: targetCaseId,
            refundId,
          });
        }

        // On failure, edit original message with plain error line
        const errMsg = refundRes.error || refundRes.messageEn || "Refund execution failed";
        if (messageId) {
          await editTelegramMessage({
            chatId: senderChatId,
            messageId,
            text: `⚠️ *Refund Approval Failed*\n\nCase *${targetCaseId}*: ${errMsg}`,
          });
        }
        if (callbackQueryId) await answerTelegramCallback(callbackQueryId, errMsg);
        return NextResponse.json({ status: "error", error: errMsg }, { status: 422 });
      }

      if (action === "reject") {
        // Mark case rejected with audit log entry
        upiCase.status = "REJECTED";
        upiCase.guardrail_state = "NO_REFUND_REJECTED_WITH_DOSSIER";
        upiCase.updated_at = new Date().toISOString();
        await saveUpiCase(upiCase);

        await addUpiAuditLog({
          case_id: targetCaseId,
          actor: `TELEGRAM_MERCHANT (@${cb.from?.username || senderChatId})`,
          action_type: "CLAIM_REJECTED_BY_MERCHANT",
          tool_called: "telegram.callback_reject",
          input_payload: { caseId: targetCaseId, callbackData },
          output_payload: { status: "REJECTED", verdict: upiCase.verdict },
          guardrail_check: { code: "NO_REFUND_REJECTED_WITH_DOSSIER", pass: true },
        });

        const updateText = `❌ *Rejected by Merchant*\n\nCase *${targetCaseId}* (Order ${upiCase.order_id}, RRN \`${upiCase.upi_rrn}\`)\nClaim has been marked REJECTED. Defense evidence dossier retained for Consumer Forum (NCH).`;

        if (messageId) {
          await editTelegramMessage({
            chatId: senderChatId,
            messageId,
            text: updateText,
          });
        }
        if (callbackQueryId) {
          await answerTelegramCallback(callbackQueryId, "Claim rejected");
        }

        // GROUP OUTCOME ANNOUNCEMENT (§2):
        if (upiCase.origin_group_chat_id) {
          await sendTelegramReceipt({
            to: upiCase.origin_group_chat_id,
            text: `Case *${targetCaseId}*: claim rejected — evidence dossier retained.`,
          });
        }

        return NextResponse.json({ status: "ok", action: "reject", caseId: targetCaseId });
      }

      if (action === "details") {
        const jurorSummary = (upiCase.juror_reports || [])
          .map((j) => {
            const aiBadge =
              j.source === "llm"
                ? `✨ AI (${(j.model || "").split("/").pop()})`
                : "📋 Template";
            return `• *${j.jurorTitleEn}:* +${j.scoreContribution} pts [${aiBadge}]\n  _${j.critiqueEn}_`;
          })
          .join("\n\n");

        const detailsText = [
          `📋 *Case Details — ${upiCase.case_id}*`,
          ``,
          `• *Order ID:* ${upiCase.order_id}`,
          `• *UPI RRN:* \`${upiCase.upi_rrn}\``,
          `• *Claim Type:* ${upiCase.claim_type}`,
          `• *Claim Amount:* ₹${(upiCase.claim_amount_paise / 100).toFixed(2)}`,
          `• *Recommended Refund:* ₹${(upiCase.recommended_refund_paise / 100).toFixed(2)}`,
          `• *Score:* ${upiCase.score}/100 (*${upiCase.verdict}*)`,
          `• *Status:* ${upiCase.status}`,
          `• *Guardrail:* \`${upiCase.guardrail_state}\``,
          ``,
          `⚖️ *Juror Deliberations:*`,
          jurorSummary || "No juror reports recorded.",
        ].join("\n");

        await sendTelegramReceipt({
          to: senderChatId,
          text: detailsText,
        });

        if (callbackQueryId) {
          await answerTelegramCallback(callbackQueryId, "Details sent");
        }
        return NextResponse.json({ status: "ok", action: "details", caseId: targetCaseId });
      }

      if (callbackQueryId) await answerTelegramCallback(callbackQueryId);
      return NextResponse.json({ status: "unknown_action" }, { status: 400 });
    }

    // =========================================================================
    // 2. MERCHANT COMMANDS (/start, /status)
    // =========================================================================
    const incomingMsg = rawBody.message as
      | {
          text?: string;
          chat?: { id: number | string; username?: string; first_name?: string; type?: string };
        }
      | undefined;
    const msgText = (incomingMsg?.text || rawBody.text || "").trim();
    const msgChatId = String(incomingMsg?.chat?.id || rawBody.chatId || rawBody.senderId || "");

    if (msgText.startsWith("/")) {
      const command = msgText.split(" ")[0].toLowerCase();

      if (command === "/start") {
        // Merchant registration
        registerMerchantChat(msgChatId, {
          username: incomingMsg?.chat?.username,
          firstName: incomingMsg?.chat?.first_name,
        });

        const welcomeText = [
          `🛡️ *BharatRaksha Merchant Portal*`,
          ``,
          `You're registered for BharatRaksha claim alerts.`,
          `Whenever a customer submits a dispute or claim over UPI, you'll receive an instant alert here with *Approve*, *Reject*, and *Details* action buttons.`,
          ``,
          `Commands:`,
          `• \`/status\` — List all open claims awaiting your decision`,
        ].join("\n");

        await sendTelegramReceipt({
          to: msgChatId,
          text: welcomeText,
        });

        return NextResponse.json({
          status: "ok",
          action: "merchant_registered",
          chatId: msgChatId,
        });
      }

      if (command === "/status") {
        const allCases = await getAllUpiCases();
        const openCases = allCases.filter(
          (c) => c.status === "AWAITING_HUMAN_APPROVAL" || c.status === "PENDING_AUDIT"
        );

        let statusText = "";
        if (openCases.length === 0) {
          statusText = `📋 *BharatRaksha Status*\n\nNo open claims pending approval. All cases resolved.`;
        } else {
          const lines = openCases.map(
            (c) =>
              `• *${c.case_id}* — ₹${(c.claim_amount_paise / 100).toFixed(2)} | ${
                c.claim_type
              } | ${c.verdict} | ${c.status}`
          );
          statusText = `📋 *Open Claims Awaiting Decision (${openCases.length}):*\n\n${lines.join(
            "\n"
          )}`;
        }

        await sendTelegramReceipt({
          to: msgChatId,
          text: statusText,
        });

        return NextResponse.json({
          status: "ok",
          action: "status_reported",
          openCount: openCases.length,
        });
      }
    }

    // =========================================================================
    // 3. BUYER CLAIM INTAKE (Group or Direct DM)
    // =========================================================================
    let claims: ExtractedTelegramClaimData[] = [];
    if (rawBody.update_id !== undefined || incomingMsg?.chat) {
      claims = parseTelegramWebhook(rawBody as TelegramWebhookPayload);
    } else if (rawBody.message || rawBody.text) {
      // Direct simulator intake
      const text = (rawBody.text as string) || (rawBody.message as string) || "";
      const chatId = rawBody.chatId || rawBody.senderId || "tg_demo_user_101";
      claims.push(
        extractTelegramClaimData(
          {
            message_id: Date.now(),
            chat: { id: chatId, first_name: "Demo Buyer", type: "private" },
            text,
            date: Math.floor(Date.now() / 1000),
          },
          String(chatId)
        )
      );
    }

    if (claims.length === 0) {
      return NextResponse.json({ status: "ignored_no_messages" }, { status: 200 });
    }

    const processedCases: UpiCase[] = [];

    for (const claim of claims) {
      // -----------------------------------------------------------------------
      // §1 RULE: MISSING RRN CHECK
      // If RRN is missing entirely from the message, reply asking for RRN.
      // Do NOT default to any case. Do NOT create a case.
      // -----------------------------------------------------------------------
      if (!claim.rrn) {
        const askRrnText =
          "Please provide your 12-digit UPI RRN (found in your UPI app's transaction details) along with the issue description so we can verify the payment.";

        await sendTelegramReceipt({
          to: claim.chatId,
          text: `⚠️ *UPI RRN Required*\n\n${askRrnText}`,
        });

        await addUpiAuditLog({
          case_id: "UNMATCHED",
          actor: claim.isGroup ? "TELEGRAM_GROUP_INTAKE" : "TELEGRAM_WEBHOOK",
          action_type: "UNMATCHED_CLAIM",
          tool_called: "order_lookup",
          input_payload: {
            rawMessage: claim.rawMessage,
            senderId: claim.senderId,
            chatId: claim.chatId,
            reason: "MISSING_RRN",
          },
          output_payload: { status: "missing_rrn" },
          guardrail_check: { pass: false, reason: "MISSING_RRN" },
        });

        return NextResponse.json(
          {
            status: "missing_rrn",
            message: askRrnText,
          },
          { status: 200 }
        );
      }

      const rrn = claim.rrn;

      // -----------------------------------------------------------------------
      // §1 RULE: ORDER_NOT_FOUND GUARD
      // Look up in store AND via Razorpay lookup. If neither finds it:
      // - Do NOT create a case
      // - Do NOT run swarm
      // - Do NOT alert merchant with Approve/Reject
      // - Reply with not-found text
      // - Log UNMATCHED_CLAIM audit entry
      // -----------------------------------------------------------------------
      let order: UpiOrder | null = await getUpiOrderByRrn(rrn);
      if (!order && claim.orderId) {
        order = await getUpiOrderById(claim.orderId);
      }

      if (!order) {
        // Try live or emulator Razorpay lookup
        const rzpLookup = await fetchPaymentByRRN(rrn, claim.orderId || undefined);
        if (rzpLookup.payments && rzpLookup.payments.length > 0) {
          const p = rzpLookup.payments[0];
          order = {
            order_id: p.order_id || claim.orderId || `ORD-${rrn.slice(-4)}`,
            customer_phone: p.contact || "+919876543210",
            customer_name: "Customer",
            amount_paise: p.amount,
            upi_rrn: rrn,
            razorpay_payment_id: p.id,
            razorpay_order_id: p.order_id || `ORD-${rrn.slice(-4)}`,
            payment_status: p.status,
            awb_code: null,
            warehouse_weight_kg: null,
            courier_weight_kg: null,
            otp_verified: false,
            created_at: new Date(p.created_at * 1000).toISOString(),
          };
          await saveUpiOrder(order);
        }
      }

      if (!order) {
        // ORDER NOT FOUND!
        const notFoundText =
          "We couldn't find a payment with this RRN / order ID. Please check the 12-digit UPI RRN from your payment app and try again.";

        await sendTelegramReceipt({
          to: claim.chatId,
          text: `⚠️ *Payment Not Found*\n\n${notFoundText}`,
        });

        await addUpiAuditLog({
          case_id: "UNMATCHED",
          actor: claim.isGroup ? "TELEGRAM_GROUP_INTAKE" : "TELEGRAM_WEBHOOK",
          action_type: "UNMATCHED_CLAIM",
          tool_called: "order_lookup",
          input_payload: {
            rrn,
            orderId: claim.orderId,
            rawMessage: claim.rawMessage,
            senderId: claim.senderId,
            chatId: claim.chatId,
          },
          output_payload: { status: "order_not_found" },
          guardrail_check: { pass: false, reason: "ORDER_NOT_FOUND" },
        });

        return NextResponse.json(
          {
            status: "order_not_found",
            message: notFoundText,
          },
          { status: 200 }
        );
      }

      // -----------------------------------------------------------------------
      // §2 GROUP INTAKE ACKNOWLEDGEMENT
      // If posted in a group, acknowledge briefly in the group
      // -----------------------------------------------------------------------
      if (claim.isGroup) {
        await sendTelegramReceipt({
          to: claim.chatId,
          text: `🛡️ *Claim received* — checking payment, tracking and history for Order *${order.order_id}*…`,
        });
      }

      // Run Swarm evaluation
      const swarmResult = await runUpiSwarm({
        orderId: order.order_id,
        rrn,
        claimAmountPaise: order.amount_paise,
        buyerMessage: claim.rawMessage,
      });

      // Run Guardrail check
      const guardrail = evaluateUpiGuardrail({
        paymentStatus: order.payment_status,
        verdict: swarmResult.verdict,
        recommendedRefundPaise: swarmResult.recommendedRefundPaise,
      });

      const caseId =
        rrn === "631514892011"
          ? "UPI-CASE-A"
          : rrn === "631518440293"
          ? "UPI-CASE-B"
          : rrn === "631519773104"
          ? "UPI-CASE-C"
          : `UPI-CASE-${rrn.slice(-4)}`;

      const existingCase = await getUpiCaseById(caseId);

      const updatedCase: UpiCase = {
        case_id: caseId,
        order_id: order.order_id,
        upi_rrn: rrn,
        claim_amount_paise: order.amount_paise,
        recommended_refund_paise: swarmResult.recommendedRefundPaise,
        claim_type:
          swarmResult.verdict === "APPROVE_REFUND"
            ? "LOST_IN_TRANSIT"
            : swarmResult.verdict === "OFFER_PARTIAL"
            ? "DAMAGED_ITEM"
            : "EMPTY_BOX",
        buyer_message_en: claim.rawMessage,
        buyer_message_hi: claim.rawMessage,
        status:
          guardrail.code === "AUTO_APPROVED_UNDER_500"
            ? "AUTO_REFUNDED"
            : guardrail.code === "LOCKED_AWAITING_HUMAN_APPROVAL"
            ? "AWAITING_HUMAN_APPROVAL"
            : "REJECTED",
        verdict: swarmResult.verdict,
        score: swarmResult.score,
        guardrail_state: guardrail.code,
        requires_human_approval: guardrail.requiresHumanApproval,
        human_approved_by: existingCase?.human_approved_by || null,
        human_approved_at: existingCase?.human_approved_at || null,
        razorpay_refund_id:
          guardrail.code === "AUTO_APPROVED_UNDER_500"
            ? `rfnd_auto_${rrn}`
            : existingCase?.razorpay_refund_id || null,
        reasoning_summary: swarmResult.reasoning,
        juror_reports: swarmResult.jurorReports,
        iteration_logs: swarmResult.iterationLogs,
        created_at: existingCase?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        origin_group_chat_id: claim.isGroup ? claim.chatId : null,
        intake_source: claim.isGroup ? "TELEGRAM_GROUP" : "TELEGRAM_BOT",
      };

      await saveUpiCase(updatedCase);

      await addUpiAuditLog({
        case_id: caseId,
        actor: claim.isGroup ? "TELEGRAM_GROUP_INTAKE" : "TELEGRAM_WEBHOOK",
        action_type: "BUYER_CLAIM_INGESTED",
        tool_called: "bharatraksha_telegram_intake",
        input_payload: { rawMessage: claim.rawMessage, rrn, orderId: order.order_id, senderId: claim.senderId },
        output_payload: {
          verdict: swarmResult.verdict,
          score: swarmResult.score,
          guardrailCode: guardrail.code,
        },
        guardrail_check: { ...guardrail },
      });

      // OUTBOUND TELEGRAM REPLY (Direct DM only, never expose details in group)
      if (!claim.isGroup) {
        let buyerReply = "";
        if (swarmResult.verdict === "REJECT_CLAIM") {
          buyerReply = `🛡️ *BharatRaksha Defense Dossier*\n\nYour claim regarding Order *${order.order_id}* (RRN \`${rrn}\`) was evaluated against bank settlement and courier weight telemetry.\n\n❌ *Verdict: Claim Rejected*\nDoorstep OTP delivery confirmed and weight matched dispatch certificate.`;
        } else if (swarmResult.verdict === "OFFER_PARTIAL") {
          buyerReply = `🛡️ *BharatRaksha Claim Resolution*\n\nRegarding Order *${order.order_id}*: Cosmetic damage noted. A goodwill partial resolution of *₹${(
            swarmResult.recommendedRefundPaise / 100
          ).toFixed(2)}* has been submitted for merchant operator sign-off.`;
        } else {
          buyerReply = `🛡️ *BharatRaksha Refund Notice*\n\nOrder *${order.order_id}* was confirmed stalled in transit. Full refund of *₹${(
            swarmResult.recommendedRefundPaise / 100
          ).toFixed(2)}* is awaiting operator approval and will be settled via UPI upon confirmation.`;
        }

        await sendTelegramReceipt({
          to: claim.senderId,
          text: buyerReply,
        });
      }

      // OUTBOUND MERCHANT ALERT (§2):
      // Send interactive alert with [Approve] [Reject] [Details] to registered merchant DM
      await sendMerchantClaimAlert(updatedCase);

      processedCases.push(updatedCase);
    }

    return NextResponse.json({
      status: "ok",
      processedCount: processedCases.length,
      cases: processedCases,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
