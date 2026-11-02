import { NextRequest, NextResponse } from "next/server";
import { fetchPaymentById, validateRazorpayKey } from "@/lib/upi/razorpay";
import { runUpiSwarm } from "@/lib/upi/jurors";
import { evaluateUpiGuardrail } from "@/lib/upi/guardrail";
import {
  addUpiAuditLog,
  getUpiCaseById,
  getUpiOrderByRrn,
  getUpiOrderById,
  saveUpiCase,
  saveUpiOrder,
} from "@/lib/upi/store-db";
import { sendMerchantClaimAlert } from "@/lib/upi/telegram";
import type { UpiCase, UpiOrder } from "@/lib/upi/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentId = (body.paymentId || "").trim();
    const rrn = (body.rrn || "").trim();
    const bodyOrderId = (body.orderId || "").trim();
    const claimType = body.claimType || "DAMAGED_ITEM";
    const buyerMessage =
      body.buyerMessage ||
      `Real Payment Intake: Claim regarding payment ${paymentId} with RRN ${rrn}`;

    if (!paymentId.startsWith("pay_")) {
      return NextResponse.json(
        { error: "Invalid Razorpay payment ID. Must start with pay_ (e.g. pay_N1x2Y3z...)" },
        { status: 400 }
      );
    }

    if (!/^\d{12}$/.test(rrn)) {
      return NextResponse.json(
        { error: "Invalid UPI RRN. Must be exactly 12 digits." },
        { status: 400 }
      );
    }

    // Verify key if present
    const keyId = process.env.RAZORPAY_KEY_ID;
    validateRazorpayKey(keyId);

    // Fetch live from Razorpay API or fallback emulator
    const { payment, source } = await fetchPaymentById(paymentId);

    let isMismatch = false;
    if (payment) {
      if (payment.acquirer_data?.rrn && payment.acquirer_data.rrn !== rrn) {
        isMismatch = true;
      }
      if (bodyOrderId && payment.order_id && payment.order_id !== bodyOrderId) {
        isMismatch = true;
      }
      if (bodyOrderId) {
        const orderById = await getUpiOrderById(bodyOrderId);
        if (orderById && orderById.upi_rrn !== rrn) {
          isMismatch = true;
        }
        const orderByRrn = await getUpiOrderByRrn(rrn);
        if (orderByRrn && orderByRrn.order_id !== bodyOrderId) {
          isMismatch = true;
        }
      }
    }

    if (!payment || isMismatch) {
      await addUpiAuditLog({
        case_id: "UNMATCHED",
        actor: "REAL_MODE_INTAKE",
        action_type: "UNMATCHED_CLAIM",
        tool_called: "order_lookup",
        input_payload: { paymentId, rrn, orderId: bodyOrderId, claimType, buyerMessage },
        output_payload: { status: "order_not_found" },
        guardrail_check: { pass: false, reason: "ORDER_NOT_FOUND" },
      });
      return NextResponse.json(
        {
          status: "order_not_found",
          error: "We couldn't find a payment with this RRN / order ID. Please check the 12-digit UPI RRN from your payment app and try again.",
        },
        { status: 404 }
      );
    }

    const orderId =
      payment.order_id ||
      bodyOrderId ||
      `ORD-${paymentId.slice(-8).toUpperCase()}`;

    // Record order in store
    const orderRecord: UpiOrder = {
      order_id: orderId,
      customer_phone: payment.contact || "+919876543210",
      customer_name: "Live Test Customer",
      amount_paise: payment.amount,
      upi_rrn: rrn,
      razorpay_payment_id: payment.id,
      razorpay_order_id: orderId,
      payment_status: payment.status,
      awb_code: null,
      warehouse_weight_kg: null,
      courier_weight_kg: null,
      otp_verified: false,
      created_at: new Date(payment.created_at * 1000).toISOString(),
    };
    await saveUpiOrder(orderRecord);

    const caseId =
      rrn === "631514892011"
        ? "UPI-CASE-A"
        : rrn === "631518440293"
        ? "UPI-CASE-B"
        : rrn === "631519773104"
        ? "UPI-CASE-C"
        : `UPI-CASE-${rrn.slice(-4)}`;

    const existingCase = await getUpiCaseById(caseId);
    if (existingCase) {
      return NextResponse.json(
        {
          status: "ok",
          alreadyExists: true,
          message: `A case for this RRN already exists — status: ${existingCase.status}.`,
          case: existingCase,
        },
        { status: 200 }
      );
    }

    // Run Swarm
    const swarmResult = await runUpiSwarm({
      orderId,
      rrn,
      claimAmountPaise: payment.amount,
      buyerMessage,
    });

    // Run Guardrail
    const guardrail = evaluateUpiGuardrail({
      paymentStatus: payment.status,
      verdict: swarmResult.verdict,
      recommendedRefundPaise: swarmResult.recommendedRefundPaise,
    });

    const newCase: UpiCase = {
      case_id: caseId,
      order_id: orderId,
      upi_rrn: rrn,
      claim_amount_paise: payment.amount,
      recommended_refund_paise: swarmResult.recommendedRefundPaise,
      claim_type: claimType,
      buyer_message_en: buyerMessage,
      buyer_message_hi: buyerMessage,
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
      human_approved_by: null,
      human_approved_at: null,
      razorpay_refund_id: null,
      reasoning_summary: swarmResult.reasoning,
      juror_reports: swarmResult.jurorReports,
      iteration_logs: swarmResult.iterationLogs,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      order_telemetry: orderRecord,
    };

    await saveUpiCase(newCase);
    await sendMerchantClaimAlert(newCase);

    await addUpiAuditLog({
      case_id: caseId,
      actor: "REAL_MODE_INTAKE",
      action_type: "LIVE_PAYMENT_INGESTED",
      tool_called: "real_mode_intake",
      input_payload: { paymentId, rrn, amount: payment.amount, claimType, buyerMessage },
      output_payload: {
        caseId,
        verdict: swarmResult.verdict,
        score: swarmResult.score,
        guardrailState: guardrail.code,
      },
      guardrail_check: { ...guardrail },
    });

    return NextResponse.json(
      {
        status: "ok",
        case: newCase,
        source,
        message: `Real payment intake completed successfully. Registered as ${caseId}.`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
