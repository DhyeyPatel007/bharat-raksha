import { NextRequest, NextResponse } from "next/server";
import {
  getUpiCaseById,
  saveUpiCase,
  addUpiAuditLog,
  getIdempotentResult,
  setIdempotentResult,
} from "@/lib/upi/store-db";
import {
  computeUpiIdempotencyKey,
  evaluateUpiGuardrail,
} from "@/lib/upi/guardrail";
import { refundCapturedPayment } from "@/lib/upi/razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, humanApproval } = body;

    if (!caseId) {
      return NextResponse.json({ error: "Missing caseId parameter" }, { status: 400 });
    }

    const upiCase = await getUpiCaseById(caseId);
    if (!upiCase) {
      return NextResponse.json({ error: "UPI Case not found" }, { status: 404 });
    }

    const paymentStatus = upiCase.order_telemetry?.payment_status || "captured";
    const paymentId = upiCase.order_telemetry?.razorpay_payment_id || `pay_${upiCase.upi_rrn}`;

    // Server-side Idempotency Lock
    const idempotencyKey = computeUpiIdempotencyKey(caseId, upiCase.upi_rrn, "EXECUTE_REFUND");
    const cachedResult = await getIdempotentResult(idempotencyKey);
    if (cachedResult) {
      return NextResponse.json(
        {
          status: "ok",
          idempotent_replay: true,
          case: upiCase,
          refund: cachedResult.refund,
          message: "Idempotent replay: Refund was already processed previously.",
        },
        { status: 200 }
      );
    }

    // Evaluate Guardrail
    const guardrail = evaluateUpiGuardrail({
      paymentStatus,
      verdict: upiCase.verdict,
      recommendedRefundPaise: upiCase.recommended_refund_paise,
      humanApprovalRecord: humanApproval || null,
    });

    // Check if human approval is required but missing
    if (guardrail.requiresHumanApproval && !guardrail.canExecuteRefund) {
      return NextResponse.json(
        {
          error: "GUARDRAIL_HUMAN_APPROVAL_REQUIRED",
          code: guardrail.code,
          messageEn: guardrail.reasonEn,
          messageHi: guardrail.reasonHi,
        },
        { status: 403 }
      );
    }

    // Hard block check (failed or authorized payments)
    if (guardrail.blocked || !guardrail.canExecuteRefund) {
      return NextResponse.json(
        {
          error: "GUARDRAIL_REFUND_BLOCKED",
          code: guardrail.code,
          messageEn: guardrail.reasonEn,
          messageHi: guardrail.reasonHi,
        },
        { status: 422 }
      );
    }

    // Fire Razorpay Refund (Live Test Mode or Emulator Fallback)
    const refundResult = await refundCapturedPayment({
      paymentId,
      amountPaise: upiCase.recommended_refund_paise,
      rrn: upiCase.upi_rrn,
      caseId: upiCase.case_id,
      reason: `Adjudicated by PHALANX UPI: ${upiCase.verdict}`,
      currentPaymentStatus: paymentStatus,
    });

    // Update case record
    upiCase.status = "REFUNDED";
    upiCase.guardrail_state = "HUMAN_APPROVED_READY_TO_FIRE";
    upiCase.razorpay_refund_id = refundResult.refund.id;
    if (humanApproval) {
      upiCase.human_approved_by = humanApproval.approvedBy || "Merchant Operator";
      upiCase.human_approved_at = humanApproval.approvedAt || new Date().toISOString();
    }

    // Append iteration log
    upiCase.iteration_logs.push({
      iteration: upiCase.iteration_logs.length + 1,
      phase: "refund_execution",
      score: upiCase.score,
      verdict: upiCase.verdict,
      timestamp: new Date().toISOString(),
      actionTaken: `Executed UPI refund ${refundResult.refund.id} for INR ${(
        upiCase.recommended_refund_paise / 100
      ).toFixed(2)} via Razorpay (${refundResult.source}).`,
    });

    await saveUpiCase(upiCase);

    // Save idempotency result
    await setIdempotentResult(idempotencyKey, {
      refund: refundResult.refund,
      caseId: upiCase.case_id,
      executedAt: new Date().toISOString(),
    });

    // Record audit log
    await addUpiAuditLog({
      case_id: upiCase.case_id,
      actor: humanApproval?.approvedBy || "AUTONOMOUS_GUARDRAIL",
      action_type: "REFUND_EXECUTED",
      tool_called: "razorpay.refundCapturedPayment",
      input_payload: {
        paymentId,
        amountPaise: upiCase.recommended_refund_paise,
        rrn: upiCase.upi_rrn,
      },
      output_payload: {
        refundId: refundResult.refund.id,
        source: refundResult.source,
      },
      guardrail_check: { ...guardrail },
      idempotency_key: idempotencyKey,
    });

    return NextResponse.json(
      {
        status: "ok",
        case: upiCase,
        refund: refundResult.refund,
        source: refundResult.source,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

