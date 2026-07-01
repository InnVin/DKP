// ═══════════════════════════════════════════════════════════════════
// State Machine — v2 (Full Scope)
// ═══════════════════════════════════════════════════════════════════
//
// Two-level state machine:
// 1. Order-level: PLACED → FUNDED → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED
// 2. Milestone-level: NOT_FUNDED → FUNDED → IN_PROGRESS → SUBMITTED → APPROVED → RELEASED
//
// Order status is DERIVED from milestone statuses for turnkey orders.
// Simple orders have 1 milestone and behave like v1.
//
// Anti-bypass engine integrated into action guards.
// ═══════════════════════════════════════════════════════════════════

import type { Order, Milestone, MilestoneStatus, EscrowStatus, BypassFlag, ContactPair } from "./types";
import { ACTION_LABELS, formatDateTime } from "./copy";

export type Role = "customer" | "specialist" | "admin";

export type OrderActionKey =
  | "FUND"
  | "CANCEL"
  | "ACCEPT"
  | "START"
  | "SUBMIT"
  | "CONFIRM"
  | "OPEN_DISPUTE"
  | "CONTACT_SUPPORT"
  | "LEAVE_REVIEW"
  // Milestone-level actions
  | "FUND_MILESTONE"
  | "START_MILESTONE"
  | "SUBMIT_MILESTONE"
  | "APPROVE_MILESTONE"
  | "DISPUTE_MILESTONE"
  // Change order actions
  | "PROPOSE_CHANGE"
  | "APPROVE_CHANGE"
  | "REJECT_CHANGE"
  // Photo actions
  | "UPLOAD_PHOTO";

export interface AllowedAction {
  key: OrderActionKey;
  label: string;
  variant: "primary" | "secondary" | "danger";
  requiresConfirmation?: boolean;
  confirmation?: { title: string; body: string; confirmLabel: string };
  disabledReason?: string;
  /** For milestone-specific actions. */
  milestoneId?: string;
}

// ─── Milestone State Machine ────────────────────────────────────

const MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  NOT_FUNDED: ["FUNDED", "CANCELLED"],
  FUNDED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["SUBMITTED", "DISPUTED"],
  SUBMITTED: ["APPROVED", "DISPUTED"],
  APPROVED: ["RELEASED"],
  RELEASED: [],
  DISPUTED: ["RELEASED", "REFUNDED"], // resolved by admin
  REFUNDED: [],
  CANCELLED: [],
};

