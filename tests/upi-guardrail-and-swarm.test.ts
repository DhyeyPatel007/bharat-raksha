// PHALANX UPI — Unit & Negative Test Suite
// Verifies: Guardrail < ₹500 auto-approve, >= ₹500 human lock, hard blocks on failed/authorized,
// 12-digit RRN extraction, Order ID extraction, Cases A/B/C deterministic verdicts, and bilingual dictionary.

import assert from "node:assert/strict";
import {
  evaluateUpiGuardrail,
  computeUpiIdempotencyKey,
  AUTO_REFUND_CEILING_PAISE,
} from "../src/lib/upi/guardrail";
import {
  extractUpiClaimData,
} from "../src/lib/upi/whatsapp";
import { extractTelegramClaimData } from "../src/lib/upi/telegram";
import {
  validateRazorpayKey,
  GuardrailViolationError,
  refundCapturedPayment,
} from "../src/lib/upi/razorpay";
import { trackAwb } from "../src/lib/upi/shiprocket";
import { runUpiSwarm, validateJurorReply } from "../src/lib/upi/jurors";
import { isLLMConfigured } from "../src/lib/llm";
import { STRINGS } from "../src/lib/i18n";

let passed = 0;
let total = 0;

function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passed++;
        console.log(`PASS  ${name}`);
      });
    }
    passed++;
    console.log(`PASS  ${name}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL  ${name} -> ${msg}`);
    throw err;
  }
}

