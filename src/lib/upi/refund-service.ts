// Unified Refund Execution Service for BharatRaksha
// Shared by /api/upi/refund and Telegram Merchant Bot callback handler.
// Enforces pure-code guardrail, server-side idempotency lock, Razorpay refund execution, and audit logging.

import {
  getUpiCaseById,
  saveUpiCase,
  addUpiAuditLog,
  getIdempotentResult,
  setIdempotentResult,
} from "./store-db";
import {
  computeUpiIdempotencyKey,
  evaluateUpiGuardrail,
} from "./guardrail";
import { refundCapturedPayment } from "./razorpay";
import type { RazorpayRefundItem, UpiCase } from "./types";
import { notifyMerchantRefundExecuted } from "./telegram";

export interface ExecuteRefundParams {
  caseId: string;
  humanApproval?: {
    approvedBy: string;
    approvedAt?: string;
    token?: string;
  } | null;
  actor?: string;
}

export interface ExecuteRefundResult {
  status: "ok" | "error";
  statusCode: number;
  case?: UpiCase;
  refund?: RazorpayRefundItem;
  source?: string;
  idempotent_replay?: boolean;
  error?: string;
  code?: string;
  messageEn?: string;
  messageHi?: string;
}

export async function executeCaseRefund(
  params: ExecuteRefundParams
): Promise<ExecuteRefundResult> {
  const { caseId, humanApproval, actor } = params;

  if (!caseId) {
    return {
      status: "error",
      statusCode: 400,
      error: "Missing caseId parameter",
    };
  }

  const upiCase = await getUpiCaseById(caseId);
  if (!upiCase) {
    return {
      status: "error",
      statusCode: 404,
      error: `UPI Case ${caseId} not found`,
    };
  }

  const paymentStatus = upiCase.order_telemetry?.payment_status || "captured";
  const paymentId =
    upiCase.order_telemetry?.razorpay_payment_id || `pay_${upiCase.upi_rrn}`;

  // Server-side Idempotency Lock
  const idempotencyKey = computeUpiIdempotencyKey(
    caseId,
    upiCase.upi_rrn,
    "EXECUTE_REFUND"
  );
  const cachedResult = await getIdempotentResult(idempotencyKey);
  if (cachedResult) {
    return {
      status: "ok",
      statusCode: 200,
      idempotent_replay: true,
      case: upiCase,
      refund: cachedResult.refund as RazorpayRefundItem,
    };
  }

  // Pure-Code Guardrail Evaluation
  const humanApprovalRecord = humanApproval
    ? {
        approvedBy: humanApproval.approvedBy,
        approvedAt: humanApproval.approvedAt || new Date().toISOString(),
        token: humanApproval.token || `tok_${Date.now()}`,
      }
    : null;

  const guardrail = evaluateUpiGuardrail({
    paymentStatus,
    verdict: upiCase.verdict,
    recommendedRefundPaise: upiCase.recommended_refund_paise,
    humanApprovalRecord,
  });

  // Human approval requirement check
  if (guardrail.requiresHumanApproval && !guardrail.canExecuteRefund) {
    return {
      status: "error",
      statusCode: 403,
      error: "GUARDRAIL_HUMAN_APPROVAL_REQUIRED",
      code: guardrail.code,
      messageEn: guardrail.reasonEn,
      messageHi: guardrail.reasonHi,
    };
  }

  // Hard block check (failed or authorized payments)
  if (guardrail.blocked || !guardrail.canExecuteRefund) {
    return {
      status: "error",
      statusCode: 422,
      error: "GUARDRAIL_REFUND_BLOCKED",
      code: guardrail.code,
      messageEn: guardrail.reasonEn,
      messageHi: guardrail.reasonHi,
    };
  }

  // Fire Razorpay Refund (Live Test Mode or Emulator Fallback)
  const refundResult = await refundCapturedPayment({
    paymentId,
    amountPaise: upiCase.recommended_refund_paise,
    rrn: upiCase.upi_rrn,
    caseId: upiCase.case_id,
    reason: `Adjudicated by BharatRaksha: ${upiCase.verdict}`,
    currentPaymentStatus: paymentStatus,
  });

  // Update case record
  upiCase.status = "REFUNDED";
  upiCase.guardrail_state = "HUMAN_APPROVED_READY_TO_FIRE";
  upiCase.razorpay_refund_id = refundResult.refund.id;
  if (humanApproval) {
    upiCase.human_approved_by = humanApproval.approvedBy || "Merchant Operator";
    upiCase.human_approved_at =
      humanApproval.approvedAt || new Date().toISOString();
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
    actor: actor || humanApproval?.approvedBy || "AUTONOMOUS_GUARDRAIL",
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

  // Notify registered merchant via Telegram
  await notifyMerchantRefundExecuted({
    caseId: upiCase.case_id,
    orderId: upiCase.order_id,
    refundId: refundResult.refund.id,
    amountPaise: upiCase.recommended_refund_paise,
    source: refundResult.source,
  });

  return {
    status: "ok",
    statusCode: 200,
    case: upiCase,
    refund: refundResult.refund,
    source: refundResult.source,
  };
}
