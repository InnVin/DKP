import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type {
  Dispute, Order, Transaction, WalletBalance, ServiceCategory, Service,
  Provider, PayoutRequest, Milestone, AuditEvent,
  ContactPair, ChangeOrder, AuditEventType, MilestonePhoto,
} from "../types";
import {
  mockDisputes, mockOrders, mockTransactions, mockCategories, mockServices,
  mockProviders, mockAuditLog, mockPayouts, DEFAULT_WALLET,
} from "../mockData";
import {
  isWithinCancelWindow, isWithinDisputeWindow, canTransitionMilestone,
  deriveOrderEscrowStatus, deriveOrderStatus, generateMaskedPhone,
  buildSingleMilestone, isMilestoneWithinDisputeWindow,
} from "../stateMachine";

// ─── State ──────────────────────────────────────────────────────

type State = {
  orders: Order[];
  disputes: Dispute[];
  transactions: Transaction[];
  wallet: WalletBalance;
  categories: ServiceCategory[];
  services: Service[];
  providers: Provider[];
  payouts: PayoutRequest[];
  contactPairs: ContactPair[];
  auditLog: AuditEvent[];
};

// ─── Action Types ───────────────────────────────────────────────

type CreateOrderPayload = Omit<Order, "id" | "status" | "escrowStatus" | "createdAt" | "policy" | "changeOrders" | "contactsRevealed"> & {
  id?: string;
  customerId: string;
  policy?: Order["policy"];
};

type Action =
  | { type: "CREATE_ORDER"; payload: CreateOrderPayload }
  | { type: "FUND_ORDER"; orderId: string }
  | { type: "CANCEL_ORDER"; orderId: string; reason?: string }
  | { type: "ACCEPT_ORDER"; orderId: string; providerId: string }
  | { type: "START_ORDER"; orderId: string }
  | { type: "SUBMIT_ORDER"; orderId: string }
  | { type: "CONFIRM_ORDER"; orderId: string; source?: "customer" | "system" }
  | { type: "OPEN_DISPUTE"; orderId: string; reason: string; description: string; category?: Dispute["category"]; milestoneId?: string }
  | { type: "RESOLVE_DISPUTE"; disputeId: string; resolution: Dispute["resolution"] }
  | { type: "ESCALATE_DISPUTE"; disputeId: string }
  | { type: "FUND_MILESTONE"; orderId: string; milestoneId: string }
  | { type: "START_MILESTONE"; orderId: string; milestoneId: string }
  | { type: "SUBMIT_MILESTONE"; orderId: string; milestoneId: string }
  | { type: "APPROVE_MILESTONE"; orderId: string; milestoneId: string }
  | { type: "DISPUTE_MILESTONE"; orderId: string; milestoneId: string; reason: string; description: string }
  | { type: "PROPOSE_CHANGE"; orderId: string; change: ChangeOrder["changes"]; proposedBy: "customer" | "specialist" }
  | { type: "APPROVE_CHANGE"; orderId: string; changeOrderId: string }
  | { type: "REJECT_CHANGE"; orderId: string; changeOrderId: string }
  | { type: "UPLOAD_PHOTO"; orderId: string; milestoneId: string; photo: Omit<MilestonePhoto, "id" | "milestoneId" | "uploadedAt"> }
  | { type: "TOGGLE_CHECKLIST"; orderId: string; milestoneId: string; checklistItemId: string; checkedBy: "customer" | "specialist" }
  | { type: "TICK" }
  | { type: "CATALOG_UPSERT_CATEGORY"; category: ServiceCategory }
  | { type: "CATALOG_DELETE_CATEGORY"; categoryId: string }
  | { type: "CATALOG_UPSERT_SERVICE"; service: Service }
  | { type: "CATALOG_PUBLISH_SERVICE"; serviceId: string }
  | { type: "CATALOG_ARCHIVE_SERVICE"; serviceId: string }
  | { type: "REQUEST_PAYOUT"; providerId: string; amount: number }
  | { type: "PAYOUT_UPDATE_STATUS"; payoutId: string; status: PayoutRequest["status"]; failureReason?: string }
  | { type: "PROVIDER_UPSERT"; provider: Provider }
  | { type: "PROVIDER_TOGGLE_VERIFIED"; providerId: string }
  | { type: "REVIEW_BYPASS_FLAG"; pairKey: string; flagId: string; action: "WARNING" | "PENALTY" | "DISMISSED" | "BAN" }
  | { type: "RESET_DEMO" };

// ─── Helpers ────────────────────────────────────────────────────

const LS_KEY = "vdele_demo_state_v3";
function uid() { return Math.random().toString(36).slice(2, 9); }
function txId() { return "tx_" + uid(); }

// Using DEFAULT_WALLET from mockData

function freshState(): State {
  return {
    orders: mockOrders, disputes: mockDisputes, transactions: mockTransactions,
    wallet: { ...DEFAULT_WALLET }, categories: mockCategories, services: mockServices,
    providers: mockProviders, payouts: mockPayouts, contactPairs: [], auditLog: mockAuditLog,
  };
}

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw) as State; if (p.contactPairs) return p; }
  } catch {}
  return freshState();
}

function persist(s: State) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} }

function addHours(iso: string, h: number): string {
  const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t + h * 3600000).toISOString() : iso;
}

function audit(log: AuditEvent[], type: AuditEventType, entType: AuditEvent["entityType"], entId: string, actor: AuditEvent["actor"], before?: string, after?: string, meta?: Record<string, unknown>): AuditEvent[] {
  return [{ id: "ae_" + uid(), type, timestamp: new Date().toISOString(), actor, entityType: entType, entityId: entId, before, after, metadata: meta }, ...log].slice(0, 500);
}

// ─── Reducer: Order-Level Actions ───────────────────────────────

