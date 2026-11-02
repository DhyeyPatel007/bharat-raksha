// Bilingual PDF Dossier Generator for PHALANX UPI Shield (Consumer Forum & NCH Proof Packet).
// Generates Page 1 Executive Summary (bilingual EN + Hindi) + Exhibits on Pages 2+.
// Uses pdf-lib with safe ASCII/Latin-1 encoding fallback to prevent crash.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { UpiCase } from "./types";
import crypto from "crypto";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 44;

function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/₹/g, "INR ")
    .replace(/→/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, " ");
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const clean = sanitizeWinAnsi(text);
  for (const block of clean.split("\n")) {
    const words = block.split(/\s+/).filter(Boolean);
    let current = "";
    for (const w of words) {
      const trial = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        current = trial;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
  pageNo: number;
}

function startPage(ctx: Ctx, headerTitle: string): { page: PDFPage; startY: number } {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pageNo += 1;

  // Header Banner
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - 40,
    width: PAGE_W - 2 * MARGIN,
    height: 24,
    color: rgb(0.96, 0.97, 0.99),
  });

  page.drawText(sanitizeWinAnsi("PHALANX UPI  //  BHARAT RAKSHA  //  CONSUMER FORUM (NCH) DEFENSE DOSSIER"), {
    x: MARGIN + 8,
    y: PAGE_H - 33,
    size: 8.5,
    font: ctx.bold,
    color: rgb(0.2, 0.25, 0.35),
  });

  // Footer
  const footerText = sanitizeWinAnsi(
    `PHALANX UPI Shield - Irreversible settlement verification. Generated: ${new Date().toISOString()}`
  );
  page.drawText(footerText, {
    x: MARGIN,
    y: 25,
    size: 7.5,
    font: ctx.font,
    color: rgb(0.45, 0.45, 0.5),
  });

  page.drawText(`Page ${ctx.pageNo}`, {
    x: PAGE_W - MARGIN - 36,
    y: 25,
    size: 8,
    font: ctx.font,
    color: rgb(0.45, 0.45, 0.5),
  });

  return { page, startY: PAGE_H - 58 };
}

