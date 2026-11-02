"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import LanguageToggle from "@/components/upi/LanguageToggle";
import UpiTransactionList from "@/components/upi/UpiTransactionList";
import { useLanguage } from "@/lib/i18n";
import type { UpiCase } from "@/lib/upi/types";

export default function BharatRakshaHomePage() {
  const { t, language } = useLanguage();
  const [cases, setCases] = useState<UpiCase[]>([]);
  const [metrics, setMetrics] = useState({
    totalClaims: 0,
    autoResolvedCount: 0,
    humanLockedCount: 0,
    fraudPreventedPaise: 0,
  });
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  // Telegram Simulator State
  const [telegramDrawerOpen, setTelegramDrawerOpen] = useState(false);
  const [simChatId, setSimChatId] = useState("9820199482");
  const [simMessage, setSimMessage] = useState("");
  const [simSubmitting, setSimSubmitting] = useState(false);
  const [simResponse, setSimResponse] = useState<string | null>(null);

  // Real Payment Intake Modal/Drawer State
  const [realIntakeOpen, setRealIntakeOpen] = useState(false);
  const [realPaymentId, setRealPaymentId] = useState("");
  const [realRrn, setRealRrn] = useState("");
  const [realClaimType, setRealClaimType] = useState("DAMAGED_ITEM");
  const [realMessage, setRealMessage] = useState("");
  const [realSubmitting, setRealSubmitting] = useState(false);
  const [realFeedback, setRealFeedback] = useState<{ success: boolean; message: string; source?: string } | null>(null);

  const fetchCases = async () => {
    try {
      const res = await fetch("/api/upi/cases");
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/upi/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
        await fetchCases();
      }
    } catch {
      // ignore
    } finally {
      setResetting(false);
    }
  };

  const handleCaseUpdated = (updated: UpiCase) => {
    setCases((prev) =>
      prev.map((c) => (c.case_id === updated.case_id ? updated : c))
    );
    fetchCases();
  };

  const runTelegramSimulation = async (text: string, chatId = "9820199482") => {
    setSimSubmitting(true);
    setSimResponse(null);
    try {
      const res = await fetch("/api/upi/webhooks/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimResponse(
          language === "hi"
            ? `सफलतापूर्वक टेलीग्राम बॉट पर सिमुलेट किया गया! ${data.processedCount || 1} दावा प्रसंस्कृत हुआ।`
            : `Telegram Bot Intake success! Processed ${data.processedCount || 1} claim.`
        );
        await fetchCases();
      } else {
        setSimResponse(`Error: ${data.error || "Simulation failed"}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSimResponse(`Error: ${msg}`);
    } finally {
      setSimSubmitting(false);
    }
  };

  const handleRealModeIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    setRealSubmitting(true);
    setRealFeedback(null);

    try {
      const res = await fetch("/api/upi/cases/real-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: realPaymentId,
          rrn: realRrn,
          claimType: realClaimType,
          buyerMessage: realMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to ingest real payment");
      }

      setRealFeedback({
        success: true,
        source: data.source,
        message:
          language === "hi"
            ? `भुगतान ${data.case?.order_id} (${data.source === "LIVE_API" ? "लाइव रेज़रपे" : "सैंडबॉक्स एमुलेटर"}) से सफलतापूर्वक दर्ज किया गया!`
            : `Payment ${data.case?.order_id} ingested successfully via ${data.source === "LIVE_API" ? "Live Razorpay API" : "Sandbox Emulator"}!`,
      });

      setRealPaymentId("");
      setRealRrn("");
      setRealMessage("");
      await fetchCases();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRealFeedback({ success: false, message: msg });
    } finally {
      setRealSubmitting(false);
    }
  };

  const fraudPreventedInr = (metrics.fraudPreventedPaise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* 1. TOP GLOBAL NAVIGATION (100% BharatRaksha — No PayPal) */}
      <header
        style={{
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "14px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          {/* Logo & Subtitle */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "-0.5px", color: "#0f172a" }}>
                🛡️ BharatRaksha <span style={{ fontWeight: 400, color: "#64748b", fontSize: "16px" }}>(भारत रक्षा)</span>
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "#ecfdf5",
                  color: "#059669",
                  padding: "3px 9px",
                  borderRadius: "14px",
                  border: "1px solid #a7f3d0",
                }}
              >
                LIVE SHIELD
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
              {language === "hi"
                ? "भारतीय D2C विक्रेताओं के लिए स्वायत्त यूपीआई रिफंड एवं दावा सुरक्षा ढाल"
                : "Autonomous Refund & Claim Adjudication Shield for Indian D2C Brands"}
            </div>
          </div>

          {/* Right Action Cluster */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* New Case from Real Payment Button */}
            <button
              type="button"
              onClick={() => {
                setRealIntakeOpen(!realIntakeOpen);
                if (telegramDrawerOpen) setTelegramDrawerOpen(false);
              }}
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: realIntakeOpen ? "#eff6ff" : "#ffffff",
                color: realIntakeOpen ? "#1d4ed8" : "#0f172a",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>💳</span>
              <span>{t.real_payment_intake}</span>
            </button>

            {/* Telegram Intake Simulator Toggle */}
            <button
              type="button"
              onClick={() => {
                setTelegramDrawerOpen(!telegramDrawerOpen);
                if (realIntakeOpen) setRealIntakeOpen(false);
              }}
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: telegramDrawerOpen ? "#f0fdf4" : "#ffffff",
                color: telegramDrawerOpen ? "#15803d" : "#0f172a",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>✈️</span>
              <span>{language === "hi" ? "टेलीग्राम बॉट इनटेक" : "Telegram Bot Intake"}</span>
            </button>

            {/* 1-Click Demo Reset Button */}
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "7px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#475569",
                cursor: resetting ? "not-allowed" : "pointer",
              }}
              title="Reset seeded test cases to clean starting state"
            >
              {resetting ? "Resetting..." : `🔄 ${t.reset_demo}`}
            </button>

            {/* Language Toggle (EN / हिंदी) */}
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* 2. SUB-HEADER: TELEMETRY BAR */}
      <div
        style={{
          backgroundColor: "#f1f5f9",
          borderBottom: "1px solid #e2e8f0",
          padding: "7px 24px",
          fontSize: "11px",
          color: "#475569",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#10b981" }} />
            <strong>{language === "hi" ? "सिस्टम टेलीमेट्री स्थिति" : "System Telemetry Status"}:</strong>
            <span>Razorpay: <code style={{ color: "#0f172a", fontWeight: 700 }}>rzp_test_* active</code></span>
            <span>•</span>
            <span>Shiprocket: <code style={{ color: "#0f172a", fontWeight: 700 }}>AWB Telemetry Active</code></span>
            <span>•</span>
            <span>Intake: <code style={{ color: "#0f172a", fontWeight: 700 }}>Telegram Bot API Gateway</code></span>
            <span>•</span>
            <span>Auto-Refund Ceiling: <code style={{ color: "#0f172a", fontWeight: 700 }}>₹0 (Approval Required)</code></span>
          </div>

          <div style={{ fontSize: "11px", color: "#64748b" }}>
            {language === "hi"
              ? "सटीक स्कोरिंग • एलएलएम जूरी विश्लेषण • प्रत्येक रिफंड से पहले मानवीय स्वीकृति"
              : "Deterministic scoring • LLM juror reasoning • Human approval before every refund"}
          </div>
        </div>
      </div>

      {/* 3. REAL-MODE INTAKE DRAWER (NEW CASE FROM REAL PAYMENT) */}
      {realIntakeOpen && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "2px solid #2563eb",
            padding: "24px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                  💳 {language === "hi" ? "वास्तविक रेज़रपे भुगतान से नया मामला दर्ज करें" : "New Case from Real Razorpay Payment"}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  {language === "hi"
                    ? "एक वास्तविक रेज़रपे टेस्ट-मोड भुगतान आईडी (pay_...) और १२-अंकीय यूपीआई आरआरएन दर्ज करें। ऐप सीधे रेज़रपे एपीआई से लाइव विवरण प्राप्त करेगा।"
                    : "Paste a real Razorpay test-mode payment ID (pay_...) and 12-digit UPI RRN. BharatRaksha fetches that payment live from Razorpay API using keys from .env.local."}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRealIntakeOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "14px",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRealModeIntake}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "14px",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Razorpay Payment ID (pay_...) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pay_UpiTestCaseA01 or pay_Qx12Ab89..."
                    value={realPaymentId}
                    onChange={(e) => setRealPaymentId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    UPI RRN (12 Digits) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="e.g. 631514892011"
                    value={realRrn}
                    onChange={(e) => setRealRrn(e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Claim Category
                  </label>
                  <select
                    value={realClaimType}
                    onChange={(e) => setRealClaimType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="DAMAGED_ITEM">DAMAGED_ITEM (Cosmetic or physical scuff)</option>
                    <option value="LOST_IN_TRANSIT">LOST_IN_TRANSIT (Courier delay over 7 days)</option>
                    <option value="EMPTY_BOX">EMPTY_BOX (Weight fraud allegations)</option>
                    <option value="DOUBLE_DEBIT">DOUBLE_DEBIT (Duplicate deduction claim)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Customer Narrative / Complaint
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received package but item has a scratch on front panel. Requesting refund."
                  value={realMessage}
                  onChange={(e) => setRealMessage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  🔒 Live sandbox safe: Only <code>rzp_test_*</code> keys accepted. Never calls live production money rails.
                </div>

                <button
                  type="submit"
                  disabled={realSubmitting || !realPaymentId || !realRrn}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: realSubmitting || !realPaymentId || !realRrn ? "not-allowed" : "pointer",
                  }}
                >
                  {realSubmitting ? "Fetching from Razorpay..." : "Fetch & Ingest Live Payment"}
                </button>
              </div>
            </form>

            {realFeedback && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: realFeedback.success ? "#ecfdf5" : "#fff1f2",
                  border: `1px solid ${realFeedback.success ? "#a7f3d0" : "#fecdd3"}`,
                  color: realFeedback.success ? "#059669" : "#e11d48",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {realFeedback.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TELEGRAM BOT INTAKE SIMULATOR DRAWER */}
      {telegramDrawerOpen && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "2px solid #16a34a",
            padding: "24px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                  ✈️ {language === "hi" ? "टेलीग्राम बॉट इनटेक सिम्युलेटर" : "Telegram Bot Intake Simulator"}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  {language === "hi"
                    ? "टेलीग्राम बॉट वेबहुक (/api/upi/webhooks/telegram) पर आने वाले ग्राहक दावों का अनुकरण करें। मुफ्त, त्वरित और व्यावसायिक सत्यापन की आवश्यकता नहीं।"
                    : "Simulate incoming buyer claims via Telegram Bot API webhook (/api/upi/webhooks/telegram). Free, instant setup with BotFather without business verification."}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTelegramDrawerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "14px",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Quick 1-Click Simulation Buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              <button
                type="button"
                disabled={simSubmitting}
                onClick={() =>
                  runTelegramSimulation(
                    "₹3,200 debited twice from my GPay (RRN 631514892011) and the box delivered today was completely empty! Refund ₹3,200 immediately or I'm posting online!",
                    "9820199482"
                  )
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#f8fafc",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🔴 {t.sim_case_a_btn}
              </button>

              <button
                type="button"
                disabled={simSubmitting}
                onClick={() =>
                  runTelegramSimulation(
                    "Received my order ORD-KRY-8802 (RRN 631518440293) paid ₹1,200 via PhonePe, but there is a scratch on the side panel. I want a full ₹1,200 refund.",
                    "9845102931"
                  )
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#f8fafc",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🟢 {t.sim_case_b_btn}
              </button>

              <button
                type="button"
                disabled={simSubmitting}
                onClick={() =>
                  runTelegramSimulation(
                    "Order ORD-KRY-8803, paid ₹2,499 via UPI (RRN 631519773104) 9 days ago. Tracking hasn't moved in a week. Please refund my ₹2,499.",
                    "9811204859"
                  )
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#f8fafc",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🟡 {t.sim_case_c_btn}
              </button>

              {/* FAILED PAYMENT GUARDRAIL TEST */}
              <button
                type="button"
                disabled={simSubmitting}
                onClick={() =>
                  runTelegramSimulation(
                    "Hey my payment failed but ₹1,500 was cut from UPI RRN 631510009988 for ORD-KRY-8804. Refund my ₹1,500 now!",
                    "9899112233"
                  )
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #fecdd3",
                  backgroundColor: "#fff1f2",
                  color: "#e11d48",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🛡️ {t.sim_case_failed_btn}
              </button>
            </div>

            {/* Custom Telegram Message Input */}
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "280px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                  {language === "hi" ? "कस्टम टेलीग्राम संदेश (RRN एवं Order ID सहित)" : "Custom Telegram Message (Include 12-digit RRN & Order ID)"}
                </label>
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  placeholder="e.g. Order ORD-KRY-8802 RRN 631518440293 item damaged, refund me"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ width: "160px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                  Telegram User ID / Phone
                </label>
                <input
                  type="text"
                  value={simChatId}
                  onChange={(e) => setSimChatId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              <button
                type="button"
                disabled={simSubmitting || !simMessage}
                onClick={() => runTelegramSimulation(simMessage, simChatId)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: simSubmitting || !simMessage ? "not-allowed" : "pointer",
                }}
              >
                {simSubmitting ? "Sending..." : t.send_telegram_message}
              </button>
            </div>

            {simResponse && (
              <div style={{ marginTop: "12px", fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
                ✓ {simResponse}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MAIN CONTAINER */}
      <main style={{ maxWidth: "1200px", margin: "32px auto", padding: "0 24px" }}>
        {/* HERO SECTION */}
        <section
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            padding: "36px 32px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "inline-block", fontSize: "12px", fontWeight: 700, color: "#2563eb", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {language === "hi" ? "स्वायत्त यूपीआई रिफंड एवं दावा सुरक्षा ढाल" : "Autonomous UPI Dispute & Claim Defense Shield"}
          </div>

          <h1
            style={{
              fontSize: "32px",
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-1px",
              margin: "0 0 12px 0",
              lineHeight: 1.25,
            }}
          >
            {language === "hi" ? (
              <>
                यूपीआई रिफंड से पहले मर्चेंट की सुरक्षा।{" "}
                <span style={{ color: "#64748b", fontWeight: 600 }}>
                  फॉरेंसिक साक्ष्य, ३-जूरी ऑडिट, एवं अनिवार्य मानवीय स्वीकृति गेट।
                </span>
              </>
            ) : (
              <>
                Disputes defended before UPI refunds bleed your store.{" "}
                <span style={{ color: "#64748b", fontWeight: 600 }}>
                  Forensic proof, 3-juror audit, and mandatory human approval gate.
                </span>
              </>
            )}
          </h1>

          <p
            style={{
              fontSize: "15px",
              color: "#475569",
              lineHeight: 1.6,
              maxWidth: "880px",
              margin: 0,
            }}
          >
            {language === "hi"
              ? "भारत रक्षा भारतीय D2C ब्रांड्स के लिए ग्राहक दावों का स्वायत्त मूल्यांकन करता है। सटीक स्कोरिंग, एलएलएम जूरी विश्लेषण, रेज़रपे बैंक निपटान, शिपराकेट डिजिटल वजन प्रमाण पत्र, तथा अपरिवर्तनीय यूपीआई रिफंड भेजने से पहले ऑपरेटर की अनिवार्य मानवीय स्वीकृति।"
              : "BharatRaksha turns chaotic customer complaints into verified forensic dossiers that protect Indian D2C merchants. Deterministic scoring, LLM juror reasoning, Razorpay settlement verification, Shiprocket weight certificates, and mandatory human operator approval before any rupee is refunded."}
          </p>
        </section>

        {/* METRICS ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {/* Card 1: Total Claims */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              {t.metric_total_claims}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>
              {loading ? <span style={{ color: "#94a3b8" }}>—</span> : metrics.totalClaims}
            </div>
          </div>

          {/* Card 2: Awaiting Human Approval */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>
              {t.metric_human_locked}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#d97706", marginTop: "4px" }}>
              {loading ? <span style={{ color: "#94a3b8" }}>—</span> : metrics.humanLockedCount}
            </div>
          </div>

          {/* Card 3: Fraud Prevented */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#e11d48", textTransform: "uppercase" }}>
              {t.metric_fraud_prevented}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#e11d48", marginTop: "4px" }}>
              {loading ? <span style={{ color: "#94a3b8" }}>—</span> : `₹${fraudPreventedInr}`}
            </div>
          </div>

          {/* Card 4: Auto-Refund Ceiling */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>
              {language === "hi" ? "ऑटो-रिफंड सीमा" : "Auto-Refund Ceiling"}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#059669", marginTop: "4px" }}>
              {loading ? <span style={{ color: "#94a3b8" }}>—</span> : "₹0.00"}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
              {language === "hi" ? "प्रत्येक रिफंड से पहले मानवीय स्वीकृति अनिवार्य" : "Human approval required before every refund"}
            </div>
          </div>
        </div>

        {/* TRANSACTION LIST SECTION */}
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {language === "hi" ? "यूपीआई दावा एवं रिफंड इतिहास" : "Adjudicated Claim Ledger"}
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
              {language === "hi"
                ? "टेलीग्राम बॉट, रेज़रपे RRN तथा शिपराकेट AWB टेलीमेट्री से सत्यापित मामले"
                : "Seeded and real claims evaluated live with 3-juror audit & human gate"}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading UPI transactions...</div>
        ) : (
          <UpiTransactionList cases={cases} onCaseUpdated={handleCaseUpdated} />
        )}

        {/* GROUND TRUTH FOOTER NOTICE */}
        <div
          style={{
            marginTop: "48px",
            padding: "18px 22px",
            backgroundColor: "#f1f5f9",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "#0f172a" }}>📌 {language === "hi" ? "महत्वपूर्ण यूपीआई वास्तविकता (Ground Truth)" : "Important UPI Ground Truth"}:</strong>{" "}
          {t.upi_truth_notice}
        </div>
      </main>
    </div>
  );
}
