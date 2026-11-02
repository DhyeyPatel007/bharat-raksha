"use client";

// PHALANX UPI — Bilingual Engine (English & हिंदी)
// Zero hardcoded strings in UPI views. Persisted via localStorage ("phalanx_lang").

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "hi";

export interface I18nDictionary {
  // Brand & Navigation
  brand_title: string;
  brand_subtitle: string;
  nav_paypal: string;
  nav_upi: string;
  switch_to_upi: string;
  switch_to_paypal: string;
  reset_demo: string;
  reset_success: string;
  telemetry_status: string;

  // Actions & Buttons
  refund: string;
  approve: string;
  reject: string;
  awaiting_approval: string;
  payment_successful: string;
  payment_failed: string;
  download_dossier: string;
  view_dossier: string;
  simulate_claim: string;
  send_whatsapp_message: string;
  confirm_approval_title: string;
  confirm_approval_desc: string;
  confirm_refund_btn: string;
  cancel: string;

  // Verdicts
  verdict_reject: string;
  verdict_offer: string;
  verdict_refund: string;

  // Guardrails
  guardrail_auto: string;
  guardrail_locked: string;
  guardrail_blocked_failed: string;
  guardrail_blocked_authorized: string;
  guardrail_approved_ready: string;
  guardrail_rejected_dossier: string;

  // Transaction Details & Badges
  upi_rrn: string;
  order_id: string;
  payment_id: string;
  awb_number: string;
  amount: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  claim_reason: string;
  score: string;
  checklist_score: string;

  // Timeline Steps
  step_1_payment: string;
  step_2_intake: string;
  step_3_audit: string;
  step_4_guardrail: string;
  step_5_resolution: string;

  // Juror Titles
  juror_gateway_title: string;
  juror_fulfillment_title: string;
  juror_buyer_risk_title: string;

  // 10 Canonical Gap Buckets
  gap_missing_tracking: string;
  gap_missing_delivery_proof: string;
  gap_missing_signature_high_value: string;
  gap_address_mismatch: string;
  gap_carrier_mismatch_digital: string;
  gap_missing_merchant_log: string;
  gap_missing_timestamp_alignment: string;
  gap_missing_invoice_itemization: string;
  gap_spec_mismatch_nad: string;
  gap_other_gap: string;

  // Simulator Drawer
  sim_title: string;
  sim_desc: string;
  sim_case_a_btn: string;
  sim_case_b_btn: string;
  sim_case_c_btn: string;
  sim_case_failed_btn: string;
  sim_custom_heading: string;
  sim_phone_placeholder: string;
  sim_rrn_placeholder: string;
  sim_msg_placeholder: string;

  // Metrics
  metric_total_claims: string;
  metric_auto_resolved: string;
  metric_human_locked: string;
  metric_fraud_prevented: string;

  // Footer / Disclaimers
  upi_truth_notice: string;
}

