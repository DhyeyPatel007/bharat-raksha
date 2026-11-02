import { NextRequest, NextResponse } from "next/server";
import {
  getAllUpiCases,
  resetDemoCases,
  addUpiAuditLog,
} from "@/lib/upi/store-db";

export async function GET() {
  try {
    const cases = await getAllUpiCases();

    // Calculate metrics
    let autoResolvedCount = 0;
    let humanLockedCount = 0;
    let fraudPreventedPaise = 0;

    for (const c of cases) {
      if (c.status === "AUTO_REFUNDED") {
        autoResolvedCount++;
      } else if (c.status === "AWAITING_HUMAN_APPROVAL") {
        humanLockedCount++;
      } else if (c.verdict === "REJECT_CLAIM") {
        fraudPreventedPaise += c.claim_amount_paise;
      }
    }

    return NextResponse.json(
      {
        cases,
        metrics: {
          totalClaims: cases.length,
          autoResolvedCount,
          humanLockedCount,
          fraudPreventedPaise,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "reset") {
      await resetDemoCases();
      await addUpiAuditLog({
        case_id: "ALL",
        actor: "DEMO_OPERATOR",
        action_type: "DEMO_CASES_RESET",
        tool_called: "store-db.resetDemoCases",
        input_payload: {},
        output_payload: { reset: true },
        guardrail_check: { pass: true },
      });
      const resetCases = await getAllUpiCases();
      return NextResponse.json({ status: "reset_successful", cases: resetCases }, { status: 200 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

