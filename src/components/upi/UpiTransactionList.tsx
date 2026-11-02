"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import type { UpiCase } from "@/lib/upi/types";

interface ExecutionStep {
  step: string;
  title: string;
  status: string;
  detail: string;
}

interface Props {
  cases: UpiCase[];
  onCaseUpdated?: (updatedCase: UpiCase) => void;
}

export default function UpiTransactionList({ cases, onCaseUpdated }: Props) {
  const { t, language } = useLanguage();
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null);
  const [activeSteps, setActiveSteps] = useState<{ [caseId: string]: ExecutionStep[] }>({});
  const [currentStepIndex, setCurrentStepIndex] = useState<{ [caseId: string]: number }>({});
  const [runError, setRunError] = useState<{ [caseId: string]: string }>({});

  const handleRunSwarm = async (e: React.MouseEvent, c: UpiCase) => {
    e.preventDefault();
    e.stopPropagation();

    const caseId = c.case_id;
    setRunningCaseId(caseId);
    setRunError((prev) => ({ ...prev, [caseId]: "" }));
    setCurrentStepIndex((prev) => ({ ...prev, [caseId]: 0 }));

    // Animated stepper preview
    const initialSteps: ExecutionStep[] = [
      {
        step: "razorpay_rrn_check",
        title: language === "hi" ? "रेज़रपे आरआरएन सत्यापन" : "Razorpay RRN Check",
        status: "RUNNING",
        detail: language === "hi" ? "बैंक लेज़र और दोहराव की जाँच हो रही है..." : "Verifying settlement and duplicate payment ledger...",
      },
      {
        step: "shiprocket_tracking",
        title: language === "hi" ? "शिपराकेट डिलीवरी टेलीमेट्री" : "Shiprocket Telemetry",
        status: "PENDING",
        detail: language === "hi" ? "कूरियर वजन और ओटीपी सत्यापन प्रतीक्षित..." : "Checking AWB status, courier weight certificate, and OTP...",
      },
      {
        step: "juror_verdicts",
        title: language === "hi" ? "३-जूरी फॉरेंसिक ऑडिट" : "3-Juror Forensic Audit",
        status: "PENDING",
        detail: language === "hi" ? "गेटवे + वेयरहाउस + खरीदार इतिहास जूरी विश्लेषण..." : "Evaluating Gateway, Logistics, and Buyer Risk profiles...",
      },
      {
        step: "guardrail_decision",
        title: language === "hi" ? "सुरक्षा सीमा एवं मानवीय गेट" : "Guardrail & Approval Gate",
        status: "PENDING",
        detail: language === "hi" ? "ऑटो-रिफंड सीमा और स्वीकृति आवश्यकताओं का मूल्यांकन..." : "Applying merchant auto-refund ceiling & human lock...",
      },
    ];
    setActiveSteps((prev) => ({ ...prev, [caseId]: initialSteps }));

    try {
      // Step 1: Razorpay
      setCurrentStepIndex((prev) => ({ ...prev, [caseId]: 0 }));
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Shiprocket
      setCurrentStepIndex((prev) => ({ ...prev, [caseId]: 1 }));
      await new Promise((r) => setTimeout(r, 400));

      // Step 3: Jurors
      setCurrentStepIndex((prev) => ({ ...prev, [caseId]: 2 }));
      await new Promise((r) => setTimeout(r, 400));

      // Step 4: Guardrail Call
      setCurrentStepIndex((prev) => ({ ...prev, [caseId]: 3 }));

      const res = await fetch(`/api/upi/cases/${caseId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Swarm execution failed");
      }

      if (data.executionSteps) {
        setActiveSteps((prev) => ({ ...prev, [caseId]: data.executionSteps }));
      }
      setCurrentStepIndex((prev) => ({ ...prev, [caseId]: 4 })); // all completed

      if (data.case && onCaseUpdated) {
        onCaseUpdated(data.case);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunError((prev) => ({ ...prev, [caseId]: msg }));
    } finally {
      setTimeout(() => {
        setRunningCaseId(null);
      }, 700);
    }
  };

  if (!cases || cases.length === 0) {
    return (
      <div
        style={{
          padding: "36px",
          textAlign: "center",
          color: "#755E46",
          backgroundColor: "#F7F3EA",
          borderRadius: "12px",
          border: "1px dashed #D4C9BC",
        }}
      >
        No UPI cases found.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {cases.map((c) => {
        const buyerName =
          c.buyer_telemetry?.customer_name ||
          c.order_telemetry?.customer_name ||
          "Customer";
        const initials = buyerName
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        const amountInr = (c.claim_amount_paise / 100).toLocaleString("en-IN", {
          maximumFractionDigits: 2,
        });
        const refundInr = (c.recommended_refund_paise / 100).toLocaleString("en-IN", {
          maximumFractionDigits: 2,
        });

        // Semantic status style & text
        let statusBg = "#f1f5f9";
        let statusColor = "#475569";
        let statusBorder = "#D4C9BC";
        let statusText: string = c.status;

        if (c.verdict === "REJECT_CLAIM" || c.status === "REJECTED") {
          statusBg = "#fff1f2";
          statusColor = "#e11d48";
          statusBorder = "#fecdd3";
          statusText = language === "hi" ? "दावा अस्वीकृत" : "Claim Rejected";
        } else if (c.status === "AUTO_REFUNDED") {
          statusBg = "#ecfdf5";
          statusColor = "#059669";
          statusBorder = "#a7f3d0";
          statusText =
            language === "hi"
              ? `₹${refundInr} स्वतः रिफंड सफल`
              : `Auto-Refunded ₹${refundInr}`;
        } else if (c.status === "REFUNDED") {
          statusBg = "#ecfdf5";
          statusColor = "#059669";
          statusBorder = "#a7f3d0";
          statusText =
            language === "hi" ? `भुगतान सफल — ₹${refundInr} रिफंड` : `Payment successful — Refunded ₹${refundInr}`;
        } else if (c.status === "AWAITING_HUMAN_APPROVAL") {
          statusBg = "#fffbeb";
          statusColor = "#d97706";
          statusBorder = "#fde68a";
          statusText =
            c.recommended_refund_paise > 0
              ? (language === "hi" ? `स्वीकृति की प्रतीक्षा (₹${refundInr})` : `Awaiting approval (₹${refundInr})`)
              : t.awaiting_approval;
        }

        const isRunning = runningCaseId === c.case_id;
        const steps = activeSteps[c.case_id];
        const stepIdx = currentStepIndex[c.case_id] ?? 0;
        const errMsg = runError[c.case_id];

        return (
          <div
            key={c.case_id}
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #E6DFD5",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              overflow: "hidden",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            {/* Top Case Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {/* Left side: Avatar + Buyer + Telemetry tags */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "260px" }}>
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "50%",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #E6DFD5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "15px",
                    color: "#334155",
                    letterSpacing: "0.5px",
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px", color: "#1A1A1A" }}>
                      {buyerName}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "11px",
                        color: "#755E46",
                        backgroundColor: "#F7F3EA",
                        padding: "2px 7px",
                        borderRadius: "6px",
                        border: "1px solid #E6DFD5",
                      }}
                    >
                      {c.order_id}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor:
                          c.score >= 80 ? "#ecfdf5" : c.score >= 50 ? "#fffbeb" : "#fff1f2",
                        color:
                          c.score >= 80 ? "#059669" : c.score >= 50 ? "#d97706" : "#e11d48",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        border: `1px solid ${
                          c.score >= 80 ? "#a7f3d0" : c.score >= 50 ? "#fde68a" : "#fecdd3"
                        }`,
                      }}
                    >
                      {c.score}/100
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#755E46",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 600,
                        color: "#475569",
                        backgroundColor: "#f1f5f9",
                        padding: "1px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      RRN: {c.upi_rrn}
                    </span>
                    <span>•</span>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{c.case_id}</span>
                    <span>•</span>
                    <span style={{ fontSize: "11px", color: "#755E46" }}>{c.claim_type}</span>
                  </div>
                </div>
              </div>

              {/* Right side: Amount + Status Pill + Action Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "19px",
                      fontWeight: 800,
                      color: "#1A1A1A",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    ₹{amountInr}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 9px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusBorder}`,
                      marginTop: "2px",
                    }}
                  >
                    {statusText}
                  </span>
                </div>

                {/* Visible RUN SWARM button */}
                <button
                  type="button"
                  onClick={(e) => handleRunSwarm(e, c)}
                  disabled={isRunning}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: isRunning ? "#D4C9BC" : "#800020",
                    color: isRunning ? "#755E46" : "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: isRunning ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  }}
                  title="Run deterministic 3-juror audit live"
                >
                  <span>{isRunning ? "⚙️" : "⚡"}</span>
                  <span>{isRunning ? t.running_swarm : t.run_swarm}</span>
                </button>

                {/* View Dossier Link */}
                <Link
                  href={`/dashboard/${c.case_id}`}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#F7F3EA",
                    color: "#800020",
                    border: "1px solid #D4C9BC",
                    fontWeight: 700,
                    fontSize: "12px",
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {language === "hi" ? "डोजियर देखें →" : "View Dossier →"}
                </Link>
              </div>
            </div>

            {/* Buyer message excerpt */}
            <div
              style={{
                padding: "8px 20px 12px 20px",
                borderTop: "1px solid #f1f5f9",
                backgroundColor: "#fafafa",
                fontSize: "12px",
                color: "#475569",
                fontStyle: "italic",
              }}
            >
              &ldquo;{language === "hi" ? c.buyer_message_hi : c.buyer_message_en}&rdquo;
            </div>

            {/* Live Stepper Execution Drawer (Shown when running or recently run) */}
            {steps && steps.length > 0 && (
              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid #E6DFD5",
                  backgroundColor: "#F7F3EA",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#755E46", marginBottom: "8px", textTransform: "uppercase" }}>
                  {language === "hi" ? "लाइव स्वार्म निष्पादन प्रगति" : "Live Swarm Execution Stages"}:
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                  {steps.map((st, i) => {
                    const isDone = stepIdx > i || stepIdx === 4;
                    const isCurrent = stepIdx === i && isRunning;
                    return (
                      <div
                        key={st.step}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: `1px solid ${
                            isDone ? "#a7f3d0" : isCurrent ? "#93c5fd" : "#E6DFD5"
                          }`,
                          backgroundColor: isDone ? "#ecfdf5" : isCurrent ? "#F5E8E8" : "#ffffff",
                          fontSize: "11px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: isDone ? "#059669" : isCurrent ? "#1d4ed8" : "#755E46" }}>
                          <span>{isDone ? "✓" : isCurrent ? "⚙️" : "○"}</span>
                          <span>{st.title}</span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#755E46", marginTop: "2px" }}>
                          {st.detail}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {errMsg && (
                  <div style={{ marginTop: "8px", color: "#e11d48", fontSize: "11px", fontWeight: 600 }}>
                    Error: {errMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
