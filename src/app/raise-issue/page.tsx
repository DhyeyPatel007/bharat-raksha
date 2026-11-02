"use client";

import React, { useState } from "react";
import Link from "next/link";
import LanguageToggle from "@/components/upi/LanguageToggle";
import { useLanguage } from "@/lib/i18n";
import type { UpiCase } from "@/lib/upi/types";

export default function RaiseIssuePage() {
  const { language } = useLanguage();
  const isHi = language === "hi";

  const [rrn, setRrn] = useState("");
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedCase, setSubmittedCase] = useState<UpiCase | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    // Client-side validation: exactly 12 digits
    const cleanedRrn = rrn.trim();
    if (!/^\d{12}$/.test(cleanedRrn)) {
      setClientError(
        isHi
          ? "कृपया 12 अंकों का वैध यूपीआई RRN दर्ज करें।"
          : "Please enter a valid 12-digit UPI RRN (digits only)."
      );
      return;
    }

    if (!description.trim()) {
      setClientError(
        isHi
          ? "कृपया अपनी समस्या का विवरण दर्ज करें।"
          : "Please provide a description of the issue."
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/upi/cases/web-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rrn: cleanedRrn,
          orderId: orderId.trim() || undefined,
          phone: phone.trim() || undefined,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setClientError(
          data.error ||
            (isHi
              ? "इस RRN के साथ कोई भुगतान नहीं मिला। कृपया अपने यूपीआई ऐप से जांचें।"
              : "We couldn't find a payment with this RRN / order ID. Please check the 12-digit UPI RRN from your payment app and try again.")
        );
        return;
      }

      setAlreadyExists(Boolean(data.alreadyExists));
      setSubmittedCase(data.case);
    } catch {
      setClientError(
        isHi
          ? "सर्वर से संपर्क करने में त्रुटि। कृपया पुनः प्रयास करें।"
          : "An error occurred while connecting to the server. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            <span style={{ fontSize: "12px", color: "#755E46" }}>/ support</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/dashboard"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                backgroundColor: "#800020",
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

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: "700px", margin: "0 auto", padding: "56px 24px 80px 24px" }}>
        {!submittedCase ? (
          <div>
            <div style={{ marginBottom: "32px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#800020",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {isHi ? "ग्राहक सहायता पोर्टल" : "BUYER SUPPORT INTAKE"}
              </span>
              <h1
                style={{
                  fontFamily: "var(--font-serif, Georgia, serif)",
                  fontSize: "38px",
                  fontWeight: 400,
                  lineHeight: 1.15,
                  color: "#1A1A1A",
                  margin: "8px 0 12px 0",
                }}
              >
                {isHi ? "भुगतान या पार्सल संबंधी शिकायत दर्ज करें" : "Raise a Payment or Order Grievance"}
              </h1>
              <p style={{ fontSize: "15px", color: "#5A554E", margin: 0 }}>
                {isHi
                  ? "अपने यूपीआई ऐप (GPay, PhonePe, Paytm, BHIM) से 12 अंकों का RRN नंबर दर्ज करें। हमारी स्वायत्त प्रणाली तुरंत सत्यापन करेगी।"
                  : "Enter the 12-digit UPI RRN from your payment app. Our autonomous swarm will verify the bank clearing and parcel logistics."}
              </p>
            </div>

            {/* Error Banner */}
            {clientError && (
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: "#FFF1F2",
                  border: "1.5px solid #FECDD3",
                  borderRadius: "8px",
                  color: "#991B1B",
                  fontSize: "14px",
                  marginBottom: "24px",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                  ⚠️ {isHi ? "सत्यापन विफल" : "Verification Notice"}
                </div>
                {clientError}
              </div>
            )}

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1.5px solid #E6DFD5",
                borderRadius: "8px",
                padding: "32px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Field 1: UPI RRN (Required) */}
              <div>
                <label
                  htmlFor="upi-rrn-input"
                  style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "6px" }}
                >
                  {isHi ? "12-अंकीय यूपीआई RRN *" : "12-Digit UPI RRN *"}
                </label>
                <input
                  id="upi-rrn-input"
                  type="text"
                  maxLength={12}
                  required
                  placeholder="e.g. 631514892011"
                  value={rrn}
                  onChange={(e) => setRrn(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "6px",
                    border: "1px solid #D4C9BC",
                    fontSize: "15px",
                    fontFamily: "monospace",
                    letterSpacing: "0.05em",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: "11px", color: "#755E46", marginTop: "4px" }}>
                  {isHi
                    ? "यह 12 अंकों की संदर्भ संख्या आपके बैंक संदेश या यूपीआई ऐप में 'UPI Ref No / RRN' के रूप में मिलती है।"
                    : "Found in your GPay / PhonePe / Paytm / BHIM transaction details under 'UPI Ref No / RRN'."}
                </div>
              </div>

              {/* Field 2: Order ID (Optional) */}
              <div>
                <label
                  htmlFor="order-id-input"
                  style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "6px" }}
                >
                  {isHi ? "ऑर्डर संख्या (वैकल्पिक)" : "Order ID (Optional)"}
                </label>
                <input
                  id="order-id-input"
                  type="text"
                  placeholder="e.g. ORD-KRY-8801"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "6px",
                    border: "1px solid #D4C9BC",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Field 3: Phone (Optional) */}
              <div>
                <label
                  htmlFor="phone-input"
                  style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "6px" }}
                >
                  {isHi ? "मोबाइल नंबर (वैकल्पिक)" : "Contact Phone (Optional)"}
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "6px",
                    border: "1px solid #D4C9BC",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Field 4: Description (Required) */}
              <div>
                <label
                  htmlFor="description-input"
                  style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "6px" }}
                >
                  {isHi ? "समस्या का विवरण *" : "Issue Description *"}
                </label>
                <textarea
                  id="description-input"
                  required
                  rows={4}
                  placeholder={
                    isHi
                      ? "विस्तार से बताएं: क्या पैसे दो बार कटे, पार्सल क्षतिग्रस्त था, या पार्सल प्राप्त नहीं हुआ?"
                      : "Describe what happened: e.g. Money debited twice, damaged package, stalled tracking, empty box..."
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "6px",
                    border: "1px solid #D4C9BC",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Quick Fill Demo Helper */}
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: "#FBF9F5",
                  border: "1px dashed #D4C9BC",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#755E46",
                }}
              >
                <strong>💡 Demo Test Helper (Click to autofill valid seeded payments):</strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRrn("631514892011");
                      setOrderId("ORD-KRY-8801");
                      setDescription("Money was debited twice on UPI for my order.");
                    }}
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #DECFC0",
                      backgroundColor: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    Seeded Case A (631514892011)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRrn("631518440293");
                      setOrderId("ORD-KRY-8802");
                      setDescription("Item arrived with severe surface scratches.");
                    }}
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #DECFC0",
                      backgroundColor: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    Seeded Case B (631518440293)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRrn("631519773104");
                      setOrderId("ORD-KRY-8803");
                      setDescription("Shipment tracking has been stalled for over 8 days.");
                    }}
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #DECFC0",
                      backgroundColor: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    Seeded Case C (631519773104)
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "14px",
                  borderRadius: "6px",
                  backgroundColor: submitting ? "#9CA3AF" : "#800020",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 700,
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {submitting ? (
                  <span>Evaluating with Swarm...</span>
                ) : (
                  <>
                    <span>{isHi ? "शिकायत दर्ज करें और फोरेंसिक जांच चलाएं" : "Submit Claim for Forensic Verification"}</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* STATUS VIEW FOR SUBMITTED CLAIM */
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #E6DFD5",
              borderRadius: "8px",
              padding: "40px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 12px",
                backgroundColor: "#ECFDF5",
                border: "1px solid #A7F3D0",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#065F46",
                marginBottom: "20px",
              }}
            >
              <span>✓</span>
              <span>{isHi ? "शिकायत सफलतापूर्वक प्राप्त हुई" : "Claim Ingested Successfully"}</span>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "32px",
                fontWeight: 400,
                color: "#1A1A1A",
                margin: "0 0 16px 0",
              }}
            >
              {isHi ? "जांच पूर्ण — व्यापारी समीक्षाधीन" : "Verification Complete — Awaiting Merchant Action"}
            </h1>

            <p style={{ fontSize: "15px", color: "#4B463E", lineHeight: 1.6, marginBottom: "24px" }}>
              {isHi
                ? "हमारी 3-ज्यूरर प्रणाली ने बैंक रिकॉर्ड और कूरियर टेलीमेट्री का परीक्षण कर लिया है। आपके दावे का विवरण मर्चेंट को टेलीग्राम पर भेज दिया गया है।"
                : "The 3-juror swarm has cross-examined your UPI RRN against gateway logs and courier telemetry. The findings have been sent to the merchant's Telegram for sign-off."}
            </p>

            {alreadyExists && (
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: "#FFFBEB",
                  border: "1.5px solid #FDE68A",
                  borderRadius: "8px",
                  color: "#92400E",
                  fontSize: "14px",
                  marginBottom: "20px",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                  ℹ️ {isHi ? "पूर्व-विद्यमान दावा सूचना" : "Existing Case Record"}
                </div>
                {isHi
                  ? `इस RRN के लिए पहले से एक मामला दर्ज है — वर्तमान स्थिति: ${submittedCase.status}। पूर्व मूल्यांकन सुरक्षित रखा गया है।`
                  : `A case for this RRN already exists — status: ${submittedCase.status}. Your previous adjudication record is preserved.`}
              </div>
            )}

            {/* Case Details Card */}
            <div
              style={{
                padding: "24px",
                backgroundColor: "#FBF9F5",
                border: "1px solid #E6DFD5",
                borderRadius: "6px",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "14px" }}>
                <div>
                  <div style={{ color: "#755E46", fontSize: "12px", fontWeight: 600 }}>CASE ID</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#1A1A1A", fontSize: "15px" }}>
                    {submittedCase.case_id}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#755E46", fontSize: "12px", fontWeight: 600 }}>UPI RRN</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#1A1A1A" }}>
                    {submittedCase.upi_rrn}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#755E46", fontSize: "12px", fontWeight: 600 }}>VERDICT &amp; SCORE</div>
                  <div style={{ fontWeight: 700, color: "#800020" }}>
                    {submittedCase.verdict} ({submittedCase.score}/100)
                  </div>
                </div>
                <div>
                  <div style={{ color: "#755E46", fontSize: "12px", fontWeight: 600 }}>RECOMMENDED REFUND</div>
                  <div style={{ fontWeight: 800, color: "#166534", fontSize: "16px" }}>
                    ₹{(submittedCase.recommended_refund_paise / 100).toFixed(2)}
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ color: "#755E46", fontSize: "12px", fontWeight: 600 }}>CURRENT STATUS</div>
                  <div style={{ fontWeight: 700, color: "#800020" }}>
                    With the merchant for approval (Alert dispatched to Telegram)
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <Link
                href={`/dashboard/${submittedCase.case_id}`}
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  backgroundColor: "#800020",
                  color: "#FFFFFF",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                Inspect Case in Dashboard →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmittedCase(null);
                  setAlreadyExists(false);
                  setRrn("");
                  setOrderId("");
                  setPhone("");
                  setDescription("");
                  setClientError(null);
                }}
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  backgroundColor: "#F7F3EA",
                  color: "#1A1A1A",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid #DECFC0",
                  cursor: "pointer",
                }}
              >
                Submit Another Issue
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