async function runAll() {
  console.log("\n=======================================================");
  console.log("PHALANX UPI SHIELD — AUTOMATED TEST SUITE");
  console.log("=======================================================\n");

  // 1. Guardrail Hard Block Rule 1: Failed payment
  test("Guardrail: failed payment is hard-blocked (funds never settled)", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "failed",
      verdict: "APPROVE_REFUND",
      recommendedRefundPaise: 150000,
    });
    assert.equal(res.blocked, true);
    assert.equal(res.canExecuteRefund, false);
    assert.equal(res.code, "HARD_BLOCK_FAILED_PAYMENT");
    assert.match(res.reasonEn, /FAILED/);
    assert.match(res.reasonHi, /विफल/);
  });

  // 2. Guardrail Hard Block Rule 2: Authorized payment
  test("Guardrail: authorized payment is hard-blocked (cannot call /refund)", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "authorized",
      verdict: "APPROVE_REFUND",
      recommendedRefundPaise: 200000,
    });
    assert.equal(res.blocked, true);
    assert.equal(res.canExecuteRefund, false);
    assert.equal(res.code, "HARD_BLOCK_AUTHORIZED_USE_VOID_OR_CAPTURE");
    assert.match(res.reasonEn, /AUTHORIZED/);
    assert.match(res.reasonHi, /अधिकृत/);
  });

  // 3. Guardrail Hard Block Rule 3: Reject Claim
  test("Guardrail: REJECT_CLAIM produces NO_REFUND_REJECTED_WITH_DOSSIER", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "captured",
      verdict: "REJECT_CLAIM",
      recommendedRefundPaise: 0,
    });
    assert.equal(res.canExecuteRefund, false);
    assert.equal(res.blocked, false);
    assert.equal(res.code, "NO_REFUND_REJECTED_WITH_DOSSIER");
  });

  // 4. Guardrail Hard Rule 4: Mandatory Human Approval Before Every Refund (Default 0 Auto-Refund Ceiling)
  test("Guardrail: ₹300 (30,000 paise) locks awaiting human approval under default 0 auto-refund ceiling", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "captured",
      verdict: "OFFER_PARTIAL",
      recommendedRefundPaise: 30000, // ₹300
    });
    assert.equal(res.canExecuteRefund, false);
    assert.equal(res.requiresHumanApproval, true);
    assert.equal(res.code, "LOCKED_AWAITING_HUMAN_APPROVAL");
    assert.equal(res.recommendedRefundPaise, 30000);
  });

  test("Guardrail: boundary test ₹499.99 (49,999 paise) locks awaiting human approval under default 0 ceiling", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "captured",
      verdict: "OFFER_PARTIAL",
      recommendedRefundPaise: 49999,
    });
    assert.equal(res.canExecuteRefund, false);
    assert.equal(res.requiresHumanApproval, true);
    assert.equal(res.code, "LOCKED_AWAITING_HUMAN_APPROVAL");
  });

  test("Guardrail: ₹300 unlocks when human approval record is present", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "captured",
      verdict: "OFFER_PARTIAL",
      recommendedRefundPaise: 30000,
      humanApprovalRecord: {
        approvedBy: "Ops Lead",
        approvedAt: new Date().toISOString(),
        token: "tok_test_case_b",
      },
    });
    assert.equal(res.canExecuteRefund, true);
    assert.equal(res.requiresHumanApproval, true);
    assert.equal(res.code, "HUMAN_APPROVED_READY_TO_FIRE");
  });

  // 5. Guardrail Hard Rule 5: >= ₹500 Human Approval Gate
  test("Guardrail: >= ₹500 boundary test (50,000 paise = ₹500.00) locks awaiting human approval", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "captured",
      verdict: "APPROVE_REFUND",
      recommendedRefundPaise: 50000, // ₹500
      humanApprovalRecord: null,
    });
    assert.equal(res.canExecuteRefund, false);
    assert.equal(res.requiresHumanApproval, true);
    assert.equal(res.code, "LOCKED_AWAITING_HUMAN_APPROVAL");
  });

  test("Guardrail: ₹2,499 (249,900 paise) locks awaiting human approval when unapproved", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "captured",
      verdict: "APPROVE_REFUND",
      recommendedRefundPaise: 249900,
      humanApprovalRecord: null,
    });
    assert.equal(res.canExecuteRefund, false);
    assert.equal(res.requiresHumanApproval, true);
    assert.equal(res.code, "LOCKED_AWAITING_HUMAN_APPROVAL");
  });

  test("Guardrail: ₹2,499 unlocks when human approval record is present", () => {
    const res = evaluateUpiGuardrail({
      paymentStatus: "captured",
      verdict: "APPROVE_REFUND",
      recommendedRefundPaise: 249900,
      humanApprovalRecord: {
        approvedBy: "Ops Lead",
        approvedAt: new Date().toISOString(),
        token: "tok_test_123",
      },
    });
    assert.equal(res.canExecuteRefund, true);
    assert.equal(res.requiresHumanApproval, true);
    assert.equal(res.code, "HUMAN_APPROVED_READY_TO_FIRE");
  });

  // 6. Regex Extraction Tests
  test("WhatsApp Parser: extracts 12-digit UPI RRN cleanly", () => {
    const text =
      "I paid using GPay RRN 631514892011 for my order ORD-KRY-8801 yesterday.";
    const data = extractUpiClaimData({
      from: "+919820199482",
      id: "msg_01",
      timestamp: "123456",
      type: "text",
      text: { body: text },
    });
    assert.equal(data.rrn, "631514892011");
    assert.equal(data.orderId, "ORD-KRY-8801");
  });

  test("WhatsApp Parser: ignores invalid RRNs (11 or 13 digits)", () => {
    const text = "Bad RRN 12345678901 and 1234567890123 with ORD-123";
    const data = extractUpiClaimData({
      from: "+919820199482",
      id: "msg_02",
      timestamp: "123456",
      type: "text",
      text: { body: text },
    });
    assert.equal(data.rrn, null);
    assert.equal(data.orderId, "ORD-123");
  });

  // 6b. Telegram Regex Extraction Tests
  test("Telegram Parser: extracts 12-digit UPI RRN cleanly", () => {
    const text = "Order ORD-KRY-8802 damaged, UPI RRN 631518440293 paid via PhonePe";
    const data = extractTelegramClaimData({
      text,
      chat: { id: 9845102931 },
    });
    assert.equal(data.rrn, "631518440293");
    assert.equal(data.orderId, "ORD-KRY-8802");
  });

  test("Telegram Parser: extracts Order ID cleanly", () => {
    const text = "Hello support, I need help with ORD-ABC-9922";
    const data = extractTelegramClaimData({
      text,
      chat: { id: 9811204859 },
    });
    assert.equal(data.orderId, "ORD-ABC-9922");
    assert.equal(data.rrn, null);
  });

  test("Telegram Parser: ignores invalid RRNs (11 or 13 digits)", () => {
    const text = "Invalid RRNs: 12345678901 and 1234567890123 for ORD-101";
    const data = extractTelegramClaimData({
      text,
      chat: { id: 12345 },
    });
    assert.equal(data.rrn, null);
    assert.equal(data.orderId, "ORD-101");
  });

  // 7. Razorpay Key & Security
  test("Razorpay Client: rejects live keys (rzp_live_*) with fatal error", () => {
    assert.throws(
      () => validateRazorpayKey("rzp_live_99887766554433"),
      /FATAL: Live Razorpay keys are forbidden/
    );
  });

  test("Razorpay Client: accepts test keys (rzp_test_*)", () => {
    assert.doesNotThrow(() => validateRazorpayKey("rzp_test_abc123456789"));
  });

  test("Razorpay Client: refundCapturedPayment throws GuardrailViolationError on failed payment", async () => {
    await assert.rejects(
      async () => {
        await refundCapturedPayment({
          paymentId: "pay_test_failed",
          amountPaise: 100000,
          rrn: "631510009988",
          caseId: "UPI-CASE-D",
          reason: "Test",
          currentPaymentStatus: "failed",
        });
      },
      GuardrailViolationError
    );
  });

  // 8. Shiprocket AWB Parser & Mock
  await test("Shiprocket Client: tracks delivered AWB with OTP", async () => {
    const res = await trackAwb("AWB-SR-990101");
    assert.ok(res.data);
    const track = res.data?.shipment_track?.[0];
    assert.equal(track?.current_status, "DELIVERED");
    assert.match(track?.delivered_to || "", /OTP/);
    assert.equal(track?.weight, "0.85");
  });

  await test("Shiprocket Client: tracks stalled / lost in transit AWB", async () => {
    const res = await trackAwb("AWB-SR-990103");
    assert.ok(res.data);
    const track = res.data?.shipment_track?.[0];
    assert.equal(track?.current_status, "LOST_IN_TRANSIT");
  });

  // 9. Deterministic Swarm & Juror Adjudication
  await test("Swarm Case A: ₹3,200 Double-Debit & Empty Box evaluates to REJECT_CLAIM (82/100)", async () => {
    const res = await runUpiSwarm({
      orderId: "ORD-KRY-8801",
      rrn: "631514892011",
      claimAmountPaise: 320000,
      buyerMessage: "debited twice and empty box",
    });
    assert.equal(res.verdict, "REJECT_CLAIM");
    assert.equal(res.score, 82);
    assert.equal(res.recommendedRefundPaise, 0);
    assert.equal(res.iterationLogs.length, 2); // Pass 1 (65) -> Pass 2 Hound deep retrieval (82)
    assert.ok(res.reasoning.en.reasons.length >= 2);
    assert.ok(res.reasoning.hi.reasons.length >= 2);
  });

  await test("Swarm Case B: ₹1,200 Minor Scratch evaluates to OFFER_PARTIAL (60/100, ₹300 refund)", async () => {
    const res = await runUpiSwarm({
      orderId: "ORD-KRY-8802",
      rrn: "631518440293",
      claimAmountPaise: 120000,
      buyerMessage: "scratch on side panel, want refund",
    });
    assert.equal(res.verdict, "OFFER_PARTIAL");
    assert.equal(res.score, 60);
    assert.equal(res.recommendedRefundPaise, 30000); // ₹300
    assert.ok(res.reasoning.en.reasons.length >= 2);
  });

  await test("Swarm Case C: ₹2,499 Lost in Transit evaluates to APPROVE_REFUND (15/100, ₹2,499 full refund)", async () => {
    const res = await runUpiSwarm({
      orderId: "ORD-KRY-8803",
      rrn: "631519773104",
      claimAmountPaise: 249900,
      buyerMessage: "stuck in transit for 9 days",
    });
    assert.equal(res.verdict, "APPROVE_REFUND");
    assert.equal(res.score, 15);
    assert.equal(res.recommendedRefundPaise, 249900); // ₹2,499
  });

  // 10. Bilingual Dictionary Exact Translations
  test("i18n: exact mandatory translations present in EN and HI", () => {
    const en = STRINGS.en;
    const hi = STRINGS.hi;

    assert.equal(en.refund, "Refund");
    assert.equal(hi.refund, "रिफंड");

    assert.equal(en.approve, "Approve");
    assert.equal(hi.approve, "स्वीकृत करें");

    assert.equal(en.reject, "Reject");
    assert.equal(hi.reject, "अस्वीकार करें");

    assert.equal(en.awaiting_approval, "Awaiting approval");
    assert.equal(hi.awaiting_approval, "स्वीकृति की प्रतीक्षा है");

    assert.equal(en.payment_successful, "Payment successful");
    assert.equal(hi.payment_successful, "भुगतान सफल");

    assert.equal(en.payment_failed, "Payment failed");
    assert.equal(hi.payment_failed, "भुगतान विफल");

    assert.equal(en.verdict_reject, "REJECT CLAIM");
    assert.equal(hi.verdict_reject, "दावा अस्वीकार करें");

    assert.equal(en.verdict_offer, "PARTIAL OFFER");
    assert.equal(hi.verdict_offer, "आंशिक रिफंड प्रस्ताव");

    assert.equal(en.verdict_refund, "FULL REFUND");
    assert.equal(hi.verdict_refund, "पूर्ण रिफंड");

    assert.equal(en.guardrail_auto, "Auto-Approved (< ₹500 Guardrail)");
    assert.equal(hi.guardrail_auto, "स्वतः स्वीकृत (< ₹500 सुरक्षा सीमा)");

    assert.equal(en.guardrail_locked, "Locked — Human Approval Required (≥ ₹500)");
    assert.equal(hi.guardrail_locked, "लॉक किया गया — मानवीय स्वीकृति आवश्यक (≥ ₹500)");

    assert.equal(en.guardrail_blocked_failed, "Blocked — Payment Failed (Merchant Never Received Funds)");
    assert.equal(hi.guardrail_blocked_failed, "अवरुद्ध — भुगतान विफल (विक्रेता को राशि प्राप्त नहीं हुई)");

    assert.equal(en.upi_rrn, "UPI RRN");
    assert.equal(hi.upi_rrn, "यूपीआई आरआरएन (RRN)");

    assert.equal(en.download_dossier, "Download Bilingual PDF Dossier");
    assert.equal(hi.download_dossier, "द्विभाषी पीडीएफ डोजियर डाउनलोड करें");
  });

  // 11. Idempotency Key Generator
  test("Idempotency: generates 64-char sha256 hash", () => {
    const key1 = computeUpiIdempotencyKey("UPI-CASE-C", "631519773104", "EXECUTE_REFUND");
    const key2 = computeUpiIdempotencyKey("UPI-CASE-C", "631519773104", "EXECUTE_REFUND");
    const key3 = computeUpiIdempotencyKey("UPI-CASE-A", "631514892011", "EXECUTE_REFUND");

    assert.equal(key1.length, 64);
    assert.equal(key1, key2);
    assert.notEqual(key1, key3);
  });


  // 12. LLM Jurors Layer & Validation Tests
  test("LLM Juror Validator: accepts authentic critique with matching ₹ and RRN", () => {
    const valid = validateJurorReply(
      "Verified 1 captured payment of ₹3,200 for RRN 631514892011. Merchant received funds once; second transaction timed out.",
      {
        rrn: "631514892011",
        claimAmountPaise: 320000,
        recommendedRefundPaise: 0,
        orderId: "ORD-KRY-8801",
        paymentAmountsPaise: [320000],
      }
    );
    assert.equal(valid, true);
  });

  test("LLM Juror Validator: rejects hallucinated ₹ amount -> falls back to template", () => {
    const invalid = validateJurorReply(
      "Verified 1 captured payment of ₹3,200 for RRN 631514892011. However buyer also demands an extra ₹9,999 refund.",
      {
        rrn: "631514892011",
        claimAmountPaise: 320000,
        recommendedRefundPaise: 0,
        orderId: "ORD-KRY-8801",
        paymentAmountsPaise: [320000],
      }
    );
    assert.equal(invalid, false);
  });

  test("LLM Juror Validator: rejects invented 12-digit RRN -> falls back to template", () => {
    const invalid = validateJurorReply(
      "Verified payment for transaction under RRN 999988887777. Merchant received ₹3,200 from buyer.",
      {
        rrn: "631514892011",
        claimAmountPaise: 320000,
        recommendedRefundPaise: 0,
        orderId: "ORD-KRY-8801",
        paymentAmountsPaise: [320000],
      }
    );
    assert.equal(invalid, false);
  });

  test("LLM Juror Validator: rejects invented Order ID -> falls back to template", () => {
    const invalid = validateJurorReply(
      "Verified shipment dispatch for order ORD-FAKE-9999 with 0.85 kg weight certificate verified.",
      {
        rrn: "631514892011",
        claimAmountPaise: 320000,
        recommendedRefundPaise: 0,
        orderId: "ORD-KRY-8801",
        paymentAmountsPaise: [320000],
      }
    );
    assert.equal(invalid, false);
  });

  test("LLM Juror Validator: rejects stub replies (<40 chars)", () => {
    const invalid = validateJurorReply("Looks verified.", {
      rrn: "631514892011",
      claimAmountPaise: 320000,
      recommendedRefundPaise: 0,
    });
    assert.equal(invalid, false);
  });

  await test("LLM Juror Swarm: isLLMConfigured() false uses template path with unchanged score", async () => {
    const oldKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    try {
      assert.equal(isLLMConfigured(), false);
      const res = await runUpiSwarm({
        orderId: "ORD-KRY-8801",
        rrn: "631514892011",
        claimAmountPaise: 320000,
        buyerMessage: "debited twice and empty box",
      });
      assert.equal(res.score, 82);
      assert.equal(res.verdict, "REJECT_CLAIM");
      for (const juror of res.jurorReports) {
        assert.equal(juror.source, "template");
      }
    } finally {
      if (oldKey) process.env.LLM_API_KEY = oldKey;
    }
  });

  await test("LLM Juror Swarm: mocked draft() delivers LLM critique while score & verdict remain 100% unchanged", async () => {
    const originalFetch = global.fetch;
    const oldKey = process.env.LLM_API_KEY;
    const oldProvider = process.env.LLM_PROVIDER;
    const oldBase = process.env.LLM_BASE_URL;
    const oldModel = process.env.LLM_MODEL;

    process.env.LLM_API_KEY = "mock_test_key";
    process.env.LLM_PROVIDER = "custom";
    process.env.LLM_BASE_URL = "https://mock.llm.nebius.test/v1";
    process.env.LLM_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507";

    const mockLlmText =
      "Verified 1 captured payment of ₹3,200 for RRN 631514892011. Merchant received funds once; second transaction timed out.";

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: mockLlmText,
            },
          },
        ],
      }),
    } as any);

    try {
      const res = await runUpiSwarm({
        orderId: "ORD-KRY-8801",
        rrn: "631514892011",
        claimAmountPaise: 320000,
        buyerMessage: "debited twice and empty box",
      });

      assert.equal(res.score, 82);
      assert.equal(res.verdict, "REJECT_CLAIM");
      assert.equal(res.recommendedRefundPaise, 0);

      const j1 = res.jurorReports.find((j) => j.jurorId === "JUROR_GATEWAY");
      assert.ok(j1);
      assert.equal(j1?.source, "llm");
      assert.equal(j1?.critiqueEn, mockLlmText);
      assert.ok(j1?.model);
      assert.equal(j1?.provider, "custom");
    } finally {
      global.fetch = originalFetch;
      if (oldKey) process.env.LLM_API_KEY = oldKey;
      else delete process.env.LLM_API_KEY;
      if (oldProvider) process.env.LLM_PROVIDER = oldProvider;
      else delete process.env.LLM_PROVIDER;
      if (oldBase) process.env.LLM_BASE_URL = oldBase;
      else delete process.env.LLM_BASE_URL;
      if (oldModel) process.env.LLM_MODEL = oldModel;
      else delete process.env.LLM_MODEL;
    }
  });

  await test("LLM Juror Swarm: mocked draft() with hallucinated ₹ amount falls back to template", async () => {
    const originalFetch = global.fetch;
    const oldKey = process.env.LLM_API_KEY;
    const oldProvider = process.env.LLM_PROVIDER;
    const oldBase = process.env.LLM_BASE_URL;
    const oldModel = process.env.LLM_MODEL;

    process.env.LLM_API_KEY = "mock_test_key";
    process.env.LLM_PROVIDER = "custom";
    process.env.LLM_BASE_URL = "https://mock.llm.nebius.test/v1";
    process.env.LLM_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507";

    const hallucinatedText =
      "Verified captured payment of ₹3,200 for RRN 631514892011, but buyer demands extra ₹9,999 compensation.";

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: hallucinatedText } }],
      }),
    } as any);

    try {
      const res = await runUpiSwarm({
        orderId: "ORD-KRY-8801",
        rrn: "631514892011",
        claimAmountPaise: 320000,
        buyerMessage: "debited twice and empty box",
      });

      assert.equal(res.score, 82);
      assert.equal(res.verdict, "REJECT_CLAIM");

      const j1 = res.jurorReports.find((j) => j.jurorId === "JUROR_GATEWAY");
      assert.ok(j1);
      assert.equal(j1?.source, "template");
      assert.notEqual(j1?.critiqueEn, hallucinatedText);
      assert.ok(j1?.critiqueEn.includes("Verified 1 captured payment"));
    } finally {
      global.fetch = originalFetch;
      if (oldKey) process.env.LLM_API_KEY = oldKey;
      else delete process.env.LLM_API_KEY;
      if (oldProvider) process.env.LLM_PROVIDER = oldProvider;
      else delete process.env.LLM_PROVIDER;
      if (oldBase) process.env.LLM_BASE_URL = oldBase;
      else delete process.env.LLM_BASE_URL;
      if (oldModel) process.env.LLM_MODEL = oldModel;
      else delete process.env.LLM_MODEL;
    }
  });

  await test("LLM Juror Swarm: mocked draft() with invented RRN falls back to template", async () => {
    const originalFetch = global.fetch;
    const oldKey = process.env.LLM_API_KEY;
    const oldProvider = process.env.LLM_PROVIDER;
    const oldBase = process.env.LLM_BASE_URL;
    const oldModel = process.env.LLM_MODEL;

    process.env.LLM_API_KEY = "mock_test_key";
    process.env.LLM_PROVIDER = "custom";
    process.env.LLM_BASE_URL = "https://mock.llm.nebius.test/v1";
    process.env.LLM_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507";

    const inventedRrnText =
      "Payment trace confirms capture of ₹3,200 under RRN 999988887777 for customer transaction.";

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: inventedRrnText } }],
      }),
    } as any);

    try {
      const res = await runUpiSwarm({
        orderId: "ORD-KRY-8801",
        rrn: "631514892011",
        claimAmountPaise: 320000,
        buyerMessage: "debited twice and empty box",
      });

      assert.equal(res.score, 82);
      const j1 = res.jurorReports.find((j) => j.jurorId === "JUROR_GATEWAY");
      assert.ok(j1);
      assert.equal(j1?.source, "template");
      assert.notEqual(j1?.critiqueEn, inventedRrnText);
    } finally {
      global.fetch = originalFetch;
      if (oldKey) process.env.LLM_API_KEY = oldKey;
      else delete process.env.LLM_API_KEY;
      if (oldProvider) process.env.LLM_PROVIDER = oldProvider;
      else delete process.env.LLM_PROVIDER;
      if (oldBase) process.env.LLM_BASE_URL = oldBase;
      else delete process.env.LLM_BASE_URL;
      if (oldModel) process.env.LLM_MODEL = oldModel;
      else delete process.env.LLM_MODEL;
    }
  });

  await test("LLM Juror Swarm: draft failure / 500 error falls back to template without throwing", async () => {
    const originalFetch = global.fetch;
    const oldKey = process.env.LLM_API_KEY;
    const oldProvider = process.env.LLM_PROVIDER;
    const oldBase = process.env.LLM_BASE_URL;
    const oldModel = process.env.LLM_MODEL;

    process.env.LLM_API_KEY = "mock_test_key";
    process.env.LLM_PROVIDER = "custom";
    process.env.LLM_BASE_URL = "https://mock.llm.nebius.test/v1";
    process.env.LLM_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507";

    global.fetch = async () => {
      throw new Error("500 Internal Server Error / Connection refused");
    };

    try {
      const res = await runUpiSwarm({
        orderId: "ORD-KRY-8801",
        rrn: "631514892011",
        claimAmountPaise: 320000,
        buyerMessage: "debited twice and empty box",
      });

      assert.equal(res.score, 82);
      assert.equal(res.verdict, "REJECT_CLAIM");
      for (const juror of res.jurorReports) {
        assert.equal(juror.source, "template");
      }
    } finally {
      global.fetch = originalFetch;
      if (oldKey) process.env.LLM_API_KEY = oldKey;
      else delete process.env.LLM_API_KEY;
      if (oldProvider) process.env.LLM_PROVIDER = oldProvider;
      else delete process.env.LLM_PROVIDER;
      if (oldBase) process.env.LLM_BASE_URL = oldBase;
      else delete process.env.LLM_BASE_URL;
      if (oldModel) process.env.LLM_MODEL = oldModel;
      else delete process.env.LLM_MODEL;
    }
  });

  console.log(`\nAll ${passed}/${total} PHALANX UPI checks passed successfully!`);
}

runAll().catch((err) => {
  console.error("FATAL in test suite:", err);
  process.exit(1);
});

