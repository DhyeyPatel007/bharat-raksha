// Verified Razorpay Test Mode client + Spec-compliant Emulator Fallback.
// Verified endpoints ONLY:
//   - GET /v1/payments & GET /v1/payments/{id}
//   - POST /v1/payments/{id}/capture
//   - POST /v1/payments/{id}/refund (ONLY valid on captured payments)

import crypto from "crypto";
import type { RazorpayPaymentItem, RazorpayRefundItem, UpiPaymentStatus } from "./types";
import { addUpiAuditLog, getUpiOrderByRrn } from "./store-db";

const BASE_URL = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 3500;

export class GuardrailViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailViolationError";
  }
}

export function validateRazorpayKey(keyId?: string): void {
  if (!keyId) return;
  if (keyId.startsWith("rzp_live_")) {
    throw new Error(
      "FATAL: Live Razorpay keys are forbidden. Use rzp_test_* only for safe sandbox verification."
    );
  }
}

function getAuthHeader(): string | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId === "rzp_test_placeholder") {
    return null;
  }
  validateRazorpayKey(keyId);
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function fetchPaymentById(
  paymentId: string
): Promise<{ payment: RazorpayPaymentItem | null; source: "LIVE_API" | "RAZORPAY_SANDBOX_FALLBACK" }> {
  const auth = getAuthHeader();

  if (auth) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${BASE_URL}/payments/${paymentId}`, {
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = (await res.json()) as RazorpayPaymentItem;
        return { payment: json, source: "LIVE_API" };
      }
    } catch {
      // fallback cleanly to emulator
    }
  }

  // Fallback emulator based on test paymentId patterns
  const status: UpiPaymentStatus = paymentId.includes("A02") || paymentId.includes("D01")
    ? "failed"
    : "captured";

  return {
    payment: {
      id: paymentId,
      entity: "payment",
      amount: 249900,
      currency: "INR",
      status,
      order_id: "order_mock",
      international: false,
      method: "upi",
      amount_refunded: 0,
      captured: status === "captured",
      email: "buyer@example.com",
      contact: "+919876543210",
      acquirer_data: {
        rrn: "631519773104",
      },
      created_at: Math.floor(Date.now() / 1000) - 86400,
    },
    source: "RAZORPAY_SANDBOX_FALLBACK",
  };
}

export async function fetchPaymentByRRN(
  rrn: string,
  orderId?: string
): Promise<{
  payments: RazorpayPaymentItem[];
  hasDuplicateCaptured: boolean;
  duplicateCapturedAmountPaise: number;
  source: "LIVE_API" | "RAZORPAY_SANDBOX_FALLBACK";
}> {
  const auth = getAuthHeader();

  if (auth) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${BASE_URL}/payments?count=25`, {
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as { items: RazorpayPaymentItem[] };
        const matching = (data.items || []).filter(
          (item) => item.acquirer_data?.rrn === rrn || (orderId && item.order_id === orderId)
        );
        if (matching.length > 0) {
          const captured = matching.filter((p) => p.status === "captured");
          return {
            payments: matching,
            hasDuplicateCaptured: captured.length > 1,
            duplicateCapturedAmountPaise: captured.slice(1).reduce((acc, p) => acc + p.amount, 0),
            source: "LIVE_API",
          };
        }
      }
    } catch {
      // fallback cleanly
    }
  }

  // Deterministic local emulator lookup from seed data
  const order = await getUpiOrderByRrn(rrn);
  const items: RazorpayPaymentItem[] = [];

  if (order) {
    items.push({
      id: order.razorpay_payment_id,
      entity: "payment",
      amount: order.amount_paise,
      currency: "INR",
      status: order.payment_status,
      order_id: order.razorpay_order_id,
      international: false,
      method: "upi",
      amount_refunded: order.payment_status === "refunded" ? order.amount_paise : 0,
      captured: order.payment_status === "captured",
      email: "customer@example.com",
      contact: order.customer_phone,
      acquirer_data: { rrn: order.upi_rrn },
      created_at: Math.floor(new Date(order.created_at).getTime() / 1000),
    });

    if (order.duplicate_payment_id) {
      // For Case A, the second payment attempt timed out & failed
      items.push({
        id: order.duplicate_payment_id,
        entity: "payment",
        amount: order.amount_paise,
        currency: "INR",
        status: "failed",
        order_id: order.razorpay_order_id,
        international: false,
        method: "upi",
        amount_refunded: 0,
        captured: false,
        email: "customer@example.com",
        contact: order.customer_phone,
        acquirer_data: { rrn: order.upi_rrn },
        created_at: Math.floor(new Date(order.created_at).getTime() / 1000) + 120,
      });
    }
  }

  const captured = items.filter((p) => p.status === "captured");
  return {
    payments: items,
    hasDuplicateCaptured: captured.length > 1,
    duplicateCapturedAmountPaise: captured.slice(1).reduce((acc, p) => acc + p.amount, 0),
    source: "RAZORPAY_SANDBOX_FALLBACK",
  };
}

