import React from 'react';

type BadgeType =
  | 'order-placed' | 'order-funded' | 'order-assigned' | 'order-in_progress'
  | 'order-submitted' | 'order-completed' | 'order-disputed' | 'order-cancelled'
  | 'escrow-not_funded' | 'escrow-held' | 'escrow-partially_held' | 'escrow-frozen'
  | 'escrow-partially_released' | 'escrow-released' | 'escrow-refunded';

interface BadgeProps { type: BadgeType; className?: string }

const badgeConfig: Record<string, { label: string; color: string; bg: string }> = {
  'order-placed':     { label: 'Создан',    color: '#946800', bg: '#FFF8E1' },
  'order-funded':     { label: 'Оплачен',   color: '#0F766E', bg: '#E6FAF5' },
  'order-assigned':   { label: 'Назначен',  color: '#0F766E', bg: '#E6FAF5' },
  'order-in_progress':{ label: 'В работе',  color: '#1D4ED8', bg: '#EFF6FF' },
  'order-submitted':  { label: 'Проверка',  color: '#946800', bg: '#FFF8E1' },
  'order-completed':  { label: 'Готово',    color: '#15803D', bg: '#F0FDF4' },
  'order-disputed':   { label: 'Спор',      color: '#DC2626', bg: '#FEF2F2' },
  'order-cancelled':  { label: 'Отмена',    color: '#6B7280', bg: '#F3F4F6' },
  'escrow-not_funded':{ label: 'Ожидает',   color: '#6B7280', bg: '#F3F4F6' },
  'escrow-held':      { label: 'Удержано',  color: '#0F766E', bg: '#E6FAF5' },
  'escrow-partially_held': { label: 'Частично', color: '#946800', bg: '#FFF8E1' },
  'escrow-frozen':    { label: 'Заморож.',  color: '#DC2626', bg: '#FEF2F2' },
  'escrow-partially_released': { label: 'Выплата', color: '#0F766E', bg: '#E6FAF5' },
  'escrow-released':  { label: 'Выплачено', color: '#15803D', bg: '#F0FDF4' },
  'escrow-refunded':  { label: 'Возврат',   color: '#6B7280', bg: '#F3F4F6' },
};

export function Badge({ type, className = '' }: BadgeProps) {
  const cfg = badgeConfig[type] ?? { label: type, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold whitespace-nowrap flex-shrink-0 ${className}`}
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}
