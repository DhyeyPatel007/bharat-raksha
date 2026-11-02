"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selector"
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "rgba(240, 242, 246, 0.95)",
        border: "1px solid rgba(210, 215, 225, 0.8)",
        borderRadius: "20px",
        padding: "2px",
        fontSize: "12px",
        fontWeight: 600,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        style={{
          padding: "3px 10px",
          borderRadius: "16px",
          border: "none",
          background: language === "en" ? "#ffffff" : "transparent",
          color: language === "en" ? "#0f172a" : "#64748b",
          fontWeight: language === "en" ? 700 : 500,
          boxShadow: language === "en" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("hi")}
        style={{
          padding: "3px 10px",
          borderRadius: "16px",
          border: "none",
          background: language === "hi" ? "#ffffff" : "transparent",
          color: language === "hi" ? "#0f172a" : "#64748b",
          fontWeight: language === "hi" ? 700 : 500,
          boxShadow: language === "hi" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        हिंदी
      </button>
    </div>
  );
}

