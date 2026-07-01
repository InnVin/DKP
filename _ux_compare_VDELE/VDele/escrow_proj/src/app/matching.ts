// ═══════════════════════════════════════════════════════════════════
// Matching Engine — v2 (Load-aware, dispute-penalized, bypass-aware)
// ═══════════════════════════════════════════════════════════════════

import type { Provider, Service, ContactPair } from "./types";

export type ProviderMatch = {
  provider: Provider;
  distanceKm: number;
  earliestSlot?: string;
  matchScore: number;
  matchReasons: string[];
  /** Warnings for admin (e.g. bypass risk). */
  warnings: string[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computeDistanceKm(provider: Provider): number {
  const base = provider.baseDistanceKm ?? 8;
  const hash = Array.from(provider.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const jitter = (hash % 7) * 0.3;
  return Math.round((base + jitter) * 10) / 10;
}

export function findEarliestSlot(provider: Provider, scheduledIso?: string): string | undefined {
  const slots = (provider.availabilitySlots ?? []).filter(Boolean);
  if (slots.length === 0) return undefined;
  const target = scheduledIso ? Date.parse(scheduledIso) : NaN;
  const sorted = [...slots].sort((a, b) => Date.parse(a) - Date.parse(b));
  if (!Number.isFinite(target)) return sorted[0];
  return sorted.find((s) => Date.parse(s) >= target) ?? sorted[sorted.length - 1];
}

export function providerMatchesService(provider: Provider, service: Service): boolean {
  const byService = provider.skillServiceIds?.includes(service.id);
  const byCategory = provider.skillCategoryIds?.includes(service.categoryId);
  return Boolean(byService || byCategory);
}

/**
 * Scoring weights (v2):
 * - Rating:       35 pts (was 55 — reduced to balance with other factors)
 * - Distance:     15 pts (was 25)
 * - Availability: 15 pts (was 20)
 * - Load:         15 pts (NEW — fewer active orders = higher score)
 * - Reliability:  15 pts (NEW — lower dispute rate = higher score)
 * - Verified:      5 pts bonus
 *
 * Penalties:
 * - Bypass risk HIGH with customer: −20 pts
 * - Penalty status WARNING: −10 pts
 * - Penalty status SUSPENDED: excluded
 * - Not accepting orders: excluded
 */
export function scoreProvider(input: {
  provider: Provider;
  service: Service;
  scheduledIso?: string;
  customerId?: string;
  contactPairs?: ContactPair[];
}): ProviderMatch {
  const { provider, service, scheduledIso, customerId, contactPairs } = input;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Exclusions
  if (!provider.acceptingOrders) {
    return { provider, distanceKm: 0, matchScore: -1, matchReasons: [], warnings: ["Не принимает заказы"] };
  }
  if (provider.penaltyStatus === "SUSPENDED" || provider.penaltyStatus === "BANNED") {
    return { provider, distanceKm: 0, matchScore: -1, matchReasons: [], warnings: [`Статус: ${provider.penaltyStatus}`] };
  }

  const distanceKm = computeDistanceKm(provider);
  const earliestSlot = findEarliestSlot(provider, scheduledIso);

  // Rating: 3.5..5.0 → 0..35
  const ratingNorm = clamp((provider.rating - 3.5) / 1.5, 0, 1);
  const ratingScore = ratingNorm * 35;
  if (provider.rating >= 4.8) reasons.push("Высокий рейтинг");

  // Distance: 0..20km → 15..0
  const distNorm = clamp(1 - distanceKm / 20, 0, 1);
  const distScore = distNorm * 15;
  if (distanceKm <= 5) reasons.push("Рядом с вами");

  // Availability: sooner = better
  let slotScore = 0;
  if (earliestSlot) {
    const hours = clamp((Date.parse(earliestSlot) - Date.now()) / 3600_000, 0, 168);
    slotScore = clamp(1 - hours / 72, 0, 1) * 15;
    if (hours <= 24) reasons.push("Доступен сегодня/завтра");
  }

  // Load: activeOrderCount 0..10 → 15..0
  const loadNorm = clamp(1 - (provider.activeOrderCount ?? 0) / 10, 0, 1);
  const loadScore = loadNorm * 15;
  if (provider.activeOrderCount === 0) reasons.push("Свободен");
  if (provider.activeOrderCount >= 5) warnings.push(`Загрузка: ${provider.activeOrderCount} активных заказов`);

  // Reliability: disputeRate 0..0.3 → 15..0
  const reliabilityNorm = clamp(1 - (provider.disputeRate ?? 0) / 0.3, 0, 1);
  const reliabilityScore = reliabilityNorm * 15;
  if (provider.disputeRate <= 0.05 && provider.completedOrders >= 10) reasons.push("Надёжный исполнитель");
  if (provider.disputeRate > 0.15) warnings.push(`Высокий % споров: ${(provider.disputeRate * 100).toFixed(0)}%`);

  // Verified bonus
  const verifiedBonus = provider.verified && provider.kycStatus === "VERIFIED" ? 5 : 0;
  if (verifiedBonus > 0) reasons.push("Проверенный специалист");

  let totalScore = ratingScore + distScore + slotScore + loadScore + reliabilityScore + verifiedBonus;

  // Bypass penalty
  if (customerId && contactPairs) {
    const pair = contactPairs.find(
      (p) => p.customerId === customerId && p.providerId === provider.id
    );
    if (pair) {
      if (pair.riskLevel === "HIGH") {
        totalScore -= 20;
        warnings.push("Риск обхода платформы: HIGH");
      } else if (pair.riskLevel === "MEDIUM") {
        totalScore -= 10;
        warnings.push("Риск обхода платформы: MEDIUM");
      }
    }
  }

  // Penalty status
  if (provider.penaltyStatus === "WARNING") {
    totalScore -= 10;
    warnings.push("Предупреждение за нарушение");
  }

  // Skill match reason
  if (provider.skillServiceIds?.includes(service.id)) reasons.unshift("Подходит по услуге");
  else if (provider.skillCategoryIds?.includes(service.categoryId)) reasons.unshift("Подходит по категории");

  return {
    provider,
    distanceKm,
    earliestSlot,
    matchScore: Math.round(Math.max(0, totalScore)),
    matchReasons: Array.from(new Set(reasons)).slice(0, 4),
    warnings,
  };
}

export function matchProviders(input: {
  providers: Provider[];
  service: Service;
  city?: string;
  scheduledIso?: string;
  requireVerified?: boolean;
  customerId?: string;
  contactPairs?: ContactPair[];
}): ProviderMatch[] {
  const { providers, service, city, scheduledIso, requireVerified, customerId, contactPairs } = input;
  return providers
    .filter((p) => (city ? (p.city ?? "") === city : true))
    .filter((p) => providerMatchesService(p, service))
    .filter((p) => (requireVerified ? p.verified : true))
    .filter((p) => p.acceptingOrders)
    .filter((p) => p.penaltyStatus !== "SUSPENDED" && p.penaltyStatus !== "BANNED")
    .map((p) => scoreProvider({ provider: p, service, scheduledIso, customerId, contactPairs }))
    .filter((m) => m.matchScore >= 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}
