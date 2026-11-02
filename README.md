# BharatRaksha (भारत रक्षा) — Autonomous UPI Refund & Claim Adjudication Shield

Autonomous dispute defense and claim adjudication shield built for Indian D2C merchants operating on UPI rails.

---

## The Core Problem & UPI Ground Truth
Indian D2C brands face relentless customer claims ("Money debited twice via GPay!", "Received an empty box!", "Order delayed in transit!"). Unlike credit cards or PayPal, **UPI settles immediately into the merchant's bank account with zero escrow, zero dispute hold, and no NPCI arbitration mechanism**. Any refund issued is direct, irreversible money loss.

BharatRaksha provides an autonomous, pure-code adjudication shield that investigates customer claims against bank clearing records (Razorpay) and courier telemetry (Shiprocket), generates bilingual defense dossiers for Consumer Forum (NCH), and enforces a mandatory human approval gate before every single refund.

---

## Application Architecture & Routing

| Route | Role | Description |
|---|---|---|
| `/` | **Landing Page** | Editorial light-theme landing page (Warm paper `#F7F3EA`, ink text, vermilion `#C93A1B` accent) featuring the 3-step flow, architecture diagram, seeded cases, and hackathon details. |
| `/dashboard` | **Merchant Workbench** | Live adjudication ledger, telemetry status bar, real-payment intake modal, and Telegram simulation drawer. |
| `/dashboard/[id]` | **Case Detail** | Deep forensic dossier with juror deliberations, telemetry breakdown, and NCH PDF download. |
| `/how-to-use` | **Runbook & Guide** | Step-by-step guide for merchants and buyers covering multichannel intake, forensics, and Telegram controller setup. |
| `/terms` | **Plain-Language Terms** | Disclaimers regarding test-mode credentials, demo persistence, and mandatory human authorization. |
| `/raise-issue` | **Buyer Support Portal** | Public web intake form with 12-digit UPI RRN validation, ORDER_NOT_FOUND protection, and real-time status card. |
| `/upi` | **Legacy Redirect** | Automatically redirects to `/dashboard` for backwards compatibility. |

---

## Key Capabilities

