// BharatRaksha Telegram Bot API Webhook Parser, RRN/Order extractor, Outbound Alerts & Merchant Controller.
// Handles Buyer Claim Intake, Merchant Registration (/start), Status Queries (/status), and Inline Action Callbacks.
// Replaces WhatsApp intake — free, instant setup with BotFather without business verification.
// Extracts 12-digit UPI RRN: /\b(\d{12})\b/
// Extracts Order ID: /\b(ORD-[A-Z0-9-]+)\b/i

import type { UpiCase } from "./types";

export interface ExtractedTelegramClaimData {
  senderId: string;
  senderName?: string;
  chatId: string;
  chatType: "private" | "group" | "supergroup" | string;
  isGroup: boolean;
  rawMessage: string;
  rrn: string | null;
  orderId: string | null;
  timestamp: string;
}

export interface TelegramIncomingMessage {
  message_id?: number;
  from?: {
    id: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat?: {
    id: number | string;
    first_name?: string;
    username?: string;
    type?: string;
  };
  text?: string;
  date?: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number | string;
      first_name?: string;
      username?: string;
      type?: string;
    };
    text?: string;
    date?: number;
  };
  data?: string;
}

export interface TelegramWebhookPayload {
  update_id?: number;
  message?: TelegramIncomingMessage;
  channel_post?: TelegramIncomingMessage;
  edited_message?: TelegramIncomingMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface OutboundTelegramLog {
  id: string;
  to: string;
  text: string;
  sentAt: string;
  status: "SENT_LIVE" | "EMULATED_LOCAL";
  replyMarkup?: unknown;
  actionType?: "SEND_MESSAGE" | "EDIT_MESSAGE" | "ANSWER_CALLBACK";
}

export interface MerchantRegistration {
  chatId: string;
  username?: string;
  firstName?: string;
  registeredAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __TELEGRAM_OUTBOUND_LOGS__: OutboundTelegramLog[] | undefined;
  // eslint-disable-next-line no-var
  var __TELEGRAM_MERCHANT_CHAT_ID__: string | undefined;
  // eslint-disable-next-line no-var
  var __TELEGRAM_MERCHANT_REGISTRATION__: MerchantRegistration | undefined;
}

function getOutboundLogs(): OutboundTelegramLog[] {
  if (!globalThis.__TELEGRAM_OUTBOUND_LOGS__) {
    globalThis.__TELEGRAM_OUTBOUND_LOGS__ = [];
  }
  return globalThis.__TELEGRAM_OUTBOUND_LOGS__;
}

export function getMerchantChatId(): string | null {
  const envChatId = process.env.TELEGRAM_MERCHANT_CHAT_ID?.trim();
  if (envChatId) return envChatId;
  return globalThis.__TELEGRAM_MERCHANT_CHAT_ID__ || null;
}

export function registerMerchantChat(
  chatId: string | number,
  meta?: { username?: string; firstName?: string }
): MerchantRegistration {
  const strId = String(chatId).trim();
  globalThis.__TELEGRAM_MERCHANT_CHAT_ID__ = strId;
  const reg: MerchantRegistration = {
    chatId: strId,
    username: meta?.username,
    firstName: meta?.firstName,
    registeredAt: new Date().toISOString(),
  };
  globalThis.__TELEGRAM_MERCHANT_REGISTRATION__ = reg;
  return reg;
}

export function clearMerchantChat(): void {
  delete globalThis.__TELEGRAM_MERCHANT_CHAT_ID__;
  delete globalThis.__TELEGRAM_MERCHANT_REGISTRATION__;
}

export function getMerchantRegistration(): MerchantRegistration | null {
  return globalThis.__TELEGRAM_MERCHANT_REGISTRATION__ || null;
}

export function extractTelegramClaimData(
  message: TelegramIncomingMessage,
  senderIdOverride?: string
): ExtractedTelegramClaimData {
  const text = message.text || "";
  const chatId = String(message.chat?.id || message.from?.id || "telegram_user");
  const chatType = message.chat?.type || "private";
  const isGroup = chatType === "group" || chatType === "supergroup";
  const senderId =
    senderIdOverride ||
    String(message.from?.id || message.chat?.id || "telegram_user");
  const senderName =
    message.from?.first_name || message.from?.username || message.chat?.first_name || "Telegram User";

  // Regex rules:
  // 12-digit UPI RRN
  const rrnMatch = text.match(/\b(\d{12})\b/);
  const rrn = rrnMatch ? rrnMatch[1] : null;

  // Order ID: ORD-KRY-8801, ORD-1234, etc.
  const orderMatch = text.match(/\b(ORD-[A-Z0-9-]+)\b/i);
  const orderId = orderMatch ? orderMatch[1].toUpperCase() : null;

  return {
    senderId,
    senderName,
    chatId,
    chatType,
    isGroup,
    rawMessage: text,
    rrn,
    orderId,
    timestamp: new Date().toISOString(),
  };
}

export function parseTelegramWebhook(
  payload: TelegramWebhookPayload
): ExtractedTelegramClaimData[] {
  const claims: ExtractedTelegramClaimData[] = [];
  const msg = payload.message || payload.channel_post || payload.edited_message;

  if (msg && msg.text) {
    claims.push(extractTelegramClaimData(msg));
  }

  return claims;
}

export async function sendTelegramReceipt(params: {
  to: string | number;
  text: string;
  replyMarkup?: unknown;
}): Promise<OutboundTelegramLog> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const logs = getOutboundLogs();
  const chatId = String(params.to);

