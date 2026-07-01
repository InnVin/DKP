// ═══════════════════════════════════════════════════════════════════
// Domain Types for «В ДЕЛЕ» Platform — v2 (Full Scope)
// ═══════════════════════════════════════════════════════════════════
//
// Changes from v1:
// - Milestone has its own state machine (independent of Order)
// - Anti-bypass system (contact masking, repeat-pair tracking, flags)
// - Change Orders (scope/price changes after start)
// - Photo reports per milestone
// - Regional (per-city) configuration
// - Audit trail / event log
// - KYC status for providers
// - Dispute escalation levels
// ═══════════════════════════════════════════════════════════════════

// ─── Order ──────────────────────────────────────────────────────

export type OrderStatus =
  | 'PLACED'
  | 'FUNDED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED';

export type EscrowStatus =
  | 'NOT_FUNDED'
  | 'HELD'
  | 'PARTIALLY_HELD'
  | 'FROZEN'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'REFUNDED';

// ─── Milestone State Machine ────────────────────────────────────
//
//   NOT_FUNDED → FUNDED → IN_PROGRESS → SUBMITTED → APPROVED → RELEASED
//                  ↓           ↓             ↓          ↓
//               CANCELLED   DISPUTED     DISPUTED    DISPUTED
//                                                       ↓
//                                                   REFUNDED

export type MilestoneStatus =
  | 'NOT_FUNDED'
  | 'FUNDED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'RELEASED'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'CANCELLED';

export interface Milestone {
  id: string;
  orderId: string;
  seq: number;
  name: string;
  description?: string;
  percent: number;
  amount: number;
  status: MilestoneStatus;
  dependsOnPrevious: boolean;
  createdAt: string;
  fundedAt?: string;
  startedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  releasedAt?: string;
  disputedAt?: string;
  autoReleaseAt?: string;
  photos: MilestonePhoto[];
  checklist: ChecklistItem[];
}

export interface MilestonePhoto {
  id: string;
  milestoneId: string;
  type: 'before' | 'during' | 'after';
  url: string;
  uploadedBy: 'customer' | 'specialist';
  uploadedAt: string;
  caption?: string;
  placeholderColor?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedAt?: string;
  checkedBy?: 'customer' | 'specialist';
}

// ─── Change Order ───────────────────────────────────────────────

export type ChangeOrderStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ChangeOrder {
  id: string;
  orderId: string;
  proposedBy: 'customer' | 'specialist';
  proposedAt: string;
  status: ChangeOrderStatus;
  resolvedAt?: string;
  changes: {
    addMilestones?: Omit<Milestone, 'id' | 'orderId' | 'status' | 'createdAt' | 'photos' | 'checklist'>[];
    removeMilestoneIds?: string[];
    priceAdjustment?: number;
    reason: string;
  };
}

// ─── Dispute ────────────────────────────────────────────────────

export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'ESCALATED'
  | 'RESOLVED_PROVIDER'
  | 'RESOLVED_CUSTOMER'
  | 'SPLIT'
  | 'CLOSED';

export type DisputeCategory =
  | 'QUALITY'
  | 'NO_SHOW'
  | 'INCOMPLETE'
  | 'DAMAGE'
  | 'PRICE_DISPUTE'
  | 'TIMELINE'
  | 'OTHER';

export interface Dispute {
  id: string;
  orderId: string;
  milestoneId?: string;
  status: DisputeStatus;
  category: DisputeCategory;
  reason: string;
  description: string;
  openedBy: 'customer' | 'specialist';
  openedAt: string;
  resolvedAt?: string;
  escalatedAt?: string;
  moderatorId?: string;
  evidence: DisputeEvidence[];
  resolution?: {
    type: 'release' | 'refund' | 'split';
    customerAmount?: number;
    providerAmount?: number;
    summary: string;
    resolvedBy?: "moderator" | "auto" | "system";
  };
  slaDeadline?: string;
  slaBreached: boolean;
}

export interface DisputeEvidence {
  id: string;
  disputeId: string;
  type: 'photo' | 'video' | 'document' | 'text';
  url?: string;
  text?: string;
  uploadedBy: 'customer' | 'specialist' | 'moderator';
  uploadedAt: string;
}