### 1. Multichannel Dispute Ingest
- **Telegram Support Groups (§2):** Merchants add the bot to their customer payment support group. When a buyer posts an issue with a 12-digit RRN, the bot posts a short acknowledgement in the group, executes the swarm, and dispatches the full interactive alert to the merchant's personal DM. Once decided, the outcome is announced back in the group.
  > **Setup for Groups:** Add the bot as group admin, or open [@BotFather](https://t.me/botfather), select your bot, type `/setprivacy`, and choose `Disable` so the bot can read messages in groups.
- **Telegram Buyer Bot:** Direct one-on-one claim submission.
- **Web Intake Form (`/raise-issue`) (§3):** Fast, accessible web submission validating 12-digit UPI RRNs.
- **Real-Mode Payment Ingestion:** Direct test-mode Razorpay payment ID (`pay_...`) intake fetching live payment telemetry from Razorpay API.

### 2. ORDER_NOT_FOUND Guard (§1)
- If a message lacks a 12-digit RRN, the bot prompts the buyer for it.
- If the RRN / Order ID is not found in the merchant's store or Razorpay records, no case is created, no swarm runs, and no merchant alert is triggered.
- The buyer receives an immediate informative message: *"We couldn't find a payment with this RRN / order ID. Please check the 12-digit UPI RRN from your payment app and try again."*
- Unmatched attempts are recorded as `UNMATCHED_CLAIM` audit log entries for merchant visibility.

### 3. LLM Juror Swarm with Proportional Score Math
- **3 Domain Juror Personas:**
  1. `Gateway State Auditor`: Bank clearing reality, duplicate deduction detection, Razorpay RRN reconciliation.
  2. `Order & Logistics Forensics`: Surat warehouse packing scale certificate vs courier hub weighment and doorstep OTP delivery verification.
  3. `Buyer History & Trust`: Refund velocity, return frequency, and policy thresholds.
- **Qwen 30B via Token Factory:** (`Qwen/Qwen3-30B-A3B-Instruct-2507`).
- **Mathematical Invariant:** Juror score contributions are normalized using the Hare-Niemeyer (largest-remainder) algorithm so that $J_1 + J_2 + J_3 \equiv \text{Score}$ across all cases in both template and LLM execution paths.
- **Auto-Run on Detail Open:** When viewing case details, the swarm auto-executes once with live LLM reasoning (3 parallel calls) and persists to store. Revisiting consumes 0 additional tokens.

### 4. Telegram Merchant Controller (Mobile Operations)
- **`/start`:** Registers the merchant's personal Telegram chat.
- **`/status`:** Lists open claims awaiting merchant decision.
- **Interactive Alerts:** Outbound alerts on new claims with inline buttons: `[✅ Approve]` `[❌ Reject]` `[🔍 Details]`.
- **1-Tap Payout:** Approving executes the refund live via Razorpay API and notifies the buyer.

---

## 3 Seeded Demo Scenarios

| Case ID | Order / Amount | Claim Details | Forensic Telemetry | Verdict & Outcome |
|---|---|---|---|---|
| **UPI-CASE-A** | ORD-KRY-8801 · ₹3,200 | Buyer alleges ₹3,200 debited twice and box delivered empty. | Single captured payment on Razorpay (second attempt timed out at NPCI); Shiprocket confirms doorstep OTP (4921) with delivery weight (0.85 kg) exactly matching Surat warehouse scale certificate. | **REJECT_CLAIM (82/100)** · Defense evidence dossier prepared for Consumer Forum. |
| **UPI-CASE-B** | ORD-KRY-8802 · ₹1,200 | Buyer alleges scratch on casing, demands ₹1,200 full refund. | Razorpay captured ₹1,200; package delivered; buyer is a loyal 0-refund customer. 25% goodwill partial settlement (₹300) recommended. | **OFFER_PARTIAL (60/100)** · Halted at Human Gate (`AWAITING_HUMAN_APPROVAL`, ₹300). |
| **UPI-CASE-C** | ORD-KRY-8803 · ₹2,499 | Buyer claims ₹2,499 paid 9 days ago, order untraceable. | Single captured payment; Shiprocket telemetry marks package lost at Bhiwandi sorting hub. Full refund justified. | **APPROVE_REFUND (15/100)** · Halted at Human Gate (`AWAITING_HUMAN_APPROVAL`, ₹2,499). |

---

## Setup & Configuration

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

# Telegram Bot API
TELEGRAM_BOT_TOKEN=
TELEGRAM_MERCHANT_CHAT_ID=

# LLM Provider Configuration (Token Factory)
LLM_PROVIDER=custom
LLM_BASE_URL=https://api.tokenfactory.nebius.com/v1
LLM_API_KEY=v1.CmQ...
LLM_MODEL=Qwen/Qwen3-30B-A3B-Instruct-2507
```

3. Connect Telegram Webhook:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://bharatraksha.krynex.in/api/upi/webhooks/telegram"
```

4. Install & Run:
```bash
npm install
npm run dev
```

---

## Testing & Verification

- **Automated Test Suite:**
```bash
npm test
```
Runs 144 unit tests + 53 UPI tests (including ORDER_NOT_FOUND guards, Telegram group intake, web intake, proportional score allocation, auto-run behavior, and Razorpay security).

- **Production Build:**
```bash
npm run build
```

- **Localhost Acceptance Verifier:**
```bash
PORT=3100 npx next start -p 3100
npm run test:acceptance
```
Validates all 17 end-to-end steps covering `/`, `/dashboard`, `/how-to-use`, `/terms`, `/raise-issue`, web intake API, PDF dossiers, and guardrail locks.

- **Negative Tests:**
```bash
node scripts/negative-tests.mjs
```
Validates all 72 negative test assertions.

---

## Hackathon & Team Credits
- **Hackathon:** AgentX 2026
- **Track:** Problem Statement PS-04 — *Autonomous Support Agent for Online Sellers*
- **Timeline:** Idea Round: Nov 2, 2026 · Build Round: Nov 11–12, 2026
- **Team:**
  - **Dhyey Patel** — Team Leader & Architect
  - **Snehil Sahay** — Swarm & Logistics Forensics
  - **Kislay Kumar** — Gateway & Telemetry Integrations
  - **Kartikey Singh** — Adjudication & Policy Engineering

---

## License
MIT — Copyright (c) 2026 Dhyey Patel
