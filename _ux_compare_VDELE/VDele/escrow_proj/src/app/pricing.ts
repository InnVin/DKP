// ═══════════════════════════════════════════════════════════════════
// Pricing Engine — v3 (Audit-corrected)
// Changes from v2:
// - Removed disputeReserve from customer fee (DeepSeek: illegal banking activity)
// - Lowered minFee tier 1 (800→500₽) to avoid 16% on small orders  
// - Added specialist guarantee deposit (replaces per-txn reserve)
// - Added acquiring cost awareness for milestone orders
// ═══════════════════════════════════════════════════════════════════

import type { CityConfig } from "./types";

export const COMMISSION_RULES = {
  defaultPercent: 0.08,
  highTicketPercent: 0.06,
  highTicketThreshold: 300_000,
  /** Graduated minimum fee — lowered tier 1 per DeepSeek audit */
  minFees: [
    { maxAmount: 10_000, minFee: 500 },   // was 800₽ at 15K — too aggressive
    { maxAmount: 30_000, minFee: 1000 },   // rebalanced
    { maxAmount: 100_000, minFee: 2000 },  // rebalanced
    { maxAmount: Infinity, minFee: 3000 },
  ],
  /** Acquiring cost rate (bank processing). */
  acquiringRate: 0.019,
  /** Specialist guarantee deposit (replaces per-txn dispute reserve).
   *  Deposited once by specialist, not deducted per transaction.
   *  DeepSeek: per-txn reserve = potentially illegal fund creation. */
  specialistGuaranteeDeposit: 10_000, // ₽, one-time deposit from specialist
} as const;

/** Default city configs for rollout cities. */
export const CITY_CONFIGS: CityConfig[] = [
  {
    city: "Якутск",
    aovMultiplier: 1.0,
    availableCategories: ["plumbing", "electric", "repair", "cleaning", "renovation"],
    timezoneOffset: 6,
    active: true,
    launchDate: "2026-04-01",
  },
  {
    city: "Владивосток",
    aovMultiplier: 1.1,
    availableCategories: ["plumbing", "electric", "repair", "cleaning", "renovation", "transport"],
    timezoneOffset: 7,
    active: false,
    launchDate: "2026-07-01",
  },
  {
    city: "Иркутск",
    aovMultiplier: 0.95,
    availableCategories: ["plumbing", "electric", "repair", "cleaning", "renovation"],
    timezoneOffset: 5,
    active: false,
    launchDate: "2026-09-01",
  },
  {
    city: "Новосибирск",
    aovMultiplier: 1.15,
    availableCategories: ["plumbing", "electric", "repair", "cleaning", "renovation", "transport"],
    timezoneOffset: 4,
    active: false,
    launchDate: "2026-11-01",
  },
  {
    city: "Екатеринбург",
    aovMultiplier: 1.2,
    takeRateOverride: 0.08,
    availableCategories: ["plumbing", "electric", "repair", "cleaning", "renovation", "transport"],
    timezoneOffset: 2,
    active: false,
    launchDate: "2027-01-01",
  },
];

export function getCityConfig(city: string): CityConfig | undefined {
  return CITY_CONFIGS.find((c) => c.city === city);
}

export function getTakeRate(subtotal: number, city?: string): number {
  const cityConfig = city ? getCityConfig(city) : undefined;
  if (cityConfig?.takeRateOverride !== undefined) {
    return subtotal >= COMMISSION_RULES.highTicketThreshold
      ? Math.min(cityConfig.takeRateOverride, COMMISSION_RULES.highTicketPercent)
      : cityConfig.takeRateOverride;
  }
  return subtotal >= COMMISSION_RULES.highTicketThreshold
    ? COMMISSION_RULES.highTicketPercent
    : COMMISSION_RULES.defaultPercent;
}

export function getMinFee(subtotal: number, city?: string): number {
  const cityConfig = city ? getCityConfig(city) : undefined;
  if (cityConfig?.minFeeOverride !== undefined) return cityConfig.minFeeOverride;
  const tier = COMMISSION_RULES.minFees.find((t) => subtotal <= t.maxAmount);
  return tier?.minFee ?? 1500;
}

/**
 * Platform fee charged to customer.
 * v3: NO dispute reserve included — that's now a specialist deposit.
 */
export function computePlatformFee(subtotal: number, city?: string): number {
  const percent = getTakeRate(subtotal, city);
  const fee = Math.round(subtotal * percent);
  return Math.max(getMinFee(subtotal, city), fee);
}

/**
 * Acquiring cost (bank processing fee) — internal, not shown to customer.
 */
export function computeAcquiringCost(totalAmount: number): number {
  return Math.round(totalAmount * COMMISSION_RULES.acquiringRate);
}

/**
 * Full breakdown for an order.
 * v3: Removed disputeReserve from customer-facing calculation.
 */
export function computeFullBreakdown(subtotal: number, city?: string) {
  const platformFee = computePlatformFee(subtotal, city);
  const totalAmount = subtotal + platformFee;
  const acquiringCost = computeAcquiringCost(totalAmount);
  const netRevenue = platformFee - acquiringCost;

  return {
    subtotal,
    platformFee,
    totalAmount,
    acquiringCost,
    netRevenue,
    providerPayout: subtotal,
    effectiveTakeRate: platformFee / subtotal,
  };
}

/**
 * Estimate acquiring cost for milestone-based orders.
 * DeepSeek/Grok: 4 milestones = 4x acquiring fee, eating margin.
 * Recommendation: use hold + partial capture when available.
 */
export function computeMilestoneAcquiringCost(milestoneAmounts: number[]): number {
  // Each milestone payment incurs separate acquiring fee
  return milestoneAmounts.reduce((sum, amt) => sum + computeAcquiringCost(amt), 0);
}
