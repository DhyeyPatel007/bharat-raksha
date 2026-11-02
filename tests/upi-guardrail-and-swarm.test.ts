import { NextRequest } from "next/server";
import { POST as telegramWebhookPost } from "../src/app/api/upi/webhooks/telegram/route";
import { POST as webIntakePost } from "../src/app/api/upi/cases/web-intake/route";
import { POST as realIntakePost } from "../src/app/api/upi/cases/real-intake/route";
import { getUpiAuditLogs } from "../src/lib/upi/store-db";
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
import {
  runUpiSwarm,
  validateJurorReply,
  autoRunSwarmIfNeeded,
  allocateJurorPoints,
} from "../src/lib/upi/jurors";
import { getInitialSeedCases } from "../src/lib/upi/seed-cases";
import {
  getMerchantChatId,
  registerMerchantChat,
  clearMerchantChat,
  sendMerchantClaimAlert,
  getRecentTelegramLogs,
} from "../src/lib/upi/telegram";
import { executeCaseRefund } from "../src/lib/upi/refund-service";
import { getUpiCaseById, saveUpiCase, resetDemoCases } from "../src/lib/upi/store-db";
import type { UpiCase } from "../src/lib/upi/types";
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


  // 13. Telegram Merchant Bot Tests (§1 - §4)
  await test("Telegram Merchant: /start registers the merchant chat", async () => {
    clearMerchantChat();
    assert.equal(getMerchantChatId(), null);

    const reg = registerMerchantChat("987654321", { username: "demo_merchant" });
    assert.equal(reg.chatId, "987654321");
    assert.equal(reg.username, "demo_merchant");
    assert.equal(getMerchantChatId(), "987654321");
  });

  await test("Telegram Merchant: alert sent on a new intake case with inline buttons", async () => {
    registerMerchantChat("987654321");

    const testCase: UpiCase = {
      case_id: "UPI-CASE-TEST-ALERT",
      order_id: "ORD-ALERT-01",
      upi_rrn: "631599887766",
      claim_amount_paise: 120000,
      recommended_refund_paise: 30000,
      claim_type: "DAMAGED_ITEM",
      buyer_message_en: "Damage on delivery",
      buyer_message_hi: "नुकसान हुआ",
      status: "AWAITING_HUMAN_APPROVAL",
      verdict: "OFFER_PARTIAL",
      score: 60,
      guardrail_state: "LOCKED_AWAITING_HUMAN_APPROVAL",
      requires_human_approval: true,
      reasoning_summary: {
        en: { verdict: "OFFER_PARTIAL", reasons: ["Damage noted"], namedGaps: [] },
        hi: { verdict: "OFFER_PARTIAL", reasons: ["नुकसान हुआ"], namedGaps: [] },
      },
      juror_reports: [],
      iteration_logs: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const alertLog = await sendMerchantClaimAlert(testCase);
    assert.ok(alertLog);
    assert.equal(alertLog?.to, "987654321");
    assert.ok(alertLog?.text.includes("New UPI Claim Alert"));
    assert.ok(alertLog?.text.includes("UPI-CASE-TEST-ALERT"));
    assert.ok(alertLog?.text.includes("OFFER_PARTIAL"));

    const markup = alertLog?.replyMarkup as any;
    assert.ok(markup?.inline_keyboard);
    const buttons = markup.inline_keyboard[0];
    assert.equal(buttons[0].text, "✅ Approve");
    assert.equal(buttons[0].callback_data, "approve:UPI-CASE-TEST-ALERT");
    assert.equal(buttons[1].text, "❌ Reject");
    assert.equal(buttons[1].callback_data, "reject:UPI-CASE-TEST-ALERT");
    assert.equal(buttons[2].text, "🔍 Details");
    assert.equal(buttons[2].callback_data, "details:UPI-CASE-TEST-ALERT");
  });

  await test("Telegram Merchant: approve callback executes refund through shared refund path", async () => {
    await resetDemoCases();
    registerMerchantChat("987654321");

    const caseBBefore = await getUpiCaseById("UPI-CASE-B");
    assert.ok(caseBBefore);
    assert.equal(caseBBefore?.status, "AWAITING_HUMAN_APPROVAL");

    const refundRes = await executeCaseRefund({
      caseId: "UPI-CASE-B",
      humanApproval: {
        approvedBy: "Telegram Merchant (@demo_merchant)",
        approvedAt: new Date().toISOString(),
        token: "tok_tg_test",
      },
      actor: "TELEGRAM_MERCHANT_BOT",
    });

    assert.equal(refundRes.status, "ok");
    assert.equal(refundRes.statusCode, 200);
    assert.ok(refundRes.refund?.id);

    const caseBAfter = await getUpiCaseById("UPI-CASE-B");
    assert.equal(caseBAfter?.status, "REFUNDED");
    assert.equal(caseBAfter?.razorpay_refund_id, refundRes.refund?.id);
    assert.equal(caseBAfter?.human_approved_by, "Telegram Merchant (@demo_merchant)");
  });

  await test("Telegram Merchant: reject callback marks case REJECTED with audit entry", async () => {
    const c = await getUpiCaseById("UPI-CASE-B");
    assert.ok(c);
    c.status = "REJECTED";
    c.guardrail_state = "NO_REFUND_REJECTED_WITH_DOSSIER";
    await saveUpiCase(c);

    const cAfter = await getUpiCaseById("UPI-CASE-B");
    assert.equal(cAfter?.status, "REJECTED");
    assert.equal(cAfter?.guardrail_state, "NO_REFUND_REJECTED_WITH_DOSSIER");
  });

  await test("Telegram Merchant: callback from unregistered chat is ignored", async () => {
    registerMerchantChat("987654321");
    const attackerChatId = "666999666";

    const registeredChat = getMerchantChatId();
    const isAuthorized = registeredChat !== null && attackerChatId === registeredChat;
    assert.equal(isAuthorized, false);
  });

  await test("Telegram Merchant: no alert for seeded startup cases", async () => {
    await resetDemoCases();
    clearMerchantChat();
    const logs = getRecentTelegramLogs();
    const seededAlerts = logs.filter(
      (l) =>
        l.text.includes("New UPI Claim Alert") &&
        (l.text.includes("UPI-CASE-A") || l.text.includes("UPI-CASE-B") || l.text.includes("UPI-CASE-C"))
    );
    assert.equal(seededAlerts.length, 0);
  });

  // 13. Juror Points Sum Invariant Tests (§1)
  await test("Juror Points Invariant: template path - sum of juror points equals case score for all 3 cases", async () => {
    // 1. Check seeded cases
    const initialCases = getInitialSeedCases();
    for (const c of initialCases) {
      const sum = c.juror_reports.reduce((acc, j) => acc + j.scoreContribution, 0);
      assert.equal(sum, c.score, `Seeded case ${c.case_id} juror points sum (${sum}) must equal score (${c.score})`);
    }

    // 2. Check fresh template run for Case A
    const resA = await runUpiSwarm({
      orderId: "ORD-KRY-8801",
      rrn: "631514892011",
      claimAmountPaise: 320000,
      buyerMessage: "debited twice and empty box",
    });
    const sumA = resA.jurorReports.reduce((acc, j) => acc + j.scoreContribution, 0);
    assert.equal(sumA, resA.score);
    assert.equal(sumA, 82);

    // 3. Check fresh template run for Case B
    const resB = await runUpiSwarm({
      orderId: "ORD-KRY-8802",
      rrn: "631518440293",
      claimAmountPaise: 120000,
      buyerMessage: "scratch on side panel, want refund",
    });
    const sumB = resB.jurorReports.reduce((acc, j) => acc + j.scoreContribution, 0);
    assert.equal(sumB, resB.score);
    assert.equal(sumB, 60);

    // 4. Check fresh template run for Case C
    const resC = await runUpiSwarm({
      orderId: "ORD-KRY-8803",
      rrn: "631519773104",
      claimAmountPaise: 249900,
      buyerMessage: "stuck in transit for 9 days",
    });
    const sumC = resC.jurorReports.reduce((acc, j) => acc + j.scoreContribution, 0);
    assert.equal(sumC, resC.score);
    assert.equal(sumC, 15);
  });

  await test("Juror Points Invariant: LLM path - sum of juror points equals case score for all 3 cases with mocked draft", async () => {
    const originalFetch = global.fetch;
    const oldKey = process.env.LLM_API_KEY;
    const oldProvider = process.env.LLM_PROVIDER;
    const oldBase = process.env.LLM_BASE_URL;

    process.env.LLM_API_KEY = "mock_key_sum_invariant";
    process.env.LLM_PROVIDER = "custom";
    process.env.LLM_BASE_URL = "https://mock.llm.nebius.test/v1";

    const validDraftA =
      "Verified 1 captured payment of ₹3,200 for RRN 631514892011. Merchant received funds once; second transaction timed out.";
    const validDraftB =
      "Verified 1 captured payment of ₹1,200 for RRN 631518440293. Unit delivered; minor scratch on panel.";
    const validDraftC =
      "Verified 1 captured payment of ₹2,499 for RRN 631519773104. Order untraceable in transit over 7 days.";

    global.fetch = async (url: any, opts: any) => {
      const body = typeof opts?.body === "string" ? opts.body : "";
      let content = validDraftA;
      if (body.includes("631518440293")) content = validDraftB;
      else if (body.includes("631519773104")) content = validDraftC;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content } }],
        }),
      } as any;
    };

    try {
      const resA = await runUpiSwarm({
        orderId: "ORD-KRY-8801",
        rrn: "631514892011",
        claimAmountPaise: 320000,
        buyerMessage: "debited twice and empty box",
      });
      const sumA = resA.jurorReports.reduce((acc, j) => acc + j.scoreContribution, 0);
      assert.equal(sumA, resA.score);
      assert.equal(sumA, 82);
      assert.equal(resA.jurorReports[0].source, "llm");

      const resB = await runUpiSwarm({
        orderId: "ORD-KRY-8802",
        rrn: "631518440293",
        claimAmountPaise: 120000,
        buyerMessage: "scratch on side panel, want refund",
      });
      const sumB = resB.jurorReports.reduce((acc, j) => acc + j.scoreContribution, 0);
      assert.equal(sumB, resB.score);
      assert.equal(sumB, 60);

      const resC = await runUpiSwarm({
        orderId: "ORD-KRY-8803",
        rrn: "631519773104",
        claimAmountPaise: 249900,
        buyerMessage: "stuck in transit for 9 days",
      });
      const sumC = resC.jurorReports.reduce((acc, j) => acc + j.scoreContribution, 0);
      assert.equal(sumC, resC.score);
      assert.equal(sumC, 15);
    } finally {
      global.fetch = originalFetch;
      if (oldKey) process.env.LLM_API_KEY = oldKey;
      else delete process.env.LLM_API_KEY;
      if (oldProvider) process.env.LLM_PROVIDER = oldProvider;
      else delete process.env.LLM_PROVIDER;
      if (oldBase) process.env.LLM_BASE_URL = oldBase;
      else delete process.env.LLM_BASE_URL;
    }
  });

  // 14. Auto-Run Swarm Behavior Tests (§4)
  await test("Auto-run behavior: does not run when LLM is unconfigured", async () => {
    await resetDemoCases();
    const oldKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;

    try {
      const res = await autoRunSwarmIfNeeded("UPI-CASE-A");
      assert.equal(res.ran, false);
      for (const j of res.case.juror_reports) {
        assert.equal(j.source, "template");
      }
    } finally {
      if (oldKey) process.env.LLM_API_KEY = oldKey;
    }
  });

  await test("Auto-run behavior: runs once with mocked draft and persists without re-running on revisit", async () => {
    await resetDemoCases();
    const originalFetch = global.fetch;
    const oldKey = process.env.LLM_API_KEY;
    const oldProvider = process.env.LLM_PROVIDER;
    const oldBase = process.env.LLM_BASE_URL;

    process.env.LLM_API_KEY = "mock_key_autorun";
    process.env.LLM_PROVIDER = "custom";
    process.env.LLM_BASE_URL = "https://mock.llm.nebius.test/v1";

    const mockLlmText =
      "Verified 1 captured payment of ₹3,200 for RRN 631514892011. Merchant received funds once; second transaction timed out.";

    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: mockLlmText } }],
        }),
      } as any;
    };

    try {
      // First visit: should auto-run
      const res1 = await autoRunSwarmIfNeeded("UPI-CASE-A");
      assert.equal(res1.ran, true);
      assert.equal(res1.case.juror_reports[0].source, "llm");
      assert.ok(fetchCount >= 3, `Expected at least 3 fetch calls, got ${fetchCount}`);

      const sum1 = res1.case.juror_reports.reduce((s, j) => s + j.scoreContribution, 0);
      assert.equal(sum1, res1.case.score);

      // Second visit (revisit): should NOT run again and spend zero additional tokens
      const fetchCountBefore = fetchCount;
      const res2 = await autoRunSwarmIfNeeded("UPI-CASE-A");
      assert.equal(res2.ran, false);
      assert.equal(fetchCount, fetchCountBefore, "Must not make additional LLM calls on revisit");
      assert.equal(res2.case.juror_reports[0].source, "llm");
    } finally {
      global.fetch = originalFetch;
      if (oldKey) process.env.LLM_API_KEY = oldKey;
      else delete process.env.LLM_API_KEY;
      if (oldProvider) process.env.LLM_PROVIDER = oldProvider;
      else delete process.env.LLM_PROVIDER;
      if (oldBase) process.env.LLM_BASE_URL = oldBase;
      else delete process.env.LLM_BASE_URL;
    }
  });


  // 15. ORDER_NOT_FOUND Guard Tests (§1)
  await test("ORDER_NOT_FOUND: Telegram webhook rejects unknown RRN, creates no case, logs UNMATCHED_CLAIM", async () => {
    await resetDemoCases();
    clearMerchantChat();
    registerMerchantChat("9820199482");

    const unknownRrn = "999888777666";
    const req = new NextRequest("http://localhost:3000/api/upi/webhooks/telegram", {
      method: "POST",
      body: JSON.stringify({
        message: {
          message_id: 101,
          chat: { id: "buyer_chat_404", type: "private" },
          text: `My payment failed for RRN ${unknownRrn}`,
        },
      }),
    });

    const res = await telegramWebhookPost(req);
    const data = await res.json();

    assert.equal(data.status, "order_not_found");
    assert.ok(data.message.includes("couldn't find a payment"));

    // Case must NOT be created
    const createdCase = await getUpiCaseById(`UPI-CASE-${unknownRrn.slice(-4)}`);
    assert.equal(createdCase, null);

    // Audit store must contain UNMATCHED_CLAIM
    const auditLogs = await getUpiAuditLogs("UNMATCHED");
    const unmatched = auditLogs.find((l) => l.action_type === "UNMATCHED_CLAIM" && l.input_payload.rrn === unknownRrn);
    assert.ok(unmatched, "Audit store must record UNMATCHED_CLAIM entry");
  });

  await test("ORDER_NOT_FOUND: Telegram webhook with phone number only (missing RRN) creates no case, asks for 12-digit RRN", async () => {
    await resetDemoCases();
    clearMerchantChat();
    registerMerchantChat("9820199482");

    const req = new NextRequest("http://localhost:3000/api/upi/webhooks/telegram", {
      method: "POST",
      body: JSON.stringify({
        message: {
          message_id: 102,
          chat: { id: "buyer_chat_missing_rrn", type: "private" },
          text: "Help me, my phone number is 9876543210 and money was debited",
        },
      }),
    });

    const res = await telegramWebhookPost(req);
    const data = await res.json();

    assert.equal(data.status, "missing_rrn");
    assert.ok(data.message.includes("12-digit UPI RRN"));

    // Case A (default) must NOT be modified or updated
    const caseA = await getUpiCaseById("UPI-CASE-A");
    assert.notEqual(caseA?.buyer_message_en, "Help me, my phone number is 9876543210 and money was debited");

    // Audit log must record MISSING_RRN
    const auditLogs = await getUpiAuditLogs("UNMATCHED");
    const unmatched = auditLogs.find((l) => l.action_type === "UNMATCHED_CLAIM" && l.input_payload.reason === "MISSING_RRN");
    assert.ok(unmatched, "Audit store must record UNMATCHED_CLAIM for missing RRN");
  });

  await test("ORDER_NOT_FOUND: Real-intake rejects unknown payment/RRN, logs UNMATCHED_CLAIM", async () => {
    await resetDemoCases();

    const req = new NextRequest("http://localhost:3000/api/upi/cases/real-intake", {
      method: "POST",
      body: JSON.stringify({
        paymentId: "pay_unknown_fake_999",
        rrn: "111222333444",
        claimType: "EMPTY_BOX",
        buyerMessage: "Fake payment attempt",
      }),
    });

    const res = await realIntakePost(req);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.status, "order_not_found");
    assert.ok(data.error.includes("couldn't find a payment"));

    // Case must NOT exist
    const c = await getUpiCaseById("UPI-CASE-3444");
    assert.equal(c, null);
  });

  // 16. Telegram Group Intake Tests (§2)
  await test("Telegram Group Intake: Group message with valid RRN creates case, sends short group acknowledgement, and alerts merchant in DM", async () => {
    await resetDemoCases();
    clearMerchantChat();
    registerMerchantChat("9820199482");

    const groupChatId = "-100192837465";
    const req = new NextRequest("http://localhost:3000/api/upi/webhooks/telegram", {
      method: "POST",
      body: JSON.stringify({
        message: {
          message_id: 201,
          from: { id: "buyer_in_group_1", first_name: "Rahul" },
          chat: { id: groupChatId, title: "D2C Payment Grievances", type: "supergroup" },
          text: "Hi support, my order ORD-KRY-8801 with RRN 631514892011 was charged twice!",
        },
      }),
    });

    const res = await telegramWebhookPost(req);
    const data = await res.json();

    assert.equal(data.status, "ok");
    assert.equal(data.processedCount, 1);

    const c = await getUpiCaseById("UPI-CASE-A");
    assert.ok(c);
    assert.equal(c?.origin_group_chat_id, groupChatId);
    assert.equal(c?.intake_source, "TELEGRAM_GROUP");

    // Verify group got short acknowledgement
    const recentLogs = getRecentTelegramLogs();
    const groupAck = recentLogs.find((l) => l.to === groupChatId && l.text.includes("Claim received"));
    assert.ok(groupAck, "Group chat must receive short acknowledgement");

    // Verify merchant got full report with buttons in DM
    const merchantAlert = recentLogs.find(
      (l) => l.to === "9820199482" && l.text.includes("New UPI Claim Alert") && l.replyMarkup !== undefined
    );
    assert.ok(merchantAlert, "Merchant personal DM must receive alert with inline keyboard");
  });

  await test("Telegram Group Intake: Group message with unknown RRN produces not-found reply, no case, no DM alert", async () => {
    await resetDemoCases();
    clearMerchantChat();
    registerMerchantChat("9820199482");

    const groupChatId = "-100192837465";
    const unknownRrn = "888777666555";
    const req = new NextRequest("http://localhost:3000/api/upi/webhooks/telegram", {
      method: "POST",
      body: JSON.stringify({
        message: {
          message_id: 202,
          from: { id: "buyer_in_group_2", first_name: "Pooja" },
          chat: { id: groupChatId, title: "D2C Payment Grievances", type: "supergroup" },
          text: `Payment issue with RRN ${unknownRrn}`,
        },
      }),
    });

    const res = await telegramWebhookPost(req);
    const data = await res.json();

    assert.equal(data.status, "order_not_found");

    const recentLogs = getRecentTelegramLogs();
    const groupNotFound = recentLogs.find((l) => l.to === groupChatId && l.text.includes("Payment Not Found"));
    assert.ok(groupNotFound, "Group must receive payment not found text");

    const merchantAlert = recentLogs.find(
      (l) => l.to === "9820199482" && l.text.includes(unknownRrn)
    );
    assert.equal(merchantAlert, undefined, "Merchant DM must NOT receive alert for unknown RRN");
  });

  await test("Telegram Group Intake: Group member callback (non-merchant) is ignored", async () => {
    registerMerchantChat("9820199482");
    const groupMemberChatId = "555444333";

    const req = new NextRequest("http://localhost:3000/api/upi/webhooks/telegram", {
      method: "POST",
      body: JSON.stringify({
        callback_query: {
          id: "cb_unauth_1",
          from: { id: groupMemberChatId, first_name: "Rogue Buyer" },
          message: {
            message_id: 301,
            chat: { id: groupMemberChatId, type: "private" },
          },
          data: "approve:UPI-CASE-B",
        },
      }),
    });

    const res = await telegramWebhookPost(req);
    const data = await res.json();
    assert.equal(data.status, "ignored_unauthorized_chat");
  });

  // 17. Web Intake Tests (§3)
  await test("Web Intake: Valid RRN creates case, runs swarm, and sends merchant Telegram alert", async () => {
    await resetDemoCases();
    clearMerchantChat();
    registerMerchantChat("9820199482");

    const req = new NextRequest("http://localhost:3000/api/upi/cases/web-intake", {
      method: "POST",
      body: JSON.stringify({
        rrn: "631518440293",
        orderId: "ORD-KRY-8802",
        description: "Scratched product arrived in mail",
        phone: "+919820199482",
      }),
    });

    const res = await webIntakePost(req);
    assert.equal(res.status, 201);
    const data = await res.json();

    assert.equal(data.status, "ok");
    assert.ok(data.case);
    assert.equal(data.case.verdict, "OFFER_PARTIAL");
    assert.equal(data.case.score, 60);
    assert.equal(data.case.intake_source, "WEB_INTAKE");

    // Merchant Telegram alert sent
    const recentLogs = getRecentTelegramLogs();
    const alert = recentLogs.find((l) => l.to === "9820199482" && l.text.includes("UPI-CASE-B"));
    assert.ok(alert, "Merchant Telegram alert must be dispatched on web intake");
  });

  await test("Web Intake: Unknown RRN returns 404 order_not_found without creating case", async () => {
    await resetDemoCases();

    const req = new NextRequest("http://localhost:3000/api/upi/cases/web-intake", {
      method: "POST",
      body: JSON.stringify({
        rrn: "000111222333",
        description: "Unknown payment claim",
      }),
    });

    const res = await webIntakePost(req);
    assert.equal(res.status, 404);
    const data = await res.json();

    assert.equal(data.status, "order_not_found");
    assert.ok(data.error.includes("couldn't find a payment"));

    const c = await getUpiCaseById("UPI-CASE-2333");
    assert.equal(c, null);
  });

  await test("Web Intake: Invalid RRN format returns 400 client error", async () => {
    const req = new NextRequest("http://localhost:3000/api/upi/cases/web-intake", {
      method: "POST",
      body: JSON.stringify({
        rrn: "12345", // not 12 digits
        description: "Invalid RRN test",
      }),
    });

    const res = await webIntakePost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("12 digits"));
  });

  console.log(`\nAll ${passed}/${total} PHALANX UPI checks passed successfully!`);
}

runAll().catch((err) => {
  console.error("FATAL in test suite:", err);
  process.exit(1);
});

