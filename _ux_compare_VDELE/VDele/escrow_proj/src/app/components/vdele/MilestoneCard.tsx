import React, { useState } from "react";
import type { Milestone, OrderPolicy } from "../../types";
import { MILESTONE_STATUS_LABEL, formatCurrencyRub, formatDateShort } from "../../copy";
import { Camera, CheckSquare, ChevronDown, ChevronUp, Clock, CalendarDays, Eye, Check, Circle } from "lucide-react";

interface Props {
  milestone: Milestone;
  policy?: OrderPolicy;
  onApprove?: () => void;
  onDispute?: () => void;
  onFund?: () => void;
  onStart?: () => void;
  onSubmit?: () => void;
  onToggleCheck?: (checkId: string) => void;
  role: "customer" | "specialist";
}

const statusColors: Record<string, { border: string; badge: string; badgeText: string; dot: string }> = {
  RELEASED:    { border: "border-l-emerald-400", badge: "#F0FDF4", badgeText: "#15803D", dot: "bg-emerald-400" },
  APPROVED:    { border: "border-l-emerald-400", badge: "#F0FDF4", badgeText: "#15803D", dot: "bg-emerald-400" },
  IN_PROGRESS: { border: "border-l-[#14B8A6]",  badge: "#E6FAF5", badgeText: "#0F766E", dot: "bg-[#14B8A6]" },
  SUBMITTED:   { border: "border-l-amber-400",   badge: "#FFF8E1", badgeText: "#946800", dot: "bg-amber-400" },
  FUNDED:      { border: "border-l-[#14B8A6]/50",badge: "#E6FAF5", badgeText: "#0F766E", dot: "bg-teal-300" },
  DISPUTED:    { border: "border-l-red-400",      badge: "#FEF2F2", badgeText: "#DC2626", dot: "bg-red-400" },
  REFUNDED:    { border: "border-l-gray-300",     badge: "#F3F4F6", badgeText: "#6B7280", dot: "bg-gray-300" },
  NOT_FUNDED:  { border: "border-l-gray-200",     badge: "#F3F4F6", badgeText: "#9CA3AF", dot: "bg-gray-200" },
  CANCELLED:   { border: "border-l-gray-200",     badge: "#F3F4F6", badgeText: "#9CA3AF", dot: "bg-gray-200" },
};

