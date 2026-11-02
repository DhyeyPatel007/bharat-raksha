// PHALANX UPI — End-to-End Localhost Acceptance Verifier
// Tests all 6 steps from prompt section 7 against a live running server on port 3100.

const base = process.env.PHALANX_BASE_URL || "http://localhost:3100";

async function testAcceptance() {
  console.log("=================================================");
  console.log(`Running Acceptance Verifier against ${base}`);
  console.log("=================================================\n");

  // Step 1: GET /api/upi/cases
  const resCases = await fetch(`${base}/api/upi/cases`);
  const casesData = await resCases.json();
  console.log(`[PASS] GET /api/upi/cases -> HTTP ${resCases.status}, count=${casesData.cases.length}`);
  if (casesData.cases.length !== 3) throw new Error("Expected 3 seeded cases");

  // Step 2: Case A verification
  const caseA = casesData.cases.find((c) => c.case_id === "UPI-CASE-A");
  console.log(`[PASS] Case A: score=${caseA.score}, verdict=${caseA.verdict}, status=${caseA.status}`);
  if (caseA.score !== 82 || caseA.verdict !== "REJECT_CLAIM") throw new Error("Case A mismatch");

  // Step 3: Case B verification
  const caseB = casesData.cases.find((c) => c.case_id === "UPI-CASE-B");
  console.log(
    `[PASS] Case B: score=${caseB.score}, verdict=${caseB.verdict}, refund=${caseB.recommended_refund_paise} paise`
  );
  if (caseB.score !== 60 || caseB.recommended_refund_paise !== 30000) throw new Error("Case B mismatch");

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

  // Step 6: Step 5 acceptance check — Unapproved refund on Case C MUST return 403!
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

  console.log("\n=================================================");
  console.log(">>> ALL LOCALHOST ACCEPTANCE CRITERIA PASSED 100% <<<");
  console.log("=================================================\n");
}

testAcceptance().catch((err) => {
  console.error("FATAL in acceptance check:", err);
  process.exit(1);
});
