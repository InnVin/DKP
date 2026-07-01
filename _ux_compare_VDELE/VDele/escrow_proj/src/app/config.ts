/**
 * Product configuration — v2 (multi-city, feature flags).
 */

export const LAUNCH_CITY = "Якутск";

export const ROLLOUT_CITIES = [
  "Якутск",
  "Владивосток",
  "Иркутск",
  "Новосибирск",
  "Екатеринбург",
] as const;

export type RolloutCity = (typeof ROLLOUT_CITIES)[number];

/** Feature flags (would be remote in production). */
export const FEATURES = {
  /** Enable milestone-based orders (turnkey renovation). */
  milestones: true,
  /** Enable change orders (scope changes after start). */
  changeOrders: true,
  /** Enable anti-bypass monitoring. */
  antiBypass: true,
  /** Enable photo reports per milestone. */
  photoReports: true,
  /** Enable checklist per milestone. */
  milestoneChecklist: true,
  /** Enable dispute escalation. */
  disputeEscalation: true,
  /** Enable audit trail in admin. */
  auditTrail: true,
  /** Contact masking (hide real contacts until escrow funded). */
  contactMasking: true,
} as const;

/** Order amount thresholds. */
export const THRESHOLDS = {
  /** Orders above this amount require milestones. */
  mandatoryMilestoneAmount: 150_000,
  /** Orders above this amount get reduced take-rate. */
  highTicketAmount: 300_000,
  /** Minimum amount for an order. */
  minOrderAmount: 1_500,
} as const;