  if (token && token.trim().length > 0 && token !== "placeholder_bot_token") {
    try {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        text: params.text,
        parse_mode: "Markdown",
      };
      if (params.replyMarkup) {
        payload.reply_markup = params.replyMarkup;
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const entry: OutboundTelegramLog = {
          id: `tg_msg_${Date.now()}`,
          to: chatId,
          text: params.text,
          sentAt: new Date().toISOString(),
          status: "SENT_LIVE",
          replyMarkup: params.replyMarkup,
          actionType: "SEND_MESSAGE",
        };
        logs.unshift(entry);
        return entry;
      }
    } catch {
      // Fallback cleanly to local log
    }
  }

  // Emulated local receipt log
  const entry: OutboundTelegramLog = {
    id: `tg_msg_mock_${Date.now()}`,
    to: chatId,
    text: params.text,
    sentAt: new Date().toISOString(),
    status: "EMULATED_LOCAL",
    replyMarkup: params.replyMarkup,
    actionType: "SEND_MESSAGE",
  };
  logs.unshift(entry);
  return entry;
}

export async function editTelegramMessage(params: {
  chatId: string | number;
  messageId: number;
  text: string;
  replyMarkup?: unknown;
}): Promise<OutboundTelegramLog> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const logs = getOutboundLogs();
  const chatId = String(params.chatId);

  if (token && token.trim().length > 0 && token !== "placeholder_bot_token") {
    try {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        message_id: params.messageId,
        text: params.text,
        parse_mode: "Markdown",
      };
      if (params.replyMarkup) {
        payload.reply_markup = params.replyMarkup;
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const entry: OutboundTelegramLog = {
          id: `tg_edit_${Date.now()}`,
          to: chatId,
          text: params.text,
          sentAt: new Date().toISOString(),
          status: "SENT_LIVE",
          replyMarkup: params.replyMarkup,
          actionType: "EDIT_MESSAGE",
        };
        logs.unshift(entry);
        return entry;
      }
    } catch {
      // Fallback to local log
    }
  }

  const entry: OutboundTelegramLog = {
    id: `tg_edit_mock_${Date.now()}`,
    to: chatId,
    text: params.text,
    sentAt: new Date().toISOString(),
    status: "EMULATED_LOCAL",
    replyMarkup: params.replyMarkup,
    actionType: "EDIT_MESSAGE",
  };
  logs.unshift(entry);
  return entry;
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "placeholder_bot_token") return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch {
    // Ignore network drop
  }
}

/**
 * Send interactive Alert to the registered Merchant Chat when a new claim is ingested after boot.
 * Includes inline action buttons: [✅ Approve] [❌ Reject] [🔍 Details].
 */
export async function sendMerchantClaimAlert(
  upiCase: UpiCase
): Promise<OutboundTelegramLog | null> {
  const merchantChatId = getMerchantChatId();
  if (!merchantChatId) return null;

  let hindiVerdict = "";
  if (upiCase.verdict === "REJECT_CLAIM") {
    hindiVerdict = "दावा अस्वीकृत (दस्तावेज़ पूर्ण, रिफंड देय नहीं)";
  } else if (upiCase.verdict === "OFFER_PARTIAL") {
    hindiVerdict = "आंशिक रिफंड प्रस्ताव (मानवीय स्वीकृति आवश्यक)";
  } else {
    hindiVerdict = "पूर्ण रिफंड अनुशंसित (मानवीय स्वीकृति आवश्यक)";
  }

  const alertText = [
    `🚨 *New UPI Claim Alert*`,
    ``,
    `• *Case ID:* \`${upiCase.case_id}\``,
    `• *Order ID:* ${upiCase.order_id}`,
    `• *UPI RRN:* \`${upiCase.upi_rrn}\``,
    `• *Claim Type:* ${upiCase.claim_type}`,
    `• *Claim Amount:* ₹${(upiCase.claim_amount_paise / 100).toFixed(2)}`,
    `• *Recommended Refund:* ₹${(upiCase.recommended_refund_paise / 100).toFixed(2)}`,
    `• *Verdict:* *${upiCase.verdict}* (${upiCase.score}/100)`,
    `_निर्णय: ${hindiVerdict}_`,
  ].join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `approve:${upiCase.case_id}` },
        { text: "❌ Reject", callback_data: `reject:${upiCase.case_id}` },
        { text: "🔍 Details", callback_data: `details:${upiCase.case_id}` },
      ],
    ],
  };

  return sendTelegramReceipt({
    to: merchantChatId,
    text: alertText,
    replyMarkup,
  });
}

/**
 * Send short notification to the registered Merchant Chat whenever a refund is executed from any channel.
 */
export async function notifyMerchantRefundExecuted(params: {
  caseId: string;
  orderId: string;
  refundId: string;
  amountPaise: number;
  source?: string;
}): Promise<OutboundTelegramLog | null> {
  const merchantChatId = getMerchantChatId();
  if (!merchantChatId) return null;

  const text = `💸 *Refund Executed*\n\nCase *${params.caseId}* (${params.orderId}): ₹${(
    params.amountPaise / 100
  ).toFixed(2)} refunded successfully.\nRefund ID: \`${params.refundId}\`${
    params.source ? ` (${params.source})` : ""
  }`;

  return sendTelegramReceipt({
    to: merchantChatId,
    text,
  });
}

export function getRecentTelegramLogs(limit = 10): OutboundTelegramLog[] {
  return getOutboundLogs().slice(0, limit);
}
