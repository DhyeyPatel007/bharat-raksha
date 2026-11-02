import { NextRequest, NextResponse } from "next/server";
import { getUpiCaseById } from "@/lib/upi/store-db";
import { generateUpiPdfDossier } from "@/lib/upi/pdf-dossier";

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

    const pdfBytes = await generateUpiPdfDossier(caseData);

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="phalanx-upi-dossier-${id}.pdf"`,
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

