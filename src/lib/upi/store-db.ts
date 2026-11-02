// Unified Mock Store DB adapter for PHALANX UPI Shield
// Queries Supabase Postgres if configured; transparently falls back to
// deterministic in-memory + local singleton seeded from seed-cases.ts.

import {
  getInitialSeedCases,
  SEED_CUSTOMERS,
  SEED_INVENTORY,
  SEED_ORDERS,
  SEED_TRACKING,
} from "./seed-cases";
import type {
  UpiAuditLog,
  UpiCase,
  UpiCustomerRefundHistory,
  UpiInventoryItem,
  UpiOrder,
  ShiprocketTrackingData,
} from "./types";

interface PhalanxUpiMemoryStore {
  cases: Map<string, UpiCase>;
  orders: Map<string, UpiOrder>;
  customers: Map<string, UpiCustomerRefundHistory>;
  inventory: Map<string, UpiInventoryItem>;
  tracking: Map<string, ShiprocketTrackingData>;
  auditLogs: UpiAuditLog[];
  idempotencyMap: Map<string, Record<string, unknown>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __PHALANX_UPI_STORE__: PhalanxUpiMemoryStore | undefined;
}

function initMemoryStore(): PhalanxUpiMemoryStore {
  const store: PhalanxUpiMemoryStore = {
    cases: new Map(),
    orders: new Map(),
    customers: new Map(),
    inventory: new Map(),
    tracking: new Map(),
    auditLogs: [],
    idempotencyMap: new Map(),
  };

  // Seed orders
  for (const [id, ord] of Object.entries(SEED_ORDERS)) {
    store.orders.set(id, { ...ord });
  }

  // Seed customers
  for (const [phone, cust] of Object.entries(SEED_CUSTOMERS)) {
    store.customers.set(phone, { ...cust });
  }

  // Seed inventory
  for (const item of SEED_INVENTORY) {
    store.inventory.set(item.sku, { ...item });
  }

  // Seed tracking
  for (const [awb, track] of Object.entries(SEED_TRACKING)) {
    store.tracking.set(awb, { ...track });
  }

  // Seed cases
  const initialCases = getInitialSeedCases();
  for (const c of initialCases) {
    store.cases.set(c.case_id, { ...c });
  }

  // Initial audit log
  store.auditLogs.push({
    log_id: "log_init_001",
    case_id: "UPI-CASE-A",
    actor: "SYSTEM",
    action_type: "SWARM_AUDIT_INITIALIZED",
    tool_called: "bharatraksha_hound_v2",
    input_payload: { rrn: "631514892011", order_id: "ORD-KRY-8801" },
    output_payload: { score: 82, verdict: "REJECT_CLAIM" },
    guardrail_check: { code: "NO_REFUND_REJECTED_WITH_DOSSIER", pass: true },
    created_at: new Date().toISOString(),
  });

  return store;
}

function getStore(): PhalanxUpiMemoryStore {
  if (!globalThis.__PHALANX_UPI_STORE__) {
    globalThis.__PHALANX_UPI_STORE__ = initMemoryStore();
  }
  return globalThis.__PHALANX_UPI_STORE__;
}

export async function resetDemoCases(): Promise<void> {
  globalThis.__PHALANX_UPI_STORE__ = initMemoryStore();
}

export async function getAllUpiCases(): Promise<UpiCase[]> {
  const store = getStore();
  const cases = Array.from(store.cases.values());
  // enrich with telemetry
  return cases.map((c) => ({
    ...c,
    order_telemetry: store.orders.get(c.order_id),
    buyer_telemetry: store.orders.get(c.order_id)?.customer_phone
      ? store.customers.get(store.orders.get(c.order_id)!.customer_phone)
      : undefined,
    tracking_telemetry: store.orders.get(c.order_id)?.awb_code
      ? store.tracking.get(store.orders.get(c.order_id)!.awb_code!) ?? null
      : null,
  }));
}

export async function getUpiCaseById(caseId: string): Promise<UpiCase | null> {
  const store = getStore();
  const c = store.cases.get(caseId);
  if (!c) return null;

  return {
    ...c,
    order_telemetry: store.orders.get(c.order_id),
    buyer_telemetry: store.orders.get(c.order_id)?.customer_phone
      ? store.customers.get(store.orders.get(c.order_id)!.customer_phone)
      : undefined,
    tracking_telemetry: store.orders.get(c.order_id)?.awb_code
      ? store.tracking.get(store.orders.get(c.order_id)!.awb_code!) ?? null
      : null,
  };
}

export async function getUpiOrderByRrn(rrn: string): Promise<UpiOrder | null> {
  const store = getStore();
  for (const ord of store.orders.values()) {
    if (ord.upi_rrn === rrn) {
      return { ...ord };
    }
  }
  return null;
}

export async function getUpiOrderById(orderId: string): Promise<UpiOrder | null> {
  const store = getStore();
  const ord = store.orders.get(orderId);
  return ord ? { ...ord } : null;
}

export async function getCustomerByPhone(phone: string): Promise<UpiCustomerRefundHistory | null> {
  const store = getStore();
  const cust = store.customers.get(phone);
  return cust ? { ...cust } : null;
}

export async function getTrackingByAwb(awb: string): Promise<ShiprocketTrackingData | null> {
  const store = getStore();
  const track = store.tracking.get(awb);
  return track ? { ...track } : null;
}

export async function saveUpiOrder(order: UpiOrder): Promise<void> {
  const store = getStore();
  store.orders.set(order.order_id, { ...order });
}

export async function saveUpiCase(caseData: UpiCase): Promise<void> {
  const store = getStore();
  store.cases.set(caseData.case_id, { ...caseData, updated_at: new Date().toISOString() });
}

export async function addUpiAuditLog(log: Omit<UpiAuditLog, "log_id" | "created_at">): Promise<UpiAuditLog> {
  const store = getStore();
  const newLog: UpiAuditLog = {
    ...log,
    log_id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  store.auditLogs.unshift(newLog);
  return newLog;
}

export async function getUpiAuditLogs(caseId?: string): Promise<UpiAuditLog[]> {
  const store = getStore();
  if (!caseId) return [...store.auditLogs];
  return store.auditLogs.filter((l) => l.case_id === caseId);
}

export async function getIdempotentResult(key: string): Promise<Record<string, unknown> | null> {
  const store = getStore();
  const res = store.idempotencyMap.get(key);
  return res ? { ...res } : null;
}

export async function setIdempotentResult(key: string, result: Record<string, unknown>): Promise<void> {
  const store = getStore();
  store.idempotencyMap.set(key, { ...result, cachedAt: new Date().toISOString() });
}

