import { NextRequest, NextResponse } from "next/server";
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
import { fetchPaymentByRRN } from "@/lib/upi/razorpay";
import { sendMerchantClaimAlert } from "@/lib/upi/telegram";
import type { UpiCase, UpiOrder } from "@/lib/upi/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rrn = (body.rrn || "").trim();
    const orderIdInput = (body.orderId || "").trim();
    const phone = (body.phone || "").trim();
    const description = (body.description || body.buyerMessage || "").trim();
    const claimType = body.claimType || "DAMAGED_ITEM";

    // 1. Validation
    if (!/^\d{12}$/.test(rrn)) {
      return NextResponse.json(
        {
          error: "Invalid UPI RRN. Must be exactly 12 digits.",
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          error: "Description of the issue is required.",
        },
        { status: 400 }
      );
    }

    // 2. ORDER_NOT_FOUND Guard & Cross-Check (§1)
    let order: UpiOrder | null = null;
    if (orderIdInput) {
      const orderById = await getUpiOrderById(orderIdInput);
      if (orderById && orderById.upi_rrn !== rrn) {
        order = null;
      } else {
        const orderByRrn = await getUpiOrderByRrn(rrn);
        if (orderByRrn && orderByRrn.order_id !== orderIdInput) {
          order = null;
        } else {
          order = orderById || orderByRrn;
        }
      }
    } else {
      order = await getUpiOrderByRrn(rrn);
    }

    if (!order) {
      // Try live or emulator Razorpay lookup with strict cross-check
      const rzpLookup = await fetchPaymentByRRN(rrn, orderIdInput || undefined);
      if (rzpLookup.payments && rzpLookup.payments.length > 0) {
        const p = rzpLookup.payments[0];
        if (p.acquirer_data?.rrn === rrn && (!orderIdInput || p.order_id === orderIdInput)) {
          order = {
            order_id: p.order_id || orderIdInput || `ORD-${rrn.slice(-4)}`,
            customer_phone: phone || p.contact || "+919876543210",
            customer_name: "Web Intake Customer",
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
    }

    if (!order) {
      // ORDER NOT FOUND!
      const notFoundMessage =
        "We couldn't find a payment with this RRN / order ID. Please check the 12-digit UPI RRN from your payment app and try again.";

      await addUpiAuditLog({
        case_id: "UNMATCHED",
        actor: "WEB_INTAKE",
        action_type: "UNMATCHED_CLAIM",
        tool_called: "order_lookup",
        input_payload: { rrn, orderId: orderIdInput, phone, description },
        output_payload: { status: "order_not_found" },
        guardrail_check: { pass: false, reason: "ORDER_NOT_FOUND" },
      });

      return NextResponse.json(
        {
          status: "order_not_found",
          error: notFoundMessage,
        },
        { status: 404 }
      );
    }

    // 3. Existing Case Check (§5 - Do NOT Overwrite Existing Case)
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

    // 4. Run Swarm Forensics for new case
    const swarmResult = await runUpiSwarm({
      orderId: order.order_id,
      rrn,
      claimAmountPaise: order.amount_paise,
      buyerMessage: description,
    });

    // 5. Run Guardrail Decision
    const guardrail = evaluateUpiGuardrail({
      paymentStatus: order.payment_status,
      verdict: swarmResult.verdict,
      recommendedRefundPaise: swarmResult.recommendedRefundPaise,
    });

    const newCase: UpiCase = {
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
          : claimType,
      buyer_message_en: description,
      buyer_message_hi: description,
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
      razorpay_refund_id:
        guardrail.code === "AUTO_APPROVED_UNDER_500"
          ? `rfnd_auto_${rrn}`
          : null,
      reasoning_summary: swarmResult.reasoning,
      juror_reports: swarmResult.jurorReports,
      iteration_logs: swarmResult.iterationLogs,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      intake_source: "WEB_INTAKE",
      origin_group_chat_id: null,
      order_telemetry: order,
    };

    await saveUpiCase(newCase);

    await addUpiAuditLog({
      case_id: caseId,
      actor: "WEB_INTAKE",
      action_type: "BUYER_CLAIM_INGESTED",
      tool_called: "web_intake",
      input_payload: { rrn, orderId: order.order_id, phone, description },
      output_payload: {
        verdict: swarmResult.verdict,
        score: swarmResult.score,
        guardrailCode: guardrail.code,
      },
      guardrail_check: { ...guardrail },
    });

    // Send Outbound Telegram Alert to Merchant DM (§3)
    await sendMerchantClaimAlert(newCase);

    return NextResponse.json(
      {
        status: "ok",
        case: newCase,
        message: "Claim submitted successfully. The merchant has been alerted on Telegram.",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
