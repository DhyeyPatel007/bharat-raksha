"use client";

import React from "react";
import Link from "next/link";
import LanguageToggle from "@/components/upi/LanguageToggle";
import { useLanguage } from "@/lib/i18n";

export default function TermsPage() {
  const { language } = useLanguage();
  const isHi = language === "hi";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F7F3EA",
        color: "#1A1A1A",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        lineHeight: 1.6,
      }}
    >
      {/* HEADER */}
      <header
        style={{
          borderBottom: "1px solid #E6DFD5",
          backgroundColor: "#F7F3EA",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "16px 32px",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "24px",
                fontWeight: 700,
                color: "#1A1A1A",
              }}
            >
              BharatRaksha
            </span>
            <span style={{ fontSize: "12px", color: "#755E46" }}>/ terms</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/dashboard"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                backgroundColor: "#C93A1B",
                color: "#FFFFFF",
                padding: "8px 16px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              {isHi ? "डैशबोर्ड खोलें" : "Open Dashboard"}
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: "860px", margin: "0 auto", padding: "56px 32px 80px 32px" }}>
        <div style={{ marginBottom: "36px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#C93A1B",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {isHi ? "नियम एवं शर्तें" : "PLAIN-LANGUAGE TERMS"}
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "40px",
              fontWeight: 400,
              lineHeight: 1.15,
              color: "#1A1A1A",
              margin: "8px 0 16px 0",
            }}
          >
            {isHi ? "डेमो एवं उपयोग की शर्तें" : "Demo Environment Terms & Disclaimers"}
          </h1>
          <p style={{ fontSize: "16px", color: "#5A554E", margin: 0 }}>
            {isHi
              ? "भारत रक्षा एक स्वायत्त रक्षा प्रणाली है। यह संदर्शिका स्पष्ट करती है कि डेमो मोड में डेटा और भुगतान कैसे संभाले जाते हैं।"
              : "Clear, honest statements regarding test credentials, data isolation, simulated money movements, and human governance."}
          </p>
        </div>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1.5px solid #E6DFD5",
            borderRadius: "8px",
            padding: "36px",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
              1. Test-Mode Credentials &amp; Sandbox Protection
            </h3>
            <p style={{ fontSize: "14px", color: "#4B463E", margin: 0, lineHeight: 1.7 }}>
              This demo application strictly connects to Razorpay in test mode (<code>rzp_test_*</code>). The codebase contains a hard safety invariant that actively refuses live keys (<code>rzp_live_*</code>) with an immediate runtime exception. No real bank accounts or merchant UPI handles are touched during evaluations.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
              2. Mandatory Human Approval Gate
            </h3>
            <p style={{ fontSize: "14px", color: "#4B463E", margin: 0, lineHeight: 1.7 }}>
              Under NPCI UPI guidelines, bank settlement is instant and irreversible. Therefore, BharatRaksha enforces a deterministic pure-code guardrail: <strong>zero autonomous refunds are executed without explicit human sign-off</strong>. All refund actions remain in <code>LOCKED_AWAITING_HUMAN_APPROVAL</code> until approved by the merchant via Telegram or the web interface.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
              3. Data Retention &amp; Demo Persistence
            </h3>
            <p style={{ fontSize: "14px", color: "#4B463E", margin: 0, lineHeight: 1.7 }}>
              Dispute records, simulated order telemetry, and juror evaluations reside in the localized in-memory demo store. Server restarts reset state to the three canonical seeded scenarios (Case A, Case B, Case C). No customer personal details or payment credentials are leaked to external LLM providers.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
              4. Evidence Dossiers &amp; Consumer Forum Disclaimer
            </h3>
            <p style={{ fontSize: "14px", color: "#4B463E", margin: 0, lineHeight: 1.7 }}>
              The bilingual evidence dossiers produced by BharatRaksha compile gateway reconciliation certificates, courier dispatch scales, and OTP logs for National Consumer Helpline (NCH) submission. While structured to meet evidentiary standards, BharatRaksha provides forensic synthesis and heuristics, not formal legal counsel.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
              5. Open Source License
            </h3>
            <p style={{ fontSize: "14px", color: "#4B463E", margin: 0, lineHeight: 1.7 }}>
              BharatRaksha is licensed under the MIT License. Copyright © 2026 Dhyey Patel (Team Leader), Snehil Sahay, Kislay Kumar, and Kartikey Singh.
            </p>
          </div>
        </div>

        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <Link
            href="/"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#C93A1B",
              textDecoration: "underline",
              textUnderlineOffset: "4px",
            }}
          >
            ← Return to BharatRaksha Home
          </Link>
        </div>
      </main>
    </div>
  );
}
