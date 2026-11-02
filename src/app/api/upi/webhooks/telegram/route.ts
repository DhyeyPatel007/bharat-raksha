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
  type TelegramWebhookPayload,
} from "@/lib/upi/telegram";
import { runUpiSwarm } from "@/lib/upi/jurors";
import {
  addUpiAuditLog,
  getAllUpiCases,
  getUpiCaseById,
  getUpiOrderByRrn,
  saveUpiCase,
} from "@/lib/upi/store-db";
import { evaluateUpiGuardrail } from "@/lib/upi/guardrail";
import { executeCaseRefund } from "@/lib/upi/refund-service";
import type { UpiCase } from "@/lib/upi/types";

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

      // SECURITY INVARIANT: Only the registered merchant chat may approve/reject.
      // Callbacks from any other chat are ignored silently.
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
        return NextResponse.json({ status: "ok", action: "reject", caseId: targetCaseId });
      }

      if (action === "details") {
        // Send full case summary message (evidence, scores, juror verdicts)
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
      | { text?: string; chat?: { id: number | string; username?: string; first_name?: string } }
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
    // 3. BUYER CLAIM INTAKE (Non-command text messages)
    // =========================================================================
    let claims = [];
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
            chat: { id: chatId, first_name: "Demo Buyer" },
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
      const rrn = claim.rrn || "631514892011";
      const orderId = claim.orderId || "ORD-KRY-8801";

      const order = await getUpiOrderByRrn(rrn);
      const claimAmountPaise = order ? order.amount_paise : 320000;

      // Run Swarm evaluation
      const swarmResult = await runUpiSwarm({
        orderId: order?.order_id || orderId,
        rrn,
        claimAmountPaise,
        buyerMessage: claim.rawMessage,
      });

      // Run Guardrail check
      const guardrail = evaluateUpiGuardrail({
        paymentStatus: order ? order.payment_status : "captured",
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
        order_id: order?.order_id || orderId,
        upi_rrn: rrn,
        claim_amount_paise: claimAmountPaise,
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
      };

      await saveUpiCase(updatedCase);

      await addUpiAuditLog({
        case_id: caseId,
        actor: "TELEGRAM_WEBHOOK",
        action_type: "BUYER_CLAIM_INGESTED",
        tool_called: "phalanx_telegram_intake",
        input_payload: { rawMessage: claim.rawMessage, rrn, orderId, senderId: claim.senderId },
        output_payload: {
          verdict: swarmResult.verdict,
          score: swarmResult.score,
          guardrailCode: guardrail.code,
        },
        guardrail_check: { ...guardrail },
      });

      // Outbound Telegram reply to buyer
      let buyerReply = "";
      if (swarmResult.verdict === "REJECT_CLAIM") {
        buyerReply = `🛡️ *BharatRaksha Defense Dossier*\n\nYour claim regarding Order *${orderId}* (RRN \`${rrn}\`) was evaluated against bank settlement and courier weight telemetry.\n\n❌ *Verdict: Claim Rejected*\nDoorstep OTP delivery confirmed and weight matched dispatch certificate.`;
      } else if (swarmResult.verdict === "OFFER_PARTIAL") {
        buyerReply = `🛡️ *BharatRaksha Claim Resolution*\n\nRegarding Order *${orderId}*: Cosmetic damage noted. A goodwill partial resolution of *₹${(
          swarmResult.recommendedRefundPaise / 100
        ).toFixed(2)}* has been submitted for merchant operator sign-off.`;
      } else {
        buyerReply = `🛡️ *BharatRaksha Refund Notice*\n\nOrder *${orderId}* was confirmed stalled in transit. Full refund of *₹${(
          swarmResult.recommendedRefundPaise / 100
        ).toFixed(2)}* is awaiting operator approval and will be settled via UPI upon confirmation.`;
      }

      await sendTelegramReceipt({
        to: claim.senderId,
        text: buyerReply,
      });

      // OUTBOUND MERCHANT ALERT (§2):
      // Send interactive alert with [Approve] [Reject] [Details] to registered merchant chat
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
