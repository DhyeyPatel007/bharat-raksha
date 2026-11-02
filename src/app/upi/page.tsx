"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import LanguageToggle from "@/components/upi/LanguageToggle";
import UpiTransactionList from "@/components/upi/UpiTransactionList";
import { useLanguage } from "@/lib/i18n";
import type { UpiCase } from "@/lib/upi/types";

export default function UpiWorkbenchPage() {
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
  const [simDrawerOpen, setSimDrawerOpen] = useState(false);
  const [simPhone, setSimPhone] = useState("+91 98201 99482");
  const [simMessage, setSimMessage] = useState("");
  const [simSubmitting, setSimSubmitting] = useState(false);
  const [simResponse, setSimResponse] = useState<string | null>(null);

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

  const runSimulation = async (text: string, phone = "+91 98201 99482") => {
    setSimSubmitting(true);
    setSimResponse(null);
    try {
      const res = await fetch("/api/upi/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          phone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimResponse(
          language === "hi"
            ? `सफलतापूर्वक सिमुलेट किया गया! ${data.processedCount || 1} दावा प्रसंस्कृत हुआ।`
            : `Simulation success! Processed ${data.processedCount || 1} claim.`
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
      {/* TOP GLOBAL BAR */}
      <header
        style={{
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "12px 24px",
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
            gap: "12px",
          }}
        >
          {/* Logo & Subtitle */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px", fontWeight: 900, letterSpacing: "-0.5px", color: "#0f172a" }}>
                🛡️ {t.brand_title}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "#ecfdf5",
                  color: "#059669",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  border: "1px solid #a7f3d0",
                }}
              >
                LIVE SHIELD
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
              {t.brand_subtitle}
            </div>
          </div>

          {/* Right Controls: Mode switcher + Reset + LanguageToggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Mode Switcher Pill */}
            <div
              style={{
                display: "inline-flex",
                backgroundColor: "#f1f5f9",
                borderRadius: "20px",
                padding: "2px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <Link
                href="/dashboard"
                style={{
                  padding: "4px 12px",
                  borderRadius: "16px",
                  textDecoration: "none",
                  color: "#64748b",
                }}
              >
                {t.nav_paypal}
              </Link>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "16px",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                  fontWeight: 700,
                }}
              >
                {t.nav_upi}
              </span>
            </div>

            {/* 1-Click Demo Reset Button */}
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                cursor: resetting ? "not-allowed" : "pointer",
              }}
            >
              {resetting ? "Resetting..." : `🔄 ${t.reset_demo}`}
            </button>

            {/* Language Toggle */}
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* SUB-HEADER: TELEMETRY & FALLBACK STATUS BADGE */}
      <div
        style={{
          backgroundColor: "#f1f5f9",
          borderBottom: "1px solid #e2e8f0",
          padding: "6px 24px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#10b981" }} />
            <strong>System Telemetry & Fallback Status:</strong>
            <span>Razorpay: <code style={{ color: "#0f172a" }}>rzp_test_active (sandbox emulator ready)</code></span>
            <span>•</span>
            <span>Shiprocket: <code style={{ color: "#0f172a" }}>MOCK_SCHEMA_EXACT (20ms)</code></span>
            <span>•</span>
            <span>WhatsApp: <code style={{ color: "#0f172a" }}>Cloud Webhook Intake Ready</code></span>
          </div>

          <button
            type="button"
            onClick={() => setSimDrawerOpen(!simDrawerOpen)}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "11px",
              padding: 0,
            }}
          >
            {simDrawerOpen ? "Close Simulator ▲" : `⚡ ${t.simulate_claim} ▼`}
          </button>
        </div>
      </div>

      {/* SIMULATOR DRAWER (COLLAPSIBLE) */}
      {simDrawerOpen && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "2px solid #2563eb",
            padding: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>
              ⚡ {t.sim_title}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
              {t.sim_desc}
            </div>

            {/* Quick 1-Click Simulation Buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
              <button
                type="button"
                disabled={simSubmitting}
                onClick={() =>
                  runSimulation(
                    "₹3,200 debited twice from my GPay (RRN 631514892011) and the box delivered today was completely empty! Refund ₹3,200 immediately or I'm posting online!",
                    "+91 98201 99482"
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
                  runSimulation(
                    "Received my order ORD-KRY-8802 (RRN 631518440293) paid ₹1,200 via PhonePe, but there is a scratch on the side panel. I want a full ₹1,200 refund.",
                    "+91 98451 02931"
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
                  runSimulation(
                    "Order ORD-KRY-8803, paid ₹2,499 via UPI (RRN 631519773104) 9 days ago. Tracking hasn't moved in a week. Please refund my ₹2,499.",
                    "+91 98112 04859"
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

              {/* FAILED PAYMENT GUARDRAIL TEST BUTTON */}
              <button
                type="button"
                disabled={simSubmitting}
                onClick={() =>
                  runSimulation(
                    "Hey my payment failed but ₹1,500 was cut from UPI RRN 631510009988 for ORD-KRY-8804. Refund my ₹1,500 now!",
                    "+91 98991 12233"
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

            {/* Custom simulation box */}
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                  {t.sim_custom_heading}
                </label>
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  placeholder={t.sim_msg_placeholder}
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
                onClick={() => runSimulation(simMessage, simPhone)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: simSubmitting || !simMessage ? "not-allowed" : "pointer",
                }}
              >
                {simSubmitting ? "Running..." : t.send_whatsapp_message}
              </button>
            </div>

            {simResponse && (
              <div style={{ marginTop: "12px", fontSize: "12px", fontWeight: 600, color: "#059669" }}>
                {simResponse}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: "1200px", margin: "28px auto", padding: "0 24px" }}>
        {/* METRICS ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
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
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              {t.metric_total_claims}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>
              {metrics.totalClaims}
            </div>
          </div>

          {/* Card 2: Auto-Resolved */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>
              {t.metric_auto_resolved}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#059669", marginTop: "4px" }}>
              {metrics.autoResolvedCount}
            </div>
          </div>

          {/* Card 3: Human Locked */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>
              {t.metric_human_locked}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#d97706", marginTop: "4px" }}>
              {metrics.humanLockedCount}
            </div>
          </div>

          {/* Card 4: Fraud Prevented */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#e11d48", textTransform: "uppercase" }}>
              {t.metric_fraud_prevented}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#e11d48", marginTop: "4px" }}>
              ₹{fraudPreventedInr}
            </div>
          </div>
        </div>

        {/* TRANSACTION LIST SECTION */}
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {language === "hi" ? "यूपीआई दावा एवं रिफंड इतिहास" : "UPI Claim & Refund Feed"}
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
              {language === "hi"
                ? "व्हाट्सएप, रेज़रपे और शिपराकेट टेलीमेट्री से प्राप्त दावों की सूची"
                : "Real-time claims adjudicated with Razorpay RRN & Shiprocket AWB telemetry"}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading UPI transactions...</div>
        ) : (
          <UpiTransactionList cases={cases} />
        )}

        {/* GROUND TRUTH FOOTER NOTICE */}
        <div
          style={{
            marginTop: "48px",
            padding: "16px 20px",
            backgroundColor: "#f1f5f9",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
            color: "#475569",
            lineHeight: 1.5,
          }}
        >
          <strong>📌 {language === "hi" ? "महत्वपूर्ण यूपीआई वास्तविकता" : "Important UPI Ground Truth"}:</strong> {t.upi_truth_notice}
        </div>
      </main>
    </div>
  );
}