// ─── Anti-Bypass System ─────────────────────────────────────────

export type BypassRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ContactPair {
  customerId: string;
  providerId: string;
  platformOrders: number;
  firstOrderAt: string;
  lastOrderAt: string;
  riskLevel: BypassRiskLevel;
  flags: BypassFlag[];
}

export interface BypassFlag {
  id: string;
  type:
    | 'CONTACT_SHARED_IN_CHAT'
    | 'REPEATED_PAIR_NO_PLATFORM'
    | 'CANCELLED_AFTER_MATCH'
    | 'EXTERNAL_REFERRAL'
    | 'SUSPICIOUS_PATTERN';
  detectedAt: string;
  description: string;
  reviewed: boolean;
  reviewedAt?: string;
  action?: 'WARNING' | 'PENALTY' | 'DISMISSED' | 'BAN';
}

// ─── Provider (extended) ────────────────────────────────────────

export type KYCStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type TaxStatus = 'SELF_EMPLOYED' | 'INDIVIDUAL_ENTREPRENEUR' | 'LLC' | 'UNKNOWN';

export interface Provider {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  reviewCount: number;
  specializations: string[];
  skillServiceIds?: string[];
  skillCategoryIds?: string[];
  city?: string;
  areas?: string[];
  portfolio?: { id: string; title?: string; imageUrl: string }[];
  availabilitySlots?: string[];
  baseDistanceKm?: number;
  verified: boolean;
  kycStatus: KYCStatus;
  taxStatus: TaxStatus;
  innMasked?: string;
  activeOrderCount: number;
  disputeRate: number;
  completedOrders: number;
  acceptingOrders: boolean;
  uniqueCustomers: number;
  penaltyStatus: 'NONE' | 'WARNING' | 'SUSPENDED' | 'BANNED';
  joinedAt: string;
}

// ─── Service & Catalog ──────────────────────────────────────────

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  requiresMilestones: boolean;
  milestoneTemplates?: MilestoneTemplate[];
}

export interface MilestoneTemplate {
  name: string;
  description: string;
  percentSuggested: number;
  checklistTemplate: string[];
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  feePercent: number;
  policy: OrderPolicy;
  parameters: ServiceParameter[];
  published: boolean;
  version: number;
  updatedAt: string;
  cities: string[];
  supportsMilestones: boolean;
  minMilestones: number;
  maxMilestones: number;
}

export interface ServiceParameter {
  id: string;
  name: string;
  type: 'select' | 'number' | 'boolean';
  options?: { label: string; value: string; priceModifier: number }[];
  required: boolean;
}

export interface OrderPolicy {
  cancelWindowMinutes: number;
  disputeWindowHours: number;
  autoReleaseHours: number;
  disputeSlaHours: number;
  milestoneAutoReleaseHours?: number;
  maxCompletionDays?: number;
}

// ─── Order (extended) ───────────────────────────────────────────

export interface Order {
  id: string;
  customerId: string;
  providerId?: string;
  serviceId: string;
  serviceName: string;
  status: OrderStatus;
  escrowStatus: EscrowStatus;
  totalAmount: number;
  breakdown: {
    basePrice: number;
    options: { name: string; amount: number }[];
    platformFee: number;
    acquiringCost?: number;
    disputeReserve?: number;
  };
  address: string;
  city: string;
  scheduledDate: string;
  createdAt: string;
  fundedAt?: string;
  assignedAt?: string;
  startedAt?: string;
  submittedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  autoReleaseDate?: string;
  policy: OrderPolicy;
  provider?: Provider;
  milestones: Milestone[];
  changeOrders: ChangeOrder[];
  isTurnkey: boolean;
  contactsRevealed: boolean;
  maskedPhone?: string;
}

// ─── Wallet & Transactions ──────────────────────────────────────

export interface WalletBalance {
  available: number;
  pending: number;
  held: number;
  totalEarned: number;
  totalPaidOut: number;
}

export interface Transaction {
  id: string;
  type: 'escrow_hold' | 'escrow_release' | 'milestone_release' | 'refund' | 'payout' | 'fee' | 'penalty';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  description: string;
  orderId?: string;
  milestoneId?: string;
}

