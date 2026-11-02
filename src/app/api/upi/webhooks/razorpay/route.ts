import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/upi/razorpay";
import {
  addUpiAuditLog,
  getIdempotentResult,
  setIdempotentResult,
} from "@/lib/upi/store-db";
import { computeUpiIdempotencyKey } from "@/lib/upi/guardrail";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "placeholder_webhook_secret";

    // Verify signature if secret configured and not placeholder
    if (secret && secret !== "placeholder_webhook_secret") {
      const isValid = verifyRazorpayWebhookSignature(rawBody, signature, secret);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    const event = (payload.event as string) || "unknown";
    const paymentEntity = (payload.payload as Record<string, unknown>)?.payment as Record<
      string,
      unknown
    > | undefined;
    const paymentItem = paymentEntity?.entity as Record<string, unknown> | undefined;

    const paymentId = (paymentItem?.id as string) || "unknown_pay";
    const rrn =
      ((paymentItem?.acquirer_data as Record<string, unknown>)?.rrn as string) || "unknown_rrn";

    // Server-side idempotency lock
    const idempotencyKey = computeUpiIdempotencyKey(paymentId, rrn, event);
    const existing = await getIdempotentResult(idempotencyKey);
    if (existing) {
      return NextResponse.json(
        { status: "ok", idempotent_replay: true, cached: existing },
        { status: 200 }
      );
    }

    // Record audit log
    const audit = await addUpiAuditLog({
      case_id: paymentId,
      actor: "RAZORPAY_WEBHOOK",
      action_type: event.toUpperCase(),
      tool_called: "api.webhooks.razorpay",
      input_payload: { event, paymentId, rrn },
      output_payload: { processed: true },
      guardrail_check: { pass: true },
      idempotency_key: idempotencyKey,
    });

    await setIdempotentResult(idempotencyKey, { processed: true, auditLogId: audit.log_id });

    return NextResponse.json({ status: "ok", event, paymentId }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

