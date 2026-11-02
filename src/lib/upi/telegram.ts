// BharatRaksha Telegram Bot API Webhook Parser, RRN/Order extractor & Outbound Receipt sender.
// Replaces WhatsApp intake — free, instant setup with BotFather without business verification.
// Extracts 12-digit UPI RRN: /\b(\d{12})\b/
// Extracts Order ID: /\b(ORD-[A-Z0-9-]+)\b/i

export interface ExtractedTelegramClaimData {
  senderId: string;
  senderName?: string;
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

export interface TelegramWebhookPayload {
  update_id?: number;
  message?: TelegramIncomingMessage;
  channel_post?: TelegramIncomingMessage;
  edited_message?: TelegramIncomingMessage;
}

export interface OutboundTelegramLog {
  id: string;
  to: string;
  text: string;
  sentAt: string;
  status: "SENT_LIVE" | "EMULATED_LOCAL";
}

declare global {
  // eslint-disable-next-line no-var
  var __TELEGRAM_OUTBOUND_LOGS__: OutboundTelegramLog[] | undefined;
}

function getOutboundLogs(): OutboundTelegramLog[] {
  if (!globalThis.__TELEGRAM_OUTBOUND_LOGS__) {
    globalThis.__TELEGRAM_OUTBOUND_LOGS__ = [];
  }
  return globalThis.__TELEGRAM_OUTBOUND_LOGS__;
}

export function extractTelegramClaimData(
  message: TelegramIncomingMessage,
  senderIdOverride?: string
): ExtractedTelegramClaimData {
  const text = message.text || "";
  const senderId =
    senderIdOverride ||
    String(message.chat?.id || message.from?.id || "telegram_user");
  const senderName =
    message.from?.first_name || message.from?.username || "Telegram User";

  // Regex rules from prompt specification:
  // 12-digit UPI RRN
  const rrnMatch = text.match(/\b(\d{12})\b/);
  const rrn = rrnMatch ? rrnMatch[1] : null;

  // Order ID: ORD-KRY-8801, ORD-1234, etc.
  const orderMatch = text.match(/\b(ORD-[A-Z0-9-]+)\b/i);
  const orderId = orderMatch ? orderMatch[1].toUpperCase() : null;

  return {
    senderId,
    senderName,
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
}): Promise<OutboundTelegramLog> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const logs = getOutboundLogs();
  const chatId = String(params.to);

  if (token && token.trim().length > 0 && token !== "placeholder_bot_token") {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: params.text,
          parse_mode: "Markdown",
        }),
      });

      if (res.ok) {
        const entry: OutboundTelegramLog = {
          id: `tg_msg_${Date.now()}`,
          to: chatId,
          text: params.text,
          sentAt: new Date().toISOString(),
          status: "SENT_LIVE",
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
  };
  logs.unshift(entry);
  return entry;
}

export function getRecentTelegramLogs(limit = 10): OutboundTelegramLog[] {
  return getOutboundLogs().slice(0, limit);
}
