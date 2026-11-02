-- ==============================================================================
-- PHALANX UPI — Autonomous Refund & Claim Adjudication Shield Schema
-- Migration: 20261111000000_phalanx_upi.sql
-- ==============================================================================

-- 1. upi_orders: Merchant order and settlement telemetry
CREATE TABLE IF NOT EXISTS upi_orders (
  order_id TEXT PRIMARY KEY,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  upi_rrn TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('authorized', 'captured', 'failed', 'refunded')),
  duplicate_payment_id TEXT,
  awb_code TEXT,
  warehouse_weight_kg NUMERIC(6, 3),
  courier_weight_kg NUMERIC(6, 3),
  otp_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upi_orders_rrn ON upi_orders(upi_rrn);
CREATE INDEX IF NOT EXISTS idx_upi_orders_phone ON upi_orders(customer_phone);

-- 2. upi_inventory: Catalog items with SKU, weights and pricing
CREATE TABLE IF NOT EXISTS upi_inventory (
  sku TEXT PRIMARY KEY,
  product_name_en TEXT NOT NULL,
  product_name_hi TEXT NOT NULL,
  unit_price_paise BIGINT NOT NULL,
  unit_weight_kg NUMERIC(6, 3) NOT NULL,
  stock_count INTEGER NOT NULL DEFAULT 0
);

-- 3. upi_customer_refund_history: Buyer risk baselining & repeat claim flags
CREATE TABLE IF NOT EXISTS upi_customer_refund_history (
  customer_phone TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0,
  refund_claims_count INTEGER NOT NULL DEFAULT 0,
  refund_ratio NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
  prior_empty_box_flags INTEGER NOT NULL DEFAULT 0,
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('LOW', 'MEDIUM', 'HIGH', 'FLAGGED'))
);

-- 4. upi_cases: Core claim adjudication cases
CREATE TABLE IF NOT EXISTS upi_cases (
  case_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES upi_orders(order_id),
  upi_rrn TEXT NOT NULL,
  claim_amount_paise BIGINT NOT NULL,
  recommended_refund_paise BIGINT NOT NULL DEFAULT 0,
  claim_type TEXT NOT NULL,
  buyer_message_en TEXT NOT NULL,
  buyer_message_hi TEXT NOT NULL,
  status TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('REJECT_CLAIM', 'OFFER_PARTIAL', 'APPROVE_REFUND')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  guardrail_state TEXT NOT NULL,
  requires_human_approval BOOLEAN NOT NULL DEFAULT FALSE,
  human_approved_by TEXT,
  human_approved_at TIMESTAMPTZ,
  razorpay_refund_id TEXT,
  reasoning_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  juror_reports JSONB NOT NULL DEFAULT '[]'::jsonb,
  iteration_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upi_cases_rrn ON upi_cases(upi_rrn);
CREATE INDEX IF NOT EXISTS idx_upi_cases_status ON upi_cases(status);

-- 5. upi_audit_logs: Immutable event trail with idempotency & guardrail receipts
CREATE TABLE IF NOT EXISTS upi_audit_logs (
  log_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES upi_cases(case_id),
  actor TEXT NOT NULL,
  action_type TEXT NOT NULL,
  tool_called TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardrail_check JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upi_audit_case ON upi_audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_upi_audit_idempotency ON upi_audit_logs(idempotency_key);

