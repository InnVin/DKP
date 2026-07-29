export type DocumentType =
  | "seller_passport"
  | "buyer_passport"
  | "vehicle_docs"
  | "old_contract"
  | "other";

export type SyncStatus = "local" | "pending" | "uploaded" | "error";

export interface DealData {
  contract_number: string;
  contract_date: string;
  contract_place: string;
  price: string;
  seller_full_name: string;
  seller_birth_date: string;
  seller_phone: string;
  seller_passport: string;
  seller_passport_issue_date: string;
  seller_passport_issued_by: string;
  seller_address: string;
  buyer_full_name: string;
  buyer_birth_date: string;
  buyer_phone: string;
  buyer_passport: string;
  buyer_passport_issue_date: string;
  buyer_passport_issued_by: string;
  buyer_address: string;
  vehicle_make_model: string;
  vehicle_type: string;
  vehicle_year: string;
  vin: string;
  body_number: string;
  chassis_number: string;
  color: string;
  registration_plate: string;
  pts_series_number: string;
  sts_series_number: string;
  seller_notes: string;
  buyer_notes: string;
  vehicle_notes: string;
}

export type DealField = keyof DealData;

export interface FieldMeta {
  confidence: number;
  page?: number;
  evidence?: string;
  source?: "openrouter" | "manual";
}

export interface FieldCandidate {
  value: string;
  confidence: number;
  page?: number;
  evidence?: string;
}

export interface DealRecord {
  id: number;
  data: DealData;
  fieldMeta: Partial<Record<DealField, FieldMeta>>;
  conflicts: Partial<Record<DealField, FieldCandidate[]>>;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DealDocument {
  id: number;
  dealId: number;
  documentType: DocumentType;
  localUri: string;
  originalName: string;
  mimeType: string;
  ocrStatus: "local" | "queued" | "processing" | "done" | "error";
  createdAt: string;
}

export interface GeneratedFile {
  id: number;
  dealId: number;
  kind: "xlsx" | "pdf" | "jpg";
  localUri: string;
  name: string;
  syncStatus: SyncStatus;
  remotePath: string;
  createdAt: string;
}

export const emptyDealData = (): DealData => ({
  contract_number: "",
  contract_date: new Date().toISOString().slice(0, 10),
  contract_place: "Якутск",
  price: "",
  seller_full_name: "",
  seller_birth_date: "",
  seller_phone: "",
  seller_passport: "",
  seller_passport_issue_date: "",
  seller_passport_issued_by: "",
  seller_address: "",
  buyer_full_name: "",
  buyer_birth_date: "",
  buyer_phone: "",
  buyer_passport: "",
  buyer_passport_issue_date: "",
  buyer_passport_issued_by: "",
  buyer_address: "",
  vehicle_make_model: "",
  vehicle_type: "B/M1",
  vehicle_year: "",
  vin: "ОТСУТСТВУЕТ",
  body_number: "",
  chassis_number: "ОТСУТСТВУЕТ",
  color: "",
  registration_plate: "",
  pts_series_number: "",
  sts_series_number: "",
  seller_notes: "",
  buyer_notes: "",
  vehicle_notes: "",
});

export const requiredFields: DealField[] = [
  "contract_number",
  "contract_date",
  "contract_place",
  "price",
  "seller_full_name",
  "seller_passport",
  "seller_address",
  "buyer_full_name",
  "buyer_passport",
  "buyer_address",
  "vehicle_make_model",
  "vehicle_year",
  "color",
  "registration_plate",
  "pts_series_number",
  "sts_series_number",
];

export const criticalOcrFields = new Set<DealField>([
  "seller_passport",
  "buyer_passport",
  "vin",
  "body_number",
  "chassis_number",
  "pts_series_number",
  "sts_series_number",
]);

export const documentLabels: Record<DocumentType, string> = {
  seller_passport: "Паспорт продавца",
  buyer_passport: "Паспорт покупателя",
  vehicle_docs: "ПТС / СТС",
  old_contract: "Старый ДКП",
  other: "Прочее",
};
