import { NextRequest, NextResponse } from "next/server";
import {
  extractTelegramClaimData,
  parseTelegramWebhook,
  sendTelegramReceipt,
  type TelegramWebhookPayload,
} from "@/lib/upi/telegram";
import { runUpiSwarm } from "@/lib/upi/jurors";
import {
  addUpiAuditLog,
  getUpiCaseById,
  getUpiOrderByRrn,
  saveUpiCase,
} from "@/lib/upi/store-db";
import { evaluateUpiGuardrail } from "@/lib/upi/guardrail";
import type { UpiCase } from "@/lib/upi/types";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "BharatRaksha Telegram Webhook Gateway",
    intake: "Active",
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // Check if this is a standard Telegram update or direct simulator payload
    let claims = [];
    if (rawBody.update_id !== undefined || rawBody.message?.chat) {
      claims = parseTelegramWebhook(rawBody as TelegramWebhookPayload);
    } else if (rawBody.message || rawBody.text) {
      // Direct simulator intake
      const text = rawBody.message || rawBody.text || "";
      const chatId = rawBody.chatId || rawBody.senderId || "tg_demo_user_101";
      claims.push(
        extractTelegramClaimData(
          {
            message_id: Date.now(),
            chat: { id: chatId, first_name: "Demo Buyer" },
            text,
            date: Math.floor(Date.now() / 1000),
          },
          chatId
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

      // Look up existing order or default
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

      // Construct or update case
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

      // Record audit log
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

      // Outbound Telegram reply message
      let replyText = "";
      if (swarmResult.verdict === "REJECT_CLAIM") {
        replyText = `🛡️ *BharatRaksha Defense Dossier*\n\nYour claim regarding Order *${orderId}* (RRN \`${rrn}\`) was evaluated against bank settlement and courier weight telemetry.\n\n❌ *Verdict: Claim Rejected*\nDoorstep OTP delivery confirmed and weight matched dispatch certificate.`;
      } else if (swarmResult.verdict === "OFFER_PARTIAL") {
        replyText = `🛡️ *BharatRaksha Claim Resolution*\n\nRegarding Order *${orderId}*: Cosmetic damage noted. A goodwill partial resolution of *₹${(
          swarmResult.recommendedRefundPaise / 100
        ).toFixed(2)}* has been submitted for merchant operator sign-off.`;
      } else {
        replyText = `🛡️ *BharatRaksha Refund Notice*\n\nOrder *${orderId}* was confirmed stalled in transit. Full refund of *₹${(
          swarmResult.recommendedRefundPaise / 100
        ).toFixed(2)}* is awaiting operator approval and will be settled via UPI upon confirmation.`;
      }

      await sendTelegramReceipt({
        to: claim.senderId,
        text: replyText,
      });

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
