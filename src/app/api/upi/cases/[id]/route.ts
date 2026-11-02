import { NextRequest, NextResponse } from "next/server";
import { getUpiCaseById, getUpiAuditLogs } from "@/lib/upi/store-db";
import { autoRunSwarmIfNeeded } from "@/lib/upi/jurors";
import { isLLMConfigured } from "@/lib/llm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shouldAutoRun = req.nextUrl.searchParams.get("autorun") !== "false";

    let caseData = await getUpiCaseById(id);

    if (!caseData) {
      return NextResponse.json({ error: "UPI Case not found" }, { status: 404 });
    }

    let ranAutoSwarm = false;
    if (shouldAutoRun && isLLMConfigured()) {
      const autoRes = await autoRunSwarmIfNeeded(id);
      caseData = autoRes.case;
      ranAutoSwarm = autoRes.ran;
    }

    const auditLogs = await getUpiAuditLogs(id);

    return NextResponse.json(
      {
        case: caseData,
        auditLogs,
        ranAutoSwarm,
        llmConfigured: isLLMConfigured(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