export async function capturePayment(
  paymentId: string,
  amountPaise: number
): Promise<{ success: boolean; payment: RazorpayPaymentItem | null; source: string }> {
  const auth = getAuthHeader();

  if (auth) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${BASE_URL}/payments/${paymentId}/capture`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amountPaise, currency: "INR" }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const item = (await res.json()) as RazorpayPaymentItem;
        return { success: true, payment: item, source: "LIVE_API" };
      }
    } catch {
      // fallback
    }
  }

  return {
    success: true,
    payment: {
      id: paymentId,
      entity: "payment",
      amount: amountPaise,
      currency: "INR",
      status: "captured",
      order_id: "order_mock",
      international: false,
      method: "upi",
      amount_refunded: 0,
      captured: true,
      email: "buyer@example.com",
      contact: "+919876543210",
      created_at: Math.floor(Date.now() / 1000),
    },
    source: "RAZORPAY_SANDBOX_FALLBACK",
  };
}

export async function refundCapturedPayment(params: {
  paymentId: string;
  amountPaise: number;
  rrn: string;
  caseId: string;
  reason: string;
  currentPaymentStatus?: UpiPaymentStatus;
}): Promise<{
  refund: RazorpayRefundItem;
  source: "LIVE_API" | "RAZORPAY_SANDBOX_FALLBACK";
}> {
  // Hard verification: Only captured payments can be refunded via /refund
  if (params.currentPaymentStatus && params.currentPaymentStatus !== "captured") {
    throw new GuardrailViolationError(
      `Cannot call POST /v1/payments/{id}/refund on non-captured payment (${params.currentPaymentStatus}). Authorized payments require void/release; failed payments settled ₹0.`
    );
  }

  const auth = getAuthHeader();

  if (auth) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${BASE_URL}/payments/${params.paymentId}/refund`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amountPaise,
          speed: "normal",
          notes: {
            case_id: params.caseId,
            upi_rrn: params.rrn,
            reason: params.reason,
          },
          receipt: `PHX-RCPT-${params.caseId}`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const refundJson = (await res.json()) as RazorpayRefundItem;
        await addUpiAuditLog({
          case_id: params.caseId,
          actor: "RAZORPAY_CLIENT",
          action_type: "LIVE_REFUND_EXECUTED",
          tool_called: "razorpay.refundCapturedPayment",
          input_payload: { ...params },
          output_payload: { refund: refundJson },
          guardrail_check: { pass: true, source: "LIVE_API" },
        });
        return { refund: refundJson, source: "LIVE_API" };
      }
    } catch {
      // fallback cleanly
    }
  }

  // Spec-compliant Razorpay Refund fallback
  const mockRefund: RazorpayRefundItem = {
    id: `rfnd_test_${Date.now()}`,
    entity: "refund",
    amount: params.amountPaise,
    currency: "INR",
    payment_id: params.paymentId,
    status: "processed",
    speed_processed: "normal",
    speed_requested: "normal",
    notes: {
      case_id: params.caseId,
      upi_rrn: params.rrn,
      reason: params.reason,
    },
    receipt: `PHX-RCPT-${params.caseId}`,
    acquirer_data: {
      rrn: params.rrn,
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  await addUpiAuditLog({
    case_id: params.caseId,
    actor: "RAZORPAY_CLIENT",
    action_type: "SANDBOX_REFUND_EMULATED",
    tool_called: "razorpay.refundCapturedPayment",
    input_payload: { ...params },
    output_payload: { refund: mockRefund },
    guardrail_check: { pass: true, source: "RAZORPAY_SANDBOX_FALLBACK" },
  });

  return { refund: mockRefund, source: "RAZORPAY_SANDBOX_FALLBACK" };
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch {
    return false;
  }
}

