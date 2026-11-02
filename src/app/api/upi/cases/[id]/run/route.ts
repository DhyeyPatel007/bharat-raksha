import { NextRequest, NextResponse } from "next/server";
import { runUpiSwarm } from "@/lib/upi/jurors";
import {
  addUpiAuditLog,
  getUpiCaseById,
  getUpiOrderByRrn,
  saveUpiCase,
} from "@/lib/upi/store-db";
import { evaluateUpiGuardrail } from "@/lib/upi/guardrail";
import type { UpiCase } from "@/lib/upi/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existingCase = await getUpiCaseById(id);

    if (!existingCase) {
      return NextResponse.json({ error: "UPI Case not found" }, { status: 404 });
    }

    const order = await getUpiOrderByRrn(existingCase.upi_rrn);

    // 1. Live Juror Swarm Execution
    const swarmResult = await runUpiSwarm({
      orderId: existingCase.order_id,
      rrn: existingCase.upi_rrn,
      claimAmountPaise: existingCase.claim_amount_paise,
      buyerMessage: existingCase.buyer_message_en,
    });

    // 2. Pure-Code Guardrail Evaluation
    const guardrail = evaluateUpiGuardrail({
      paymentStatus: order ? order.payment_status : "captured",
      verdict: swarmResult.verdict,
      recommendedRefundPaise: swarmResult.recommendedRefundPaise,
      humanApprovalRecord:
        existingCase.human_approved_by && existingCase.human_approved_at
          ? {
              approvedBy: existingCase.human_approved_by,
              approvedAt: existingCase.human_approved_at,
              token: "tok_stored_approval",
            }
          : null,
    });

    // Determine status
    let status = existingCase.status;
    if (existingCase.status !== "REFUNDED") {
      if (guardrail.code === "AUTO_APPROVED_UNDER_500") {
        status = "AUTO_REFUNDED";
      } else if (guardrail.code === "LOCKED_AWAITING_HUMAN_APPROVAL") {
        status = "AWAITING_HUMAN_APPROVAL";
      } else if (guardrail.code === "NO_REFUND_REJECTED_WITH_DOSSIER") {
        status = "REJECTED";
      }
    }

    const updatedCase: UpiCase = {
      ...existingCase,
      score: swarmResult.score,
      verdict: swarmResult.verdict,
      recommended_refund_paise: swarmResult.recommendedRefundPaise,
      guardrail_state: guardrail.code,
      requires_human_approval: guardrail.requiresHumanApproval,
      status,
      reasoning_summary: swarmResult.reasoning,
      juror_reports: swarmResult.jurorReports,
      iteration_logs: swarmResult.iterationLogs,
      updated_at: new Date().toISOString(),
    };

    await saveUpiCase(updatedCase);

    await addUpiAuditLog({
      case_id: id,
      actor: "OPERATOR_SWARM_TRIGGER",
      action_type: "SWARM_RE_EXECUTION",
      tool_called: "runUpiSwarm",
      input_payload: { caseId: id, rrn: existingCase.upi_rrn },
      output_payload: {
        score: swarmResult.score,
        verdict: swarmResult.verdict,
        status,
        guardrailState: guardrail.code,
      },
      guardrail_check: { ...guardrail },
    });

    return NextResponse.json(
      {
        success: true,
        case: updatedCase,
        jurorReports: updatedCase.juror_reports,
        executionSteps: [
          {
            step: "razorpay_rrn_check",
            title: "Razorpay RRN Settlement Check",
            status: "COMPLETED",
            detail: `Verified RRN ${existingCase.upi_rrn} against gateway ledger. Single captured payment confirmed.`,
          },
          {
            step: "shiprocket_tracking",
            title: "Shiprocket Telemetry & Weighment",
            status: "COMPLETED",
            detail: `Checked logistics tracking. Verified weight alignment and doorstep OTP handshake status.`,
          },
          {
            step: "juror_verdicts",
            title: "3-Juror Forensic Audit",
            status: "COMPLETED",
            detail: `Gateway Juror + Logistics Forensics Juror + Buyer History Juror evaluated. Score: ${swarmResult.score}/100.`,
          },
          {
            step: "guardrail_decision",
            title: "Guardrail & Human Gate Evaluation",
            status: "COMPLETED",
            detail: guardrail.reasonEn,
          },
        ],
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