export function MilestoneCard({ milestone: ms, policy, onApprove, onDispute, onFund, onStart, onSubmit, onToggleCheck, role }: Props) {
  const [open, setOpen] = useState(["IN_PROGRESS", "SUBMITTED"].includes(ms.status));
  const [viewPhoto, setViewPhoto] = useState<number | null>(null);
  const checkedCount = ms.checklist.filter((c) => c.checked).length;
  const sc = statusColors[ms.status] ?? statusColors.NOT_FUNDED;

  return (
    <div className={`bg-white rounded-2xl overflow-hidden border-l-[3px] ${sc.border} shadow-sm shadow-black/[0.04]`}>
      {/* ── Header ── */}
      <button className="w-full text-left px-4 py-3.5 flex items-center gap-3" onClick={() => setOpen(!open)}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-gray-900">{ms.seq}. {ms.name}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[13px] font-semibold text-gray-800">{formatCurrencyRub(ms.amount)}</span>
            <span className="text-[11px] px-2 py-[2px] rounded-full font-medium" style={{ backgroundColor: sc.badge, color: sc.badgeText }}>
              {MILESTONE_STATUS_LABEL[ms.status]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ms.photos.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Camera className="w-3.5 h-3.5" />{ms.photos.length}
            </span>
          )}
          {ms.checklist.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <CheckSquare className="w-3.5 h-3.5" />{checkedCount}/{ms.checklist.length}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
        </div>
      </button>

      {/* ── Expanded Detail ── */}
      {open && (
        <div className="border-t border-gray-100">
          {/* Description */}
          {ms.description && (
            <div className="px-4 pt-3">
              <p className="text-[13px] text-gray-500 leading-relaxed">{ms.description}</p>
            </div>
          )}

          {/* Timeline dates */}
          <div className="px-4 pt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
              {ms.fundedAt && <span>Оплачен: {formatDateShort(ms.fundedAt)}</span>}
              {ms.startedAt && <span>Начат: {formatDateShort(ms.startedAt)}</span>}
              {ms.submittedAt && <span>Сдан: {formatDateShort(ms.submittedAt)}</span>}
              {ms.approvedAt && <span>Принят: {formatDateShort(ms.approvedAt)}</span>}
              {ms.releasedAt && <span>Выплата: {formatDateShort(ms.releasedAt)}</span>}
            </div>
          </div>

          {/* ── Photo Report ── */}
          {ms.photos.length > 0 && (
            <div className="px-4 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-gray-400" />
                <span className="text-[13px] font-semibold text-gray-700">Фото-отчёт</span>
                <span className="text-[11px] text-gray-400">{ms.photos.length} фото</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' } as any}>
                {ms.photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    onClick={() => setViewPhoto(i)}
                    className="flex-shrink-0 rounded-xl overflow-hidden active:scale-95 transition-transform"
                  >
                    <div
                      className="w-[88px] h-[88px] flex items-center justify-center"
                      style={{ backgroundColor: (photo as any).placeholderColor || '#E5E7EB' }}
                    >
                      <Camera className="w-5 h-5 text-white/60" />
                    </div>
                    <div className="w-[88px] bg-gray-50 px-1.5 py-1">
                      <div className="text-[10px] text-gray-500 truncate">{photo.caption || `Фото ${i + 1}`}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Checklist ── */}
          {ms.checklist.length > 0 && (
            <div className="px-4 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-gray-400" />
                  <span className="text-[13px] font-semibold text-gray-700">Чек-лист приёмки</span>
                </div>
                <span className="text-[11px] font-medium" style={{ color: checkedCount === ms.checklist.length ? '#15803D' : '#9CA3AF' }}>
                  {checkedCount}/{ms.checklist.length}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1 rounded-full bg-gray-100 mb-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#14B8A6] transition-all"
                  style={{ width: `${ms.checklist.length > 0 ? (checkedCount / ms.checklist.length) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-0.5">
                {ms.checklist.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onToggleCheck?.(item.id)}
                    className="w-full flex items-center gap-2.5 py-2 px-1 rounded-lg active:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      item.checked
                        ? 'bg-[#14B8A6]'
                        : 'border-2 border-gray-200'
                    }`}>
                      {item.checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-[14px] leading-tight ${
                      item.checked ? 'text-gray-400 line-through' : 'text-gray-800'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="px-4 py-3 flex gap-2">
            {role === "customer" && ms.status === "NOT_FUNDED" && onFund && (
              <button onClick={onFund} className="flex-1 py-2.5 rounded-xl bg-[#14B8A6] text-white text-[14px] font-semibold active:scale-[0.97] transition-transform">
                Оплатить этап
              </button>
            )}
            {role === "customer" && ms.status === "SUBMITTED" && onApprove && (
              <button onClick={onApprove} className="flex-1 py-2.5 rounded-xl bg-[#14B8A6] text-white text-[14px] font-semibold active:scale-[0.97] transition-transform">
                ✓ Принять работу
              </button>
            )}
            {role === "customer" && ms.status === "SUBMITTED" && onDispute && (
              <button onClick={onDispute} className="py-2.5 px-4 rounded-xl bg-red-50 text-red-600 text-[13px] font-medium active:scale-[0.97] transition-transform">
                Спор
              </button>
            )}
            {role === "specialist" && ms.status === "FUNDED" && onStart && (
              <button onClick={onStart} className="flex-1 py-2.5 rounded-xl bg-[#14B8A6] text-white text-[14px] font-semibold active:scale-[0.97] transition-transform">
                Начать этап
              </button>
            )}
            {role === "specialist" && ms.status === "IN_PROGRESS" && onSubmit && (
              <button onClick={onSubmit} className="flex-1 py-2.5 rounded-xl bg-[#14B8A6] text-white text-[14px] font-semibold active:scale-[0.97] transition-transform">
                Сдать на приёмку
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Photo Viewer Modal ── */}
      {viewPhoto !== null && ms.photos[viewPhoto] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setViewPhoto(null)}>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-white/70 text-[13px]">{viewPhoto + 1} / {ms.photos.length}</span>
            <button className="text-white/70 text-[13px] font-medium" onClick={() => setViewPhoto(null)}>Закрыть</button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            <div
              className="w-full max-w-sm aspect-square rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: (ms.photos[viewPhoto] as any).placeholderColor || '#374151' }}
            >
              <div className="text-center">
                <Camera className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <div className="text-white/70 text-[14px] font-medium">{ms.photos[viewPhoto].caption || `Фото ${viewPhoto + 1}`}</div>
                <div className="text-white/40 text-[12px] mt-1">{formatDateShort(ms.photos[viewPhoto].uploadedAt)}</div>
              </div>
            </div>
          </div>
          {/* Thumbnail strip */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto justify-center">
            {ms.photos.map((p, i) => (
              <button
                key={p.id}
                onClick={(e) => { e.stopPropagation(); setViewPhoto(i); }}
                className={`w-12 h-12 rounded-lg flex-shrink-0 ${i === viewPhoto ? 'ring-2 ring-white' : 'opacity-50'}`}
                style={{ backgroundColor: (p as any).placeholderColor || '#374151' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