export interface PayoutRequest {
  id: string;
  providerId: string;
  amount: number;
  fee: number;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REJECTED';
  requestedAt: string;
  processedAt?: string;
  failureReason?: string;
}

// ─── Audit Trail ────────────────────────────────────────────────

export type AuditEventType =
  | 'ORDER_CREATED'
  | 'ORDER_FUNDED'
  | 'ORDER_ASSIGNED'
  | 'ORDER_STARTED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'ORDER_AUTO_RELEASED'
  | 'MILESTONE_FUNDED'
  | 'MILESTONE_STARTED'
  | 'MILESTONE_SUBMITTED'
  | 'MILESTONE_APPROVED'
  | 'MILESTONE_RELEASED'
  | 'MILESTONE_DISPUTED'
  | 'MILESTONE_REFUNDED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_ESCALATED'
  | 'DISPUTE_RESOLVED'
  | 'CHANGE_ORDER_PROPOSED'
  | 'CHANGE_ORDER_APPROVED'
  | 'CHANGE_ORDER_REJECTED'
  | 'BYPASS_FLAG_RAISED'
  | 'BYPASS_FLAG_REVIEWED'
  | 'PROVIDER_VERIFIED'
  | 'PROVIDER_PENALIZED'
  | 'PAYOUT_REQUESTED'
  | 'PAYOUT_COMPLETED';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;
  actor: {
    role: 'customer' | 'specialist' | 'admin' | 'system';
    id?: string;
  };
  entityType: 'order' | 'milestone' | 'dispute' | 'provider' | 'payout';
  entityId: string;
  before?: string;
  after?: string;
  metadata?: Record<string, unknown>;
}

// ─── Regional Configuration ─────────────────────────────────────

export interface CityConfig {
  city: string;
  aovMultiplier: number;
  takeRateOverride?: number;
  minFeeOverride?: number;
  availableCategories: string[];
  timezoneOffset: number;
  active: boolean;
  launchDate?: string;
}

// ═══ Audit-driven additions (DeepSeek/Grok/ChatGPT recommendations) ═══

// Escalation replaces auto-release (DeepSeek P1: auto-release is legally risky)
export type EscalationStatus = 'NONE' | 'PENDING_CUSTOMER' | 'PENDING_SUPPORT' | 'RESOLVED';

export interface EscalationRecord {
  id: string;
  orderId: string;
  milestoneId?: string;
  reason: 'AUTO_RELEASE_BLOCKED' | 'CUSTOMER_INACTIVE' | 'QUALITY_CONCERN';
  status: EscalationStatus;
  notificationsSent: number;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: 'customer' | 'support';
}

// Guarantee deposit from specialist (DeepSeek: dispute reserve 2% per txn = illegal banking)
export interface GuaranteeDeposit {
  providerId: string;
  amount: number;
  depositedAt: string;
  status: 'ACTIVE' | 'PARTIALLY_USED' | 'RETURNED';
}

// Legal entity types (DeepSeek P0: platform status must be defined)
export type PlatformLegalStatus = 'INFORMATION_INTERMEDIARY'; // ст. 1253.1 ГК РФ
export type SpecialistLegalForm = 'SELF_EMPLOYED' | 'INDIVIDUAL_ENTREPRENEUR' | 'LLC';

export interface LegalConsent {
  userId: string;
  offertaAccepted: boolean;
  offertaAcceptedAt?: string;
  privacyPolicyAccepted: boolean;
  privacyPolicyAcceptedAt?: string;
  dataProcessingConsent: boolean;
  dataProcessingConsentAt?: string;
}

// Insurance (all 3 audits missed this — critical for 500K+ orders)
export interface SpecialistInsurance {
  providerId: string;
  hasLiabilityInsurance: boolean;
  insuranceProvider?: string;
  coverageAmount?: number;
  expiresAt?: string;
}

// SRO/Licenses (DeepSeek: certain work types require permits)
export interface SpecialistLicense {
  type: 'SRO' | 'MChS' | 'ELECTRICAL' | 'GAS';
  number: string;
  issuedBy: string;
  validUntil: string;
  verified: boolean;
}
