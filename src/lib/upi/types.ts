// PHALANX UPI — Domain types & interfaces
// Strict domain reality: Immediate settlement / clearing — no escrow, no chargeback hold.

export type UpiPaymentStatus = "authorized" | "captured" | "failed" | "refunded";

export type UpiVerdict = "REJECT_CLAIM" | "OFFER_PARTIAL" | "APPROVE_REFUND";

export type UpiClaimType =
  | "DOUBLE_DEBIT"
  | "EMPTY_BOX"
  | "DAMAGED_ITEM"
  | "LOST_IN_TRANSIT"
  | "GENERAL_REFUND_DEMAND";

export type UpiCaseStatus =
  | "REJECTED"
  | "AUTO_REFUNDED"
  | "AWAITING_HUMAN_APPROVAL"
  | "REFUNDED"
  | "PENDING_AUDIT";

export type GuardrailDecisionCode =
  | "AUTO_APPROVED_UNDER_500"
  | "LOCKED_AWAITING_HUMAN_APPROVAL"
  | "HUMAN_APPROVED_READY_TO_FIRE"
  | "HARD_BLOCK_FAILED_PAYMENT"
  | "HARD_BLOCK_AUTHORIZED_USE_VOID_OR_CAPTURE"
  | "NO_REFUND_REJECTED_WITH_DOSSIER"
  | "IDEMPOTENT_REPLAY_NOOP";

export interface GuardrailDecision {
  canExecuteRefund: boolean;
  blocked: boolean;
  requiresHumanApproval: boolean;
  code: GuardrailDecisionCode;
  reasonEn: string;
  reasonHi: string;
  recommendedRefundPaise: number;
}

export interface UpiOrder {
  order_id: string;
  customer_phone: string;
  customer_name: string;
  amount_paise: number;
  upi_rrn: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  payment_status: UpiPaymentStatus;
  duplicate_payment_id?: string | null;
  awb_code?: string | null;
  warehouse_weight_kg?: number | null;
  courier_weight_kg?: number | null;
  otp_verified: boolean;
  created_at: string;
}

export interface UpiInventoryItem {
  sku: string;
  product_name_en: string;
  product_name_hi: string;
  unit_price_paise: number;
  unit_weight_kg: number;
  stock_count: number;
}

export interface UpiCustomerRefundHistory {
  customer_phone: string;
  customer_name: string;
  total_orders: number;
  refund_claims_count: number;
  refund_ratio: number;
  prior_empty_box_flags: number;
  risk_tier: "LOW" | "MEDIUM" | "HIGH" | "FLAGGED";
}

export interface PracticalReasoningSummary {
  verdict: UpiVerdict;
  reasons: string[];
  namedGaps: string[];
}

export interface BilingualPracticalReasoning {
  en: PracticalReasoningSummary;
  hi: PracticalReasoningSummary;
}

export interface JurorReport {
  jurorId: "JUROR_GATEWAY" | "JUROR_FULFILLMENT" | "JUROR_BUYER_RISK";
  jurorTitleEn: string;
  jurorTitleHi: string;
  scoreContribution: number;
  critiqueEn: string;
  critiqueHi: string;
  gapsIdentified: string[];
  verdictRecommendation: UpiVerdict;
  telemetrySummary: Record<string, unknown>;
  source?: "llm" | "template";
  model?: string;
  provider?: string;
}

export interface UpiIterationLog {
  iteration: number;
  phase: string;
  score: number;
  verdict: UpiVerdict;
  timestamp: string;
  actionTaken: string;
  retrievedArtifacts?: string[];
}

export interface UpiCase {
  case_id: string;
  order_id: string;
  upi_rrn: string;
  claim_amount_paise: number;
  recommended_refund_paise: number;
  claim_type: UpiClaimType;
  buyer_message_en: string;
  buyer_message_hi: string;
  status: UpiCaseStatus;
  verdict: UpiVerdict;
  score: number; // 0-100 deterministic checklist score
  guardrail_state: GuardrailDecisionCode;
  requires_human_approval: boolean;
  human_approved_by?: string | null;
  human_approved_at?: string | null;
  razorpay_refund_id?: string | null;
  reasoning_summary: BilingualPracticalReasoning;
  juror_reports: JurorReport[];
  iteration_logs: UpiIterationLog[];
  created_at: string;
  updated_at: string;
  // Attached store & logistics telemetry for fast view rendering
  order_telemetry?: UpiOrder;
  buyer_telemetry?: UpiCustomerRefundHistory;
  tracking_telemetry?: ShiprocketTrackingData | null;
  origin_group_chat_id?: string | null;
  intake_source?: string | null;
}

export interface UpiAuditLog {
  log_id: string;
  case_id: string;
  actor: string;
  action_type: string;
  tool_called: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  guardrail_check: Record<string, unknown>;
  idempotency_key?: string | null;
  created_at: string;
}

// Razorpay verified types
export interface RazorpayPaymentItem {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: UpiPaymentStatus;
  order_id: string;
  invoice_id?: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status?: string | null;
  captured: boolean;
  description?: string;
  card_id?: string | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  email: string;
  contact: string;
  acquirer_data?: {
    rrn?: string;
    auth_code?: string;
    upi_transaction_id?: string;
    [key: string]: unknown;
  };
  created_at: number;
}

export interface RazorpayRefundItem {
  id: string;
  entity: "refund";
  amount: number;
  currency: "INR";
  payment_id: string;
  notes?: Record<string, string>;
  receipt?: string;
  acquirer_data?: {
    rrn?: string;
    [key: string]: unknown;
  };
  created_at: number;
  batch_id?: string | null;
  status: "processed" | "pending" | "failed";
  speed_processed: "normal" | "optimum";
  speed_requested: "normal" | "optimum";
}

// Shiprocket exact schema
export interface ShiprocketShipmentTrack {
  id: number;
  awb_code: string;
  courier_company_id: number;
  shipment_id: number;
  order_id: number | string;
  pickup_date: string;
  delivered_date: string;
  weight: string;
  packages: number;
  current_status: "DELIVERED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "RTO_INITIATED" | "LOST_IN_TRANSIT" | "PICKED_UP";
  delivered_to: string;
  destination: string;
  consignee_name: string;
  origin: string;
  courier_agent_details: string;
}

export interface ShiprocketTrackActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
  "sr-status": string;
  "sr-status-label": string;
}

export interface ShiprocketTrackingData {
  track_status: number;
  shipment_status: number;
  shipment_track: ShiprocketShipmentTrack[];
  shipment_track_activities: ShiprocketTrackActivity[];
  track_url: string;
  etd: string;
}

export interface ShiprocketResponse {
  tracking_data: ShiprocketTrackingData;
}

// WhatsApp Cloud API
export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: string;
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: "whatsapp";
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: WhatsAppIncomingMessage[];
    };
    field: "messages";
  }>;
}

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WhatsAppWebhookEntry[];
}

