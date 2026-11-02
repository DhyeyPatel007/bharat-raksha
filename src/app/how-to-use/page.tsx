"use client";

import React from "react";
import Link from "next/link";
import LanguageToggle from "@/components/upi/LanguageToggle";
import { useLanguage } from "@/lib/i18n";

export default function HowToUsePage() {
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
            <span style={{ fontSize: "12px", color: "#755E46" }}>/ guide</span>
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
        {/* Title */}
        <div style={{ marginBottom: "40px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#C93A1B",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {isHi ? "व्यापारी एवं ग्राहक संदर्शिका" : "SYSTEM RUNBOOK & GUIDE"}
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "42px",
              fontWeight: 400,
              lineHeight: 1.15,
              color: "#1A1A1A",
              margin: "8px 0 16px 0",
            }}
          >
            {isHi ? "भारत रक्षा का उपयोग कैसे करें" : "How BharatRaksha Works"}
          </h1>
          <p style={{ fontSize: "17px", color: "#5A554E", margin: 0 }}>
            {isHi
              ? "यूपीआई दावों की जांच, टेलीग्राम मर्चेंट अलर्ट, और मानवीय स्वीकृति द्वारा सुरक्षित रिफंड की पूर्ण चरणबद्ध गाइड।"
              : "A step-by-step runbook for merchants and buyers explaining intake, forensic adjudication, and 1-tap Telegram resolution."}
          </p>
        </div>

        {/* SECTION 1: INTAKE */}
        <section
          style={{
            backgroundColor: "#FFFFFF",
            border: "1.5px solid #E6DFD5",
            borderRadius: "8px",
            padding: "32px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "24px",
                color: "#C93A1B",
                fontWeight: 700,
              }}
            >
              01
            </span>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
              {isHi ? "दावा दर्ज करना (Multichannel Ingest)" : "Submitting a Claim (Multichannel Ingest)"}
            </h2>
          </div>
          <p style={{ fontSize: "14px", color: "#4B463E", lineHeight: 1.7, margin: "0 0 16px 0" }}>
            {isHi
              ? "ग्राहक तीन चैनलों के माध्यम से अपनी शिकायत दर्ज कर सकते हैं:"
              : "Buyers can lodge payment issues through three separate channels without downloading specialized apps:"}
          </p>
          <ul style={{ fontSize: "14px", color: "#4B463E", lineHeight: 1.8, paddingLeft: "20px" }}>
            <li>
              <strong>Telegram Merchant Group:</strong> Buyers post their message in the merchant's payment-issues group including their 12-digit UPI RRN. The bot acknowledges the message in the group while dispatching the full case to the merchant's DM.
            </li>
            <li>
              <strong>Telegram Buyer Support Bot:</strong> Direct message to the Telegram bot with the RRN and issue description.
            </li>
            <li>
              <strong>Web Intake Form (<code>/raise-issue</code>):</strong> A browser-accessible form with strict 12-digit UPI RRN validation and real-time status tracking.
            </li>
          </ul>

          <div
            style={{
              marginTop: "20px",
              padding: "14px 18px",
              backgroundColor: "#FBF9F5",
              border: "1px solid #E6DFD5",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#755E46",
            }}
          >
            <strong>🛡️ The ORDER_NOT_FOUND Guard:</strong> If a message does not contain a 12-digit RRN, the system asks for it. If the RRN is not found in the merchant's store or Razorpay records, the claim is rejected immediately with an informative message. No fake cases are ever created.
          </div>
        </section>

        {/* SECTION 2: FORENSICS */}
        <section
          style={{
            backgroundColor: "#FFFFFF",
            border: "1.5px solid #E6DFD5",
            borderRadius: "8px",
            padding: "32px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "24px",
                color: "#C93A1B",
                fontWeight: 700,
              }}
            >
              02
            </span>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
              {isHi ? "3-ज्यूरर फोरेंसिक जांच" : "Autonomous 3-Juror Swarm Investigation"}
            </h2>
          </div>
          <p style={{ fontSize: "14px", color: "#4B463E", lineHeight: 1.7, margin: "0 0 16px 0" }}>
            Once a valid RRN is received, the swarm executes three parallel audits:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "12px 16px", backgroundColor: "#F7F3EA", borderRadius: "6px" }}>
              <strong>Juror 1 (Gateway State):</strong> Reconciles the UPI RRN against Razorpay API telemetry. Identifies double captures or confirms genuine settlement status.
            </div>
            <div style={{ padding: "12px 16px", backgroundColor: "#F7F3EA", borderRadius: "6px" }}>
              <strong>Juror 2 (Order &amp; Logistics):</strong> Verifies Shiprocket courier telemetry. Cross-checks warehouse scale weight against carrier transit weight and inspects doorstep delivery OTP verification.
            </div>
            <div style={{ padding: "12px 16px", backgroundColor: "#F7F3EA", borderRadius: "6px" }}>
              <strong>Juror 3 (Buyer History &amp; Trust):</strong> Audits previous return rates, claim velocity, and abuse patterns to protect the seller from organized fraud rings.
            </div>
          </div>
          <div style={{ marginTop: "16px", fontSize: "13px", color: "#5A554E" }}>
            <strong>Hare-Niemeyer Score Math:</strong> Juror score points are mathematically normalized so that Juror 1 + Juror 2 + Juror 3 points always sum exactly to the final 0–100 verdict score.
          </div>
        </section>

        {/* SECTION 3: TELEGRAM MERCHANT BOT */}
        <section
          style={{
            backgroundColor: "#FFFFFF",
            border: "1.5px solid #E6DFD5",
            borderRadius: "8px",
            padding: "32px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "24px",
                color: "#C93A1B",
                fontWeight: 700,
              }}
            >
              03
            </span>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
              {isHi ? "टेलीग्राम मर्चेंट बॉट सेटअप" : "Telegram Merchant Controller Setup"}
            </h2>
          </div>
          <p style={{ fontSize: "14px", color: "#4B463E", lineHeight: 1.7, margin: "0 0 16px 0" }}>
            Merchants can control the entire system straight from their personal Telegram account:
          </p>
          <ol style={{ fontSize: "14px", color: "#4B463E", lineHeight: 1.8, paddingLeft: "20px" }}>
            <li>
              <strong>Register as Merchant:</strong> Open your bot in Telegram and send <code>/start</code>. Your chat is instantly registered as the merchant authority.
            </li>
            <li>
              <strong>Query Open Cases:</strong> Send <code>/status</code> to receive a live list of all pending claims awaiting your approval.
            </li>
            <li>
              <strong>Receive Interactive Alerts:</strong> Every newly ingested claim sends an alert to your chat with:
              <br />
              • <code>[✅ Approve ₹X]</code> — Executes irreversible UPI refund live via Razorpay.
              <br />
              • <code>[❌ Reject]</code> — Marks claim rejected and seals the defense dossier.
              <br />
              • <code>[🔍 View Details]</code> — Summarizes juror reasoning and telemetry anchors.
            </li>
            <li>
              <strong>Add Bot to Telegram Support Groups:</strong> Add the bot to your merchant customer support group. Set the bot as Admin or disable group privacy via BotFather (<code>/setprivacy</code> → Disable) so the bot can parse claims.
            </li>
          </ol>
        </section>

        {/* SECTION 4: HUMAN GATE */}
        <section
          style={{
            backgroundColor: "#FFFFFF",
            border: "1.5px solid #E6DFD5",
            borderRadius: "8px",
            padding: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "24px",
                color: "#C93A1B",
                fontWeight: 700,
              }}
            >
              04
            </span>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
              {isHi ? "मानवीय स्वीकृति द्वार एवं उपभोक्ता फोरम डॉसियर" : "Mandatory Human Gate & NCH Evidence Dossier"}
            </h2>
          </div>
          <p style={{ fontSize: "14px", color: "#4B463E", lineHeight: 1.7, margin: "0 0 16px 0" }}>
            UPI refunds in India are instantaneous and irreversible. Unlike credit card chargeback systems where merchants can contest disputed amounts with banks, UPI payments credit directly to the customer's VPA.
          </p>
          <ul style={{ fontSize: "14px", color: "#4B463E", lineHeight: 1.8, paddingLeft: "20px" }}>
            <li>
              <strong>Mandatory Human Gate:</strong> No autonomous agent is permitted to move merchant money without explicit merchant approval.
            </li>
            <li>
              <strong>National Consumer Helpline (NCH) Dossier:</strong> When a fraudulent claim is rejected, BharatRaksha automatically compiles a signed, multi-page evidentiary PDF dossier containing RRN clearing certificates, courier weights, and OTP logs ready for Consumer Forum submission.
            </li>
          </ul>

          <div style={{ marginTop: "24px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                fontSize: "14px",
                fontWeight: 700,
                backgroundColor: "#C93A1B",
                color: "#FFFFFF",
                padding: "10px 20px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              Open Merchant Dashboard →
            </Link>
            <Link
              href="/raise-issue"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                backgroundColor: "#F7F3EA",
                color: "#1A1A1A",
                padding: "10px 20px",
                borderRadius: "6px",
                textDecoration: "none",
                border: "1px solid #DECFC0",
              }}
            >
              Test Buyer Web Intake
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid #E6DFD5",
          backgroundColor: "#F7F3EA",
          padding: "32px",
          textAlign: "center",
          fontSize: "13px",
          color: "#755E46",
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          BharatRaksha • Autonomous UPI Dispute &amp; Claim Shield • MIT License
        </div>
      </footer>
    </div>
  );
}
