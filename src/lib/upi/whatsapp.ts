// Parked — returns when the merchant has a WhatsApp business number.
// WhatsApp Cloud API Webhook Parser, RRN/Order extractor & Outbound Receipt sender.
// Extracts 12-digit UPI RRN: /\b(\d{12})\b/
// Extracts Order ID: /\b(ORD-[A-Z0-9-]+)\b/i

import type { WhatsAppIncomingMessage, WhatsAppWebhookPayload } from "./types";

export interface ExtractedClaimData {
  senderPhone: string;
  rawMessage: string;
  rrn: string | null;
  orderId: string | null;
  timestamp: string;
}

export interface OutboundWhatsAppLog {
  id: string;
  to: string;
  text: string;
  sentAt: string;
  status: "SENT_LIVE" | "EMULATED_LOCAL";
}

declare global {
  // eslint-disable-next-line no-var
  var __WHATSAPP_OUTBOUND_LOGS__: OutboundWhatsAppLog[] | undefined;
}

function getOutboundLogs(): OutboundWhatsAppLog[] {
  if (!globalThis.__WHATSAPP_OUTBOUND_LOGS__) {
    globalThis.__WHATSAPP_OUTBOUND_LOGS__ = [];
  }
  return globalThis.__WHATSAPP_OUTBOUND_LOGS__;
}

export function extractUpiClaimData(
  message: WhatsAppIncomingMessage,
  senderPhone?: string
): ExtractedClaimData {
  const text = message.text?.body || "";
  const phone = senderPhone || message.from;

  // Regex rules from prompt specification:
  // 12-digit UPI RRN
  const rrnMatch = text.match(/\b(\d{12})\b/);
  const rrn = rrnMatch ? rrnMatch[1] : null;

  // Order ID: ORD-KRY-8801, ORD-1234, etc.
  const orderMatch = text.match(/\b(ORD-[A-Z0-9-]+)\b/i);
  const orderId = orderMatch ? orderMatch[1].toUpperCase() : null;

  return {
    senderPhone: phone,
    rawMessage: text,
    rrn,
    orderId,
    timestamp: new Date().toISOString(),
  };
}

export function parseWhatsAppWebhook(
  payload: WhatsAppWebhookPayload
): ExtractedClaimData[] {
  const claims: ExtractedClaimData[] = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const messages = change.value.messages || [];
      for (const msg of messages) {
        claims.push(extractUpiClaimData(msg));
      }
    }
  }

  return claims;
}

export async function sendWhatsAppReceipt(params: {
  to: string;
  text: string;
}): Promise<OutboundWhatsAppLog> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const logs = getOutboundLogs();

  if (token && phoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: params.to.replace(/[^\d]/g, ""),
          type: "text",
          text: { preview_url: false, body: params.text },
        }),
      });

      if (res.ok) {
        const entry: OutboundWhatsAppLog = {
          id: `wa_msg_${Date.now()}`,
          to: params.to,
          text: params.text,
          sentAt: new Date().toISOString(),
          status: "SENT_LIVE",
        };
        logs.unshift(entry);
        return entry;
      }
    } catch {
      // fallback to local log
    }
  }

  // Emulated local receipt log
  const entry: OutboundWhatsAppLog = {
    id: `wa_msg_mock_${Date.now()}`,
    to: params.to,
    text: params.text,
    sentAt: new Date().toISOString(),
    status: "EMULATED_LOCAL",
  };
  logs.unshift(entry);
  return entry;
}

export function getRecentWhatsAppLogs(limit = 10): OutboundWhatsAppLog[] {
  return getOutboundLogs().slice(0, limit);
}

