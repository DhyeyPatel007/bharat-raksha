"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import LanguageToggle from "@/components/upi/LanguageToggle";
import { useLanguage } from "@/lib/i18n";

export default function BharatRakshaLandingPage() {
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
      {/* 1. TOP EDITORIAL NAVIGATION */}
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
            maxWidth: "1240px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {/* Logo & Identity */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#1A1A1A",
              }}
            >
              BharatRaksha
            </span>
            <span
              style={{
                fontSize: "15px",
                color: "#755E46",
                fontWeight: 500,
              }}
            >
              (भारत रक्षा)
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                backgroundColor: "#FBEAE7",
                color: "#C93A1B",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid #F5CCC4",
                letterSpacing: "0.05em",
              }}
            >
              UPI SHIELD
            </span>
          </Link>

          {/* Navigation Links & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <Link
              href="/how-to-use"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#4B463E",
                textDecoration: "none",
              }}
            >
              {isHi ? "उपयोग निर्देश" : "How it Works"}
            </Link>
            <Link
              href="/terms"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#4B463E",
                textDecoration: "none",
              }}
            >
              {isHi ? "शर्तें एवं नियम" : "Terms"}
            </Link>
            <Link
              href="/raise-issue"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#C93A1B",
                textDecoration: "none",
              }}
            >
              {isHi ? "शिकायत दर्ज करें" : "Raise an Issue"}
            </Link>
            <Link
              href="/dashboard"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                backgroundColor: "#C93A1B",
                color: "#FFFFFF",
                padding: "8px 18px",
                borderRadius: "6px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{isHi ? "डैशबोर्ड खोलें" : "Open Dashboard"}</span>
              <span>→</span>
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION — EDITORIAL SERIF & VERMILION ACCENT */}
      <section
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "72px 32px 56px 32px",
        }}
      >
        <div style={{ maxWidth: "860px" }}>
          {/* Accent Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              backgroundColor: "#F4EBE1",
              border: "1px solid #DECFC0",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#755E46",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "24px",
            }}
          >
            <span style={{ color: "#C93A1B" }}>●</span>
            <span>
              {isHi
                ? "भारतीय D2C विक्रेताओं के लिए स्वायत्त यूपीआई दावा ढाल"
                : "Autonomous Refund & Claim Shield for Indian D2C Merchants"}
            </span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "clamp(42px, 5.5vw, 68px)",
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#1A1A1A",
              margin: "0 0 24px 0",
            }}
          >
            {isHi ? (
              <>
                फर्जी यूपीआई रिफंड दावों पर <span style={{ color: "#C93A1B" }}>पैसा गवाना</span> बंद करें।
              </>
            ) : (
              <>
                Stop bleeding money on <span style={{ color: "#C93A1B" }}>fraudulent UPI refund claims</span>.
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "19px",
              color: "#4B463E",
              lineHeight: 1.6,
              margin: "0 0 36px 0",
              maxWidth: "760px",
            }}
          >
            {isHi
              ? "जब ग्राहक 'पैसे कट गए' या 'पार्सल खाली निकला' का दावा करते हैं, तो भारत रक्षा का 3-ज्यूरर एलएलएम स्वार्म सीधे रेज़रपे यूपीआई RRN, शिपराकेट वजन प्रमाण पत्र, और डिलीवरी ओटीपी टेलीमेट्री की निष्पक्ष जांच करता है। प्रत्येक रिफंड से पहले मानवीय स्वीकृति अनिवार्य है।"
              : "When customers claim 'money debited twice' or 'empty box delivered', BharatRaksha's 3-juror LLM swarm cross-examines live Razorpay UPI RRN clearing, Shiprocket warehouse dispatch scale weights, and doorstep OTP telemetry. Every single payout requires human sign-off."}
          </p>

          {/* Hero CTAs */}
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href="/dashboard"
              style={{
                fontSize: "15px",
                fontWeight: 700,
                backgroundColor: "#C93A1B",
                color: "#FFFFFF",
                padding: "14px 28px",
                borderRadius: "6px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{isHi ? "लाइव डेमो आज़माएं" : "Try the Live Demo"}</span>
              <span>→</span>
            </Link>

            <Link
              href="/raise-issue"
              style={{
                fontSize: "15px",
                fontWeight: 700,
                backgroundColor: "#FFFFFF",
                color: "#1A1A1A",
                padding: "14px 28px",
                borderRadius: "6px",
                textDecoration: "none",
                border: "1.5px solid #DECFC0",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📝</span>
              <span>{isHi ? "ग्राहक शिकायत पोर्टल" : "Raise an Issue"}</span>
            </Link>

            <Link
              href="/how-to-use"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#755E46",
                padding: "14px 18px",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              {isHi ? "यह कैसे काम करता है?" : "How it works guide"}
            </Link>
          </div>

          {/* Quick proof stats bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "24px",
              marginTop: "48px",
              paddingTop: "32px",
              borderTop: "1px solid #E6DFD5",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: "32px", color: "#1A1A1A" }}>
                100%
              </div>
              <div style={{ fontSize: "12px", color: "#755E46", fontWeight: 600, textTransform: "uppercase" }}>
                {isHi ? "मानवीय स्वीकृति द्वार" : "Human Approval Gate"}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: "32px", color: "#C93A1B" }}>
                12 Digits
              </div>
              <div style={{ fontSize: "12px", color: "#755E46", fontWeight: 600, textTransform: "uppercase" }}>
                {isHi ? "यूपीआई RRN समाधान" : "UPI RRN Reconciliation"}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: "32px", color: "#1A1A1A" }}>
                3 Jurors
              </div>
              <div style={{ fontSize: "12px", color: "#755E46", fontWeight: 600, textTransform: "uppercase" }}>
                {isHi ? "एलएलएम साक्ष्य परीक्षण" : "LLM Evidence Swarm"}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: "32px", color: "#1A1A1A" }}>
                ₹0.00
              </div>
              <div style={{ fontSize: "12px", color: "#755E46", fontWeight: 600, textTransform: "uppercase" }}>
                {isHi ? "बिना पुष्टि के रिफंड" : "Silent Auto-Payouts"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS — 3-STEP INFOGRAPHIC SECTION */}
      <section
        style={{
          borderTop: "1px solid #E6DFD5",
          borderBottom: "1px solid #E6DFD5",
          backgroundColor: "#FFFFFF",
          padding: "64px 32px",
        }}
      >
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
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
              {isHi ? "3-चरणीय स्वायत्त प्रक्रिया" : "THE 3-STEP FLOW"}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "36px",
                fontWeight: 400,
                color: "#1A1A1A",
                margin: "8px 0 12px 0",
              }}
            >
              {isHi ? "दावा आने से लेकर निर्णय तक की यात्रा" : "From customer grievance to verified resolution"}
            </h2>
            <p style={{ fontSize: "15px", color: "#5A554E", maxWidth: "680px", margin: 0 }}>
              {isHi
                ? "पारंपरिक ई-कॉमर्स बिना जांचे रिफंड दे देता है। भारत रक्षा हर दावे की गहराई से पड़ताल करता है।"
                : "Traditional stores either blindly refund or stall buyers for weeks. BharatRaksha investigates immediately and protects seller margins."}
            </p>
          </div>

          {/* Infographic Visual Asset */}
          <div
            style={{
              padding: "24px",
              backgroundColor: "#FBF9F5",
              border: "1.5px solid #E6DFD5",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <img
              src="/assets/flow-diagram.svg"
              alt="BharatRaksha 3-Step Flow Diagram"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        </div>
      </section>

      {/* 4. THE 3-JUROR SWARM ARCHITECTURE */}
      <section
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "72px 32px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "48px",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#C93A1B",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {isHi ? "स्वार्म वास्तुकला" : "SWARM ARCHITECTURE"}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "36px",
                fontWeight: 400,
                color: "#1A1A1A",
                margin: "8px 0 16px 0",
                lineHeight: 1.15,
              }}
            >
              {isHi ? "3 एलएलएम ज्यूरर और गणितीय अंक प्रणाली" : "Three LLM Jurors with proportional score math"}
            </h2>
            <p style={{ fontSize: "15px", color: "#4B463E", lineHeight: 1.6, marginBottom: "20px" }}>
              {isHi
                ? "प्रत्येक दावा तीन स्वतंत्र विशेषज्ञों द्वारा परखा जाता है (Qwen 30B via Token Factory)। अंक प्रणाली हेयर-नीमेयर (Largest-Remainder) विधि से विभाजित की जाती है ताकि प्रत्येक ज्यूरर का योगदान अंतिम स्कोर के बिल्कुल बराबर रहे।"
                : "Each case is evaluated across three isolated perspectives by Qwen 30B via Token Factory. Juror point contributions are distributed via Hare-Niemeyer proportional allocation so the displayed juror breakdown equals the exact verdict score."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "14px 18px", backgroundColor: "#FFFFFF", border: "1px solid #E6DFD5", borderRadius: "6px" }}>
                <strong style={{ color: "#1A1A1A", fontSize: "14px" }}>Juror 1: Gateway State Auditor</strong>
                <div style={{ fontSize: "13px", color: "#5A554E", marginTop: "3px" }}>
                  Verifies Razorpay settlement status, checks for duplicate captures on the 12-digit RRN, and eliminates false double-debit claims.
                </div>
              </div>

              <div style={{ padding: "14px 18px", backgroundColor: "#FFFFFF", border: "1px solid #E6DFD5", borderRadius: "6px" }}>
                <strong style={{ color: "#1A1A1A", fontSize: "14px" }}>Juror 2: Order &amp; Fulfillment Forensics</strong>
                <div style={{ fontSize: "13px", color: "#5A554E", marginTop: "3px" }}>
                  Compares dispatch weighing scale certificates against courier transit logs and doorstep OTP delivery confirmation to expose empty-box fraud.
                </div>
              </div>

              <div style={{ padding: "14px 18px", backgroundColor: "#FFFFFF", border: "1px solid #E6DFD5", borderRadius: "6px" }}>
                <strong style={{ color: "#1A1A1A", fontSize: "14px" }}>Juror 3: Buyer History &amp; Guardrail Auditor</strong>
                <div style={{ fontSize: "13px", color: "#5A554E", marginTop: "3px" }}>
                  Audits customer refund velocity, past return frequency, and enforces merchant policy thresholds before unlocking goodwill settlements.
                </div>
              </div>
            </div>
          </div>

          <div>
            <div
              style={{
                padding: "20px",
                backgroundColor: "#FFFFFF",
                border: "1.5px solid #E6DFD5",
                borderRadius: "8px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              <img
                src="/assets/swarm-architecture.svg"
                alt="BharatRaksha 3-Juror Swarm Architecture"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. TELEGRAM MERCHANT CONTROLLER */}
      <section
        style={{
          borderTop: "1px solid #E6DFD5",
          borderBottom: "1px solid #E6DFD5",
          backgroundColor: "#FBF9F5",
          padding: "72px 32px",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "48px",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ maxWidth: "340px", width: "100%" }}>
              <img
                src="/assets/telegram-bot-mockup.svg"
                alt="Telegram Merchant Bot Interactive Interface"
                style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.08))" }}
              />
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#C93A1B",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {isHi ? "टेलीग्राम मर्चेंट बॉट" : "TELEGRAM MERCHANT CONTROLLER"}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "36px",
                fontWeight: 400,
                color: "#1A1A1A",
                margin: "8px 0 16px 0",
                lineHeight: 1.15,
              }}
            >
              {isHi ? "बिना किसी वेबसाइट के पूरे दावे टेलीग्राम से प्रबंधित करें" : "Run the entire shield from your phone — no login required"}
            </h2>
            <p style={{ fontSize: "15px", color: "#4B463E", lineHeight: 1.6, marginBottom: "24px" }}>
              {isHi
                ? "जब भी ग्राहक कोई दावा दर्ज करता है, मर्चेंट को उनके टेलीग्राम पर तुरंत एक अलर्ट संदेश प्राप्त होता है। एक टैप में स्वीकृति (Approve), अस्वीकृति (Reject), या ज्यूरर विवरण (Details) देखा जा सकता है।"
                : "The merchant doesn't need to stay glued to a computer. Whenever a buyer submits a claim in a support group or via the bot, an interactive alert arrives in the merchant's personal Telegram DM with instant 1-tap action buttons."}
            </p>

            <ul style={{ paddingLeft: "20px", fontSize: "14px", color: "#4B463E", lineHeight: 1.8 }}>
              <li>
                <strong>Instant Alert:</strong> Case ID, Order ID, 12-digit UPI RRN, Verdict, and Recommended Refund.
              </li>
              <li>
                <strong>1-Tap Payout:</strong> Tapping <code>Approve</code> triggers the live Razorpay UPI refund instantly.
              </li>
              <li>
                <strong>Group Privacy Protected:</strong> Public groups receive brief acknowledgements and outcomes only; private merchant controls stay in personal DM.
              </li>
              <li>
                <strong>Zero Setup Hassle:</strong> No Meta WhatsApp business verification hurdles. Start via Telegram BotFather in 60 seconds.
              </li>
            </ul>

            <div style={{ marginTop: "24px" }}>
              <Link
                href="/how-to-use"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#C93A1B",
                  textDecoration: "underline",
                  textUnderlineOffset: "4px",
                }}
              >
                {isHi ? "टेलीग्राम बॉट सेटअप गाइड पढ़ें →" : "Read Telegram bot connection runbook →"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LIVE DEMO SEEDED CASES SECTION */}
      <section
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "72px 32px",
        }}
      >
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
            {isHi ? "सीडेड टेस्ट मामले" : "LIVE VERIFIED CASES"}
          </span>
          <h2
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "36px",
              fontWeight: 400,
              color: "#1A1A1A",
              margin: "8px 0 12px 0",
            }}
          >
            {isHi ? "3 प्रमुख ई-कॉमर्स विवाद परिदृश्य" : "Explore the three foundational D2C scenarios"}
          </h2>
          <p style={{ fontSize: "15px", color: "#5A554E", maxWidth: "700px", margin: 0 }}>
            {isHi
              ? "प्रत्येक परिदृश्य को रेज़रपे और शिपराकेट के वास्तविक डेटा के साथ परखा गया है। डैशबोर्ड में किसी भी मामले पर क्लिक करके एलएलएम स्वार्म को लाइव चलाएं।"
              : "Each scenario reflects real-world Indian UPI commerce challenges. Open any case in the dashboard to inspect the evidence dossier and run the LLM swarm live."}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          {/* Case A */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #E6DFD5",
              borderRadius: "8px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 700, color: "#755E46" }}>
                  UPI-CASE-A
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    backgroundColor: "#FEE2E2",
                    color: "#991B1B",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  82/100 REJECT
                </span>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
                Double Debit &amp; Empty Box
              </h3>
              <div style={{ fontSize: "13px", color: "#C93A1B", fontWeight: 600, marginBottom: "8px" }}>
                Claimed: ₹3,200.00 • Recommended Refund: ₹0.00
              </div>
              <p style={{ fontSize: "13px", color: "#5A554E", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                Buyer claimed money was debited twice and received an empty box. Razorpay shows a single valid capture; Shiprocket shows 0.42kg dispatch matched courier delivery scale with verified doorstep OTP.
              </p>
            </div>
            <Link
              href="/dashboard/UPI-CASE-A"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#1A1A1A",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#F7F3EA",
                borderRadius: "4px",
                border: "1px solid #DECFC0",
                width: "fit-content",
              }}
            >
              <span>Inspect Case A</span>
              <span>→</span>
            </Link>
          </div>

          {/* Case B */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #E6DFD5",
              borderRadius: "8px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 700, color: "#755E46" }}>
                  UPI-CASE-B
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  60/100 OFFER
                </span>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
                Cosmetic Damage on Premium Good
              </h3>
              <div style={{ fontSize: "13px", color: "#92400E", fontWeight: 600, marginBottom: "8px" }}>
                Claimed: ₹1,200.00 • Goodwill Refund: ₹300.00
              </div>
              <p style={{ fontSize: "13px", color: "#5A554E", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                Buyer reported scratched surface on a luxury leather wallet. Order was delivered in full; Juror 3 recommends a 25% goodwill partial settlement (₹300.00) locked behind mandatory human gate.
              </p>
            </div>
            <Link
              href="/dashboard/UPI-CASE-B"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#1A1A1A",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#F7F3EA",
                borderRadius: "4px",
                border: "1px solid #DECFC0",
                width: "fit-content",
              }}
            >
              <span>Inspect Case B</span>
              <span>→</span>
            </Link>
          </div>

          {/* Case C */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #E6DFD5",
              borderRadius: "8px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 700, color: "#755E46" }}>
                  UPI-CASE-C
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    backgroundColor: "#DCFCE7",
                    color: "#166534",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  15/100 REFUND
                </span>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px 0" }}>
                Lost in Transit via Courier Hub
              </h3>
              <div style={{ fontSize: "13px", color: "#166534", fontWeight: 600, marginBottom: "8px" }}>
                Claimed: ₹2,499.00 • Full Refund: ₹2,499.00
              </div>
              <p style={{ fontSize: "13px", color: "#5A554E", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                Shiprocket AWB telemetry indicates package stalled at regional transit hub for &gt;7 days. Swarm recommends 100% refund, locked awaiting merchant authorization before bank execution.
              </p>
            </div>
            <Link
              href="/dashboard/UPI-CASE-C"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#1A1A1A",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#F7F3EA",
                borderRadius: "4px",
                border: "1px solid #DECFC0",
                width: "fit-content",
              }}
            >
              <span>Inspect Case C</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. HACKATHON & TEAM CREDITS */}
      <section
        style={{
          borderTop: "1px solid #E6DFD5",
          backgroundColor: "#FBF9F5",
          padding: "64px 32px",
        }}
      >
        <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
          <div
            style={{
              padding: "32px",
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #E6DFD5",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "36px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#C93A1B",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  HACKATHON TRACK
                </span>
                <h3
                  style={{
                    fontFamily: "var(--font-serif, Georgia, serif)",
                    fontSize: "26px",
                    color: "#1A1A1A",
                    margin: "8px 0 12px 0",
                  }}
                >
                  AgentX 2026 — Problem Statement PS-04
                </h3>
                <p style={{ fontSize: "14px", color: "#5A554E", lineHeight: 1.6, margin: "0 0 12px 0" }}>
                  <strong>PS-04: Autonomous Support Agent for Online Sellers.</strong> Built to safeguard Indian merchants against payment clearing disputes, doorstep delivery fraud, and consumer forum arbitration penalties.
                </p>
                <div style={{ fontSize: "12px", color: "#755E46" }}>
                  • <strong>Idea Round:</strong> November 2, 2026<br />
                  • <strong>Build Round:</strong> November 11–12, 2026
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#C93A1B",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  THE BUILD TEAM
                </span>
                <h3
                  style={{
                    fontFamily: "var(--font-serif, Georgia, serif)",
                    fontSize: "26px",
                    color: "#1A1A1A",
                    margin: "8px 0 12px 0",
                  }}
                >
                  Core Contributors
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", color: "#333333" }}>
                  <div>
                    <strong>Dhyey Patel</strong> — <span style={{ color: "#C93A1B", fontWeight: 700 }}>Team Leader &amp; Architect</span>
                  </div>
                  <div>
                    <strong>Snehil Sahay</strong> — Swarm &amp; Logistics Forensics
                  </div>
                  <div>
                    <strong>Kislay Kumar</strong> — Gateway &amp; Telemetry Integrations
                  </div>
                  <div>
                    <strong>Kartikey Singh</strong> — Adjudication &amp; Policy Engineering
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer
        style={{
          borderTop: "1px solid #E6DFD5",
          backgroundColor: "#F7F3EA",
          padding: "40px 32px 48px 32px",
          fontSize: "13px",
          color: "#755E46",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <span style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: "18px", color: "#1A1A1A", fontWeight: 700 }}>
              BharatRaksha
            </span>{" "}
            — Autonomous UPI Claim Defense Shield.
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              MIT License • © 2026 Dhyey Patel &amp; Team.
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <Link href="/dashboard" style={{ color: "#1A1A1A", fontWeight: 600, textDecoration: "none" }}>
              Dashboard
            </Link>
            <Link href="/raise-issue" style={{ color: "#1A1A1A", fontWeight: 600, textDecoration: "none" }}>
              Raise Issue
            </Link>
            <Link href="/how-to-use" style={{ color: "#1A1A1A", fontWeight: 600, textDecoration: "none" }}>
              How it Works
            </Link>
            <Link href="/terms" style={{ color: "#1A1A1A", fontWeight: 600, textDecoration: "none" }}>
              Terms &amp; Disclaimers
            </Link>
            <a
              href="https://github.com/DhyeyPatel007/bharat-raksha"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#C93A1B", fontWeight: 700, textDecoration: "none" }}
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
