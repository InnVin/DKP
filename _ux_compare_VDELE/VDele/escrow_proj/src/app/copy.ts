// ============================================================
// Copywriting & Labels v2 — «В ДЕЛЕ»
// ============================================================

import type { OrderStatus, EscrowStatus, DisputeStatus, MilestoneStatus, ChangeOrderStatus, DisputeCategory } from "./types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Создан",
  FUNDED: "Оплачен",
  ASSIGNED: "Назначен",
  IN_PROGRESS: "В работе",
  SUBMITTED: "На проверке",
  COMPLETED: "Завершён",
  DISPUTED: "Спор",
  CANCELLED: "Отменён",
};

export const ESCROW_STATUS_LABEL: Record<EscrowStatus, string> = {
  NOT_FUNDED: "Не оплачено",
  HELD: "Удержано",
  PARTIALLY_HELD: "Частично удержано",
  FROZEN: "Заморожено",
  PARTIALLY_RELEASED: "Частично выплачено",
  RELEASED: "Перечислено",
  REFUNDED: "Возврат",
};

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: "Открыт",
  UNDER_REVIEW: "На рассмотрении",
  ESCALATED: "Эскалирован",
  RESOLVED_PROVIDER: "Решено: выплата",
  RESOLVED_CUSTOMER: "Решено: возврат",
  SPLIT: "Решено: split",
  CLOSED: "Закрыт",
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  NOT_FUNDED: "Ожидает оплаты",
  FUNDED: "Оплачен",
  IN_PROGRESS: "В работе",
  SUBMITTED: "На приёмке",
  APPROVED: "Принят",
  RELEASED: "Выплачен",
  DISPUTED: "Спор",
  REFUNDED: "Возврат",
  CANCELLED: "Отменён",
};

export const CHANGE_ORDER_STATUS_LABEL: Record<ChangeOrderStatus, string> = {
  PROPOSED: "Предложено",
  APPROVED: "Согласовано",
  REJECTED: "Отклонено",
  CANCELLED: "Отменено",
};

export const DISPUTE_CATEGORY_LABEL: Record<DisputeCategory, string> = {
  QUALITY: "Качество работы",
  NO_SHOW: "Специалист не пришёл",
  INCOMPLETE: "Работа не завершена",
  DAMAGE: "Повреждение имущества",
  PRICE_DISPUTE: "Спор по цене",
  TIMELINE: "Нарушение сроков",
  OTHER: "Другое",
};

export const ACTION_LABELS = {
  FUND: "Оплатить",
  CANCEL: "Отменить",
  ACCEPT: "Принять заказ",
  START: "Начать работу",
  SUBMIT: "Отметить выполнено",
  CONFIRM: "Подтвердить выполнение",
  OPEN_DISPUTE: "Открыть спор",
  CONTACT_SUPPORT: "Поддержка",
  LEAVE_REVIEW: "Оставить отзыв",
} as const;

export function formatCurrencyRub(amount: number): string {
  return amount.toLocaleString("ru-RU") + " ₽";
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ru-RU"); } catch { return iso; }
}

export function formatDateShort(iso?: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); } catch { return iso; }
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
