"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import type { UpiAuditLog, UpiCase } from "@/lib/upi/types";

interface Props {
  initialCase: UpiCase;
  auditLogs: UpiAuditLog[];
}

export default function UpiTransactionDetail({ initialCase, auditLogs }: Props) {
  const { t, language } = useLanguage();
  const [caseData, setCaseData] = useState<UpiCase>(initialCase);
  const [logs, setLogs] = useState<UpiAuditLog[]>(auditLogs);
  const [isApproving, setIsApproving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunningSwarm, setIsRunningSwarm] = useState(false);
  const [swarmRunNotice, setSwarmRunNotice] = useState<string | null>(null);

  const handleRunSwarm = async () => {
    setIsRunningSwarm(true);
    setSwarmRunNotice(null);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/upi/cases/${caseData.case_id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Swarm execution failed");
      if (data.case) setCaseData(data.case);
      setSwarmRunNotice(
        language === "hi"
          ? `स्वार्म सफलतापूर्वक निष्पादित हुआ! नया स्कोर: ${data.case?.score}/100`
          : `Swarm executed live! New score: ${data.case?.score}/100 (${data.case?.verdict})`
      );
      const logRes = await fetch(`/api/upi/cases/${caseData.case_id}`);
      if (logRes.ok) {
        const fresh = await logRes.json();
        if (fresh.auditLogs) setLogs(fresh.auditLogs);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsRunningSwarm(false);
    }
  };

  const copyToClipboard = (text: string, badgeName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBadge(badgeName);
    setTimeout(() => setCopiedBadge(null), 1800);
  };

  const executeHumanRefund = async () => {
    setIsApproving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/upi/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseData.case_id,
          humanApproval: {
            approvedBy: "Merchant Ops Lead",
            approvedAt: new Date().toISOString(),
            token: `token_human_${Date.now()}`,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.messageEn || data.error || "Refund execution failed");
      }

      setCaseData(data.case);
      setShowConfirmModal(false);

      // Refresh audit logs
      const logRes = await fetch(`/api/upi/cases/${caseData.case_id}`);
      if (logRes.ok) {
        const fresh = await logRes.json();
        if (fresh.auditLogs) setLogs(fresh.auditLogs);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsApproving(false);
    }
  };

  const amountInr = (caseData.claim_amount_paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const refundInr = (caseData.recommended_refund_paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Semantic Colors
  const isRejected = caseData.verdict === "REJECT_CLAIM" || caseData.status === "REJECTED";
  const isRefunded = caseData.status === "REFUNDED" || caseData.status === "AUTO_REFUNDED";
  const isLocked = caseData.status === "AWAITING_HUMAN_APPROVAL";

  let pillBg = "#f1f5f9";
  let pillColor = "#334155";
  let pillBorder = "#cbd5e1";
  let statusText: string = caseData.status;

  if (isRejected) {
    pillBg = "#fff1f2";
    pillColor = "#e11d48";
    pillBorder = "#fecdd3";
    statusText = language === "hi" ? "दावा अस्वीकृत" : "Claim Rejected";
  } else if (caseData.status === "AUTO_REFUNDED") {
    pillBg = "#ecfdf5";
    pillColor = "#059669";
    pillBorder = "#a7f3d0";
    statusText =
      language === "hi"
        ? `₹${refundInr} स्वतः रिफंड सफल`
        : `Auto-Refunded ₹${refundInr}`;
  } else if (caseData.status === "REFUNDED") {
    pillBg = "#ecfdf5";
    pillColor = "#059669";
    pillBorder = "#a7f3d0";
    statusText =
      language === "hi"
        ? `भुगतान सफल — ₹${refundInr} रिफंड किया गया`
        : `Payment successful — Refunded ₹${refundInr}`;
  } else if (isLocked) {
    pillBg = "#fffbeb";
    pillColor = "#d97706";
    pillBorder = "#fde68a";
    statusText = t.awaiting_approval;
  }

  // Guardrail Sub-Pill
  let guardrailPill = t.guardrail_auto;
  if (caseData.guardrail_state === "LOCKED_AWAITING_HUMAN_APPROVAL") {
    guardrailPill = t.guardrail_locked;
  } else if (caseData.guardrail_state === "HARD_BLOCK_FAILED_PAYMENT") {
    guardrailPill = t.guardrail_blocked_failed;
  } else if (caseData.guardrail_state === "NO_REFUND_REJECTED_WITH_DOSSIER") {
    guardrailPill = t.guardrail_rejected_dossier;
  } else if (caseData.guardrail_state === "HUMAN_APPROVED_READY_TO_FIRE") {
    guardrailPill = t.guardrail_approved_ready;
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#475569",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          ← {language === "hi" ? "लेनदेन सूची पर वापस" : "Back to UPI Transactions"}
        </Link>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#be123c",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* TOP UPI TRANSACTION RECEIPT HEADER CARD */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "32px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          textAlign: "center",
          marginBottom: "28px",
        }}
      >
        <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
          {caseData.buyer_telemetry?.customer_name || caseData.order_telemetry?.customer_name} •{" "}
          {caseData.order_id}
        </div>

        {/* Large Rupee Amount */}
        <div
          style={{
            fontSize: "44px",
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-1px",
            marginBottom: "12px",
          }}
        >
          ₹{amountInr}
        </div>

        {/* Status Pill */}
        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 800,
              backgroundColor: pillBg,
              color: pillColor,
              border: `1px solid ${pillBorder}`,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ● {statusText}
          </span>

          <span
            style={{
              padding: "5px 12px",
              borderRadius: "16px",
              fontSize: "11px",
              fontWeight: 600,
              backgroundColor: "#f1f5f9",
              color: "#334155",
              border: "1px solid #e2e8f0",
            }}
          >
            {guardrailPill}
          </span>
        </div>

        {/* Metadata Grid Badges */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginTop: "28px",
            paddingTop: "24px",
            borderTop: "1px solid #f1f5f9",
            textAlign: "left",
          }}
        >
          {/* UPI RRN */}
          <div
            onClick={() => copyToClipboard(caseData.upi_rrn, "RRN")}
            style={{
              padding: "10px 14px",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              {t.upi_rrn} {copiedBadge === "RRN" && "✓ Copied"}
            </div>
            <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
              {caseData.upi_rrn}
            </div>
          </div>

          {/* Razorpay Payment ID */}
          <div
            onClick={() => copyToClipboard(caseData.order_telemetry?.razorpay_payment_id || "", "PAY_ID")}
            style={{
              padding: "10px 14px",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Razorpay ID {copiedBadge === "PAY_ID" && "✓ Copied"}
            </div>
            <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
              {caseData.order_telemetry?.razorpay_payment_id || "N/A"}
            </div>
          </div>

          {/* Shiprocket AWB */}
          <div
            onClick={() => copyToClipboard(caseData.order_telemetry?.awb_code || "", "AWB")}
            style={{
              padding: "10px 14px",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              {t.awb_number} {copiedBadge === "AWB" && "✓ Copied"}
            </div>
            <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
              {caseData.order_telemetry?.awb_code || "N/A"}
            </div>
          </div>

          {/* Payment Status */}
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Payment State
            </div>
            <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "13px", fontWeight: 800, color: caseData.order_telemetry?.payment_status === "captured" ? "#059669" : "#e11d48", marginTop: "2px" }}>
              {caseData.order_telemetry?.payment_status?.toUpperCase() || "UNKNOWN"}
            </div>
          </div>
        </div>

        {/* HUMAN GATE ACTION BAR */}
        {isLocked && (
          <div
            style={{
              marginTop: "24px",
              padding: "18px",
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#92400e" }}>
                🔒 {language === "hi" ? "मानवीय स्वीकृति आवश्यक (सुरक्षा सीमा: ≥ ₹500)" : "Human Approval Gate Locked (Guardrail: ≥ ₹500)"}
              </div>
              <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>
                {language === "hi"
                  ? `दावा राशि ₹${refundInr} है। अपरिवर्तनीय यूपीआई रिफंड निष्पादित करने हेतु मानवीय स्वीकृति अनिवार्य है।`
                  : `Claim recommended ₹${refundInr}. Human approval required before firing irreversible live UPI debit.`}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isApproving}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: isApproving ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(5, 150, 105, 0.2)",
                }}
              >
                {isApproving
                  ? language === "hi"
                    ? "प्रसंस्करण जारी..."
                    : "Processing..."
                  : t.approve}
              </button>
            </div>
          </div>
        )}

        {/* ACTIONS: RUN SWARM & BILINGUAL PDF DOSSIER DOWNLOAD */}
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleRunSwarm}
            disabled={isRunningSwarm}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "10px",
              backgroundColor: isRunningSwarm ? "#cbd5e1" : "#2563eb",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              fontSize: "13px",
              cursor: isRunningSwarm ? "not-allowed" : "pointer",
              boxShadow: "0 2px 6px rgba(37, 99, 235, 0.2)",
            }}
          >
            <span>{isRunningSwarm ? "⚙️" : "⚡"}</span>
            <span>{isRunningSwarm ? t.running_swarm : t.run_swarm}</span>
          </button>

          <a
            href={`/api/upi/cases/${caseData.case_id}/dossier.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 22px",
              borderRadius: "10px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "13px",
              boxShadow: "0 2px 6px rgba(15, 23, 42, 0.15)",
            }}
          >
            📄 {t.download_dossier}
          </a>
        </div>

        {swarmRunNotice && (
          <div style={{ marginTop: "12px", fontSize: "12px", fontWeight: 700, color: "#059669" }}>
            ✓ {swarmRunNotice}
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              maxWidth: "460px",
              width: "100%",
              padding: "28px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>
              ⚠️ {t.confirm_approval_title}
            </div>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, marginBottom: "16px" }}>
              {t.confirm_approval_desc}
            </p>
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                padding: "12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontFamily: "var(--font-mono, monospace)",
                marginBottom: "20px",
              }}
            >
              <div><strong>Case:</strong> {caseData.case_id}</div>
              <div><strong>RRN:</strong> {caseData.upi_rrn}</div>
              <div><strong>Refund Amount:</strong> ₹{refundInr}</div>
              <div><strong>Gateway:</strong> Razorpay API (POST /v1/payments/.../refund)</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={executeHumanRefund}
                disabled={isApproving}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#e11d48",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: isApproving ? "not-allowed" : "pointer",
                }}
              >
                {isApproving ? "Executing..." : t.confirm_refund_btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERTICAL TRANSACTION & ADJUDICATION TIMELINE */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "24px",
          marginBottom: "28px",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginBottom: "18px" }}>
          {language === "hi" ? "लेनदेन एवं फॉरेंसिक निर्णय समय-सीमा" : "Transaction & Forensic Adjudication Timeline"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Step 1: Payment Captured */}
          <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
              1
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{t.step_1_payment}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                RRN {caseData.upi_rrn} • Razorpay ID {caseData.order_telemetry?.razorpay_payment_id || "pay_trace"} • Status: {caseData.order_telemetry?.payment_status?.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Step 2: Intake */}
          <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
              2
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{t.step_2_intake}</div>
              <div style={{ fontSize: "12px", color: "#475569", fontStyle: "italic", marginTop: "2px" }}>
                &ldquo;{language === "hi" ? caseData.buyer_message_hi : caseData.buyer_message_en}&rdquo;
              </div>
            </div>
          </div>

          {/* Step 3: Swarm Audit */}
          <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#faf5ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
              3
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{t.step_3_audit}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Checklist Score: <strong>{caseData.score}/100</strong> • 3 Jurors deliberated with 2/3 quorum • Iteration count: {caseData.iteration_logs?.length || 1}
              </div>
            </div>
          </div>

          {/* Step 4: Guardrail */}
          <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#fffbeb", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
              4
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{t.step_4_guardrail}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Rule code: <code style={{ backgroundColor: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>{caseData.guardrail_state}</code> • {caseData.requires_human_approval ? "Requires human signature" : "Autonomous execution enabled"}
              </div>
            </div>
          </div>

          {/* Step 5: Resolution */}
          <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: isRejected ? "#fff1f2" : "#ecfdf5", color: isRejected ? "#e11d48" : "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px", flexShrink: 0 }}>
              5
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{t.step_5_resolution}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Verdict: <strong>{caseData.verdict}</strong> • Status: {statusText}
                {caseData.razorpay_refund_id && ` • Refund ID: ${caseData.razorpay_refund_id}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SWARM JURORS & PRACTICAL REASONING CARDS */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Arbiter Practical Reasoning Summary */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
              ⚖️ {language === "hi" ? "आर्बिटर व्यावहारिक निष्कर्ष" : "Arbiter Practical Reasoning Summary"}
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 800,
                fontSize: "14px",
                color: isRejected ? "#e11d48" : isRefunded ? "#059669" : "#d97706",
              }}
            >
              {caseData.score}/100
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(language === "hi"
              ? caseData.reasoning_summary?.hi?.reasons || []
              : caseData.reasoning_summary?.en?.reasons || []
            ).map((reason, idx) => (
              <div key={idx} style={{ display: "flex", gap: "10px", fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>
                <span style={{ color: "#2563eb", fontWeight: 800 }}>•</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>

          {/* Named Gaps */}
          <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>
              {language === "hi" ? "पहचाने गए विसंगति वर्ग (Canonical Gap Buckets)" : "Identified Canonical Gap Buckets"}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(caseData.reasoning_summary?.en?.namedGaps || []).map((gap, idx) => (
                <span
                  key={idx}
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    backgroundColor: "#f8fafc",
                    color: "#475569",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {gap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 3 JUROR CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {caseData.juror_reports?.map((juror, idx) => {
            const isAi = juror.source === "llm";
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                      {language === "hi" ? juror.jurorTitleHi : juror.jurorTitleEn}
                    </div>
                    {/* Badge: AI vs Template */}
                    <div style={{ marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: isAi ? "#ecfdf5" : "#f1f5f9",
                          color: isAi ? "#059669" : "#64748b",
                          border: isAi ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        {isAi ? "✨ AI" : "📋 Template"}
                      </span>
                      {isAi && juror.model && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "var(--font-mono, monospace)",
                            color: "#64748b",
                          }}
                        >
                          {juror.model.split("/").pop()}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: juror.scoreContribution > 0 ? "#059669" : "#64748b",
                      whiteSpace: "nowrap",
                    }}
                  >
                    +{juror.scoreContribution} pts
                  </span>
                </div>

                <p style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5, margin: 0 }}>
                  {language === "hi" ? juror.critiqueHi : juror.critiqueEn}
                </p>
              </div>
            );
          })}
        </div>

        {/* IMMUTABLE AUDIT LOG TABLE */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginBottom: "14px" }}>
            📜 {language === "hi" ? "अपरिवर्तनीय ऑडिट लॉग" : "Immutable Telemetry Audit Logs"}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Timestamp</th>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Actor</th>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Action</th>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Tool</th>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Idempotency / Guardrail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.log_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono, monospace)", color: "#64748b" }}>
                      {log.created_at.slice(11, 19)}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0f172a" }}>
                      {log.actor}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#334155" }}>
                      {log.action_type}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono, monospace)", color: "#2563eb" }}>
                      {log.tool_called}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "var(--font-mono, monospace)", color: "#64748b" }}>
                      {log.idempotency_key ? log.idempotency_key.slice(0, 10) + "..." : "PASS"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