export const STRINGS: Record<Language, I18nDictionary> = {
  en: {
    brand_title: "PHALANX UPI SHIELD",
    brand_subtitle: "Autonomous Refund & Claim Adjudication for Indian D2C Merchants",
    nav_paypal: "PayPal Dispute Desk",
    nav_upi: "UPI Shield (India)",
    switch_to_upi: "Switch to UPI Shield",
    switch_to_paypal: "Switch to PayPal Desk",
    reset_demo: "Reset Demo Cases",
    reset_success: "Demo cases reset successfully",
    telemetry_status: "Telemetries Active",

    refund: "Refund",
    approve: "Approve",
    reject: "Reject",
    awaiting_approval: "Awaiting approval",
    payment_successful: "Payment successful",
    payment_failed: "Payment failed",
    download_dossier: "Download Bilingual PDF Dossier",
    view_dossier: "View Defense Dossier",
    simulate_claim: "Simulate WhatsApp Buyer Claim",
    send_whatsapp_message: "Send Inbound Claim",
    confirm_approval_title: "Irreversible UPI Refund Confirmation",
    confirm_approval_desc: "You are authorizing an instant, irreversible UPI refund. This will debit your merchant settlement account via Razorpay API.",
    confirm_refund_btn: "Authorize & Execute Refund",
    cancel: "Cancel",

    verdict_reject: "REJECT CLAIM",
    verdict_offer: "PARTIAL OFFER",
    verdict_refund: "FULL REFUND",

    guardrail_auto: "Auto-Approved (< ₹500 Guardrail)",
    guardrail_locked: "Locked — Human Approval Required (≥ ₹500)",
    guardrail_blocked_failed: "Blocked — Payment Failed (Merchant Never Received Funds)",
    guardrail_blocked_authorized: "Blocked — Payment Authorized (Requires Capture or Void, Cannot Refund)",
    guardrail_approved_ready: "Human Approved — Ready to Fire Live Refund",
    guardrail_rejected_dossier: "Claim Rejected — Defense Dossier Dispatched",

    upi_rrn: "UPI RRN",
    order_id: "Order ID",
    payment_id: "Payment ID",
    awb_number: "Shiprocket AWB",
    amount: "Amount",
    status: "Status",
    customer_name: "Customer",
    customer_phone: "Phone",
    claim_reason: "Buyer Claim Narrative",
    score: "Score",
    checklist_score: "0–100 Checklist Score",

    step_1_payment: "Payment Settled / Captured",
    step_2_intake: "WhatsApp Claim Ingested",
    step_3_audit: "Hound + 3-Juror Forensic Audit",
    step_4_guardrail: "Deterministic Guardrail Check",
    step_5_resolution: "Final Claim Resolution",

    juror_gateway_title: "Gateway & Settlement Juror",
    juror_fulfillment_title: "Order & Logistics Telemetry Juror",
    juror_buyer_risk_title: "Buyer History & Guardrail Juror",

    gap_missing_tracking: "Missing Carrier Tracking",
    gap_missing_delivery_proof: "Missing Delivery Proof / POD",
    gap_missing_signature_high_value: "No Signature Confirmation on File",
    gap_address_mismatch: "Delivery Address / PIN Mismatch",
    gap_carrier_mismatch_digital: "Physical Carrier for Intangible Good",
    gap_missing_merchant_log: "Missing Warehouse Dispatch CCTV/Log",
    gap_missing_timestamp_alignment: "Fulfillment Timestamp Discrepancy",
    gap_missing_invoice_itemization: "Missing Itemized Tax Invoice",
    gap_spec_mismatch_nad: "Unsubstantiated Item Condition Proof",
    gap_other_gap: "Supporting Telemetry Advisory",

    sim_title: "WhatsApp Buyer Intake Simulator",
    sim_desc: "Simulate inbound buyer refund messages arriving via Meta's WhatsApp Cloud API webhook.",
    sim_case_a_btn: "Test Case A (₹3,200 Double-Debit & Empty Box Scam)",
    sim_case_b_btn: "Test Case B (₹1,200 Cosmetic Scuff → ₹300 Auto-Offer)",
    sim_case_c_btn: "Test Case C (₹2,499 Lost in Transit → Human Gate Lock)",
    sim_case_failed_btn: "Test Failed-Payment Refund Block (RRN 631510009988)",
    sim_custom_heading: "Or Ingest Custom Inbound Message",
    sim_phone_placeholder: "+91 98765 43210",
    sim_rrn_placeholder: "12-digit UPI RRN (e.g. 631514892011)",
    sim_msg_placeholder: "Enter buyer message containing 12-digit RRN and Order ID...",

    metric_total_claims: "Total Inbound Claims",
    metric_auto_resolved: "Auto-Settled (< ₹500)",
    metric_human_locked: "Human Gate Locked",
    metric_fraud_prevented: "Fraud Prevented (INR)",

    upi_truth_notice: "UPI Reality: Instant clearing into merchant bank account. No escrow, no dispute hold. Defense relies on RRN matching, dispatch weight proof, and doorstep OTP verification.",
  },
  hi: {
    brand_title: "फालांक्स यूपीआई कवच",
    brand_subtitle: "भारतीय डी2सी विक्रेताओं के लिए स्वायत्त रिफंड एवं दावा निर्णय प्रणाली",
    nav_paypal: "पेपैल विवाद पटल",
    nav_upi: "यूपीआई शील्ड (भारत)",
    switch_to_upi: "यूपीआई शील्ड पर जाएं",
    switch_to_paypal: "पेपैल डेस्क पर जाएं",
    reset_demo: "डेमो रीसेट करें",
    reset_success: "डेमो डेटा सफलतापूर्वक रीसेट हो गया",
    telemetry_status: "सक्रिय टेलीमेट्री प्रणाली",

    refund: "रिफंड",
    approve: "स्वीकृत करें",
    reject: "अस्वीकार करें",
    awaiting_approval: "स्वीकृति की प्रतीक्षा है",
    payment_successful: "भुगतान सफल",
    payment_failed: "भुगतान विफल",
    download_dossier: "द्विभाषी पीडीएफ डोजियर डाउनलोड करें",
    view_dossier: "साक्ष्य डोजियर देखें",
    simulate_claim: "व्हाट्सएप ग्राहक दावा सिमुलेटर",
    send_whatsapp_message: "व्हाट्सएप संदेश भेजें",
    confirm_approval_title: "अपरिवर्तनीय यूपीआई रिफंड प्रमाणीकरण",
    confirm_approval_desc: "आप तत्काल और अपरिवर्तनीय यूपीआई रिफंड को अधिकृत कर रहे हैं। यह रेज़रपे एपीआई के माध्यम से आपके विक्रेता खाते से राशि डेबिट करेगा।",
    confirm_refund_btn: "स्वीकृत करें एवं रिफंड भेजें",
    cancel: "रद्द करें",

    verdict_reject: "दावा अस्वीकार करें",
    verdict_offer: "आंशिक रिफंड प्रस्ताव",
    verdict_refund: "पूर्ण रिफंड",

    guardrail_auto: "स्वतः स्वीकृत (< ₹500 सुरक्षा सीमा)",
    guardrail_locked: "लॉक किया गया — मानवीय स्वीकृति आवश्यक (≥ ₹500)",
    guardrail_blocked_failed: "अवरुद्ध — भुगतान विफल (विक्रेता को राशि प्राप्त नहीं हुई)",
    guardrail_blocked_authorized: "अवरुद्ध — भुगतान अधिकृत (कैप्चर या शून्य आवश्यक)",
    guardrail_approved_ready: "मानवीय रूप से स्वीकृत — रिफंड के लिए तैयार",
    guardrail_rejected_dossier: "दावा अस्वीकृत — साक्ष्य डोजियर तैयार",

    upi_rrn: "यूपीआई आरआरएन (RRN)",
    order_id: "ऑर्डर संख्या (Order ID)",
    payment_id: "भुगतान संख्या (Payment ID)",
    awb_number: "शिपराकेट एडब्ल्यूबी (AWB)",
    amount: "राशि",
    status: "स्थिति",
    customer_name: "ग्राहक",
    customer_phone: "फोन",
    claim_reason: "ग्राहक का दावा विवरण",
    score: "अंक",
    checklist_score: "०–१०० चेकलिस्ट स्कोर",

    step_1_payment: "भुगतान निपटान (कैप्चर)",
    step_2_intake: "व्हाट्सएप दावा दर्ज",
    step_3_audit: "हाउंड एवं ३-जूरी फॉरेंसिक ऑडिट",
    step_4_guardrail: "नियम आधारित सुरक्षा सीमा जांच",
    step_5_resolution: "अंतिम दावा समाधान",

    juror_gateway_title: "भुगतान गेटवे एवं बैंक जूरी",
    juror_fulfillment_title: "वेयरहाउस एवं शिपिंग टेलीमेट्री जूरी",
    juror_buyer_risk_title: "ग्राहक इतिहास एवं सुरक्षा सीमा जूरी",

    gap_missing_tracking: "कूरियर ट्रैकिंग उपलब्ध नहीं",
    gap_missing_delivery_proof: "डिलीवरी का प्रमाण (POD) अनुपलब्ध",
    gap_missing_signature_high_value: "हस्ताक्षर पावती उपलब्ध नहीं",
    gap_address_mismatch: "डिलीवरी पता या पिनकोड बेमेल",
    gap_carrier_mismatch_digital: "डिजिटल उत्पाद हेतु भौतिक कूरियर बेमेल",
    gap_missing_merchant_log: "वेयरहाउस सीसीटीवी/वजन लॉग अनुपलब्ध",
    gap_missing_timestamp_alignment: "समय-सीमा (टाइमस्टैम्प) में विसंगति",
    gap_missing_invoice_itemization: "मदवार कर चालान (Invoice) अनुपलब्ध",
    gap_spec_mismatch_nad: "सामान की स्थिति का अपुष्ट प्रमाण",
    gap_other_gap: "अतिरिक्त सहायक टेलीमेट्री परामर्श",

    sim_title: "व्हाट्सएप ग्राहक संदेश सिमुलेटर",
    sim_desc: "मेटा व्हाट्सएप क्लाउड एपीआई से प्राप्त होने वाले इनबाउंड संदेशों का सिमुलेशन करें।",
    sim_case_a_btn: "केस ए (₹3,200 डबल-डेबिट व खाली डिब्बा फर्जी दावा)",
    sim_case_b_btn: "केस बी (₹1,200 हल्का खरोंच → ₹300 स्वतः प्रस्ताव)",
    sim_case_c_btn: "केस सी (₹2,499 पार्सल गुम → मानवीय स्वीकृति लॉक)",
    sim_case_failed_btn: "विफल भुगतान रिफंड ब्लॉक टेस्ट (RRN 631510009988)",
    sim_custom_heading: "या कस्टम इनबाउंड संदेश दर्ज करें",
    sim_phone_placeholder: "+91 98765 43210",
    sim_rrn_placeholder: "12-अंकीय यूपीआई आरआरएन (उदा. 631514892011)",
    sim_msg_placeholder: "12-अंकीय आरआरएन और ऑर्डर आईडी युक्त संदेश लिखें...",

    metric_total_claims: "कुल दर्ज दावे",
    metric_auto_resolved: "स्वतः सुलझाए गए (< ₹500)",
    metric_human_locked: "मानवीय स्वीकृति लॉक",
    metric_fraud_prevented: "रोकी गई धोखाधड़ी (₹)",

    upi_truth_notice: "यूपीआई वास्तविकता: बैंक खाते में तत्काल निपटान। कोई एस्क्रो या होल्ड नहीं। बचाव आरआरएन मिलान, डिस्पैच वजन प्रमाण और दरवाजे पर ओटीपी सत्यापन पर निर्भर करता है।",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: I18nDictionary;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: STRINGS.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("phalanx_lang");
      if (saved === "hi" || saved === "en") {
        setLanguageState(saved);
      }
    } catch {
      // ignore SSR or storage exceptions
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("phalanx_lang", lang);
    } catch {
      // ignore storage exceptions
    }
  };

  return React.createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage, t: STRINGS[language] } },
    children
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