export function canTransitionMilestone(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return MILESTONE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isMilestoneTerminal(status: MilestoneStatus): boolean {
  return ["RELEASED", "REFUNDED", "CANCELLED"].includes(status);
}

export function isMilestoneActive(status: MilestoneStatus): boolean {
  return ["FUNDED", "IN_PROGRESS", "SUBMITTED", "APPROVED"].includes(status);
}

/**
 * Check if a milestone can start (dependency check).
 * A milestone can start if:
 * - It doesn't depend on previous, OR
 * - The previous milestone is RELEASED.
 */
export function canMilestoneStart(milestone: Milestone, allMilestones: Milestone[]): boolean {
  if (!milestone.dependsOnPrevious) return true;
  if (milestone.seq <= 1) return true;
  const prev = allMilestones.find((m) => m.seq === milestone.seq - 1);
  if (!prev) return true;
  return prev.status === "RELEASED";
}

// ─── Derive Order Status from Milestones ────────────────────────

/**
 * For turnkey orders with multiple milestones, derive order-level
 * status and escrow status from the aggregate milestone state.
 */
export function deriveOrderEscrowStatus(milestones: Milestone[]): EscrowStatus {
  if (milestones.length === 0) return "NOT_FUNDED";

  const statuses = milestones.map((m) => m.status);

  if (statuses.every((s) => s === "NOT_FUNDED")) return "NOT_FUNDED";
  if (statuses.every((s) => s === "RELEASED")) return "RELEASED";
  if (statuses.every((s) => s === "REFUNDED" || s === "CANCELLED")) return "REFUNDED";
  if (statuses.some((s) => s === "DISPUTED")) return "FROZEN";
  if (statuses.some((s) => s === "RELEASED") && statuses.some((s) => s !== "RELEASED")) return "PARTIALLY_RELEASED";
  if (statuses.some((s) => s === "FUNDED" || s === "IN_PROGRESS" || s === "SUBMITTED" || s === "APPROVED")) return "HELD";
  if (statuses.some((s) => s === "FUNDED") && statuses.some((s) => s === "NOT_FUNDED")) return "PARTIALLY_HELD";

  return "HELD";
}

/**
 * Derive high-level order status from milestones.
 */
export function deriveOrderStatus(milestones: Milestone[], currentOrderStatus: Order["status"]): Order["status"] {
  if (milestones.length === 0) return currentOrderStatus;
  if (currentOrderStatus === "CANCELLED") return "CANCELLED";

  const statuses = milestones.map((m) => m.status);

  if (statuses.every((s) => s === "RELEASED")) return "COMPLETED";
  if (statuses.every((s) => s === "NOT_FUNDED")) return currentOrderStatus === "ASSIGNED" ? "ASSIGNED" : "PLACED";
  if (statuses.every((s) => s === "REFUNDED" || s === "CANCELLED")) return "CANCELLED";
  if (statuses.some((s) => s === "DISPUTED")) return "DISPUTED";
  if (statuses.some((s) => s === "SUBMITTED") && !statuses.some((s) => s === "IN_PROGRESS")) return "SUBMITTED";
  if (statuses.some((s) => s === "IN_PROGRESS" || s === "SUBMITTED" || s === "APPROVED" || s === "RELEASED")) return "IN_PROGRESS";
  if (statuses.some((s) => s === "FUNDED")) return "FUNDED";

  return currentOrderStatus;
}

// ─── Order-Level Allowed Actions ────────────────────────────────

export function getAllowedActions(order: Order, role: Role): AllowedAction[] {
  const s = order.status;
  const isTurnkey = order.isTurnkey && order.milestones.length > 1;

  if (role === "customer") {
    if (s === "PLACED") {
      return [
        {
          key: "CANCEL",
          label: ACTION_LABELS.CANCEL,
          variant: "secondary",
          requiresConfirmation: true,
          confirmation: {
            title: "Отменить заказ?",
            body: "Заказ будет отменён. Если оплаты не было — списаний не будет.",
            confirmLabel: "Отменить",
          },
        },
        { key: "FUND", label: ACTION_LABELS.FUND, variant: "primary" },
      ];
    }

    if (s === "FUNDED") {
      const canCancel = isWithinCancelWindow(order);
      const actions: AllowedAction[] = [];

      if (canCancel) {
        actions.push({
          key: "CANCEL",
          label: ACTION_LABELS.CANCEL,
          variant: "secondary",
          requiresConfirmation: true,
          confirmation: {
            title: "Отменить заказ?",
            body: "Средства будут возвращены по правилам услуги.",
            confirmLabel: "Отменить",
          },
        });
      }
      actions.push({ key: "CONTACT_SUPPORT", label: ACTION_LABELS.CONTACT_SUPPORT, variant: "secondary" });
      return actions;
    }

    if (s === "ASSIGNED" || s === "IN_PROGRESS") {
      const actions: AllowedAction[] = [
        { key: "CONTACT_SUPPORT", label: ACTION_LABELS.CONTACT_SUPPORT, variant: "secondary" },
      ];

      // For turnkey orders, show milestone-level actions
      if (isTurnkey) {
        actions.push(...getMilestoneActionsForCustomer(order));
      }

      // Allow proposing changes during active work
      if (s === "IN_PROGRESS") {
        actions.push({ key: "PROPOSE_CHANGE", label: "Изменить объём работ", variant: "secondary" });
      }

      return actions;
    }

    if (s === "SUBMITTED") {
      const canDispute = isWithinDisputeWindow(order);
      const actions: AllowedAction[] = [];

      if (isTurnkey) {
        actions.push(...getMilestoneActionsForCustomer(order));
      } else {
        if (canDispute) {
          actions.push({ key: "OPEN_DISPUTE", label: ACTION_LABELS.OPEN_DISPUTE, variant: "danger" });
        }
        actions.push({
          key: "CONFIRM",
          label: ACTION_LABELS.CONFIRM,
          variant: "primary",
          requiresConfirmation: true,
          confirmation: {
            title: "Подтвердить выполнение?",
            body: "Средства будут переведены специалисту.",
            confirmLabel: "Подтвердить",
          },
        });
      }

      return actions;
    }

    if (s === "DISPUTED") {
      return [{ key: "CONTACT_SUPPORT", label: ACTION_LABELS.CONTACT_SUPPORT, variant: "secondary" }];
    }

    if (s === "COMPLETED") {
      return [{ key: "LEAVE_REVIEW", label: ACTION_LABELS.LEAVE_REVIEW, variant: "primary" }];
    }

    return [];
  }

  if (role === "specialist") {
    if (s === "FUNDED") return [{ key: "ACCEPT", label: ACTION_LABELS.ACCEPT, variant: "primary" }];

    if (s === "ASSIGNED") {
      if (isTurnkey) {
        // Specialist starts first milestone
        return getMilestoneActionsForSpecialist(order);
      }
      return [{ key: "START", label: ACTION_LABELS.START, variant: "primary" }];
    }

    if (s === "IN_PROGRESS") {
      if (isTurnkey) {
        const actions = getMilestoneActionsForSpecialist(order);
        actions.push({ key: "PROPOSE_CHANGE", label: "Предложить доп. работы", variant: "secondary" });
        return actions;
      }
      return [
        { key: "SUBMIT", label: ACTION_LABELS.SUBMIT, variant: "primary" },
        { key: "UPLOAD_PHOTO", label: "Добавить фото", variant: "secondary" },
      ];
    }

    if (s === "DISPUTED") {
      return [{ key: "CONTACT_SUPPORT", label: ACTION_LABELS.CONTACT_SUPPORT, variant: "secondary" }];
    }

    return [];
  }

  return [];
}

// ─── Milestone-Level Actions ────────────────────────────────────

function getMilestoneActionsForCustomer(order: Order): AllowedAction[] {
  const actions: AllowedAction[] = [];

  for (const ms of order.milestones) {
    if (ms.status === "NOT_FUNDED") {
      const canFund = canMilestoneStart(ms, order.milestones) ||
        // First milestone can always be funded
        ms.seq === 1 ||
        // Or if previous doesn't block
        !ms.dependsOnPrevious;

      if (canFund) {
        actions.push({
          key: "FUND_MILESTONE",
          label: `Оплатить: ${ms.name}`,
          variant: "primary",
          milestoneId: ms.id,
        });
      }
    }

    if (ms.status === "SUBMITTED") {
      actions.push({
        key: "APPROVE_MILESTONE",
        label: `Принять: ${ms.name}`,
        variant: "primary",
        milestoneId: ms.id,
        requiresConfirmation: true,
        confirmation: {
          title: `Принять этап «${ms.name}»?`,
          body: `Средства ${ms.amount.toLocaleString("ru-RU")} ₽ будут переведены специалисту.`,
          confirmLabel: "Подтвердить",
        },
      });

      actions.push({
        key: "DISPUTE_MILESTONE",
        label: `Спор: ${ms.name}`,
        variant: "danger",
        milestoneId: ms.id,
      });
    }
  }

  return actions;
}

function getMilestoneActionsForSpecialist(order: Order): AllowedAction[] {
  const actions: AllowedAction[] = [];

  for (const ms of order.milestones) {
    if (ms.status === "FUNDED" && canMilestoneStart(ms, order.milestones)) {
      actions.push({
        key: "START_MILESTONE",
        label: `Начать: ${ms.name}`,
        variant: "primary",
        milestoneId: ms.id,
      });
    }

    if (ms.status === "IN_PROGRESS") {
      actions.push({
        key: "SUBMIT_MILESTONE",
        label: `Сдать: ${ms.name}`,
        variant: "primary",
        milestoneId: ms.id,
      });

      actions.push({
        key: "UPLOAD_PHOTO",
        label: `Фото: ${ms.name}`,
        variant: "secondary",
        milestoneId: ms.id,
      });
    }
  }

  return actions;
}

// ─── Timeline ───────────────────────────────────────────────────

export function orderTimeline(
  order: Order
): Array<{ label: string; date?: string; state: "completed" | "active" | "pending" | "disputed"; milestoneId?: string }> {
  const steps: Array<{ label: string; date?: string; state: "completed" | "active" | "pending" | "disputed"; milestoneId?: string }> = [];

  steps.push({ label: "Заказ создан", date: formatDateTime(order.createdAt) || undefined, state: "completed" });

  if (order.status === "PLACED") {
    steps.push({ label: "Ожидание оплаты", state: "active" });
    if (order.isTurnkey) {
      for (const ms of order.milestones) {
        steps.push({ label: ms.name, state: "pending", milestoneId: ms.id });
      }
    } else {
      steps.push({ label: "Выполнение", state: "pending" });
      steps.push({ label: "Приёмка", state: "pending" });
    }
    return steps;
  }

  steps.push({ label: "Оплата удержана", date: formatDateTime(order.fundedAt ?? order.createdAt) || undefined, state: "completed" });

  if (order.status === "CANCELLED") {
    steps.push({ label: "Заказ отменён", date: order.cancelledAt ? (formatDateTime(order.cancelledAt) || undefined) : undefined, state: "completed" });
    return steps;
  }

  // For turnkey orders, show milestone-level timeline
  if (order.isTurnkey && order.milestones.length > 1) {
    if (order.assignedAt) {
      steps.push({
        label: "Специалист назначен",
        date: formatDateTime(order.assignedAt) || undefined,
        state: "completed",
      });
    }

    for (const ms of order.milestones) {
      const msState = milestoneToTimelineState(ms.status);
      const msDate =
        ms.releasedAt ?? ms.approvedAt ?? ms.submittedAt ?? ms.startedAt ?? ms.fundedAt;
      steps.push({
        label: `${ms.name} — ${milestoneStatusLabel(ms.status)}`,
        date: msDate ? (formatDateTime(msDate) || undefined) : undefined,
        state: msState,
        milestoneId: ms.id,
      });
    }

    if (order.status === "COMPLETED") {
      steps.push({
        label: "Заказ завершён",
        date: order.completedAt ? (formatDateTime(order.completedAt) || undefined) : undefined,
        state: "completed",
      });
    }

    return steps;
  }

  // Simple order timeline (same as v1)
  if (order.status === "FUNDED") {
    steps.push({ label: "Ожидание специалиста", state: "active" });
    steps.push({ label: "Выполнение", state: "pending" });
    steps.push({ label: "Приёмка", state: "pending" });
    return steps;
  }

  steps.push({
    label: "Специалист назначен",
    date: order.assignedAt ? (formatDateTime(order.assignedAt) || undefined) : undefined,
    state: order.status === "ASSIGNED" ? "active" : "completed",
  });

  if (order.status === "ASSIGNED") {
    steps.push({ label: "Выполнение", state: "pending" });
    steps.push({ label: "Приёмка", state: "pending" });
    return steps;
  }

  if (order.status === "IN_PROGRESS") {
    steps.push({ label: "Работа в процессе", date: order.startedAt ? (formatDateTime(order.startedAt) || undefined) : undefined, state: "active" });
    steps.push({ label: "Приёмка", state: "pending" });
    return steps;
  }

  if (order.status === "SUBMITTED") {
    steps.push({ label: "Работа выполнена", date: order.submittedAt ? (formatDateTime(order.submittedAt) || undefined) : undefined, state: "completed" });
    steps.push({ label: "Ожидание приёмки", state: "active" });
    return steps;
  }

  if (order.status === "DISPUTED") {
    steps.push({ label: "Открыт спор", state: "disputed" });
    return steps;
  }

  if (order.status === "COMPLETED") {
    steps.push({ label: "Работа выполнена", date: order.submittedAt ? (formatDateTime(order.submittedAt) || undefined) : undefined, state: "completed" });
    steps.push({ label: "Заказ завершён", date: order.completedAt ? (formatDateTime(order.completedAt) || undefined) : undefined, state: "completed" });
    return steps;
  }

  return steps;
}

function milestoneToTimelineState(status: MilestoneStatus): "completed" | "active" | "pending" | "disputed" {
  switch (status) {
    case "RELEASED":
    case "APPROVED":
      return "completed";
    case "IN_PROGRESS":
    case "SUBMITTED":
    case "FUNDED":
      return "active";
    case "DISPUTED":
      return "disputed";
    default:
      return "pending";
  }
}

function milestoneStatusLabel(status: MilestoneStatus): string {
  const map: Record<MilestoneStatus, string> = {
    NOT_FUNDED: "Ожидает оплаты",
    FUNDED: "Оплачен",
    IN_PROGRESS: "В работе",
    SUBMITTED: "На приёмке",
    APPROVED: "Принят",
    RELEASED: "Выплачено",
    DISPUTED: "Спор",
    REFUNDED: "Возврат",
    CANCELLED: "Отменён",
  };
  return map[status] ?? status;
}

// ─── Escrow Banner ──────────────────────────────────────────────

export function escrowBannerText(status: EscrowStatus): { title: string; body: string; tone: "teal" | "red" | "gray" | "yellow" } {
  switch (status) {
    case "HELD":
      return { title: "Средства защищены", body: "Оплата удержана до подтверждения выполнения.", tone: "teal" };
    case "PARTIALLY_HELD":
      return { title: "Частичная оплата", body: "Часть этапов оплачена. Остальные ожидают оплаты.", tone: "yellow" };
    case "FROZEN":
      return { title: "Средства заморожены", body: "Открыт спор. Средства удержаны до решения.", tone: "red" };
    case "PARTIALLY_RELEASED":
      return { title: "Частичная выплата", body: "Часть этапов завершена и оплачена.", tone: "teal" };
    case "RELEASED":
      return { title: "Средства перечислены", body: "Выплата отправлена специалисту.", tone: "gray" };
    case "REFUNDED":
      return { title: "Средства возвращены", body: "Возврат выполнен.", tone: "gray" };
    default:
      return { title: "Ожидание оплаты", body: "Оплатите заказ, чтобы удержать средства в Escrow.", tone: "gray" };
  }
}

// ─── Window Checks ──────────────────────────────────────────────

export function isWithinCancelWindow(order: Order): boolean {
  const mins = order.policy?.cancelWindowMinutes ?? 0;
  if (mins <= 0) return false;
  const base = order.fundedAt ?? order.createdAt;
  const t0 = Date.parse(base);
  if (!Number.isFinite(t0)) return false;
  return Date.now() - t0 <= mins * 60 * 1000;
}

export function isWithinDisputeWindow(order: Order): boolean {
  const hours = order.policy?.disputeWindowHours ?? 0;
  if (hours <= 0) return false;
  if (!order.submittedAt) return false;
  const t0 = Date.parse(order.submittedAt);
  if (!Number.isFinite(t0)) return false;
  const disputeDeadline = t0 + hours * 3600 * 1000;
  const autoDeadline = order.autoReleaseDate ? Date.parse(order.autoReleaseDate) : Number.POSITIVE_INFINITY;
  const deadline = Math.min(disputeDeadline, autoDeadline);
  return Date.now() <= deadline;
}

export function isMilestoneWithinDisputeWindow(milestone: Milestone, policy: OrderPolicy): boolean {
  const hours = policy.milestoneAutoReleaseHours ?? policy.disputeWindowHours ?? 24;
  if (!milestone.submittedAt) return false;
  const t0 = Date.parse(milestone.submittedAt);
  if (!Number.isFinite(t0)) return false;
  return Date.now() <= t0 + hours * 3600 * 1000;
}

// ─── Anti-Bypass Engine ─────────────────────────────────────────

/**
 * Detect bypass risk for a customer-provider pair.
 * Called after order completion to update ContactPair records.
 */
export function assessBypassRisk(pair: ContactPair): BypassRiskLevel {
  // High risk: many orders, then sudden stop
  if (pair.platformOrders >= 3) {
    const lastOrderDate = Date.parse(pair.lastOrderAt);
    const daysSinceLastOrder = (Date.now() - lastOrderDate) / (86400 * 1000);
    if (daysSinceLastOrder > 90) return "HIGH";
  }

  // Medium risk: customer cancelled after matching (possible off-platform deal)
  if (pair.flags.some((f) => f.type === "CANCELLED_AFTER_MATCH" && !f.reviewed)) {
    return "MEDIUM";
  }

  // Medium risk: contact sharing detected
  if (pair.flags.some((f) => f.type === "CONTACT_SHARED_IN_CHAT" && !f.reviewed)) {
    return "HIGH";
  }

  if (pair.platformOrders >= 2) return "LOW";
  return "LOW";
}

/**
 * Check if a message contains phone numbers or email addresses.
 * Used to flag potential contact sharing in chat.
 */
export function detectContactInMessage(text: string): boolean {
  // Russian phone patterns: +7, 8-, various formats
  const phonePattern = /(\+?7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/;
  // Email pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  // Telegram/WhatsApp handles
  const messengerPattern = /@[a-zA-Z0-9_]{3,}/;

  return phonePattern.test(text) || emailPattern.test(text) || messengerPattern.test(text);
}

/**
 * Generate a masked phone number for order communication.
 * In production this would route through a telephony provider (Twilio-like).
 */
export function generateMaskedPhone(): string {
  const prefix = "+7-800-";
  const suffix = Math.floor(1000000 + Math.random() * 9000000).toString().slice(0, 7);
  return `${prefix}${suffix.slice(0, 3)}-${suffix.slice(3, 5)}-${suffix.slice(5)}`;
}

// ─── Milestone Helpers ──────────────────────────────────────────

/**
 * Create milestones from a template for turnkey orders.
 */
export function buildMilestonesFromTemplate(
  orderId: string,
  providerPayoutAmount: number,
  templates: { name: string; description?: string; percent: number; checklistItems?: string[] }[],
  nowIso: string,
  sequential: boolean = true
): Milestone[] {
  return templates.map((t, i) => ({
    id: `MS-${orderId}-${i + 1}`,
    orderId,
    seq: i + 1,
    name: t.name,
    description: t.description,
    percent: t.percent,
    amount: Math.round(providerPayoutAmount * t.percent),
    status: "NOT_FUNDED" as MilestoneStatus,
    dependsOnPrevious: sequential && i > 0,
    createdAt: nowIso,
    photos: [],
    checklist: (t.checklistItems ?? []).map((label, ci) => ({
      id: `CL-${orderId}-${i + 1}-${ci + 1}`,
      label,
      checked: false,
    })),
  }));
}

/**
 * Create a single milestone for simple (non-turnkey) orders.
 */
export function buildSingleMilestone(orderId: string, providerPayoutAmount: number, nowIso: string): Milestone[] {
  return [
    {
      id: `MS-${orderId}-1`,
      orderId,
      seq: 1,
      name: "Основная работа",
      percent: 1,
      amount: providerPayoutAmount,
      status: "NOT_FUNDED" as MilestoneStatus,
      dependsOnPrevious: false,
      createdAt: nowIso,
      photos: [],
      checklist: [],
    },
  ];
}

/**
 * Validate that milestones sum to 100%.
 */
export function validateMilestonePercents(milestones: Pick<Milestone, "percent">[]): boolean {
  const sum = milestones.reduce((acc, m) => acc + m.percent, 0);
  return Math.abs(sum - 1) < 0.001;
}
