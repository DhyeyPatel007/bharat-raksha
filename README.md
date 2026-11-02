# BharatRaksha (भारत रक्षा) — Autonomous UPI Refund & Claim Adjudication Shield

Autonomous dispute defense and claim adjudication shield built for Indian D2C merchants operating on UPI rails.

## Overview
Indian D2C brands face relentless customer claims ("Money debited twice via GPay!", "Received an empty box!", "Order delayed in transit!"). Unlike credit cards or PayPal, **UPI settles immediately into the merchant's bank account with zero escrow, zero dispute hold, and no NPCI arbitration mechanism**. Any refund issued is direct, irreversible money loss.

BharatRaksha provides an autonomous, pure-code adjudication shield that investigates customer claims against bank clearing records (Razorpay) and courier telemetry (Shiprocket), generates bilingual defense dossiers, and enforces a mandatory human approval gate before every single refund.

---

## What It Does
- **Root Standalone Experience (`/`):** Dedicated Indian D2C workbench with full English ↔ हिंदी bilingual localization and zero page reload.
- **LLM Juror Swarm Layer:**
  - 3 domain auditor personas deliberate in parallel:
    1. `Gateway & Settlement Juror`: Payments, settlement trace, clearing reality, double-debit claims.
    2. `Order & Logistics Telemetry Juror`: Warehouse packing scale certificates, courier hub transit weight, doorstep OTP handshake.
    3. `Buyer History & Guardrail Juror`: Customer refund velocity, repeat empty-box strikes, merchant human approval gate.
  - Powered by Token Factory / Nebius (`Qwen/Qwen3-30B-A3B-Instruct-2507`).
  - **Hard Invariant:** Deterministic checklist scoring (0-100), verdict mapping, and guardrail logic remain 100% pure-code and never changed by the LLM. The LLM articulates forensic reasoning.
  - **Airtight Output Validation:** Every LLM draft is inspected before acceptance. Any draft with hallucinated ₹ amounts, invented 12-digit RRNs, unregistered Order IDs, or length < 40 chars is rejected and falls back to deterministic templates.
  - **UI Source Badges:** Juror cards display a `✨ AI` badge with the active model name or `📋 Template` fallback.
- **Intake Channel:**
  - **Telegram Bot API Today:** Free, instant setup via BotFather (`/api/upi/webhooks/telegram`, `TELEGRAM_BOT_TOKEN`). Parses 12-digit UPI RRNs (`/\b(\d{12})\b/`) and Order IDs (`/\b(ORD-[A-Z0-9-]+)\b/i`), and dispatches instant status updates and refund receipts via Telegram.
  - **WhatsApp Cloud API Parked:** Parked in `src/lib/upi/whatsapp.ts` — returns when the merchant acquires an approved Meta WhatsApp Business Number.
- **Telegram Merchant Bot (Mobile-First Operations):**
  - Run the entire adjudication workbench directly from Telegram without visiting the web UI.
  - **`/start`**: Registers the merchant chat ID to receive real-time claim alerts.
  - **`/status`**: Lists all open claims currently awaiting merchant approval with amounts and verdicts.
  - **New-Claim Outbound Alerts**: Every new claim ingested post-boot triggers an alert with case telemetry and inline action buttons: `[✅ Approve] [❌ Reject] [🔍 Details]`.
  - **One-Tap Adjudication**: Tapping Approve executes the refund through the shared pure-code guardrail and Razorpay API, updating the alert message in real time.
  - **Single-Tenant Security**: Strict chat validation ensures only the registered merchant can approve, reject, or inspect claims. All unauthorized interactions are silently ignored.
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
# Optional merchant chat ID override (bypasses /start registration requirement)
TELEGRAM_MERCHANT_CHAT_ID=

# LLM Provider Configuration (Token Factory / OpenAI-compatible endpoint)
LLM_PROVIDER=custom
LLM_BASE_URL=https://api.tokenfactory.nebius.com/v1
LLM_API_KEY=v1.CmQ...
LLM_MODEL=Qwen/Qwen3-30B-A3B-Instruct-2507
```

### Telegram Webhook Setup (Production / Live Bot)
To connect your Telegram bot to the live webhook on deployment:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://bharatraksha.krynex.in/api/upi/webhooks/telegram"
```
Or for local testing with ngrok/localtunnel:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-tunnel-domain>/api/upi/webhooks/telegram"
```

> **Note for Vercel Deployment:** After pushing to GitHub, add the environment variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_MERCHANT_CHAT_ID`, and the 4 LLM variables `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`) to your Vercel Project Settings (Environment Variables, Production) so the live demo at [bharatraksha.krynex.in](https://bharatraksha.krynex.in) operates smoothly in production.

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
Runs 144 unit checks + 40 UPI checks (including Telegram parser regex, merchant /start registration, inline callback approvals, guardrail approval gates, LLM mock draft verification, hallucination rejection, Razorpay security, and Shiprocket mock).

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
