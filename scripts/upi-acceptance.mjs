// BharatRaksha UPI — End-to-End Acceptance Verifier
// Tests all API and frontend routes against a live running server.

const base = process.env.PHALANX_BASE_URL || process.env.BASE_URL || "http://localhost:3100";

async function testAcceptance() {
  console.log("=================================================");
  console.log(`Running Acceptance Verifier against ${base}`);
  console.log("=================================================\n");

  // Step 1: GET /api/upi/cases
  const resCases = await fetch(`${base}/api/upi/cases`);
  const casesData = await resCases.json();
  console.log(`[PASS] GET /api/upi/cases -> HTTP ${resCases.status}, count=${casesData.cases.length}`);
  if (casesData.cases.length < 3) throw new Error("Expected at least 3 seeded cases");

  // Step 2: Case A verification
  const caseA = casesData.cases.find((c) => c.case_id === "UPI-CASE-A");
  console.log(`[PASS] Case A: score=${caseA.score}, verdict=${caseA.verdict}, status=${caseA.status}`);
  if (caseA.score !== 82 || caseA.verdict !== "REJECT_CLAIM") throw new Error("Case A mismatch");

  // Step 3: Case B verification
  const caseB = casesData.cases.find((c) => c.case_id === "UPI-CASE-B");
  console.log(
    `[PASS] Case B: score=${caseB.score}, verdict=${caseB.verdict}, refund=${caseB.recommended_refund_paise} paise, status=${caseB.status}`
  );
  if (caseB.score !== 60 || caseB.recommended_refund_paise !== 30000 || caseB.status !== "AWAITING_HUMAN_APPROVAL") {
    throw new Error(`Case B mismatch: score=${caseB.score}, refund=${caseB.recommended_refund_paise}, status=${caseB.status}`);
  }

  // Step 4: Case C initial state verification
  const caseC = casesData.cases.find((c) => c.case_id === "UPI-CASE-C");
  console.log(`[PASS] Case C: score=${caseC.score}, verdict=${caseC.verdict}, status=${caseC.status}`);
  if (caseC.score !== 15 || caseC.status !== "AWAITING_HUMAN_APPROVAL") throw new Error("Case C mismatch");

  // Step 5: PDF generation check
  const resPdf = await fetch(`${base}/api/upi/cases/UPI-CASE-A/dossier.pdf`);
  console.log(
    `[PASS] PDF download: HTTP ${resPdf.status}, content-type: ${resPdf.headers.get("content-type")}`
  );
  if (resPdf.status !== 200 || !resPdf.headers.get("content-type")?.includes("pdf")) {
    throw new Error("PDF route failed");
  }

  // Step 6: Unapproved refund on Case C MUST return 403
  const resUnapproved = await fetch(`${base}/api/upi/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId: "UPI-CASE-C" }),
  });
  const unapprovedData = await resUnapproved.json();
  console.log(
    `[PASS] Unapproved Case C refund -> HTTP ${resUnapproved.status} (${unapprovedData.error})`
  );
  if (
    resUnapproved.status !== 403 ||
    unapprovedData.error !== "GUARDRAIL_HUMAN_APPROVAL_REQUIRED"
  ) {
    throw new Error(`Expected 403 GUARDRAIL_HUMAN_APPROVAL_REQUIRED, got ${resUnapproved.status}`);
  }

  // Step 7: Approved refund on Case C
  const resApproved = await fetch(`${base}/api/upi/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "UPI-CASE-C",
      humanApproval: {
        approvedBy: "Lead Operator",
        approvedAt: new Date().toISOString(),
        token: "tok_test_demo",
      },
    }),
  });
  const approvedData = await resApproved.json();
  console.log(
    `[PASS] Approved Case C refund -> HTTP ${resApproved.status}, status=${approvedData.case?.status}, refundId=${approvedData.refund?.id}`
  );
  if (resApproved.status !== 200 || approvedData.case?.status !== "REFUNDED") {
    throw new Error("Approved refund failed");
  }

  // Step 8: Idempotency lock test (replay same refund)
  const resReplay = await fetch(`${base}/api/upi/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "UPI-CASE-C",
      humanApproval: {
        approvedBy: "Lead Operator",
        approvedAt: new Date().toISOString(),
        token: "tok_test_demo",
      },
    }),
  });
  const replayData = await resReplay.json();
  console.log(
    `[PASS] Idempotent replay -> HTTP ${resReplay.status}, idempotent_replay=${replayData.idempotent_replay}`
  );
  if (!replayData.idempotent_replay) throw new Error("Expected idempotent_replay true");

  // Step 9: Reset Demo Cases
  const resReset = await fetch(`${base}/api/upi/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
  console.log(`[PASS] Reset demo status: HTTP ${resReset.status}`);
  const resetCaseC = (await (await fetch(`${base}/api/upi/cases/UPI-CASE-C`)).json()).case;
  console.log(
    `[PASS] Reset Case C status: ${resetCaseC.status} (expected AWAITING_HUMAN_APPROVAL)`
  );
  if (resetCaseC.status !== "AWAITING_HUMAN_APPROVAL") {
    throw new Error("Reset failed to restore Amber status");
  }

  // Step 10: Failed-Payment Guardrail Negative Test
  const resFailed = await fetch(`${base}/api/upi/webhooks/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Order ORD-KRY-8804 failed, RRN 631510009988 refund now",
      phone: "+919899112233",
    }),
  });
  const failedData = await resFailed.json();
  const failedCase = failedData.cases?.[0];
  console.log(
    `[PASS] Failed-Payment webhook -> HTTP ${resFailed.status}, guardrail_state=${failedCase?.guardrail_state}`
  );
  if (failedCase?.guardrail_state !== "HARD_BLOCK_FAILED_PAYMENT") {
    throw new Error("Expected HARD_BLOCK_FAILED_PAYMENT");
  }

  // Step 10b: Telegram Bot Webhook Intake Test (valid RRN)
  const resTelegram = await fetch(`${base}/api/upi/webhooks/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Order ORD-KRY-8802 with RRN 631518440293 has scratch on panel",
      chatId: "9845102931",
    }),
  });
  const tgData = await resTelegram.json();
  console.log(`[PASS] Telegram Bot Webhook -> HTTP ${resTelegram.status}, status=${tgData.status}`);
  if (resTelegram.status !== 200 || tgData.status !== "ok") {
    throw new Error("Telegram Bot webhook check failed");
  }

  // Step 11: Shiprocket Mock Server check
  const resMockSR = await fetch(
    `${base}/api/upi/mock-shiprocket/v1/external/courier/track/awb/AWB-SR-990101`
  );
  const mockSRData = await resMockSR.json();
  const awbStatus = mockSRData.tracking_data?.shipment_track?.[0]?.current_status;
  console.log(`[PASS] Shiprocket Mock Server -> HTTP ${resMockSR.status}, AWB status=${awbStatus}`);
  if (resMockSR.status !== 200 || awbStatus !== "DELIVERED") {
    throw new Error("Shiprocket mock server check failed");
  }

  // Step 12: Landing page loads at `/` (200, BharatRaksha, no PHALANX text)
  const resLanding = await fetch(`${base}/`);
  const landingHtml = await resLanding.text();
  console.log(`[PASS] GET / -> HTTP ${resLanding.status}`);
  if (resLanding.status !== 200) throw new Error("Landing page / failed to load");
  if (!landingHtml.includes("BharatRaksha")) throw new Error("Landing page missing BharatRaksha brand");
  if (landingHtml.includes("PHALANX")) throw new Error("Landing page contains forbidden PHALANX text");

  // Step 13: Dashboard loads at `/dashboard`
  const resDashboard = await fetch(`${base}/dashboard`);
  const dashboardHtml = await resDashboard.text();
  console.log(`[PASS] GET /dashboard -> HTTP ${resDashboard.status}`);
  if (resDashboard.status !== 200) throw new Error("Dashboard failed to load");
  if (!dashboardHtml.includes("BharatRaksha")) throw new Error("Dashboard missing BharatRaksha");

  // Step 14: `/how-to-use` and `/terms` load (200)
  const resGuide = await fetch(`${base}/how-to-use`);
  console.log(`[PASS] GET /how-to-use -> HTTP ${resGuide.status}`);
  if (resGuide.status !== 200) throw new Error("/how-to-use failed to load");

  const resTerms = await fetch(`${base}/terms`);
  console.log(`[PASS] GET /terms -> HTTP ${resTerms.status}`);
  if (resTerms.status !== 200) throw new Error("/terms failed to load");

  // Step 15: `/raise-issue` page loads
  const resRaise = await fetch(`${base}/raise-issue`);
  console.log(`[PASS] GET /raise-issue -> HTTP ${resRaise.status}`);
  if (resRaise.status !== 200) throw new Error("/raise-issue page failed to load");

  // Step 16: Web intake rejects unknown RRN (ORDER_NOT_FOUND guard)
  const resWebUnknown = await fetch(`${base}/api/upi/cases/web-intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rrn: "000999888777",
      description: "Non-existent payment test",
    }),
  });
  const unknownData = await resWebUnknown.json();
  console.log(`[PASS] Web Intake unknown RRN -> HTTP ${resWebUnknown.status} (${unknownData.status})`);
  if (resWebUnknown.status !== 404 || unknownData.status !== "order_not_found") {
    throw new Error(`Expected 404 order_not_found, got ${resWebUnknown.status}`);
  }

  // Step 16b: §1 Cross-Check: Web intake rejects unknown RRN with known Order ID (404)
  const resCrossCheck = await fetch(`${base}/api/upi/cases/web-intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rrn: "999999999999",
      orderId: "ORD-KRY-8802",
      description: "Spoofed cross-check test",
    }),
  });
  const crossData = await resCrossCheck.json();
  console.log(`[PASS] §1 Cross-check (unknown RRN + known order) -> HTTP ${resCrossCheck.status} (${crossData.status})`);
  if (resCrossCheck.status !== 404 || crossData.status !== "order_not_found") {
    throw new Error(`Expected 404 order_not_found on cross-check mismatch, got ${resCrossCheck.status}`);
  }

  // Step 17: Web intake submits valid case
  const resWebValid = await fetch(`${base}/api/upi/cases/web-intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rrn: "631518440293",
      orderId: "ORD-KRY-8802",
      description: "Item scratched in shipping transit",
      phone: "+919876543210",
    }),
  });
  const validData = await resWebValid.json();
  console.log(`[PASS] Web Intake valid RRN -> HTTP ${resWebValid.status}, caseId=${validData.case?.case_id}`);
  if (![200, 201].includes(resWebValid.status) || validData.status !== "ok" || !validData.case) {
    throw new Error(`Expected 200/201 ok for valid web intake, got ${resWebValid.status}`);
  }

  console.log("\n=================================================");
  console.log(">>> ALL LOCALHOST ACCEPTANCE CRITERIA PASSED 100% <<<");
  console.log("=================================================\n");
}

testAcceptance().catch((err) => {
  console.error("FATAL in acceptance check:", err);
  process.exit(1);
});