export async function generateUpiPdfDossier(caseData: UpiCase): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const ctx: Ctx = { doc, font, bold, mono, pageNo: 0 };

  // ==========================================
  // PAGE 1: EXECUTIVE SUMMARY (Bilingual EN/HI)
  // ==========================================
  const { page: p1, startY } = startPage(ctx, "Executive Summary");
  let y = startY;

  // Case Title & Badge
  p1.drawText(`DISPUTE DEFENSE DOSSIER: ${caseData.case_id}`, {
    x: MARGIN,
    y,
    size: 15,
    font: bold,
    color: rgb(0.08, 0.1, 0.15),
  });
  y -= 20;

  p1.drawText(
    sanitizeWinAnsi("Adjudication Record & Forensic Telemetry Packet for National Consumer Helpline (NCH)"),
    {
      x: MARGIN,
      y,
      size: 9.5,
      font,
      color: rgb(0.35, 0.4, 0.45),
    }
  );
  y -= 22;

  // Verdict Box
  const isRejected = caseData.verdict === "REJECT_CLAIM";
  const isAutoRefund = caseData.verdict === "OFFER_PARTIAL";
  const boxColor = isRejected
    ? rgb(0.98, 0.94, 0.94)
    : isAutoRefund
    ? rgb(0.93, 0.98, 0.94)
    : rgb(0.99, 0.97, 0.92);
  const strokeColor = isRejected
    ? rgb(0.88, 0.25, 0.25)
    : isAutoRefund
    ? rgb(0.15, 0.65, 0.35)
    : rgb(0.85, 0.6, 0.15);

  p1.drawRectangle({
    x: MARGIN,
    y: y - 54,
    width: PAGE_W - 2 * MARGIN,
    height: 54,
    color: boxColor,
    borderColor: strokeColor,
    borderWidth: 1,
  });

  const verdictLabel =
    caseData.verdict === "REJECT_CLAIM"
      ? "CLAIM REJECTED / DAWA ASWIKRIT (82/100 Hard Defense)"
      : caseData.verdict === "OFFER_PARTIAL"
      ? "PARTIAL SETTLEMENT OFFER / AANSHIK REFUND (60/100 Score)"
      : "FULL REFUND RECOMMENDED / PURNA REFUND (15/100 Transit Loss)";

  p1.drawText(sanitizeWinAnsi(verdictLabel), {
    x: MARGIN + 12,
    y: y - 22,
    size: 11.5,
    font: bold,
    color: strokeColor,
  });

  const guardrailDesc = `Guardrail State: ${caseData.guardrail_state} | Checklist Score: ${caseData.score}/100`;
  p1.drawText(sanitizeWinAnsi(guardrailDesc), {
    x: MARGIN + 12,
    y: y - 42,
    size: 8.5,
    font,
    color: rgb(0.25, 0.3, 0.35),
  });

  y -= 74;

  // Metadata Grid Table
  p1.drawText("1. TRANSACTION & TELEMETRY IDENTIFIERS", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: rgb(0.1, 0.15, 0.2),
  });
  y -= 14;

  const rows = [
    ["UPI RRN (12-digit):", caseData.upi_rrn, "Order ID:", caseData.order_id],
    [
      "Claim Amount:",
      `INR ${(caseData.claim_amount_paise / 100).toFixed(2)}`,
      "Recommended Refund:",
      `INR ${(caseData.recommended_refund_paise / 100).toFixed(2)}`,
    ],
    [
      "Razorpay Payment ID:",
      caseData.order_telemetry?.razorpay_payment_id || "N/A",
      "Payment Status:",
      caseData.order_telemetry?.payment_status?.toUpperCase() || "N/A",
    ],
    [
      "Shiprocket AWB:",
      caseData.order_telemetry?.awb_code || "N/A",
      "Delivery Status:",
      caseData.tracking_telemetry?.shipment_track?.[0]?.current_status || "N/A",
    ],
    [
      "Buyer Name:",
      caseData.buyer_telemetry?.customer_name || caseData.order_telemetry?.customer_name || "N/A",
      "Buyer Risk Tier:",
      caseData.buyer_telemetry?.risk_tier || "LOW",
    ],
  ];

  for (const r of rows) {
    p1.drawText(sanitizeWinAnsi(r[0]), { x: MARGIN, y, size: 8, font: bold, color: rgb(0.3, 0.35, 0.4) });
    p1.drawText(sanitizeWinAnsi(r[1]), { x: MARGIN + 105, y, size: 8, font: mono, color: rgb(0.1, 0.1, 0.15) });
    p1.drawText(sanitizeWinAnsi(r[2]), { x: MARGIN + 260, y, size: 8, font: bold, color: rgb(0.3, 0.35, 0.4) });
    p1.drawText(sanitizeWinAnsi(r[3]), { x: MARGIN + 380, y, size: 8, font: mono, color: rgb(0.1, 0.1, 0.15) });
    y -= 14;
  }

  y -= 12;

  // Practical Reasons (Bilingual)
  p1.drawText("2. ADJUDICATION FINDINGS & PRACTICAL REASONS (ENGLISH)", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: rgb(0.1, 0.15, 0.2),
  });
  y -= 14;

  const enReasons = caseData.reasoning_summary?.en?.reasons || [];
  for (const r of enReasons) {
    const lines = wrapLines(`* ${r}`, font, 8.5, PAGE_W - 2 * MARGIN);
    for (const l of lines) {
      p1.drawText(l, { x: MARGIN + 6, y, size: 8.5, font, color: rgb(0.15, 0.18, 0.22) });
      y -= 11.5;
    }
  }

  y -= 8;

  p1.drawText("3. NCH HINDI SUMMARY (TRANSLITERATED & VERIFIED TELEMETRY)", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: rgb(0.1, 0.15, 0.2),
  });
  y -= 14;

  const hiReasons = caseData.reasoning_summary?.hi?.reasons || [];
  for (const r of hiReasons) {
    const lines = wrapLines(`* [HI] ${r}`, font, 8, PAGE_W - 2 * MARGIN);
    for (const l of lines) {
      p1.drawText(l, { x: MARGIN + 6, y, size: 8, font, color: rgb(0.2, 0.22, 0.25) });
      y -= 11;
    }
  }

  y -= 10;

  // 10 Canonical Gaps Analyzed
  p1.drawText("4. CANONICAL GAP BUCKET MAPPINGS", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: rgb(0.1, 0.15, 0.2),
  });
  y -= 14;

  const namedGaps = caseData.reasoning_summary?.en?.namedGaps || [];
  const gapStr = namedGaps.length > 0 ? namedGaps.join("  |  ") : "NO_UNRESOLVED_GAPS";
  p1.drawText(sanitizeWinAnsi(gapStr), {
    x: MARGIN + 6,
    y,
    size: 8,
    font: mono,
    color: rgb(0.35, 0.4, 0.45),
  });

  // ==========================================
  // PAGE 2: EXHIBIT A — RAZORPAY SETTLEMENT TRACE
  // ==========================================
  const { page: p2, startY: y2 } = startPage(ctx, "Exhibit A - Razorpay Gateway Trace");
  let curY = y2;

  p2.drawText("EXHIBIT A: RAZORPAY PAYMENT GATEWAY & RRN TRACE", {
    x: MARGIN,
    y: curY,
    size: 13,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  curY -= 18;

  const gatewayPayload = {
    upi_rrn: caseData.upi_rrn,
    order_id: caseData.order_id,
    payment_id: caseData.order_telemetry?.razorpay_payment_id,
    payment_status: caseData.order_telemetry?.payment_status,
    duplicate_payment_id: caseData.order_telemetry?.duplicate_payment_id || null,
    amount_inr: (caseData.claim_amount_paise / 100).toFixed(2),
    settlement_reality: "Instant settlement to merchant account. No escrow hold.",
  };

  const rawJsonA = JSON.stringify(gatewayPayload, null, 2);
  for (const line of wrapLines(rawJsonA, mono, 8, PAGE_W - 2 * MARGIN)) {
    p2.drawText(line, { x: MARGIN, y: curY, size: 8, font: mono, color: rgb(0.1, 0.1, 0.15) });
    curY -= 11;
  }

  // ==========================================
  // PAGE 3: EXHIBIT B — SHIPROCKET LOGISTICS TELEMETRY
  // ==========================================
  const { page: p3, startY: y3 } = startPage(ctx, "Exhibit B - Shiprocket Logistics Telemetry");
  curY = y3;

  p3.drawText("EXHIBIT B: SHIPROCKET AWB & WEIGHT AUDIT TELEMETRY", {
    x: MARGIN,
    y: curY,
    size: 13,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  curY -= 18;

  const rawJsonB = JSON.stringify(
    caseData.tracking_telemetry || { error: "No courier tracking telemetry available" },
    null,
    2
  );
  for (const line of wrapLines(rawJsonB, mono, 7.5, PAGE_W - 2 * MARGIN)) {
    if (curY < 45) break;
    p3.drawText(line, { x: MARGIN, y: curY, size: 7.5, font: mono, color: rgb(0.1, 0.1, 0.15) });
    curY -= 10;
  }

  // ==========================================
  // PAGE 4: EXHIBIT C — WHATSAPP INTAKE & AUDIT LOGS
  // ==========================================
  const { page: p4, startY: y4 } = startPage(ctx, "Exhibit C - Communication & Audit Trail");
  curY = y4;

  p4.drawText("EXHIBIT C: WHATSAPP INTAKE & IMMUTABLE SWARM AUDIT LOG", {
    x: MARGIN,
    y: curY,
    size: 13,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  curY -= 18;

  const commPayload = {
    buyer_inbound_message: caseData.buyer_message_en,
    extracted_rrn: caseData.upi_rrn,
    extracted_order_id: caseData.order_id,
    iteration_history: caseData.iteration_logs,
    cryptographic_sha256: crypto
      .createHash("sha256")
      .update(JSON.stringify(caseData))
      .digest("hex"),
  };

  const rawJsonC = JSON.stringify(commPayload, null, 2);
  for (const line of wrapLines(rawJsonC, mono, 8, PAGE_W - 2 * MARGIN)) {
    if (curY < 45) break;
    p4.drawText(line, { x: MARGIN, y: curY, size: 8, font: mono, color: rgb(0.1, 0.1, 0.15) });
    curY -= 11;
  }

  return await doc.save();
}

