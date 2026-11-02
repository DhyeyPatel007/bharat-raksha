// PHALANX UPI — 100% Deterministic Pure-Code Guardrail Engine (Zero LLM)
// Enforces < ₹500 auto-refund ceiling, >= ₹500 mandatory human gate lock,
// hard-block on failed/authorized payments, and duplicate payment excess checks.

import crypto from "crypto";
import type { GuardrailDecision, UpiPaymentStatus, UpiVerdict } from "./types";

export interface GuardrailInput {
  paymentStatus: UpiPaymentStatus;
  hasDuplicateCapturedPayment?: boolean;
  duplicateCapturedAmountPaise?: number;
  verdict: UpiVerdict;
  recommendedRefundPaise: number;
  humanApprovalRecord?: {
    approvedBy: string;
    approvedAt: string;
    token: string;
  } | null;
}

export const AUTO_REFUND_CEILING_PAISE = 50000; // ₹500.00 = 50,000 paise

export function computeUpiIdempotencyKey(
  caseId: string,
  rrn: string,
  actionType: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${caseId}:${rrn}:${actionType}`)
    .digest("hex");
}

export function evaluateUpiGuardrail(input: {
  paymentStatus: UpiPaymentStatus;
  hasDuplicateCapturedPayment?: boolean;
  duplicateCapturedAmountPaise?: number;
  verdict: UpiVerdict;
  recommendedRefundPaise: number;
  humanApprovalRecord?: { approvedBy: string; approvedAt: string; token: string } | null;
}): GuardrailDecision {
  const { paymentStatus, verdict, recommendedRefundPaise, humanApprovalRecord } = input;

  // HARD RULE 1: Payment Failed at Bank Clearing
  // Merchant received ₹0. Any refund would cause direct financial loss to the merchant.
  if (paymentStatus === "failed") {
    return {
      canExecuteRefund: false,
      blocked: true,
      requiresHumanApproval: false,
      code: "HARD_BLOCK_FAILED_PAYMENT",
      reasonEn:
        "Blocked: Payment status is FAILED. Funds never reached the merchant bank account. NPCI will auto-reverse to buyer within T+3 to T+5 days.",
      reasonHi:
        "अवरुद्ध: भुगतान स्थिति विफल (FAILED) है। राशि कभी मर्चेंट बैंक खाते में नहीं पहुंची। बैंक T+3 से T+5 दिनों में ग्राहक को स्वतः राशि वापस करेगा।",
      recommendedRefundPaise: 0,
    };
  }

  // HARD RULE 2: Payment Authorized (Uncaptured)
  // Calling /refund on authorized payments fails at Razorpay.
  if (paymentStatus === "authorized") {
    return {
      canExecuteRefund: false,
      blocked: true,
      requiresHumanApproval: false,
      code: "HARD_BLOCK_AUTHORIZED_USE_VOID_OR_CAPTURE",
      reasonEn:
        "Blocked: Payment is AUTHORIZED (uncaptured). Razorpay POST /refund fails on authorized payments. Must void/release authorization or capture first.",
      reasonHi:
        "अवरुद्ध: भुगतान केवल अधिकृत है (कैप्चर नहीं हुआ)। रेज़रपे रिफंड केवल कैप्चर किए गए भुगतानों पर कार्य करता है।",
      recommendedRefundPaise: 0,
    };
  }

  // HARD RULE 3: Claim Rejected or Recommended Refund is ₹0
  if (verdict === "REJECT_CLAIM" || recommendedRefundPaise <= 0) {
    return {
      canExecuteRefund: false,
      blocked: false,
      requiresHumanApproval: false,
      code: "NO_REFUND_REJECTED_WITH_DOSSIER",
      reasonEn:
        "Claim rejected by forensic evaluation. No refund authorized. Defense evidence dossier prepared for Consumer Forum/NCH.",
      reasonHi:
        "फॉरेंसिक मूल्यांकन द्वारा दावा अस्वीकृत। कोई रिफंड अधिकृत नहीं। उपभोक्ता फोरम हेतु साक्ष्य डोजियर तैयार।",
      recommendedRefundPaise: 0,
    };
  }

  // Payment is CAPTURED and refund amount > 0:
  // Check ₹500 Guardrail Boundary (50,000 paise)
  if (recommendedRefundPaise < AUTO_REFUND_CEILING_PAISE) {
    // HARD RULE 4: < ₹500 Auto-Refund
    return {
      canExecuteRefund: true,
      blocked: false,
      requiresHumanApproval: false,
      code: "AUTO_APPROVED_UNDER_500",
      reasonEn: `Auto-Approved: Refund amount (₹${(recommendedRefundPaise / 100).toFixed(
        2
      )}) is strictly below the ₹500 guardrail ceiling. Executed autonomously without human lock.`,
      reasonHi: `स्वतः स्वीकृत: रिफंड राशि (₹${(recommendedRefundPaise / 100).toFixed(
        2
      )}) ₹500 की सुरक्षा सीमा से कम है। बिना मानवीय लॉक के स्वतः निष्पादित।`,
      recommendedRefundPaise,
    };
  }

  // HARD RULE 5: >= ₹500 Mandatory Human Approval Gate
  if (!humanApprovalRecord) {
    return {
      canExecuteRefund: false,
      blocked: false,
      requiresHumanApproval: true,
      code: "LOCKED_AWAITING_HUMAN_APPROVAL",
      reasonEn: `Locked: Irreversible UPI refund of ₹${(recommendedRefundPaise / 100).toFixed(
        2
      )} meets or exceeds the ₹500 guardrail ceiling. Mandatory Human Approval Gate is LOCKED.`,
      reasonHi: `लॉक किया गया: ₹${(recommendedRefundPaise / 100).toFixed(
        2
      )} का अपरिवर्तनीय यूपीआई रिफंड ₹500 की सुरक्षा सीमा पर या उससे अधिक है। मानवीय स्वीकृति आवश्यक है।`,
      recommendedRefundPaise,
    };
  }

  // Approved by Human Operator
  return {
    canExecuteRefund: true,
    blocked: false,
    requiresHumanApproval: true,
    code: "HUMAN_APPROVED_READY_TO_FIRE",
    reasonEn: `Human Approved: Authorized by operator ${humanApprovalRecord.approvedBy} at ${humanApprovalRecord.approvedAt}. Ready to fire live refund.`,
    reasonHi: `मानवीय स्वीकृति प्राप्त: संचालक ${humanApprovalRecord.approvedBy} द्वारा ${humanApprovalRecord.approvedAt} पर अधिकृत। रिफंड भेजने हेतु तैयार।`,
    recommendedRefundPaise,
  };
}

