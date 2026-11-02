# BharatRaksha (भारत रक्षा) — Autonomous UPI Refund & Claim Adjudication Shield

Autonomous dispute defense and claim adjudication shield built for Indian D2C merchants operating on UPI rails.

## Overview
Indian D2C brands face relentless customer claims ("Money debited twice via GPay!", "Received an empty box!", "Order delayed in transit!"). Unlike credit cards or PayPal, **UPI settles immediately into the merchant's bank account with zero escrow, zero dispute hold, and no NPCI arbitration mechanism**. Any refund issued is direct, irreversible money loss.

BharatRaksha provides an autonomous, pure-code adjudication shield that investigates customer claims against bank clearing records (Razorpay) and courier telemetry (Shiprocket), generates bilingual defense dossiers, and enforces a mandatory human approval gate before every single refund.

---

## What It Does
- **Root Standalone Experience (`/`):** Dedicated Indian D2C workbench with full English ↔ हिंदी bilingual localization and zero page reload.
- **Intake Channel:**
  - **Telegram Bot API Today:** Free, instant setup via BotFather (`/api/upi/webhooks/telegram`, `TELEGRAM_BOT_TOKEN`). Parses 12-digit UPI RRNs (`/\b(\d{12})\b/`) and Order IDs (`/\b(ORD-[A-Z0-9-]+)\b/i`), and dispatches instant status updates and refund receipts via Telegram.
  - **WhatsApp Cloud API Parked:** Parked in `src/lib/upi/whatsapp.ts` — returns when the merchant acquires an approved Meta WhatsApp Business Number.
- **Visible Live Swarm Execution:**
  - Every case features a **"Run swarm"** button that re-evaluates the forensic jurors live and animates the 4 deterministic stages:
    1. `Razorpay RRN check`: Verifies captured vs failed bank attempts and duplicate deductions.
    2. `Shiprocket tracking`: Verifies dispatch scale weights against courier hub weighment and doorstep OTP delivery.
    3. `3-Juror Forensic Audit`: Evaluates Gateway (35 pts), Fulfillment Forensics (30 pts), and Buyer Risk Profile (17 pts).
    4. `Guardrail Decision`: Enforces merchant approval requirements before refund execution.
- **Approval Before Every Refund:**
  - Configurable merchant auto-refund ceiling `AUTO_REFUND_CEILING_PAISE` (default 0 = approval required before every refund).
  - Even small settlements (e.g. Case B ₹300) halt at the mandatory Human Approval Gate (`AWAITING_HUMAN_APPROVAL`).
- **Real-Mode Intake:**
  - "New case from real payment" flow allows merchants to paste real Razorpay test-mode payment IDs (`pay_...`) and RRNs.
  - Fetches payment details live from Razorpay API (`https://api.razorpay.com/v1/payments/{id}`) using `rzp_test_*` credentials from `.env.local`.
  - Gracefully falls back to sandbox emulator for mock seeded data.
- **Bilingual Consumer Forum (NCH) Ready Dossier:**
  - Server-side PDF generation (`pdf-lib`) assembling transaction evidence, courier scale matching, OTP logs, and SHA-256 evidence integrity manifests.
- **Legacy Phalanx PayPal Tool:** Parked under `/legacy-phalanx/`.

---

## 3 Seeded Demo Scenarios

| Case ID | Order / Channel | Claim Details | Forensic Telemetry | Verdict & Outcome |
|---|---|---|---|---|
| **UPI-CASE-A** | ORD-KRY-8801 · ₹3,200 | Buyer alleges ₹3,200 debited twice and box delivered empty. | Single captured payment on Razorpay (second attempt timed out at NPCI); Shiprocket confirms doorstep OTP (4921) with delivery weight (0.85 kg) exactly matching Surat warehouse scale certificate. | **REJECT_CLAIM (82/100)** · Defense evidence dossier prepared for Consumer Forum. |
| **UPI-CASE-B** | ORD-KRY-8802 · ₹1,200 | Buyer alleges scratch on casing, demands ₹1,200 full refund. | Razorpay captured ₹1,200; package delivered; buyer is a loyal 0-refund customer. 25% goodwill partial settlement (₹300) recommended. | **OFFER_PARTIAL (60/100)** · Halted at Human Gate (`AWAITING_HUMAN_APPROVAL`, ₹300). |
| **UPI-CASE-C** | ORD-KRY-8803 · ₹2,499 | Buyer claims ₹2,499 paid 9 days ago, order untraceable. | Single captured payment; Shiprocket telemetry marks package lost at Bhiwandi sorting hub. Full refund justified. | **APPROVE_REFUND (15/100)** · Halted at Human Gate (`AWAITING_HUMAN_APPROVAL`, ₹2,499). |

---

## Quickstart Setup

1. Copy environment template:
```bash
cp .env.example .env.local
```

2. Configure `.env.local`:
```env
# Razorpay Test Mode (Must start with rzp_test_)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Shiprocket Telemetry (mock | live)
SHIPROCKET_MODE=mock

# Telegram Bot API (Optional for live outbound bot replies)
TELEGRAM_BOT_TOKEN=
```

3. Install & Run:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the standalone BharatRaksha home.

---

## Verification & Testing Suite

- **Unit & UPI Tests:**
```bash
npm test
```
Runs 144 unit checks + 24 UPI checks (including Telegram parser regex, guardrail approval gates, Razorpay security, and Shiprocket mock).

- **Production Build:**
```bash
npm run build
```

- **Localhost Acceptance Verifier:**
```bash
npx next start -p 3100
npm run test:acceptance
```
Validates all cases, human approval gate, idempotency locks, PDF download, and Telegram webhook against port 3100.

- **Negative Tests:**
```bash
node scripts/negative-tests.mjs
```

---

## License
MIT — Copyright (c) 2026 Dhyey Patel
