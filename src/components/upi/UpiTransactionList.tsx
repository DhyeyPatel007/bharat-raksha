"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import type { UpiCase } from "@/lib/upi/types";

interface Props {
  cases: UpiCase[];
}

export default function UpiTransactionList({ cases }: Props) {
  const { t, language } = useLanguage();

  if (!cases || cases.length === 0) {
    return (
      <div
        style={{
          padding: "36px",
          textAlign: "center",
          color: "#64748b",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px dashed #cbd5e1",
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
        gap: "10px",
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

        // Semantic status style & text
        let statusBg = "#f1f5f9";
        let statusColor = "#475569";
        let statusBorder = "#cbd5e1";
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
          const refundInr = (c.recommended_refund_paise / 100).toLocaleString("en-IN");
          statusText =
            language === "hi"
              ? `₹${refundInr} स्वतः रिफंड सफल`
              : `Auto-Refunded ₹${refundInr}`;
        } else if (c.status === "REFUNDED") {
          statusBg = "#ecfdf5";
          statusColor = "#059669";
          statusBorder = "#a7f3d0";
          statusText =
            language === "hi" ? "भुगतान सफल — रिफंड किया गया" : "Payment successful — Refunded";
        } else if (c.status === "AWAITING_HUMAN_APPROVAL") {
          statusBg = "#fffbeb";
          statusColor = "#d97706";
          statusBorder = "#fde68a";
          statusText = t.awaiting_approval;
        }

        return (
          <Link
            key={c.case_id}
            href={`/upi/${c.case_id}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              transition: "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#94a3b8";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
            }}
          >
            {/* Left side: Avatar + Details */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "50%",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #e2e8f0",
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
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>
                    {buyerName}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "11px",
                      color: "#64748b",
                      backgroundColor: "#f8fafc",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {c.order_id}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#64748b",
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
                  <span>{c.case_id}</span>
                </div>
              </div>
            </div>

            {/* Right side: Big Amount + Status Pill */}
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "-0.5px",
                }}
              >
                ₹{amountInr}
              </div>

              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: statusBg,
                  color: statusColor,
                  border: `1px solid ${statusBorder}`,
                  letterSpacing: "0.2px",
                }}
              >
                {statusText}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

