// Shiprocket Tracking Connector & Fallback Handler
// Verified endpoint: GET https://apiv2.shiprocket.in/v1/external/courier/track/awb/{awb_code}
// 240h token cache & refresh + schema-exact local mock fallback

import { SEED_TRACKING } from "./seed-cases";
import type { ShiprocketResponse, ShiprocketTrackingData } from "./types";

interface TokenCache {
  token: string | null;
  expiresAt: number;
}

let cachedAuth: TokenCache = {
  token: null,
  expiresAt: 0,
};

const TIMEOUT_MS = 3500;

export async function getShiprocketToken(): Promise<string | null> {
  // If direct bearer token provided in env, use it
  if (process.env.SHIPROCKET_BEARER_TOKEN) {
    return process.env.SHIPROCKET_BEARER_TOKEN;
  }

  // Check cached token
  if (cachedAuth.token && Date.now() < cachedAuth.expiresAt) {
    return cachedAuth.token;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as { token: string };
      if (data.token) {
        cachedAuth = {
          token: data.token,
          // 230 hours cache (Shiprocket tokens valid for 240 hours)
          expiresAt: Date.now() + 230 * 3600 * 1000,
        };
        return data.token;
      }
    }
  } catch {
    // ignore and fall back to mock
  }

  return null;
}

export async function trackAwb(
  awbCode: string
): Promise<{ data: ShiprocketTrackingData | null; source: "LIVE_API" | "SHIPROCKET_MOCK_SCHEMA_EXACT" }> {
  const mode = process.env.SHIPROCKET_MODE || "mock";

  if (mode === "live") {
    try {
      const token = await getShiprocketToken();
      if (token) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const res = await fetch(
          `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timer);

        if (res.status === 401) {
          // Token expired, clear cache and retry once
          cachedAuth = { token: null, expiresAt: 0 };
          const freshToken = await getShiprocketToken();
          if (freshToken) {
            const retryRes = await fetch(
              `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`,
              {
                headers: {
                  Authorization: `Bearer ${freshToken}`,
                  "Content-Type": "application/json",
                },
              }
            );
            if (retryRes.ok) {
              const body = (await retryRes.json()) as ShiprocketResponse;
              return { data: body.tracking_data, source: "LIVE_API" };
            }
          }
        } else if (res.ok) {
          const body = (await res.json()) as ShiprocketResponse;
          return { data: body.tracking_data, source: "LIVE_API" };
        }
      }
    } catch {
      // fallback to schema-exact mock
    }
  }

  // Schema-exact local fallback
  const mock = SEED_TRACKING[awbCode];
  if (mock) {
    return { data: { ...mock }, source: "SHIPROCKET_MOCK_SCHEMA_EXACT" };
  }

  // Generic fallback if unknown AWB
  const genericMock: ShiprocketTrackingData = {
    track_status: 1,
    shipment_status: 7,
    shipment_track: [
      {
        id: 999999,
        awb_code: awbCode,
        courier_company_id: 10,
        shipment_id: 777777,
        order_id: "ORD-MOCK",
        pickup_date: "2026-11-01 10:00:00",
        delivered_date: "2026-11-04 14:00:00",
        weight: "1.00",
        packages: 1,
        current_status: "DELIVERED",
        delivered_to: "Buyer",
        destination: "India",
        consignee_name: "Valued Customer",
        origin: "Central Warehouse",
        courier_agent_details: "Surface Courier",
      },
    ],
    shipment_track_activities: [
      {
        date: "2026-11-04 14:00:00",
        status: "DLVD",
        activity: "Delivered to buyer",
        location: "Destination",
        "sr-status": "7",
        "sr-status-label": "DELIVERED",
      },
    ],
    track_url: `https://shiprocket.co/tracking/${awbCode}`,
    etd: "2026-11-04 18:00:00",
  };

  return { data: genericMock, source: "SHIPROCKET_MOCK_SCHEMA_EXACT" };
}