function reducer(state: State, action: Action): State {
  const nowIso = new Date().toISOString();

  const getOrder = (id: string) => state.orders.find((o) => o.id === id);
  const mapOrders = (id: string, patch: Partial<Order>) => state.orders.map((o) => o.id === id ? { ...o, ...patch } : o);
  const mapMs = (order: Order, msId: string, patch: Partial<Milestone>): Milestone[] => order.milestones.map((m) => m.id === msId ? { ...m, ...patch } : m);
  const mapAllMs = (order: Order, patch: Partial<Milestone>): Milestone[] => order.milestones.map((m) => ({ ...m, ...patch }));

  /** After milestone update, re-derive order-level statuses. */
  const syncFromMs = (order: Order, ms: Milestone[]): Partial<Order> => ({
    milestones: ms, escrowStatus: deriveOrderEscrowStatus(ms), status: deriveOrderStatus(ms, order.status),
  });

  /** Release a milestone: pending→available. */
  const releaseMs = (order: Order, ms: Milestone) => ({
    wallet: { ...state.wallet, pending: Math.max(0, state.wallet.pending - ms.amount), available: state.wallet.available + ms.amount, totalEarned: state.wallet.totalEarned + ms.amount, held: state.wallet.held },
    tx: { id: txId(), type: "milestone_release" as const, amount: ms.amount, status: "completed" as const, date: nowIso, description: `Выплата: ${ms.name} — ${order.id}`, orderId: order.id, milestoneId: ms.id } satisfies Transaction,
  });

  switch (action.type) {

  case "RESET_DEMO": { const f = freshState(); persist(f); return f; }

  // ── CREATE ──
  case "CREATE_ORDER": {
    const p = action.payload;
    const id = p.id ?? `ORD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const defPol = { cancelWindowMinutes: 30, disputeWindowHours: 24, autoReleaseHours: 24, disputeSlaHours: 48 };
    const milestones = p.milestones?.length ? p.milestones : buildSingleMilestone(id, Math.max(0, p.totalAmount - (p.breakdown?.platformFee ?? 0)), nowIso);
    const order: Order = {
      id, customerId: p.customerId, providerId: p.providerId, serviceId: p.serviceId,
      serviceName: p.serviceName, status: "PLACED", escrowStatus: "NOT_FUNDED",
      totalAmount: p.totalAmount, breakdown: p.breakdown, address: p.address,
      city: p.city ?? "Якутск", scheduledDate: p.scheduledDate, createdAt: nowIso,
      policy: p.policy ?? defPol, provider: p.provider, milestones, changeOrders: [],
      isTurnkey: p.isTurnkey ?? false, contactsRevealed: false, maskedPhone: generateMaskedPhone(),
    };
    const log = audit(state.auditLog, "ORDER_CREATED", "order", id, { role: "customer", id: p.customerId });
    const next = { ...state, orders: [order, ...state.orders], auditLog: log };
    persist(next); return next;
  }

  // ── FUND ──
  case "FUND_ORDER": {
    const o = getOrder(action.orderId);
    if (!o || o.status !== "PLACED") return state;
    const ms = mapAllMs(o, { status: "FUNDED", fundedAt: nowIso });
    const orders = mapOrders(o.id, { status: "FUNDED", escrowStatus: "HELD", fundedAt: nowIso, milestones: ms });
    const txs: Transaction[] = [{ id: txId(), type: "escrow_hold", amount: o.totalAmount, status: "completed", date: nowIso, description: `Escrow hold — ${o.id}`, orderId: o.id }, ...state.transactions];
    const log = audit(state.auditLog, "ORDER_FUNDED", "order", o.id, { role: "customer", id: o.customerId }, "PLACED", "FUNDED");
    const next = { ...state, orders, transactions: txs, auditLog: log }; persist(next); return next;
  }

  // ── CANCEL ──
  case "CANCEL_ORDER": {
    const o = getOrder(action.orderId);
    if (!o || !["PLACED", "FUNDED"].includes(o.status)) return state;
    if (o.status === "FUNDED" && !isWithinCancelWindow(o)) return state;
    const refund = o.escrowStatus === "HELD";
    const ms = mapAllMs(o, { status: refund ? "REFUNDED" : "CANCELLED" });
    const orders = mapOrders(o.id, { status: "CANCELLED", escrowStatus: refund ? "REFUNDED" : o.escrowStatus, cancelledAt: nowIso, autoReleaseDate: undefined, milestones: ms });
    const txs = refund ? [{ id: txId(), type: "refund" as const, amount: -o.totalAmount, status: "completed" as const, date: nowIso, description: `Возврат — ${o.id}`, orderId: o.id }, ...state.transactions] : state.transactions;
    const log = audit(state.auditLog, "ORDER_CANCELLED", "order", o.id, { role: "customer", id: o.customerId }, o.status, "CANCELLED");
    const next = { ...state, orders, transactions: txs, auditLog: log }; persist(next); return next;
  }

  // ── ACCEPT ──
  case "ACCEPT_ORDER": {
    const o = getOrder(action.orderId);
    if (!o || o.status !== "FUNDED") return state;
    const prov = state.providers.find((p) => p.id === action.providerId);
    const orders = mapOrders(o.id, { status: "ASSIGNED", providerId: action.providerId, assignedAt: nowIso, contactsRevealed: true, provider: prov ?? o.provider });
    const providers = state.providers.map((p) => p.id === action.providerId ? { ...p, activeOrderCount: p.activeOrderCount + 1 } : p);
    const log = audit(state.auditLog, "ORDER_ASSIGNED", "order", o.id, { role: "specialist", id: action.providerId }, "FUNDED", "ASSIGNED");
    const next = { ...state, orders, providers, auditLog: log }; persist(next); return next;
  }

  // ── START (simple order) ──
  case "START_ORDER": {
    const o = getOrder(action.orderId);
    if (!o || o.status !== "ASSIGNED") return state;
    const ms = o.milestones.length === 1 ? mapMs(o, o.milestones[0].id, { status: "IN_PROGRESS", startedAt: nowIso }) : o.milestones;
    const derived = syncFromMs(o, ms);
    const orders = mapOrders(o.id, { ...derived, startedAt: nowIso, status: "IN_PROGRESS" });
    const log = audit(state.auditLog, "ORDER_STARTED", "order", o.id, { role: "specialist", id: o.providerId ?? "" }, "ASSIGNED", "IN_PROGRESS");
    const next = { ...state, orders, auditLog: log }; persist(next); return next;
  }

  // ── SUBMIT (simple order) ──
  case "SUBMIT_ORDER": {
    const o = getOrder(action.orderId);
    if (!o || o.status !== "IN_PROGRESS") return state;
    const autoDate = addHours(nowIso, o.policy.autoReleaseHours);
    const ms = o.milestones.length === 1 ? mapMs(o, o.milestones[0].id, { status: "SUBMITTED", submittedAt: nowIso, autoReleaseAt: autoDate }) : o.milestones;
    const orders = mapOrders(o.id, { status: "SUBMITTED", submittedAt: nowIso, autoReleaseDate: autoDate, milestones: ms });
    const log = audit(state.auditLog, "ORDER_SUBMITTED", "order", o.id, { role: "specialist", id: o.providerId ?? "" }, "IN_PROGRESS", "SUBMITTED");
    const next = { ...state, orders, auditLog: log }; persist(next); return next;
  }

  // ── CONFIRM (simple order) ──
  case "CONFIRM_ORDER": {
    const o = getOrder(action.orderId);
    if (!o || o.status !== "SUBMITTED" || o.escrowStatus !== "HELD") return state;
    const ms0 = o.milestones[0];
    const updMs = mapMs(o, ms0.id, { status: "RELEASED", approvedAt: nowIso, releasedAt: nowIso });
    const { wallet, tx } = releaseMs(o, ms0);
    const orders = mapOrders(o.id, { status: "COMPLETED", escrowStatus: "RELEASED", completedAt: nowIso, autoReleaseDate: undefined, milestones: updMs });
    // Update provider stats
    const providers = state.providers.map((p) => p.id === o.providerId ? { ...p, activeOrderCount: Math.max(0, p.activeOrderCount - 1), completedOrders: p.completedOrders + 1 } : p);
    // Update contact pair
    const pairs = updateContactPair(state.contactPairs, o.customerId, o.providerId ?? "", nowIso);
    const log = audit(state.auditLog, "ORDER_CONFIRMED", "order", o.id, { role: action.source === "system" ? "system" : "customer", id: o.customerId }, "SUBMITTED", "COMPLETED");
    const next = { ...state, orders, wallet, transactions: [tx, ...state.transactions], providers, contactPairs: pairs, auditLog: log };
    persist(next); return next;
  }

  // ════════════════════════════════════════════════════════════
  // DISPUTE ACTIONS
  // ════════════════════════════════════════════════════════════

  case "OPEN_DISPUTE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    // For simple orders: must be SUBMITTED
    if (!action.milestoneId && o.status !== "SUBMITTED") return state;
    if (!action.milestoneId && o.escrowStatus !== "HELD") return state;
    if (!action.milestoneId && !isWithinDisputeWindow(o)) return state;

    const dispute: Dispute = {
      id: "DIS-" + uid().toUpperCase(), orderId: o.id,
      milestoneId: action.milestoneId,
      status: "OPEN", category: action.category ?? "OTHER",
      reason: action.reason, description: action.description,
      openedBy: "customer", openedAt: nowIso,
      evidence: [], slaBreached: false,
      slaDeadline: addHours(nowIso, o.policy.disputeSlaHours),
    };

    let ms = o.milestones;
    if (action.milestoneId) {
      ms = mapMs(o, action.milestoneId, { status: "DISPUTED", disputedAt: nowIso });
    } else {
      ms = mapAllMs(o, { status: "DISPUTED", disputedAt: nowIso });
    }
    const derived = syncFromMs(o, ms);
    const orders = mapOrders(o.id, { ...derived, status: "DISPUTED", escrowStatus: "FROZEN" });
    const wallet = { ...state.wallet, held: state.wallet.held + (action.milestoneId ? (o.milestones.find(m => m.id === action.milestoneId)?.amount ?? 0) : o.totalAmount) };
    const log = audit(state.auditLog, "DISPUTE_OPENED", "dispute", dispute.id, { role: "customer", id: o.customerId });
    const next = { ...state, orders, disputes: [dispute, ...state.disputes], wallet, auditLog: log };
    persist(next); return next;
  }

  case "ESCALATE_DISPUTE": {
    const d = state.disputes.find((x) => x.id === action.disputeId);
    if (!d || d.status !== "UNDER_REVIEW") return state;
    const disputes = state.disputes.map((x) => x.id === d.id ? { ...x, status: "ESCALATED" as const, escalatedAt: nowIso } : x);
    const log = audit(state.auditLog, "DISPUTE_ESCALATED", "dispute", d.id, { role: "admin" });
    const next = { ...state, disputes, auditLog: log }; persist(next); return next;
  }

  case "RESOLVE_DISPUTE": {
    const d = state.disputes.find((x) => x.id === action.disputeId);
    if (!d) return state;
    const o = getOrder(d.orderId);
    if (!o || o.escrowStatus !== "FROZEN") return state;
    const res = action.resolution;
    if (!res) return state;

    let txs = [...state.transactions];
    let wallet = { ...state.wallet };
    let ms = o.milestones;

    if (res.type === "release") {
      const targetMs = d.milestoneId ? o.milestones.find(m => m.id === d.milestoneId) : o.milestones[0];
      if (targetMs) {
        ms = mapMs(o, targetMs.id, { status: "RELEASED", approvedAt: nowIso, releasedAt: nowIso });
        wallet.available += targetMs.amount;
        wallet.held = Math.max(0, wallet.held - targetMs.amount);
        wallet.totalEarned += targetMs.amount;
        txs.unshift({ id: txId(), type: "milestone_release", amount: targetMs.amount, status: "completed", date: nowIso, description: `Спор решён → выплата: ${targetMs.name} — ${o.id}`, orderId: o.id, milestoneId: targetMs.id });
      }
    } else if (res.type === "refund") {
      const targetMs = d.milestoneId ? o.milestones.find(m => m.id === d.milestoneId) : o.milestones[0];
      if (targetMs) {
        ms = mapMs(o, targetMs.id, { status: "REFUNDED" });
        wallet.held = Math.max(0, wallet.held - targetMs.amount);
        txs.unshift({ id: txId(), type: "refund", amount: -targetMs.amount, status: "completed", date: nowIso, description: `Спор решён → возврат: ${targetMs.name} — ${o.id}`, orderId: o.id, milestoneId: targetMs.id });
      }
    } else if (res.type === "split") {
      const custAmt = res.customerAmount ?? 0;
      const provAmt = res.providerAmount ?? 0;
      const targetMs = d.milestoneId ? o.milestones.find(m => m.id === d.milestoneId) : o.milestones[0];
      if (targetMs) {
        ms = mapMs(o, targetMs.id, { status: "RELEASED", approvedAt: nowIso, releasedAt: nowIso });
        wallet.available += provAmt;
        wallet.held = Math.max(0, wallet.held - (custAmt + provAmt));
        wallet.totalEarned += provAmt;
        txs.unshift({ id: txId(), type: "milestone_release", amount: provAmt, status: "completed", date: nowIso, description: `Split выплата — ${o.id}`, orderId: o.id });
        if (custAmt > 0) txs.unshift({ id: txId(), type: "refund", amount: -custAmt, status: "completed", date: nowIso, description: `Split возврат — ${o.id}`, orderId: o.id });
      }
    }

    const derived = syncFromMs(o, ms);
    // If all milestones resolved, complete or cancel order
    let finalStatus = derived.status;
    if (ms.every(m => m.status === "RELEASED")) finalStatus = "COMPLETED";
    else if (ms.every(m => m.status === "REFUNDED" || m.status === "CANCELLED")) finalStatus = "CANCELLED";

    const orders = mapOrders(o.id, { ...derived, status: finalStatus, completedAt: finalStatus === "COMPLETED" ? nowIso : o.completedAt, cancelledAt: finalStatus === "CANCELLED" ? nowIso : o.cancelledAt });
    const disputes = state.disputes.map((x) => x.id === d.id ? { ...x, status: "CLOSED" as const, resolvedAt: nowIso, resolution: res } : x);

    // Update provider dispute rate
    const providers = o.providerId ? state.providers.map((p) => {
      if (p.id !== o.providerId) return p;
      const totalDisputes = state.disputes.filter(dd => state.orders.find(oo => oo.id === dd.orderId && oo.providerId === p.id)).length;
      return { ...p, disputeRate: p.completedOrders > 0 ? totalDisputes / p.completedOrders : 0 };
    }) : state.providers;

    const log = audit(state.auditLog, "DISPUTE_RESOLVED", "dispute", d.id, { role: "admin" }, d.status, "CLOSED");
    const next = { ...state, orders, disputes, transactions: txs, wallet, providers, auditLog: log };
    persist(next); return next;
  }

  // ════════════════════════════════════════════════════════════
  // MILESTONE-LEVEL ACTIONS
  // ════════════════════════════════════════════════════════════

  case "FUND_MILESTONE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const ms = o.milestones.find((m) => m.id === action.milestoneId);
    if (!ms || !canTransitionMilestone(ms.status, "FUNDED")) return state;
    const updMs = mapMs(o, ms.id, { status: "FUNDED", fundedAt: nowIso });
    const derived = syncFromMs(o, updMs);
    const orders = mapOrders(o.id, derived);
    const txs: Transaction[] = [{ id: txId(), type: "escrow_hold", amount: ms.amount, status: "completed", date: nowIso, description: `Escrow hold: ${ms.name} — ${o.id}`, orderId: o.id, milestoneId: ms.id }, ...state.transactions];
    const log = audit(state.auditLog, "MILESTONE_FUNDED", "milestone", ms.id, { role: "customer", id: o.customerId });
    const next = { ...state, orders, transactions: txs, auditLog: log }; persist(next); return next;
  }

  case "START_MILESTONE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const ms = o.milestones.find((m) => m.id === action.milestoneId);
    if (!ms || !canTransitionMilestone(ms.status, "IN_PROGRESS")) return state;
    const updMs = mapMs(o, ms.id, { status: "IN_PROGRESS", startedAt: nowIso });
    const derived = syncFromMs(o, updMs);
    // If order was ASSIGNED, move to IN_PROGRESS
    const extra: Partial<Order> = o.status === "ASSIGNED" ? { startedAt: nowIso } : {};
    const orders = mapOrders(o.id, { ...derived, status: derived.status === "ASSIGNED" ? "IN_PROGRESS" : derived.status, ...extra });
    const log = audit(state.auditLog, "MILESTONE_STARTED", "milestone", ms.id, { role: "specialist", id: o.providerId ?? "" });
    const next = { ...state, orders, auditLog: log }; persist(next); return next;
  }

  case "SUBMIT_MILESTONE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const ms = o.milestones.find((m) => m.id === action.milestoneId);
    if (!ms || !canTransitionMilestone(ms.status, "SUBMITTED")) return state;
    const autoDate = addHours(nowIso, o.policy.milestoneAutoReleaseHours ?? o.policy.autoReleaseHours);
    const updMs = mapMs(o, ms.id, { status: "SUBMITTED", submittedAt: nowIso, autoReleaseAt: autoDate });
    const derived = syncFromMs(o, updMs);
    const orders = mapOrders(o.id, derived);
    const log = audit(state.auditLog, "MILESTONE_SUBMITTED", "milestone", ms.id, { role: "specialist", id: o.providerId ?? "" });
    const next = { ...state, orders, auditLog: log }; persist(next); return next;
  }

  case "APPROVE_MILESTONE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const ms = o.milestones.find((m) => m.id === action.milestoneId);
    if (!ms || !canTransitionMilestone(ms.status, "APPROVED")) return state;
    // Approve then immediately release (in production these might be separate)
    const updMs = mapMs(o, ms.id, { status: "RELEASED", approvedAt: nowIso, releasedAt: nowIso });
    const derived = syncFromMs(o, updMs);
    const { wallet, tx } = releaseMs(o, ms);
    // If all milestones released, complete order
    const allDone = updMs.every((m) => m.status === "RELEASED");
    const finalPatch: Partial<Order> = allDone ? { status: "COMPLETED", completedAt: nowIso, escrowStatus: "RELEASED" } : derived;
    const orders = mapOrders(o.id, { ...derived, ...finalPatch, milestones: updMs });

    // Provider stats on full completion
    let providers = state.providers;
    let pairs = state.contactPairs;
    if (allDone && o.providerId) {
      providers = providers.map((p) => p.id === o.providerId ? { ...p, activeOrderCount: Math.max(0, p.activeOrderCount - 1), completedOrders: p.completedOrders + 1 } : p);
      pairs = updateContactPair(pairs, o.customerId, o.providerId, nowIso);
    }

    const log = audit(state.auditLog, "MILESTONE_RELEASED", "milestone", ms.id, { role: "customer", id: o.customerId }, "SUBMITTED", "RELEASED", { amount: ms.amount });
    const next = { ...state, orders, wallet, transactions: [tx, ...state.transactions], providers, contactPairs: pairs, auditLog: log };
    persist(next); return next;
  }

  case "DISPUTE_MILESTONE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const ms = o.milestones.find((m) => m.id === action.milestoneId);
    if (!ms || !canTransitionMilestone(ms.status, "DISPUTED")) return state;

    const dispute: Dispute = {
      id: "DIS-" + uid().toUpperCase(), orderId: o.id, milestoneId: ms.id,
      status: "OPEN", category: "QUALITY",
      reason: action.reason, description: action.description,
      openedBy: "customer", openedAt: nowIso, evidence: [],
      slaBreached: false, slaDeadline: addHours(nowIso, o.policy.disputeSlaHours),
    };

    const updMs = mapMs(o, ms.id, { status: "DISPUTED", disputedAt: nowIso });
    const derived = syncFromMs(o, updMs);
    const wallet = { ...state.wallet, held: state.wallet.held + ms.amount };
    const orders = mapOrders(o.id, derived);
    const log = audit(state.auditLog, "MILESTONE_DISPUTED", "milestone", ms.id, { role: "customer", id: o.customerId });
    const next = { ...state, orders, disputes: [dispute, ...state.disputes], wallet, auditLog: log };
    persist(next); return next;
  }

  // ════════════════════════════════════════════════════════════
  // CHANGE ORDERS, PHOTOS, CHECKLIST
  // ════════════════════════════════════════════════════════════

  case "PROPOSE_CHANGE": {
    const o = getOrder(action.orderId);
    if (!o || !["IN_PROGRESS", "ASSIGNED"].includes(o.status)) return state;
    const co: ChangeOrder = {
      id: "CO-" + uid().toUpperCase(), orderId: o.id,
      proposedBy: action.proposedBy, proposedAt: nowIso,
      status: "PROPOSED", changes: action.change,
    };
    const orders = mapOrders(o.id, { changeOrders: [...o.changeOrders, co] });
    const log = audit(state.auditLog, "CHANGE_ORDER_PROPOSED", "order", o.id, { role: action.proposedBy === "customer" ? "customer" : "specialist" });
    const next = { ...state, orders, auditLog: log }; persist(next); return next;
  }

  case "APPROVE_CHANGE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const co = o.changeOrders.find((c) => c.id === action.changeOrderId);
    if (!co || co.status !== "PROPOSED") return state;
    const updCo = o.changeOrders.map((c) => c.id === co.id ? { ...c, status: "APPROVED" as const, resolvedAt: nowIso } : c);

    // Apply changes
    let ms = [...o.milestones];
    let totalAmount = o.totalAmount;
    if (co.changes.addMilestones) {
      const provPayout = Math.max(0, totalAmount - o.breakdown.platformFee);
      for (const tmpl of co.changes.addMilestones) {
        const newMs: Milestone = {
          id: `MS-${o.id}-${ms.length + 1}`, orderId: o.id, seq: ms.length + 1,
          name: tmpl.name, description: tmpl.description, percent: tmpl.percent,
          amount: tmpl.amount, status: "NOT_FUNDED", dependsOnPrevious: tmpl.dependsOnPrevious,
          createdAt: nowIso, photos: [], checklist: [],
        };
        ms.push(newMs);
      }
    }
    if (co.changes.removeMilestoneIds) {
      ms = ms.filter((m) => !co.changes.removeMilestoneIds!.includes(m.id) || m.status !== "NOT_FUNDED");
    }
    if (co.changes.priceAdjustment) {
      totalAmount += co.changes.priceAdjustment;
    }

    const orders = mapOrders(o.id, { changeOrders: updCo, milestones: ms, totalAmount });
    const log = audit(state.auditLog, "CHANGE_ORDER_APPROVED", "order", o.id, { role: "customer" });
    const next = { ...state, orders, auditLog: log }; persist(next); return next;
  }

  case "REJECT_CHANGE": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const updCo = o.changeOrders.map((c) => c.id === action.changeOrderId ? { ...c, status: "REJECTED" as const, resolvedAt: nowIso } : c);
    const orders = mapOrders(o.id, { changeOrders: updCo });
    const log = audit(state.auditLog, "CHANGE_ORDER_REJECTED", "order", o.id, { role: "customer" });
    const next = { ...state, orders, auditLog: log }; persist(next); return next;
  }

  case "UPLOAD_PHOTO": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const photo: MilestonePhoto = {
      id: "ph_" + uid(), milestoneId: action.milestoneId,
      type: action.photo.type, url: action.photo.url,
      uploadedBy: action.photo.uploadedBy, uploadedAt: nowIso,
      caption: action.photo.caption,
    };
    const ms = o.milestones.map((m) => m.id === action.milestoneId ? { ...m, photos: [...m.photos, photo] } : m);
    const orders = mapOrders(o.id, { milestones: ms });
    const next = { ...state, orders }; persist(next); return next;
  }

  case "TOGGLE_CHECKLIST": {
    const o = getOrder(action.orderId);
    if (!o) return state;
    const ms = o.milestones.map((m) => {
      if (m.id !== action.milestoneId) return m;
      const cl = m.checklist.map((c) => {
        if (c.id !== action.checklistItemId) return c;
        return { ...c, checked: !c.checked, checkedAt: !c.checked ? nowIso : undefined, checkedBy: !c.checked ? action.checkedBy : undefined };
      });
      return { ...m, checklist: cl };
    });
    const orders = mapOrders(o.id, { milestones: ms });
    const next = { ...state, orders }; persist(next); return next;
  }

  // ════════════════════════════════════════════════════════════
  // TICK (auto-release), CATALOG, PAYOUTS, PROVIDERS, BYPASS
  // ════════════════════════════════════════════════════════════

  case "TICK": {
    const now = Date.now();
    let changed = false;
    let orders = state.orders;
    let wallet = state.wallet;
    let txs = state.transactions;
    let log = state.auditLog;
    let providers = state.providers;
    let pairs = state.contactPairs;

    for (const o of state.orders) {
      // Auto-release for simple orders
      if (o.status === "SUBMITTED" && o.escrowStatus === "HELD" && o.autoReleaseDate) {
        const t = Date.parse(o.autoReleaseDate);
        if (Number.isFinite(t) && t <= now) {
          const ms0 = o.milestones[0];
          if (ms0 && ms0.status === "SUBMITTED") {
            const updMs = mapMs(o, ms0.id, { status: "RELEASED", approvedAt: new Date().toISOString(), releasedAt: new Date().toISOString() });
            const r = releaseMs(o, ms0);
            orders = orders.map((x) => x.id === o.id ? { ...x, status: "COMPLETED" as const, escrowStatus: "RELEASED" as const, completedAt: new Date().toISOString(), autoReleaseDate: undefined, milestones: updMs } : x);
            wallet = r.wallet;
            txs = [r.tx, ...txs];
            log = audit(log, "ORDER_AUTO_RELEASED", "order", o.id, { role: "system" }, "SUBMITTED", "COMPLETED");
            if (o.providerId) {
              providers = providers.map(p => p.id === o.providerId ? { ...p, activeOrderCount: Math.max(0, p.activeOrderCount - 1), completedOrders: p.completedOrders + 1 } : p);
              pairs = updateContactPair(pairs, o.customerId, o.providerId, new Date().toISOString());
            }
            changed = true;
            break;
          }
        }
      }

      // Auto-release for individual milestones in turnkey orders
      if (o.isTurnkey && o.status === "IN_PROGRESS") {
        for (const ms of o.milestones) {
          if (ms.status === "SUBMITTED" && ms.autoReleaseAt) {
            const t = Date.parse(ms.autoReleaseAt);
            if (Number.isFinite(t) && t <= now) {
              const updMs = o.milestones.map(m => m.id === ms.id ? { ...m, status: "RELEASED" as const, approvedAt: new Date().toISOString(), releasedAt: new Date().toISOString() } : m);
              const r = releaseMs(o, ms);
              const derived = syncFromMs(o, updMs);
              const allDone = updMs.every(m => m.status === "RELEASED");
              orders = orders.map(x => x.id === o.id ? { ...x, ...derived, milestones: updMs, ...(allDone ? { status: "COMPLETED" as const, completedAt: new Date().toISOString(), escrowStatus: "RELEASED" as const } : {}) } : x);
              wallet = r.wallet;
              txs = [r.tx, ...txs];
              log = audit(log, "MILESTONE_RELEASED", "milestone", ms.id, { role: "system" }, "SUBMITTED", "RELEASED", { auto: true });
              if (allDone && o.providerId) {
                providers = providers.map(p => p.id === o.providerId ? { ...p, activeOrderCount: Math.max(0, p.activeOrderCount - 1), completedOrders: p.completedOrders + 1 } : p);
                pairs = updateContactPair(pairs, o.customerId, o.providerId, new Date().toISOString());
              }
              changed = true;
              break;
            }
          }
        }
        if (changed) break;
      }
    }

    if (!changed) return state;
    const next = { ...state, orders, wallet, transactions: txs, auditLog: log, providers, contactPairs: pairs };
    persist(next); return next;
  }

  // ── Catalog ──
  case "CATALOG_UPSERT_CATEGORY": {
    const cats = state.categories.some((c) => c.id === action.category.id) ? state.categories.map((c) => c.id === action.category.id ? action.category : c) : [action.category, ...state.categories];
    const next = { ...state, categories: cats }; persist(next); return next;
  }
  case "CATALOG_DELETE_CATEGORY": {
    const next = { ...state, categories: state.categories.filter((c) => c.id !== action.categoryId), services: state.services.filter((s) => s.categoryId !== action.categoryId) };
    persist(next); return next;
  }
  case "CATALOG_UPSERT_SERVICE": {
    const s = { ...action.service, updatedAt: nowIso, version: action.service.version ?? 1, published: action.service.published ?? false } as Service;
    const svcs = state.services.some((x) => x.id === s.id) ? state.services.map((x) => x.id === s.id ? { ...s, version: x.version + 1 } : x) : [{ ...s, version: 1 }, ...state.services];
    const next = { ...state, services: svcs }; persist(next); return next;
  }
  case "CATALOG_PUBLISH_SERVICE": {
    const next = { ...state, services: state.services.map((s) => s.id === action.serviceId ? { ...s, published: true, updatedAt: nowIso } : s) };
    persist(next); return next;
  }
  case "CATALOG_ARCHIVE_SERVICE": {
    const next = { ...state, services: state.services.map((s) => s.id === action.serviceId ? { ...s, published: false, updatedAt: nowIso } : s) };
    persist(next); return next;
  }

  // ── Payouts ──
  case "REQUEST_PAYOUT": {
    if (action.amount <= 0 || action.amount > state.wallet.available) return state;
    const fee = Math.max(0, Math.round(action.amount * 0.02));
    const po: PayoutRequest = { id: "PO-" + uid().toUpperCase(), providerId: action.providerId, amount: action.amount, fee, status: "REQUESTED", requestedAt: nowIso };
    const tx: Transaction = { id: txId(), type: "payout", amount: -action.amount, status: "pending", date: nowIso, description: `Запрос на вывод — ${po.id}` };
    const wallet = { ...state.wallet, available: state.wallet.available - action.amount, pending: state.wallet.pending + action.amount };
    const log = audit(state.auditLog, "PAYOUT_REQUESTED", "payout", po.id, { role: "specialist", id: action.providerId });
    const next = { ...state, payouts: [po, ...state.payouts], transactions: [tx, ...state.transactions], wallet, auditLog: log };
    persist(next); return next;
  }
  case "PAYOUT_UPDATE_STATUS": {
    const p = state.payouts.find((x) => x.id === action.payoutId);
    if (!p) return state;
    const payouts = state.payouts.map((x) => x.id === p.id ? { ...x, status: action.status, processedAt: nowIso, failureReason: action.failureReason } : x);
    let wallet = { ...state.wallet };
    if (action.status === "SUCCEEDED") wallet.pending = Math.max(0, wallet.pending - p.amount);
    if (action.status === "REJECTED" || action.status === "FAILED") { wallet.pending = Math.max(0, wallet.pending - p.amount); wallet.available += p.amount; }
    const log = audit(state.auditLog, "PAYOUT_COMPLETED", "payout", p.id, { role: "admin" });
    const next = { ...state, payouts, wallet, auditLog: log }; persist(next); return next;
  }

  // ── Providers ──
  case "PROVIDER_UPSERT": {
    const provs = state.providers.some((p) => p.id === action.provider.id) ? state.providers.map((p) => p.id === action.provider.id ? action.provider : p) : [action.provider, ...state.providers];
    const next = { ...state, providers: provs }; persist(next); return next;
  }
  case "PROVIDER_TOGGLE_VERIFIED": {
    const provs = state.providers.map((p) => p.id === action.providerId ? { ...p, verified: !p.verified, kycStatus: !p.verified ? "VERIFIED" as const : "NOT_STARTED" as const } : p);
    const log = audit(state.auditLog, "PROVIDER_VERIFIED", "provider", action.providerId, { role: "admin" });
    const next = { ...state, providers: provs, auditLog: log }; persist(next); return next;
  }

  // ── Anti-bypass ──
  case "REVIEW_BYPASS_FLAG": {
    const pairs = state.contactPairs.map((pair) => {
      const key = `${pair.customerId}-${pair.providerId}`;
      if (key !== action.pairKey) return pair;
      const flags = pair.flags.map((f) => f.id === action.flagId ? { ...f, reviewed: true, reviewedAt: nowIso, action: action.action } : f);
      return { ...pair, flags };
    });
    const log = audit(state.auditLog, "BYPASS_FLAG_REVIEWED", "provider", action.pairKey, { role: "admin" }, undefined, action.action);
    const next = { ...state, contactPairs: pairs, auditLog: log }; persist(next); return next;
  }

  default: return state;
  }
}

// ─── Contact Pair Helper ────────────────────────────────────────

function updateContactPair(pairs: ContactPair[], customerId: string, providerId: string, nowIso: string): ContactPair[] {
  const existing = pairs.find((p) => p.customerId === customerId && p.providerId === providerId);
  if (existing) {
    return pairs.map((p) => p === existing ? { ...p, platformOrders: p.platformOrders + 1, lastOrderAt: nowIso } : p);
  }
  return [...pairs, { customerId, providerId, platformOrders: 1, firstOrderAt: nowIso, lastOrderAt: nowIso, riskLevel: "LOW", flags: [] }];
}

// ─── Context & Provider ─────────────────────────────────────────

type Ctx = State & {
  actions: {
    // Order-level
    createOrder: (payload: CreateOrderPayload) => void;
    fundOrder: (orderId: string) => void;
    cancelOrder: (orderId: string, reason?: string) => void;
    acceptOrder: (orderId: string, providerId: string) => void;
    startOrder: (orderId: string) => void;
    submitOrder: (orderId: string) => void;
    confirmOrder: (orderId: string) => void;
    // Disputes
    openDispute: (orderId: string, reason: string, description: string, category?: Dispute["category"], milestoneId?: string) => void;
    resolveDispute: (disputeId: string, resolution: Dispute["resolution"]) => void;
    escalateDispute: (disputeId: string) => void;
    // Milestone-level
    fundMilestone: (orderId: string, milestoneId: string) => void;
    startMilestone: (orderId: string, milestoneId: string) => void;
    submitMilestone: (orderId: string, milestoneId: string) => void;
    approveMilestone: (orderId: string, milestoneId: string) => void;
    disputeMilestone: (orderId: string, milestoneId: string, reason: string, description: string) => void;
    // Change orders
    proposeChange: (orderId: string, change: ChangeOrder["changes"], proposedBy: "customer" | "specialist") => void;
    approveChange: (orderId: string, changeOrderId: string) => void;
    rejectChange: (orderId: string, changeOrderId: string) => void;
    // Photos & checklist
    uploadPhoto: (orderId: string, milestoneId: string, photo: Omit<MilestonePhoto, "id" | "milestoneId" | "uploadedAt">) => void;
    toggleChecklist: (orderId: string, milestoneId: string, checklistItemId: string, checkedBy: "customer" | "specialist") => void;
    // Catalog
    upsertCategory: (category: ServiceCategory) => void;
    deleteCategory: (categoryId: string) => void;
    upsertService: (service: Service) => void;
    publishService: (serviceId: string) => void;
    archiveService: (serviceId: string) => void;
    // Payouts
    requestPayout: (providerId: string, amount: number) => void;
    updatePayoutStatus: (payoutId: string, status: PayoutRequest["status"], failureReason?: string) => void;
    // Providers
    upsertProvider: (provider: Provider) => void;
    toggleProviderVerified: (providerId: string) => void;
    // Anti-bypass
    reviewBypassFlag: (pairKey: string, flagId: string, action: "WARNING" | "PENALTY" | "DISMISSED" | "BAN") => void;
    // System
    resetDemo: () => void;
  };
};

const AppStoreContext = createContext<Ctx | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as any, loadInitial);

  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: "TICK" }), 3000);
    return () => window.clearInterval(id);
  }, []);

  const actions = useMemo(() => ({
    createOrder: (payload: CreateOrderPayload) => dispatch({ type: "CREATE_ORDER", payload }),
    fundOrder: (orderId: string) => dispatch({ type: "FUND_ORDER", orderId }),
    cancelOrder: (orderId: string, reason?: string) => dispatch({ type: "CANCEL_ORDER", orderId, reason }),
    acceptOrder: (orderId: string, providerId: string) => dispatch({ type: "ACCEPT_ORDER", orderId, providerId }),
    startOrder: (orderId: string) => dispatch({ type: "START_ORDER", orderId }),
    submitOrder: (orderId: string) => dispatch({ type: "SUBMIT_ORDER", orderId }),
    confirmOrder: (orderId: string) => dispatch({ type: "CONFIRM_ORDER", orderId, source: "customer" }),
    openDispute: (orderId: string, reason: string, description: string, category?: Dispute["category"], milestoneId?: string) => dispatch({ type: "OPEN_DISPUTE", orderId, reason, description, category, milestoneId }),
    resolveDispute: (disputeId: string, resolution: Dispute["resolution"]) => dispatch({ type: "RESOLVE_DISPUTE", disputeId, resolution }),
    escalateDispute: (disputeId: string) => dispatch({ type: "ESCALATE_DISPUTE", disputeId }),
    fundMilestone: (orderId: string, milestoneId: string) => dispatch({ type: "FUND_MILESTONE", orderId, milestoneId }),
    startMilestone: (orderId: string, milestoneId: string) => dispatch({ type: "START_MILESTONE", orderId, milestoneId }),
    submitMilestone: (orderId: string, milestoneId: string) => dispatch({ type: "SUBMIT_MILESTONE", orderId, milestoneId }),
    approveMilestone: (orderId: string, milestoneId: string) => dispatch({ type: "APPROVE_MILESTONE", orderId, milestoneId }),
    disputeMilestone: (orderId: string, milestoneId: string, reason: string, description: string) => dispatch({ type: "DISPUTE_MILESTONE", orderId, milestoneId, reason, description }),
    proposeChange: (orderId: string, change: ChangeOrder["changes"], proposedBy: "customer" | "specialist") => dispatch({ type: "PROPOSE_CHANGE", orderId, change, proposedBy }),
    approveChange: (orderId: string, changeOrderId: string) => dispatch({ type: "APPROVE_CHANGE", orderId, changeOrderId }),
    rejectChange: (orderId: string, changeOrderId: string) => dispatch({ type: "REJECT_CHANGE", orderId, changeOrderId }),
    uploadPhoto: (orderId: string, milestoneId: string, photo: Omit<MilestonePhoto, "id" | "milestoneId" | "uploadedAt">) => dispatch({ type: "UPLOAD_PHOTO", orderId, milestoneId, photo }),
    toggleChecklist: (orderId: string, milestoneId: string, checklistItemId: string, checkedBy: "customer" | "specialist") => dispatch({ type: "TOGGLE_CHECKLIST", orderId, milestoneId, checklistItemId, checkedBy }),
    upsertCategory: (category: ServiceCategory) => dispatch({ type: "CATALOG_UPSERT_CATEGORY", category }),
    deleteCategory: (categoryId: string) => dispatch({ type: "CATALOG_DELETE_CATEGORY", categoryId }),
    upsertService: (service: Service) => dispatch({ type: "CATALOG_UPSERT_SERVICE", service }),
    publishService: (serviceId: string) => dispatch({ type: "CATALOG_PUBLISH_SERVICE", serviceId }),
    archiveService: (serviceId: string) => dispatch({ type: "CATALOG_ARCHIVE_SERVICE", serviceId }),
    requestPayout: (providerId: string, amount: number) => dispatch({ type: "REQUEST_PAYOUT", providerId, amount }),
    updatePayoutStatus: (payoutId: string, status: PayoutRequest["status"], failureReason?: string) => dispatch({ type: "PAYOUT_UPDATE_STATUS", payoutId, status, failureReason }),
    upsertProvider: (provider: Provider) => dispatch({ type: "PROVIDER_UPSERT", provider }),
    toggleProviderVerified: (providerId: string) => dispatch({ type: "PROVIDER_TOGGLE_VERIFIED", providerId }),
    reviewBypassFlag: (pairKey: string, flagId: string, act: "WARNING" | "PENALTY" | "DISMISSED" | "BAN") => dispatch({ type: "REVIEW_BYPASS_FLAG", pairKey, flagId, action: act }),
    resetDemo: () => dispatch({ type: "RESET_DEMO" }),
  }), []);

  const value: Ctx = useMemo(() => ({ ...state, actions }), [state, actions]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
