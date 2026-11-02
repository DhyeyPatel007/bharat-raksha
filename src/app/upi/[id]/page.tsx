"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import LanguageToggle from "@/components/upi/LanguageToggle";
import UpiTransactionDetail from "@/components/upi/UpiTransactionDetail";
import { useLanguage } from "@/lib/i18n";
import type { UpiAuditLog, UpiCase } from "@/lib/upi/types";

export default function UpiCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, language } = useLanguage();
  const [caseData, setCaseData] = useState<UpiCase | null>(null);
  const [auditLogs, setAuditLogs] = useState<UpiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadCase() {
      try {
        const res = await fetch(`/api/upi/cases/${id}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setCaseData(data.case);
          setAuditLogs(data.auditLogs || []);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadCase();
  }, [id]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F7F3EA",
        color: "#1A1A1A",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* TOP GLOBAL BAR */}
      <header
        style={{
          borderBottom: "1px solid #E6DFD5",
          backgroundColor: "#F7F3EA",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "12px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1000px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Link
                href="/"
                style={{
                  textDecoration: "none",
                  fontSize: "18px",
                  fontWeight: 900,
                  letterSpacing: "-0.5px",
                  color: "#1A1A1A",
                }}
              >
                🛡️ {t.brand_title}
              </Link>
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link
              href="/"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748b",
                textDecoration: "none",
                padding: "4px 10px",
                borderRadius: "8px",
                backgroundColor: "#f1f5f9",
              }}
            >
              ← {language === "hi" ? "मुखपृष्ठ" : "Home"}
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: "1000px", margin: "28px auto", padding: "0 24px" }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
            Loading case adjudication telemetry...
          </div>
        ) : notFound || !caseData ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              backgroundColor: "#F7F3EA",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1A1A1A" }}>Case Not Found</h3>
            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
              The requested UPI case does not exist or has expired from memory.
            </p>
            <Link
              href="/upi"
              style={{
                display: "inline-block",
                marginTop: "16px",
                padding: "8px 16px",
                borderRadius: "8px",
                backgroundColor: "#0f172a",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Return to UPI Feed
            </Link>
          </div>
        ) : (
          <UpiTransactionDetail initialCase={caseData} auditLogs={auditLogs} />
        )}
      </main>
    </div>
  );
}

