import { NextRequest, NextResponse } from "next/server";
import { executeCaseRefund } from "@/lib/upi/refund-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, humanApproval } = body;

    const result = await executeCaseRefund({
      caseId,
      humanApproval,
      actor: humanApproval?.approvedBy || "OPERATOR_WEB_UI",
    });

    if (result.status === "error") {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          messageEn: result.messageEn,
          messageHi: result.messageHi,
        },
        { status: result.statusCode }
      );
    }

    if (result.idempotent_replay) {
      return NextResponse.json(
        {
          status: "ok",
          idempotent_replay: true,
          case: result.case,
          refund: result.refund,
          message: "Idempotent replay: Refund was already processed previously.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        case: result.case,
        refund: result.refund,
        source: result.source,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
