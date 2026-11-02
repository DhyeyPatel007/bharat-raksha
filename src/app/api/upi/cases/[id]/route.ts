import { NextRequest, NextResponse } from "next/server";
import { getUpiCaseById, getUpiAuditLogs } from "@/lib/upi/store-db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caseData = await getUpiCaseById(id);

    if (!caseData) {
      return NextResponse.json({ error: "UPI Case not found" }, { status: 404 });
    }

    const auditLogs = await getUpiAuditLogs(id);

    return NextResponse.json(
      {
        case: caseData,
        auditLogs,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

