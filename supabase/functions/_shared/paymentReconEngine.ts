/**
 * Pure payment-reconciliation engine shared by the admin UI and the
 * admin-payment-recon-import edge function. No database client and no
 * customer data live here.
 */

export const FILE_KINDS = [
  "customer_status",
  "payment_events",
  "accesspay_daily",
  "bank_statement",
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const MATCH_CATEGORIES = [
  "matched",
  "discrepancy",
  "genuine_unmatched",
  "unlinked",
] as const;
export type MatchCategory = (typeof MATCH_CATEGORIES)[number];

export const RECON_STATUSES = [
  "paid",
  "pending",
  "failed",
  "cancelled_mandate",
  "overdue",
  "not_yet_submitted",
  "closed",
  "unallocated",
  "genuine_unmatched",
] as const;
export type ReconStatus = (typeof RECON_STATUSES)[number];

export const STATUS_LABELS: Record<ReconStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  cancelled_mandate: "Cancelled mandate",
  overdue: "Overdue",
  not_yet_submitted: "Not yet submitted",
  closed: "Closed/do not chase",
  unallocated: "Unallocated",
  genuine_unmatched: "Genuine business payment, not matched to a customer",
};

export const CATEGORY_LABELS: Record<MatchCategory, string> = {
  matched: "Matched",
  discrepancy: "Discrepancy",
  genuine_unmatched: "Genuine business payment, not matched to a customer",
  unlinked: "Unlinked payment",
};

export const CASE_LABELS: Record<string, string> = {
  opening_balance_uninvoiced: "Opening balance includes uninvoiced months",
  mandate_cancelled_occta_active: "AccessPay mandate cancelled; Occta still active",
  failed_attempt_existing_charge: "Failed DD on an existing charge, not extra debt",
  failed_attempt_resolved: "Failed attempt collected on a later retry",
  bank_receipt_not_in_occta: "Bank receipt not recorded in Occta",
  mislabeled_card_was_transfer: "Occta says card; payment was a bank transfer",
  accesspay_only_no_occta_record: "AccessPay only — no Occta customer",
  draft_invoice_mark_due_no_email: "Draft invoice — mark due, do not email",
  unallocated_no_invoice: "Unallocated payment with no matching invoice",
};

/** Shown in the admin UI. Not a hardcoded match rule. */
export const PAYER_ALIAS_HELP =
  "A customer can pay under a trading name that differs from their personal name. Put the business name in Payer name and any statement spelling in Name aliases. Example: payer Harmonic Spa may appear on the bank statement as HAIRMONIC HEAD SPA.";

export interface AccountRow {
  rowKey: string;
  customerName: string;
  payerName: string | null;
  bankPayerName: string | null;
  nameAliases: string[];
  occtaRef: string | null;
  method: string | null;
  occtaMethod: string | null;
  amountDue: number | null;
  dueDateRaw: string | null;
  dueOn: string | null;
  lastPaymentReceived: string | null;
  seenIn: string | null;
  statusRaw: string | null;
  reconciledStatus: ReconStatus;
  matchCategory: MatchCategory;
  caseCodes: string[];
  balanceOutstanding: number | null;
  balanceKind: string | null;
  invoicedAmount: number | null;
  uninvoicedAmount: number | null;
  nextAction: string | null;
  accesspayStatus: string | null;
  occtaMandateStatus: string | null;
  ddStatus: string | null;
  lastDdDateRaw: string | null;
  lastDdOn: string | null;
  lastDdAmount: number | null;
  lastDdResult: string | null;
  failureTreatment: string | null;
  nextDdDateRaw: string | null;
  nextDdOn: string | null;
  nextDdAmount: number | null;
  bankPayments: string | null;
  matchedPayout: string | null;
  invoiceBalance: number | null;
  invoiceState: string | null;
  occtaRecorded: boolean | null;
  notes: string | null;
  linkedAccountNumber: string | null;
  linkedInvoiceNumber: string | null;
  draftMarkedDueAt: string | null;
}

export interface PaymentRow {
  eventKey: string;
  accountKey: string | null;
  customerName: string | null;
  payerName: string | null;
  bankPayerName: string | null;
  nameAliases: string[];
  occtaRef: string | null;
  paymentRef: string | null;
  mandateRef: string | null;
  invoiceNumber: string | null;
  method: string | null;
  occtaMethod: string | null;
  amount: number | null;
  chargeKind: string | null;
  submittedAtRaw: string | null;
  submittedOn: string | null;
  collectionDateRaw: string | null;
  collectionOn: string | null;
  failedAtRaw: string | null;
  failedOn: string | null;
  failureReason: string | null;
  failureTreatment: string | null;
  processedAtRaw: string | null;
  processedOn: string | null;
  payoutRef: string | null;
  bankReceivedAtRaw: string | null;
  bankReceivedOn: string | null;
  bankDescription: string | null;
  statusRaw: string | null;
  reconciledStatus: ReconStatus;
  matchCategory: MatchCategory;
  caseCodes: string[];
  balanceAfter: number | null;
  occtaRecorded: boolean | null;
  linkedAccountNumber: string | null;
  linkedInvoiceNumber: string | null;
}

export interface MandateRow {
  mandateKey: string;
  accountKey: string | null;
  customerName: string | null;
  occtaRef: string | null;
  payerName: string | null;
  mandateReference: string | null;
  status: string | null;
  accesspayStatus: string | null;
  createdRaw: string | null;
  createdOn: string | null;
  submittedRaw: string | null;
  submittedOn: string | null;
  cancelledRaw: string | null;
  cancelledOn: string | null;
  isTest: boolean;
  isDuplicate: boolean;
  neverSubmitted: boolean;
  linkedAccountNumber: string | null;
}

export interface BankLine {
  lineKey: string;
  bankDateRaw: string | null;
  bankOn: string | null;
  amount: number | null;
  description: string | null;
  payerName: string | null;
  reference: string | null;
  payoutRef: string | null;
  matchCategory: MatchCategory;
  matchedAccountKey: string | null;
  matchedPaymentRef: string | null;
  matchedPayoutRef: string | null;
  linkedAccountNumber: string | null;
  linkedInvoiceNumber: string | null;
}

export interface PayoutRow {
  payoutRef: string;
  amount: number | null;
  feeAmount: number | null;
  bankAmount: number | null;
  processedRaw: string | null;
  processedOn: string | null;
  bankDateRaw: string | null;
  bankOn: string | null;
  bankDescription: string | null;
  matchCategory: MatchCategory;
}

export interface TimelineRow {
  timelineKey: string;
  subjectType: string;
  subjectKey: string;
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
  recordedAt: string;
  fileKind: string | null;
  fileSha: string | null;
  note: string | null;
}

export interface ImportRecord {
  fileKind: FileKind;
  fileName: string;
  contentSha256: string;
  rowCount: number;
  importedBy: string | null;
  importedByEmail: string | null;
  firstImportedAt: string;
  lastImportedAt: string;
  importCount: number;
}

export interface AuditRecord {
  auditKey: string;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  subjectType: string;
  subjectKey: string;
  accountNumber: string | null;
  invoiceNumber: string | null;
  detail: string | null;
}

export interface ReconState {
  accounts: AccountRow[];
  payments: PaymentRow[];
  mandates: MandateRow[];
  bankLines: BankLine[];
  payouts: PayoutRow[];
  timeline: TimelineRow[];
  imports: ImportRecord[];
  audit: AuditRecord[];
}

export interface ImportMeta {
  csvText: string;
  fileName: string;
  importedBy: string | null;
  importedByEmail: string | null;
  importedAt: string;
}

export interface ImportResult {
  state: ReconState;
  errors: string[];
  warnings: string[];
  rowCount: number;
}

export function emptyState(): ReconState {
  return {
    accounts: [],
    payments: [],
    mandates: [],
    bankLines: [],
    payouts: [],
    timeline: [],
    imports: [],
    audit: [],
  };
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

export function normaliseCsvText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normaliseMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normaliseRef(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/** Calendar date only when the free text starts with an unambiguous D Mon YYYY. */
export function parseUnambiguousDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || /^(none|n\/a|na|-|—)$/i.test(text)) return null;
  const match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:\s+\d{1,2}:\d{2})?(?:\s+(.*))?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number(match[3]);
  const rest = (match[4] ?? "").trim();
  if (!month || day < 1 || day > 31) return null;
  if (rest && !/^\(.*\)$/.test(rest) && !/^£?\s*-?\d[\d,]*(?:\.\d+)?$/.test(rest)) return null;
  const stamp = new Date(Date.UTC(year, month - 1, day));
  if (stamp.getUTCFullYear() !== year || stamp.getUTCMonth() !== month - 1 || stamp.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!text || /^(none|n\/a|na|-|—)$/i.test(text)) return null;
  const cleaned = text.replace(/£/g, "").replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function extractAmount(raw: string | null | undefined): number | null {
  const direct = parseAmount(raw);
  if (direct != null) return direct;
  if (!raw) return null;
  const matches = raw.match(/£\s*-?\d[\d,]*(?:\.\d+)?/g);
  if (!matches || matches.length !== 1) return null;
  return parseAmount(matches[0]);
}

export function parseBool(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (["yes", "true", "y", "1"].includes(text)) return true;
  if (["no", "false", "n", "0"].includes(text)) return false;
  return null;
}

export function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const parts = raw.split(/[;|]/).map((part) => part.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = normaliseMatchText(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

export function mapStatus(raw: string | null | undefined): ReconStatus {
  const text = normaliseMatchText(raw);
  if (!text) return "pending";
  if (text === "genuine unmatched" || text.includes("genuine business payment") || text.includes("genuine unmatched")) {
    return "genuine_unmatched";
  }
  if (text.includes("unallocated")) return "unallocated";
  if (text.includes("do not chase") || text === "closed" || text.startsWith("closed ")) return "closed";
  if (text.includes("not yet submitted") || text.includes("awaiting submission")) return "not_yet_submitted";
  if (text.includes("cancelled mandate") || text.includes("mandate cancelled") || text.includes("addacs")) return "cancelled_mandate";
  if (text.includes("failed") || text.includes("arudd")) return "failed";
  if (text.includes("overdue")) return "overdue";
  if (text.includes("paid") || text === "collected") return "paid";
  if (text.includes("pending")) return "pending";
  return "pending";
}

export function parseCaseCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const tokens = raw.split(/[;|]/).map((part) => part.trim()).filter(Boolean);
  const codes: string[] = [];
  for (const token of tokens) {
    const norm = normaliseMatchText(token).replace(/ /g, "_");
    const byCode = CASE_LABELS[norm] ? norm : null;
    const byLabel = Object.entries(CASE_LABELS).find(([, label]) => normaliseMatchText(label) === normaliseMatchText(token))?.[0] ?? null;
    const code = byCode ?? byLabel;
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function headerKey(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
}

const HEADER_MAP: Record<string, string> = {
  customer: "customer",
  "occta ref": "occta_ref",
  method: "method",
  "amount due £": "amount_due",
  "amount due": "amount_due",
  "due date": "due_date",
  "last payment received": "last_payment_received",
  "seen in": "seen_in",
  status: "status",
  "balance outstanding £": "balance_outstanding",
  "balance outstanding": "balance_outstanding",
  "next action": "next_action",
  "accesspay status": "accesspay_status",
  "occta mandate status": "occta_mandate_status",
  "dd status": "dd_status",
  "last dd date": "last_dd_date",
  "last dd amount £": "last_dd_amount",
  "last dd amount": "last_dd_amount",
  "last dd result": "last_dd_result",
  "failure treatment": "failure_treatment",
  "next dd date": "next_dd_date",
  "next dd amount £": "next_dd_amount",
  "next dd amount": "next_dd_amount",
  "bank payments": "bank_payments",
  "matched payout": "matched_payout",
  "invoice balance £": "invoice_balance",
  "invoice balance": "invoice_balance",
  "invoice state": "invoice_state",
  "invoice number": "invoice_number",
  "occta recorded": "occta_recorded",
  "occta method": "occta_method",
  "payer name": "payer_name",
  "bank payer name": "bank_payer_name",
  "name aliases": "name_aliases",
  "name alias": "name_aliases",
  "balance kind": "balance_kind",
  cases: "cases",
  case: "cases",
  "invoiced £": "invoiced_amount",
  "invoiced": "invoiced_amount",
  "uninvoiced £": "uninvoiced_amount",
  "uninvoiced": "uninvoiced_amount",
  "match category": "match_category",
  notes: "notes",
  occta_ref: "occta_ref",
  payment_ref: "payment_ref",
  "payment ref": "payment_ref",
  amount: "amount",
  submitted_at: "submitted_at",
  "submitted at": "submitted_at",
  collection_date: "collection_date",
  "collection date": "collection_date",
  failed_at: "failed_at",
  "failed at": "failed_at",
  failure_reason: "failure_reason",
  "failure reason": "failure_reason",
  processed_at: "processed_at",
  "processed at": "processed_at",
  payout_ref: "payout_ref",
  "payout ref": "payout_ref",
  bank_received_at: "bank_received_at",
  "bank received at": "bank_received_at",
  bank_description: "bank_description",
  "bank description": "bank_description",
  charge_kind: "charge_kind",
  "charge kind": "charge_kind",
  balance_after: "balance_after",
  "balance after": "balance_after",
  record_type: "record_type",
  "record type": "record_type",
  mandate_ref: "mandate_ref",
  "mandate ref": "mandate_ref",
  fee_amount: "fee_amount",
  "fee amount": "fee_amount",
  "fee £": "fee_amount",
  mandate_status: "mandate_status",
  "mandate status": "mandate_status",
  mandate_created_at: "mandate_created_at",
  "mandate created at": "mandate_created_at",
  mandate_submitted_at: "mandate_submitted_at",
  "mandate submitted at": "mandate_submitted_at",
  mandate_cancelled_at: "mandate_cancelled_at",
  "mandate cancelled at": "mandate_cancelled_at",
  is_test: "is_test",
  "is test": "is_test",
  is_duplicate: "is_duplicate",
  "is duplicate": "is_duplicate",
  never_submitted: "never_submitted",
  "never submitted": "never_submitted",
  bank_date: "bank_date",
  "bank date": "bank_date",
  date: "bank_date",
  description: "description",
  reference: "reference",
};

function indexHeaders(headers: string[]): { index: Record<string, number>; unknown: string[] } {
  const index: Record<string, number> = {};
  const unknown: string[] = [];
  headers.forEach((header, position) => {
    const key = HEADER_MAP[headerKey(header)];
    if (!key) unknown.push(header.trim());
    else if (index[key] == null) index[key] = position;
  });
  return { index, unknown };
}

function cell(row: string[], index: Record<string, number>, key: string): string {
  const position = index[key];
  if (position == null) return "";
  return (row[position] ?? "").trim();
}

function blank(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

function requireHeaders(index: Record<string, number>, required: string[], label: string): string | null {
  const missing = required.filter((key) => index[key] == null);
  if (!missing.length) return null;
  return `${label} is missing columns: ${missing.join(", ")}`;
}

export function accountNames(account: Pick<AccountRow, "customerName" | "payerName" | "bankPayerName" | "nameAliases">): string[] {
  return [account.customerName, account.payerName ?? "", account.bankPayerName ?? "", ...account.nameAliases].filter(Boolean);
}

export function textHitsNames(text: string | null | undefined, names: string[]): boolean {
  const hay = normaliseMatchText(text);
  if (!hay) return false;
  return names.some((name) => {
    const needle = normaliseMatchText(name);
    if (!needle) return false;
    if (hay === needle) return true;
    return needle.length >= 8 && hay.includes(needle);
  });
}

export function looksLikeAccessPayCredit(description: string | null | undefined): boolean {
  return /aps\s+re\s+occta/i.test(description ?? "");
}

function inferCases(input: {
  explicit: string[];
  accesspayStatus?: string | null;
  occtaMandateStatus?: string | null;
  failureTreatment?: string | null;
  occtaRecorded?: boolean | null;
  occtaMethod?: string | null;
  method?: string | null;
  balanceKind?: string | null;
  invoiceState?: string | null;
  status: ReconStatus;
}): string[] {
  const codes = [...input.explicit];
  const add = (code: string) => {
    if (!codes.includes(code)) codes.push(code);
  };
  if (/uninvoiced/i.test(input.balanceKind ?? "")) add("opening_balance_uninvoiced");
  if (/cancel|addacs/i.test(input.accesspayStatus ?? "") && /active/i.test(input.occtaMandateStatus ?? "")) {
    add("mandate_cancelled_occta_active");
  }
  if (/existing/i.test(input.failureTreatment ?? "")) add("failed_attempt_existing_charge");
  if (input.occtaRecorded === false) add("bank_receipt_not_in_occta");
  if (/card/i.test(input.occtaMethod ?? "") && /transfer/i.test(input.method ?? "")) add("mislabeled_card_was_transfer");
  if (/^draft\b/i.test(input.invoiceState ?? "")) add("draft_invoice_mark_due_no_email");
  if (input.status === "unallocated") add("unallocated_no_invoice");
  return codes;
}

function explicitCategory(raw: string | null | undefined, status: ReconStatus): MatchCategory | null {
  const text = normaliseMatchText(raw);
  if (text === "genuine unmatched" || text.includes("genuine business")) return "genuine_unmatched";
  if (text === "unlinked" || text === "unallocated") return "unlinked";
  if (text === "discrepancy" || text === "exception" || text === "exceptions") return "discrepancy";
  if (text === "matched") return "matched";
  if (status === "genuine_unmatched") return "genuine_unmatched";
  if (status === "unallocated") return "unlinked";
  return null;
}

export function resolveCategory(input: {
  status: ReconStatus;
  explicitCategory?: string | null;
  caseCodes: string[];
  customerKnown: boolean;
}): MatchCategory {
  const explicit = explicitCategory(input.explicitCategory, input.status);
  if (explicit === "genuine_unmatched" || input.status === "genuine_unmatched") return "genuine_unmatched";
  if (explicit === "unlinked" || input.status === "unallocated") return "unlinked";
  if (explicit === "discrepancy") return "discrepancy";
  const exceptionCases = input.caseCodes.filter((code) => code !== "unallocated_no_invoice");
  const statusException = ["failed", "overdue", "cancelled_mandate", "not_yet_submitted"].includes(input.status);
  if (statusException || exceptionCases.length > 0) return "discrepancy";
  if (input.customerKnown || explicit === "matched" || input.status === "paid" || input.status === "pending" || input.status === "closed") {
    return "matched";
  }
  return "unlinked";
}

function accountKey(name: string, ref: string | null): string | null {
  const normalised = normaliseRef(ref);
  if (normalised) return `ref:${normalised}`;
  const person = normaliseMatchText(name);
  if (person) return `name:${person}`;
  return null;
}

function customerKnown(ref: string | null, name: string, linked: string | null): boolean {
  return Boolean(normaliseRef(ref) || normaliseRef(linked) || normaliseMatchText(name));
}

function findAccountKey(state: ReconState, ref: string | null, name: string | null, aliases: string[]): string | null {
  const normalised = normaliseRef(ref);
  if (normalised) {
    const byRef = state.accounts.find((account) => normaliseRef(account.occtaRef) === normalised || account.rowKey === `ref:${normalised}`);
    if (byRef) return byRef.rowKey;
    return `ref:${normalised}`;
  }
  const probes = [name ?? "", ...aliases].filter(Boolean);
  const hits = state.accounts.filter((account) => probes.some((probe) => textHitsNames(probe, accountNames(account))));
  if (hits.length === 1) return hits[0].rowKey;
  return null;
}

function pushTimeline(
  state: ReconState,
  row: Omit<TimelineRow, "timelineKey" | "recordedAt"> & { recordedAt?: string },
): void {
  if ((row.previousValue ?? "") === (row.newValue ?? "")) return;
  const timelineKey = ["tl", row.subjectType, row.subjectKey, row.fieldName, row.previousValue ?? "", row.newValue ?? ""].join("|");
  if (state.timeline.some((item) => item.timelineKey === timelineKey)) return;
  state.timeline.push({ ...row, timelineKey, recordedAt: row.recordedAt ?? new Date(0).toISOString() });
}

function rememberImport(state: ReconState, meta: ImportMeta, fileKind: FileKind, hash: string, rowCount: number): void {
  const existing = state.imports.find((item) => item.fileKind === fileKind && item.contentSha256 === hash);
  if (existing) {
    existing.fileName = meta.fileName;
    existing.rowCount = rowCount;
    existing.importedBy = meta.importedBy;
    existing.importedByEmail = meta.importedByEmail;
    existing.lastImportedAt = meta.importedAt;
    existing.importCount += 1;
    return;
  }
  state.imports.push({
    fileKind,
    fileName: meta.fileName,
    contentSha256: hash,
    rowCount,
    importedBy: meta.importedBy,
    importedByEmail: meta.importedByEmail,
    firstImportedAt: meta.importedAt,
    lastImportedAt: meta.importedAt,
    importCount: 1,
  });
}

function amountsEqual(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.005;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function importCustomerStatus(previous: ReconState, meta: ImportMeta): Promise<ImportResult> {
  const state = clone(previous);
  const table = parseCsv(meta.csvText);
  if (table.length < 2) return { state: previous, errors: ["The customer status file has no data rows."], warnings: [], rowCount: 0 };
  const { index, unknown } = indexHeaders(table[0]);
  const missing = requireHeaders(index, [
    "customer", "occta_ref", "method", "amount_due", "due_date", "last_payment_received", "seen_in", "status", "balance_outstanding", "next_action",
  ], "Customer status file");
  if (missing) return { state: previous, errors: [missing], warnings: [], rowCount: 0 };
  const warnings = unknown.filter(Boolean).map((column) => `Ignored unknown column "${column}".`);
  const nextAccounts: AccountRow[] = [];
  const seen = new Set<string>();
  for (const raw of table.slice(1)) {
    const name = cell(raw, index, "customer");
    const ref = blank(cell(raw, index, "occta_ref"));
    const key = accountKey(name, ref);
    if (!key) {
      warnings.push("Skipped a row with no customer name and no Occta ref.");
      continue;
    }
    const status = mapStatus(cell(raw, index, "status"));
    const explicitCases = parseCaseCodes(cell(raw, index, "cases"));
    const accesspayStatus = blank(cell(raw, index, "accesspay_status"));
    const occtaMandateStatus = blank(cell(raw, index, "occta_mandate_status"));
    const failureTreatment = blank(cell(raw, index, "failure_treatment"));
    const occtaRecorded = parseBool(cell(raw, index, "occta_recorded"));
    const occtaMethod = blank(cell(raw, index, "occta_method"));
    const method = blank(cell(raw, index, "method"));
    const balanceKind = blank(cell(raw, index, "balance_kind"));
    const invoiceState = blank(cell(raw, index, "invoice_state"));
    const caseCodes = inferCases({
      explicit: explicitCases,
      accesspayStatus,
      occtaMandateStatus,
      failureTreatment,
      occtaRecorded,
      occtaMethod,
      method,
      balanceKind,
      invoiceState,
      status,
    });
    if (/accesspay only|no occta/i.test(cell(raw, index, "notes")) || /accesspay only/i.test(cell(raw, index, "cases"))) {
      if (!caseCodes.includes("accesspay_only_no_occta_record")) caseCodes.push("accesspay_only_no_occta_record");
    }
    const prior = state.accounts.find((account) => account.rowKey === key);
    const linkedAccountNumber = prior?.linkedAccountNumber ?? null;
    const row: AccountRow = {
      rowKey: key,
      customerName: name || ref || "Unnamed",
      payerName: blank(cell(raw, index, "payer_name")),
      bankPayerName: blank(cell(raw, index, "bank_payer_name")),
      nameAliases: splitList(cell(raw, index, "name_aliases")),
      occtaRef: ref ? normaliseRef(ref) : null,
      method,
      occtaMethod,
      amountDue: parseAmount(cell(raw, index, "amount_due")),
      dueDateRaw: blank(cell(raw, index, "due_date")),
      dueOn: parseUnambiguousDate(cell(raw, index, "due_date")),
      lastPaymentReceived: blank(cell(raw, index, "last_payment_received")),
      seenIn: blank(cell(raw, index, "seen_in")),
      statusRaw: blank(cell(raw, index, "status")),
      reconciledStatus: status,
      matchCategory: resolveCategory({
        status,
        explicitCategory: cell(raw, index, "match_category"),
        caseCodes,
        customerKnown: customerKnown(ref, name, linkedAccountNumber) && status !== "unallocated" && !caseCodes.includes("accesspay_only_no_occta_record"),
      }),
      caseCodes,
      balanceOutstanding: parseAmount(cell(raw, index, "balance_outstanding")),
      balanceKind,
      invoicedAmount: parseAmount(cell(raw, index, "invoiced_amount")),
      uninvoicedAmount: parseAmount(cell(raw, index, "uninvoiced_amount")),
      nextAction: blank(cell(raw, index, "next_action")),
      accesspayStatus,
      occtaMandateStatus,
      ddStatus: blank(cell(raw, index, "dd_status")) ?? accesspayStatus,
      lastDdDateRaw: blank(cell(raw, index, "last_dd_date")),
      lastDdOn: parseUnambiguousDate(cell(raw, index, "last_dd_date")),
      lastDdAmount: parseAmount(cell(raw, index, "last_dd_amount")),
      lastDdResult: blank(cell(raw, index, "last_dd_result")),
      failureTreatment,
      nextDdDateRaw: blank(cell(raw, index, "next_dd_date")),
      nextDdOn: parseUnambiguousDate(cell(raw, index, "next_dd_date")),
      nextDdAmount: parseAmount(cell(raw, index, "next_dd_amount")),
      bankPayments: blank(cell(raw, index, "bank_payments")),
      matchedPayout: blank(cell(raw, index, "matched_payout")),
      invoiceBalance: parseAmount(cell(raw, index, "invoice_balance")),
      invoiceState,
      occtaRecorded,
      notes: blank(cell(raw, index, "notes")),
      linkedAccountNumber,
      linkedInvoiceNumber: prior?.linkedInvoiceNumber ?? null,
      draftMarkedDueAt: prior?.draftMarkedDueAt ?? null,
    };
    if (row.bankPayerName && !row.nameAliases.some((alias) => normaliseMatchText(alias) === normaliseMatchText(row.bankPayerName))) {
      row.nameAliases.push(row.bankPayerName);
    }
    const existingIndex = nextAccounts.findIndex((account) => account.rowKey === key);
    if (existingIndex >= 0) nextAccounts[existingIndex] = row;
    else nextAccounts.push(row);
    seen.add(key);
  }
  if (!nextAccounts.length) return { state: previous, errors: ["No usable customer rows were found."], warnings, rowCount: 0 };
  state.accounts = nextAccounts;
  void seen;
  const hash = await sha256Hex(normaliseCsvText(meta.csvText));
  rememberImport(state, meta, "customer_status", hash, nextAccounts.length);
  return { state, errors: [], warnings, rowCount: nextAccounts.length };
}

function paymentFromParts(input: {
  customer: string;
  ref: string | null;
  payerName: string | null;
  bankPayerName: string | null;
  aliases: string[];
  paymentRef: string | null;
  mandateRef: string | null;
  invoiceNumber: string | null;
  method: string | null;
  occtaMethod: string | null;
  amount: number | null;
  chargeKind: string | null;
  submittedRaw: string | null;
  collectionRaw: string | null;
  failedRaw: string | null;
  failureReason: string | null;
  failureTreatment: string | null;
  processedRaw: string | null;
  payoutRef: string | null;
  bankRaw: string | null;
  bankDescription: string | null;
  statusRaw: string | null;
  explicitCategory: string | null;
  casesRaw: string | null;
  balanceAfter: number | null;
  occtaRecorded: boolean | null;
  accountKey: string | null;
  prior: PaymentRow | null;
}): PaymentRow {
  const status = mapStatus(input.statusRaw);
  const caseCodes = inferCases({
    explicit: parseCaseCodes(input.casesRaw),
    failureTreatment: input.failureTreatment,
    occtaRecorded: input.occtaRecorded,
    occtaMethod: input.occtaMethod,
    method: input.method,
    status,
  });
  const known = Boolean(input.accountKey || normaliseRef(input.ref) || input.prior?.linkedAccountNumber);
  return {
    eventKey: input.prior?.eventKey || (input.paymentRef ? `pay:${input.paymentRef.trim().toUpperCase()}` : ""),
    accountKey: input.accountKey,
    customerName: blank(input.customer),
    payerName: input.payerName,
    bankPayerName: input.bankPayerName,
    nameAliases: input.aliases,
    occtaRef: input.ref ? normaliseRef(input.ref) : null,
    paymentRef: input.paymentRef ? input.paymentRef.trim().toUpperCase() : null,
    mandateRef: input.mandateRef ? input.mandateRef.trim().toUpperCase() : null,
    invoiceNumber: input.invoiceNumber,
    method: input.method,
    occtaMethod: input.occtaMethod,
    amount: input.amount,
    chargeKind: input.chargeKind,
    submittedAtRaw: input.submittedRaw,
    submittedOn: parseUnambiguousDate(input.submittedRaw),
    collectionDateRaw: input.collectionRaw,
    collectionOn: parseUnambiguousDate(input.collectionRaw),
    failedAtRaw: input.failedRaw,
    failedOn: parseUnambiguousDate(input.failedRaw),
    failureReason: input.failureReason,
    failureTreatment: input.failureTreatment,
    processedAtRaw: input.processedRaw,
    processedOn: parseUnambiguousDate(input.processedRaw),
    payoutRef: input.payoutRef ? input.payoutRef.trim().toUpperCase() : null,
    bankReceivedAtRaw: input.bankRaw,
    bankReceivedOn: parseUnambiguousDate(input.bankRaw),
    bankDescription: input.bankDescription,
    statusRaw: input.statusRaw,
    reconciledStatus: status,
    matchCategory: resolveCategory({
      status,
      explicitCategory: input.explicitCategory,
      caseCodes,
      customerKnown: known && status !== "unallocated",
    }),
    caseCodes,
    balanceAfter: input.balanceAfter,
    occtaRecorded: input.occtaRecorded,
    linkedAccountNumber: input.prior?.linkedAccountNumber ?? null,
    linkedInvoiceNumber: input.prior?.linkedInvoiceNumber ?? input.invoiceNumber,
  };
}

async function assignEventKey(row: PaymentRow): Promise<PaymentRow> {
  if (row.eventKey) return row;
  const hash = await sha256Hex([
    row.customerName, row.occtaRef, row.method, row.amount, row.submittedAtRaw, row.collectionDateRaw,
    row.failedAtRaw, row.failureReason, row.processedAtRaw, row.payoutRef, row.bankReceivedAtRaw, row.bankDescription, row.statusRaw,
  ].map((value) => value ?? "").join("|"));
  return { ...row, eventKey: `hash:${hash}` };
}

function trackPaymentChanges(state: ReconState, prior: PaymentRow | null, next: PaymentRow, meta: ImportMeta, hash: string, recordedAt: string): void {
  const fields: Array<[string, string | null, string | null]> = [
    ["status", prior?.statusRaw ?? null, next.statusRaw],
    ["failure_reason", prior?.failureReason ?? null, next.failureReason],
    ["submitted_at", prior?.submittedAtRaw ?? null, next.submittedAtRaw],
    ["collection_date", prior?.collectionDateRaw ?? null, next.collectionDateRaw],
    ["failed_at", prior?.failedAtRaw ?? null, next.failedAtRaw],
    ["processed_at", prior?.processedAtRaw ?? null, next.processedAtRaw],
    ["bank_received_at", prior?.bankReceivedAtRaw ?? null, next.bankReceivedAtRaw],
    ["payout_ref", prior?.payoutRef ?? null, next.payoutRef],
  ];
  if (!prior) {
    pushTimeline(state, {
      subjectType: "payment",
      subjectKey: next.eventKey,
      fieldName: "status",
      previousValue: null,
      newValue: next.statusRaw ?? next.reconciledStatus,
      recordedAt,
      fileKind: meta.fileName ? "payment" : null,
      fileSha: hash,
      note: "Imported",
    });
    return;
  }
  for (const [fieldName, previousValue, newValue] of fields) {
    pushTimeline(state, {
      subjectType: "payment",
      subjectKey: next.eventKey,
      fieldName,
      previousValue,
      newValue,
      recordedAt,
      fileKind: "payment",
      fileSha: hash,
      note: "Status change from import",
    });
  }
}

function upsertPayment(state: ReconState, row: PaymentRow): void {
  const index = state.payments.findIndex((payment) => payment.eventKey === row.eventKey);
  if (index >= 0) state.payments[index] = row;
  else state.payments.push(row);
}

function keepText(incoming: string | null | undefined, prior: string | null | undefined): string | null {
  if (incoming != null && incoming.trim() !== "") return incoming.trim();
  return prior ?? null;
}

function keepNum(incoming: number | null | undefined, prior: number | null | undefined): number | null {
  if (incoming == null || Number.isNaN(incoming)) return prior ?? null;
  return incoming;
}

function recomputePayment(row: PaymentRow, explicit: string | null): void {
  row.submittedOn = parseUnambiguousDate(row.submittedAtRaw);
  row.collectionOn = parseUnambiguousDate(row.collectionDateRaw);
  row.failedOn = parseUnambiguousDate(row.failedAtRaw);
  row.processedOn = parseUnambiguousDate(row.processedAtRaw);
  row.bankReceivedOn = parseUnambiguousDate(row.bankReceivedAtRaw);
  row.reconciledStatus = mapStatus(row.statusRaw);
  row.matchCategory = resolveCategory({
    status: row.reconciledStatus,
    explicitCategory: explicit,
    caseCodes: row.caseCodes,
    customerKnown: Boolean(row.accountKey || row.occtaRef || row.linkedAccountNumber || row.customerName) && row.reconciledStatus !== "unallocated",
  });
}

/** Incoming blanks never erase a stored payment value. A non-empty incoming value still replaces it. */
function mergePayment(prior: PaymentRow | null, incoming: PaymentRow, explicit: string | null): PaymentRow {
  if (!prior) {
    recomputePayment(incoming, explicit);
    return incoming;
  }
  const merged: PaymentRow = {
    ...incoming,
    eventKey: prior.eventKey,
    accountKey: keepText(incoming.accountKey, prior.accountKey),
    customerName: keepText(incoming.customerName, prior.customerName),
    payerName: keepText(incoming.payerName, prior.payerName),
    bankPayerName: keepText(incoming.bankPayerName, prior.bankPayerName),
    nameAliases: incoming.nameAliases.length ? incoming.nameAliases : prior.nameAliases,
    occtaRef: keepText(incoming.occtaRef, prior.occtaRef),
    paymentRef: keepText(incoming.paymentRef, prior.paymentRef),
    mandateRef: keepText(incoming.mandateRef, prior.mandateRef),
    invoiceNumber: keepText(incoming.invoiceNumber, prior.invoiceNumber),
    method: keepText(incoming.method, prior.method),
    occtaMethod: keepText(incoming.occtaMethod, prior.occtaMethod),
    amount: keepNum(incoming.amount, prior.amount),
    chargeKind: keepText(incoming.chargeKind, prior.chargeKind),
    submittedAtRaw: keepText(incoming.submittedAtRaw, prior.submittedAtRaw),
    collectionDateRaw: keepText(incoming.collectionDateRaw, prior.collectionDateRaw),
    failedAtRaw: keepText(incoming.failedAtRaw, prior.failedAtRaw),
    failureReason: keepText(incoming.failureReason, prior.failureReason),
    failureTreatment: keepText(incoming.failureTreatment, prior.failureTreatment),
    processedAtRaw: keepText(incoming.processedAtRaw, prior.processedAtRaw),
    payoutRef: keepText(incoming.payoutRef, prior.payoutRef),
    bankReceivedAtRaw: keepText(incoming.bankReceivedAtRaw, prior.bankReceivedAtRaw),
    bankDescription: keepText(incoming.bankDescription, prior.bankDescription),
    statusRaw: keepText(incoming.statusRaw, prior.statusRaw),
    caseCodes: [...new Set([...prior.caseCodes, ...incoming.caseCodes])],
    balanceAfter: keepNum(incoming.balanceAfter, prior.balanceAfter),
    occtaRecorded: incoming.occtaRecorded == null ? prior.occtaRecorded : incoming.occtaRecorded,
    linkedAccountNumber: keepText(incoming.linkedAccountNumber, prior.linkedAccountNumber),
    linkedInvoiceNumber: keepText(incoming.linkedInvoiceNumber, prior.linkedInvoiceNumber),
  };
  recomputePayment(merged, explicit);
  return merged;
}

function isFailureAttempt(payment: PaymentRow): boolean {
  return payment.reconciledStatus === "failed" || (Boolean(payment.failedAtRaw) && payment.reconciledStatus !== "paid");
}

function isSuccessfulCollection(payment: PaymentRow): boolean {
  if (payment.matchCategory === "genuine_unmatched" || payment.reconciledStatus === "genuine_unmatched") return false;
  if (isFailureAttempt(payment)) return false;
  return payment.reconciledStatus === "paid" || Boolean(payment.processedAtRaw || payment.bankReceivedAtRaw);
}

function sameCustomerPayment(a: PaymentRow, b: PaymentRow): boolean {
  if (a.accountKey && b.accountKey && a.accountKey === b.accountKey) return true;
  if (a.occtaRef && b.occtaRef && normaliseRef(a.occtaRef) === normaliseRef(b.occtaRef)) return true;
  const left = normaliseMatchText(a.customerName);
  const right = normaliseMatchText(b.customerName);
  return Boolean(left && left === right);
}

function sameCharge(failure: PaymentRow, success: PaymentRow): boolean {
  const invA = normaliseRef(failure.invoiceNumber || failure.linkedInvoiceNumber);
  const invB = normaliseRef(success.invoiceNumber || success.linkedInvoiceNumber);
  if (invA && invB && invA === invB) return true;
  const manA = normaliseRef(failure.mandateRef);
  const manB = normaliseRef(success.mandateRef);
  return Boolean(manA && manB && manA === manB && amountsEqual(failure.amount, success.amount));
}

function successNotBeforeFailure(success: PaymentRow, failure: PaymentRow): boolean {
  const successOn = success.collectionOn || success.processedOn || success.bankReceivedOn || success.submittedOn;
  const failureOn = failure.failedOn || failure.collectionOn || failure.submittedOn;
  if (successOn && failureOn) return successOn >= failureOn;
  return true;
}

export function settleRetriedFailures(state: ReconState): void {
  for (const failure of state.payments) {
    if (!isFailureAttempt(failure)) continue;
    const resolved = state.payments.some((other) => other.eventKey !== failure.eventKey && isSuccessfulCollection(other) && sameCustomerPayment(failure, other) && sameCharge(failure, other) && successNotBeforeFailure(other, failure));
    if (!resolved) continue;
    failure.matchCategory = "matched";
    if (!failure.caseCodes.includes("failed_attempt_resolved")) failure.caseCodes.push("failed_attempt_resolved");
  }
  for (const account of state.accounts) {
    const payments = state.payments.filter((payment) => payment.accountKey === account.rowKey || (account.occtaRef && payment.occtaRef === account.occtaRef));
    const failures = payments.filter((payment) => isFailureAttempt(payment));
    if (!failures.length || !failures.every((payment) => payment.caseCodes.includes("failed_attempt_resolved"))) continue;
    const blocking = account.caseCodes.filter((code) => code !== "failed_attempt_existing_charge" && code !== "failed_attempt_resolved");
    if (blocking.length || account.matchCategory !== "discrepancy") continue;
    account.matchCategory = "matched";
    if (!account.caseCodes.includes("failed_attempt_resolved")) account.caseCodes.push("failed_attempt_resolved");
  }
}

export async function importPaymentEvents(previous: ReconState, meta: ImportMeta): Promise<ImportResult> {
  const state = clone(previous);
  const table = parseCsv(meta.csvText);
  if (table.length < 2) return { state: previous, errors: ["The payment events file has no data rows."], warnings: [], rowCount: 0 };
  const { index, unknown } = indexHeaders(table[0]);
  const missing = requireHeaders(index, [
    "customer", "occta_ref", "payment_ref", "method", "amount", "submitted_at", "collection_date", "failed_at",
    "failure_reason", "processed_at", "payout_ref", "bank_received_at", "bank_description", "status",
  ], "Payment events file");
  if (missing) return { state: previous, errors: [missing], warnings: [], rowCount: 0 };
  const warnings = unknown.filter(Boolean).map((column) => `Ignored unknown column "${column}".`);
  const hash = await sha256Hex(normaliseCsvText(meta.csvText));
  let count = 0;
  for (const raw of table.slice(1)) {
    const paymentRef = blank(cell(raw, index, "payment_ref"));
    const prior = paymentRef ? state.payments.find((payment) => payment.paymentRef === paymentRef.trim().toUpperCase()) ?? null : null;
    const aliases = splitList(cell(raw, index, "name_aliases"));
    const bankPayer = blank(cell(raw, index, "bank_payer_name"));
    if (bankPayer) aliases.push(bankPayer);
    const ref = blank(cell(raw, index, "occta_ref"));
    const explicitCategory = blank(cell(raw, index, "match_category"));
    const built = mergePayment(prior, await assignEventKey(paymentFromParts({
      customer: cell(raw, index, "customer"),
      ref,
      payerName: blank(cell(raw, index, "payer_name")),
      bankPayerName: bankPayer,
      aliases,
      paymentRef,
      mandateRef: blank(cell(raw, index, "mandate_ref")),
      invoiceNumber: blank(cell(raw, index, "invoice_number")),
      method: blank(cell(raw, index, "method")),
      occtaMethod: blank(cell(raw, index, "occta_method")),
      amount: parseAmount(cell(raw, index, "amount")),
      chargeKind: blank(cell(raw, index, "charge_kind")),
      submittedRaw: blank(cell(raw, index, "submitted_at")),
      collectionRaw: blank(cell(raw, index, "collection_date")),
      failedRaw: blank(cell(raw, index, "failed_at")),
      failureReason: blank(cell(raw, index, "failure_reason")),
      failureTreatment: blank(cell(raw, index, "failure_treatment")),
      processedRaw: blank(cell(raw, index, "processed_at")),
      payoutRef: blank(cell(raw, index, "payout_ref")),
      bankRaw: blank(cell(raw, index, "bank_received_at")),
      bankDescription: blank(cell(raw, index, "bank_description")),
      statusRaw: blank(cell(raw, index, "status")),
      explicitCategory,
      casesRaw: blank(cell(raw, index, "cases")),
      balanceAfter: parseAmount(cell(raw, index, "balance_after")),
      occtaRecorded: parseBool(cell(raw, index, "occta_recorded")),
      accountKey: findAccountKey(state, ref, cell(raw, index, "customer"), aliases) ?? prior?.accountKey ?? null,
      prior,
    })), explicitCategory);
    trackPaymentChanges(state, prior, built, meta, hash, meta.importedAt);
    upsertPayment(state, built);
    count++;
  }
  if (!count) return { state: previous, errors: ["No payment event rows were found."], warnings, rowCount: 0 };
  settleRetriedFailures(state);
  rememberImport(state, meta, "payment_events", hash, count);
  return { state, errors: [], warnings, rowCount: count };
}

export async function importAccessPayDaily(previous: ReconState, meta: ImportMeta): Promise<ImportResult> {
  const state = clone(previous);
  const table = parseCsv(meta.csvText);
  if (table.length < 2) return { state: previous, errors: ["The AccessPay file has no data rows."], warnings: [], rowCount: 0 };
  const { index, unknown } = indexHeaders(table[0]);
  const missing = requireHeaders(index, [
    "record_type", "customer", "occta_ref", "payer_name", "name_aliases", "payment_ref", "mandate_ref", "invoice_number",
    "method", "amount", "submitted_at", "collection_date", "failed_at", "failure_reason", "processed_at", "payout_ref",
    "fee_amount", "status", "accesspay_status", "mandate_status", "mandate_created_at", "mandate_submitted_at",
    "mandate_cancelled_at", "is_test", "is_duplicate", "never_submitted", "charge_kind", "failure_treatment",
  ], "AccessPay daily file");
  if (missing) return { state: previous, errors: [missing], warnings: [], rowCount: 0 };
  const warnings = unknown.filter(Boolean).map((column) => `Ignored unknown column "${column}".`);
  const hash = await sha256Hex(normaliseCsvText(meta.csvText));
  let count = 0;
  for (const raw of table.slice(1)) {
    const recordType = cell(raw, index, "record_type").toLowerCase();
    if (!recordType) {
      warnings.push("Skipped an AccessPay row with no record_type.");
      continue;
    }
    if (recordType === "mandate") {
      const mandateRef = blank(cell(raw, index, "mandate_ref"));
      const mandateKey = mandateRef ? `man:${mandateRef.toUpperCase()}` : `man:${await sha256Hex(raw.join("|"))}`;
      const prior = state.mandates.find((mandate) => mandate.mandateKey === mandateKey) ?? null;
      const ref = blank(cell(raw, index, "occta_ref"));
      const aliases = splitList(cell(raw, index, "name_aliases"));
      const next: MandateRow = {
        mandateKey,
        accountKey: findAccountKey(state, ref, cell(raw, index, "customer"), aliases),
        customerName: blank(cell(raw, index, "customer")),
        occtaRef: ref ? normaliseRef(ref) : null,
        payerName: blank(cell(raw, index, "payer_name")),
        mandateReference: mandateRef,
        status: blank(cell(raw, index, "mandate_status")) ?? blank(cell(raw, index, "status")),
        accesspayStatus: blank(cell(raw, index, "accesspay_status")),
        createdRaw: blank(cell(raw, index, "mandate_created_at")),
        createdOn: parseUnambiguousDate(cell(raw, index, "mandate_created_at")),
        submittedRaw: blank(cell(raw, index, "mandate_submitted_at")),
        submittedOn: parseUnambiguousDate(cell(raw, index, "mandate_submitted_at")),
        cancelledRaw: blank(cell(raw, index, "mandate_cancelled_at")),
        cancelledOn: parseUnambiguousDate(cell(raw, index, "mandate_cancelled_at")),
        isTest: parseBool(cell(raw, index, "is_test")) === true,
        isDuplicate: parseBool(cell(raw, index, "is_duplicate")) === true,
        neverSubmitted: parseBool(cell(raw, index, "never_submitted")) === true,
        linkedAccountNumber: prior?.linkedAccountNumber ?? null,
      };
      pushTimeline(state, {
        subjectType: "mandate",
        subjectKey: mandateKey,
        fieldName: "status",
        previousValue: prior?.status ?? null,
        newValue: next.status,
        recordedAt: meta.importedAt,
        fileKind: "accesspay_daily",
        fileSha: hash,
        note: prior ? "Mandate status change" : "Mandate imported",
      });
      const at = state.mandates.findIndex((mandate) => mandate.mandateKey === mandateKey);
      if (at >= 0) state.mandates[at] = next;
      else state.mandates.push(next);
      count++;
      continue;
    }
    if (recordType === "payout") {
      const payoutRef = blank(cell(raw, index, "payout_ref"));
      if (!payoutRef) {
        warnings.push("Skipped a payout row with no payout_ref.");
        continue;
      }
      const key = payoutRef.toUpperCase();
      const prior = state.payouts.find((payout) => payout.payoutRef === key) ?? null;
      const next: PayoutRow = {
        payoutRef: key,
        amount: parseAmount(cell(raw, index, "amount")),
        feeAmount: parseAmount(cell(raw, index, "fee_amount")),
        bankAmount: prior?.bankAmount ?? null,
        processedRaw: blank(cell(raw, index, "processed_at")),
        processedOn: parseUnambiguousDate(cell(raw, index, "processed_at")),
        bankDateRaw: prior?.bankDateRaw ?? null,
        bankOn: prior?.bankOn ?? null,
        bankDescription: prior?.bankDescription ?? null,
        matchCategory: prior?.bankAmount != null ? "matched" : "unlinked",
      };
      const at = state.payouts.findIndex((payout) => payout.payoutRef === key);
      if (at >= 0) state.payouts[at] = next;
      else state.payouts.push(next);
      count++;
      continue;
    }
    if (["collection", "failure", "payment"].includes(recordType)) {
      const paymentRef = blank(cell(raw, index, "payment_ref"));
      const prior = paymentRef ? state.payments.find((payment) => payment.paymentRef === paymentRef.trim().toUpperCase()) ?? null : null;
      const aliases = splitList(cell(raw, index, "name_aliases"));
      const ref = blank(cell(raw, index, "occta_ref"));
      const statusRaw = blank(cell(raw, index, "status")) ?? (recordType === "failure" ? "Failed" : null);
      const built = mergePayment(prior, await assignEventKey(paymentFromParts({
        customer: cell(raw, index, "customer"),
        ref,
        payerName: blank(cell(raw, index, "payer_name")),
        bankPayerName: null,
        aliases,
        paymentRef,
        mandateRef: blank(cell(raw, index, "mandate_ref")),
        invoiceNumber: blank(cell(raw, index, "invoice_number")),
        method: blank(cell(raw, index, "method")),
        occtaMethod: null,
        amount: parseAmount(cell(raw, index, "amount")),
        chargeKind: blank(cell(raw, index, "charge_kind")),
        submittedRaw: blank(cell(raw, index, "submitted_at")),
        collectionRaw: blank(cell(raw, index, "collection_date")),
        failedRaw: blank(cell(raw, index, "failed_at")),
        failureReason: blank(cell(raw, index, "failure_reason")),
        failureTreatment: blank(cell(raw, index, "failure_treatment")),
        processedRaw: blank(cell(raw, index, "processed_at")),
        payoutRef: blank(cell(raw, index, "payout_ref")),
        bankRaw: null,
        bankDescription: null,
        statusRaw,
        explicitCategory: null,
        casesRaw: null,
        balanceAfter: null,
        occtaRecorded: null,
        accountKey: findAccountKey(state, ref, cell(raw, index, "customer"), aliases) ?? prior?.accountKey ?? null,
        prior,
      })), null);
      trackPaymentChanges(state, prior, built, meta, hash, meta.importedAt);
      upsertPayment(state, built);
      count++;
      continue;
    }
    warnings.push(`Skipped unsupported AccessPay record_type "${recordType}".`);
  }
  if (!count) return { state: previous, errors: ["No AccessPay rows were imported."], warnings, rowCount: 0 };
  settleRetriedFailures(state);
  rememberImport(state, meta, "accesspay_daily", hash, count);
  return { state, errors: [], warnings, rowCount: count };
}

export async function importBankStatement(previous: ReconState, meta: ImportMeta): Promise<ImportResult> {
  const state = clone(previous);
  const table = parseCsv(meta.csvText);
  if (table.length < 2) return { state: previous, errors: ["The bank statement file has no data rows."], warnings: [], rowCount: 0 };
  const { index, unknown } = indexHeaders(table[0]);
  const missing = requireHeaders(index, ["bank_date", "amount", "description", "payer_name", "reference", "payout_ref"], "Bank statement file");
  if (missing) return { state: previous, errors: [missing], warnings: [], rowCount: 0 };
  const warnings = unknown.filter(Boolean).map((column) => `Ignored unknown column "${column}".`);
  const hash = await sha256Hex(normaliseCsvText(meta.csvText));
  let count = 0;
  for (const raw of table.slice(1)) {
    const bankDateRaw = blank(cell(raw, index, "bank_date"));
    const amount = parseAmount(cell(raw, index, "amount"));
    const description = blank(cell(raw, index, "description"));
    const payerName = blank(cell(raw, index, "payer_name"));
    const reference = blank(cell(raw, index, "reference"));
    const payoutRef = blank(cell(raw, index, "payout_ref"));
    const lineKey = `bank:${await sha256Hex([bankDateRaw, amount, description, reference, payoutRef].map((value) => value ?? "").join("|"))}`;
    const prior = state.bankLines.find((line) => line.lineKey === lineKey) ?? null;
    const matched = matchBankLine({ bankOn: parseUnambiguousDate(bankDateRaw), amount, description, payerName, reference, payoutRef: payoutRef ? payoutRef.toUpperCase() : null }, state);
    const category = prior?.linkedAccountNumber ? "matched" : matched.category;
    const line: BankLine = {
      lineKey,
      bankDateRaw,
      bankOn: parseUnambiguousDate(bankDateRaw),
      amount,
      description,
      payerName,
      reference,
      payoutRef: payoutRef ? payoutRef.toUpperCase() : null,
      matchCategory: category,
      matchedAccountKey: matched.accountKey,
      matchedPaymentRef: matched.paymentRef,
      matchedPayoutRef: matched.payoutRef,
      linkedAccountNumber: prior?.linkedAccountNumber ?? null,
      linkedInvoiceNumber: prior?.linkedInvoiceNumber ?? null,
    };
    if (line.matchedPayoutRef) {
      const payout = state.payouts.find((item) => item.payoutRef === line.matchedPayoutRef);
      if (payout) {
        payout.bankAmount = line.amount;
        payout.bankDateRaw = line.bankDateRaw;
        payout.bankOn = line.bankOn;
        payout.bankDescription = line.description;
        payout.matchCategory = "matched";
      }
    }
    const at = state.bankLines.findIndex((item) => item.lineKey === lineKey);
    if (at >= 0) state.bankLines[at] = line;
    else state.bankLines.push(line);
    count++;
  }
  if (!count) return { state: previous, errors: ["No bank lines were found."], warnings, rowCount: 0 };
  rememberImport(state, meta, "bank_statement", hash, count);
  return { state, errors: [], warnings, rowCount: count };
}

function matchBankLine(line: { bankOn: string | null; amount: number | null; description: string | null; payerName: string | null; reference: string | null; payoutRef: string | null }, state: ReconState): { category: MatchCategory; accountKey: string | null; paymentRef: string | null; payoutRef: string | null } {
  const payoutRef = line.payoutRef
    || state.payouts.find((payout) => line.reference && payout.payoutRef === line.reference.toUpperCase())?.payoutRef
    || state.payouts.find((payout) => line.description && line.description.toUpperCase().includes(payout.payoutRef))?.payoutRef
    || null;
  if (payoutRef) {
    const payments = state.payments.filter((payment) => payment.payoutRef === payoutRef);
    const accountKeys = [...new Set(payments.map((payment) => payment.accountKey).filter((key): key is string => Boolean(key)))];
    return {
      category: "matched",
      accountKey: accountKeys.length === 1 ? accountKeys[0] : null,
      paymentRef: payments.length === 1 ? payments[0].paymentRef : null,
      payoutRef,
    };
  }
  if (looksLikeAccessPayCredit(line.description)) {
    const sameAmount = state.payouts.filter((payout) => amountsEqual(payout.amount, line.amount) && payout.bankAmount == null);
    if (sameAmount.length === 1) {
      return { category: "matched", accountKey: null, paymentRef: null, payoutRef: sameAmount[0].payoutRef };
    }
  }
  const namedAccounts = state.accounts.filter((account) => textHitsNames(line.payerName, accountNames(account)) || textHitsNames(line.description, accountNames(account)));
  const dated = state.payments.filter((payment) => amountsEqual(payment.amount, line.amount) && [payment.collectionOn, payment.processedOn, payment.bankReceivedOn, payment.submittedOn].includes(line.bankOn));
  let pool = dated;
  if (namedAccounts.length === 1) {
    const narrowed = dated.filter((payment) => payment.accountKey === namedAccounts[0].rowKey || normaliseRef(payment.occtaRef) === normaliseRef(namedAccounts[0].occtaRef));
    if (narrowed.length) pool = narrowed;
  }
  if (pool.length === 1) {
    return { category: "matched", accountKey: pool[0].accountKey ?? namedAccounts[0]?.rowKey ?? null, paymentRef: pool[0].paymentRef, payoutRef: pool[0].payoutRef };
  }
  if (namedAccounts.length === 1) {
    return { category: "matched", accountKey: namedAccounts[0].rowKey, paymentRef: null, payoutRef: null };
  }
  return { category: "unlinked", accountKey: null, paymentRef: null, payoutRef: null };
}

export function linkSubject(previous: ReconState, input: {
  subjectType: "account" | "payment" | "bank" | "mandate";
  subjectKey: string;
  accountNumber: string | null;
  invoiceNumber: string | null;
  actorId: string | null;
  actorEmail: string | null;
  at: string;
}): ReconState {
  const state = clone(previous);
  const accountNumber = input.accountNumber ? normaliseRef(input.accountNumber) : null;
  const invoiceNumber = input.invoiceNumber?.trim() || null;
  if (input.subjectType === "account") {
    const row = state.accounts.find((account) => account.rowKey === input.subjectKey);
    if (!row) return previous;
    row.linkedAccountNumber = accountNumber;
    row.linkedInvoiceNumber = invoiceNumber ?? row.linkedInvoiceNumber;
    if (accountNumber && row.matchCategory !== "genuine_unmatched") row.matchCategory = "matched";
  } else if (input.subjectType === "payment") {
    const row = state.payments.find((payment) => payment.eventKey === input.subjectKey);
    if (!row) return previous;
    row.linkedAccountNumber = accountNumber;
    row.linkedInvoiceNumber = invoiceNumber ?? row.linkedInvoiceNumber;
    if (accountNumber && row.matchCategory !== "genuine_unmatched") row.matchCategory = "matched";
  } else if (input.subjectType === "bank") {
    const row = state.bankLines.find((line) => line.lineKey === input.subjectKey);
    if (!row) return previous;
    row.linkedAccountNumber = accountNumber;
    row.linkedInvoiceNumber = invoiceNumber;
    if (accountNumber) row.matchCategory = "matched";
  } else {
    const row = state.mandates.find((mandate) => mandate.mandateKey === input.subjectKey);
    if (!row) return previous;
    row.linkedAccountNumber = accountNumber;
  }
  state.audit.push({
    auditKey: `audit:${input.at}:${input.subjectType}:${input.subjectKey}:${accountNumber ?? ""}:${invoiceNumber ?? ""}`,
    createdAt: input.at,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: "link_to_customer",
    subjectType: input.subjectType,
    subjectKey: input.subjectKey,
    accountNumber,
    invoiceNumber,
    detail: "Manual link. Does not change invoices, payments or allocations.",
  });
  return state;
}

export function markDraftDue(previous: ReconState, input: { rowKey: string; at: string; actorId: string | null; actorEmail: string | null }): ReconState {
  const state = clone(previous);
  const row = state.accounts.find((account) => account.rowKey === input.rowKey);
  if (!row) return previous;
  row.draftMarkedDueAt = input.at;
  state.audit.push({
    auditKey: `audit:draft:${input.rowKey}:${input.at}`,
    createdAt: input.at,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: "mark_draft_due_no_email",
    subjectType: "account",
    subjectKey: input.rowKey,
    accountNumber: row.linkedAccountNumber ?? row.occtaRef,
    invoiceNumber: row.linkedInvoiceNumber,
    detail: "Marked the draft as due on the reconciliation row only. No invoice was changed and no email was sent.",
  });
  return state;
}

export interface ProfileRef {
  id: string;
  account_number: string | null;
  full_name: string | null;
}

export function matchAccountToProfile(account: AccountRow, profiles: ProfileRef[]): { accountNumber: string | null; profileId: string | null; how: "manual" | "ref" | "name" | "payer" | null } {
  const linked = normaliseRef(account.linkedAccountNumber);
  if (linked) {
    const profile = profiles.find((item) => normaliseRef(item.account_number) === linked);
    return { accountNumber: linked, profileId: profile?.id ?? null, how: "manual" };
  }
  const ref = normaliseRef(account.occtaRef);
  if (ref) {
    const profile = profiles.find((item) => normaliseRef(item.account_number) === ref);
    if (profile) return { accountNumber: normaliseRef(profile.account_number), profileId: profile.id, how: "ref" };
    return { accountNumber: null, profileId: null, how: null };
  }
  const names = accountNames(account).map(normaliseMatchText).filter(Boolean);
  const hits = profiles.filter((profile) => names.includes(normaliseMatchText(profile.full_name)) && normaliseRef(profile.account_number));
  const unique = [...new Map(hits.map((profile) => [profile.id, profile])).values()];
  if (unique.length === 1) {
    const how = normaliseMatchText(unique[0].full_name) === normaliseMatchText(account.customerName) ? "name" : "payer";
    return { accountNumber: normaliseRef(unique[0].account_number), profileId: unique[0].id, how };
  }
  return { accountNumber: null, profileId: null, how: null };
}

export function accountBelongsToCustomer(account: AccountRow, customer: { accountNumber: string | null; fullName: string | null }, profiles: ProfileRef[]): boolean {
  const accountNumber = normaliseRef(customer.accountNumber);
  if (accountNumber && (normaliseRef(account.linkedAccountNumber) === accountNumber || normaliseRef(account.occtaRef) === accountNumber)) return true;
  if (normaliseRef(account.occtaRef) || normaliseRef(account.linkedAccountNumber)) return false;
  const match = matchAccountToProfile(account, profiles);
  return Boolean(accountNumber && match.accountNumber === accountNumber);
}

export interface ReconSummary {
  collected: number;
  failedAttempts: number;
  failedExtraDebt: number;
  outstanding: number;
  unlinked: number;
  genuineReceived: number;
  discrepancyCount: number;
  matchedCount: number;
}

function paymentWasReceived(payment: PaymentRow): boolean {
  if (payment.matchCategory === "unlinked") return false;
  if (payment.matchCategory === "genuine_unmatched" || payment.reconciledStatus === "genuine_unmatched") return true;
  if (isFailureAttempt(payment)) return false;
  if (payment.reconciledStatus === "paid") return true;
  return Boolean(payment.processedAtRaw || payment.bankReceivedAtRaw);
}

export function summarise(state: ReconState): ReconSummary {
  let collected = 0;
  let failedAttempts = 0;
  let failedExtraDebt = 0;
  let outstanding = 0;
  let unlinked = 0;
  let genuineReceived = 0;
  let discrepancyCount = 0;
  let matchedCount = 0;
  const received = state.payments.filter(paymentWasReceived);
  collected = received.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
  const countedPayouts = new Set(received.map((payment) => payment.payoutRef).filter((ref): ref is string => Boolean(ref)));
  const countedPaymentRefs = new Set(received.map((payment) => payment.paymentRef).filter((ref): ref is string => Boolean(ref)));
  const genuinePaymentNames = new Set(
    state.payments.filter((payment) => payment.matchCategory === "genuine_unmatched").map((payment) => normaliseMatchText(payment.customerName)),
  );
  for (const account of state.accounts) {
    if (account.matchCategory === "genuine_unmatched") {
      if (!genuinePaymentNames.has(normaliseMatchText(account.customerName))) {
        genuineReceived += extractAmount(account.lastPaymentReceived) ?? account.amountDue ?? 0;
      }
    } else if ((account.balanceOutstanding ?? 0) > 0 && account.reconciledStatus !== "closed") {
      outstanding += account.balanceOutstanding ?? 0;
    }
    if (account.matchCategory === "unlinked") unlinked += extractAmount(account.lastPaymentReceived) ?? account.amountDue ?? 0;
    if (account.matchCategory === "discrepancy") discrepancyCount++;
    if (account.matchCategory === "matched") matchedCount++;
  }
  for (const payment of state.payments) {
    if (payment.matchCategory === "genuine_unmatched") genuineReceived += payment.amount ?? 0;
    if (payment.reconciledStatus === "failed" || payment.failedAtRaw) {
      failedAttempts += payment.amount ?? 0;
      const resolved = payment.caseCodes.includes("failed_attempt_resolved");
      if (!resolved && !/existing/i.test(payment.failureTreatment ?? "") && !payment.caseCodes.includes("failed_attempt_existing_charge")) {
        failedExtraDebt += payment.amount ?? 0;
      }
    }
    if (payment.matchCategory === "unlinked") unlinked += payment.amount ?? 0;
    if (payment.matchCategory === "discrepancy") discrepancyCount++;
  }
  for (const line of state.bankLines) {
    if (line.matchCategory === "unlinked") unlinked += line.amount ?? 0;
    if (line.matchCategory === "genuine_unmatched") genuineReceived += line.amount ?? 0;
    if (line.matchCategory === "discrepancy") discrepancyCount++;
    if (line.matchCategory === "matched" || line.matchCategory === "genuine_unmatched") {
      const batch = line.matchedPayoutRef || line.payoutRef;
      const alreadyCounted = (batch != null && countedPayouts.has(batch)) || (line.matchedPaymentRef != null && countedPaymentRefs.has(line.matchedPaymentRef));
      if (!alreadyCounted) collected += line.amount ?? 0;
    }
  }
  return { collected, failedAttempts, failedExtraDebt, outstanding, unlinked, genuineReceived, discrepancyCount, matchedCount };
}

export function bankLinesForAccount(account: AccountRow, state: ReconState): BankLine[] {
  const payouts = new Set(
    state.payments
      .filter((payment) => payment.accountKey === account.rowKey || (account.occtaRef && payment.occtaRef === account.occtaRef))
      .map((payment) => payment.payoutRef)
      .filter((ref): ref is string => Boolean(ref)),
  );
  return state.bankLines.filter((line) => {
    const batch = line.matchedPayoutRef || line.payoutRef;
    if (batch && payouts.has(batch)) return true;
    if (batch) return false;
    if (line.matchedAccountKey === account.rowKey) return true;
    if (line.linkedAccountNumber && (normaliseRef(line.linkedAccountNumber) === normaliseRef(account.occtaRef) || normaliseRef(line.linkedAccountNumber) === normaliseRef(account.linkedAccountNumber))) return true;
    return textHitsNames(line.payerName, accountNames(account)) || textHitsNames(line.description, accountNames(account));
  });
}

export function itemsInCategory(state: ReconState, category: MatchCategory): Array<{ kind: string; key: string; title: string; amount: number | null; category: MatchCategory }> {
  return [
    ...state.accounts.filter((account) => account.matchCategory === category).map((account) => ({
      kind: "account", key: account.rowKey, title: account.customerName, amount: account.balanceOutstanding, category,
    })),
    ...state.payments.filter((payment) => payment.matchCategory === category).map((payment) => ({
      kind: "payment", key: payment.eventKey, title: payment.customerName || payment.paymentRef || "Payment", amount: payment.amount, category,
    })),
    ...state.bankLines.filter((line) => line.matchCategory === category).map((line) => ({
      kind: "bank", key: line.lineKey, title: line.payerName || line.description || "Bank line", amount: line.amount, category,
    })),
  ];
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function str(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}
function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export function accountToDb(row: AccountRow): Record<string, unknown> {
  return {
    row_key: row.rowKey, customer_name: row.customerName, payer_name: row.payerName, bank_payer_name: row.bankPayerName,
    name_aliases: row.nameAliases, occta_ref: row.occtaRef, method: row.method, occta_method: row.occtaMethod,
    amount_due: row.amountDue, due_date_raw: row.dueDateRaw, due_on: row.dueOn, last_payment_received: row.lastPaymentReceived,
    seen_in: row.seenIn, status_raw: row.statusRaw, reconciled_status: row.reconciledStatus, match_category: row.matchCategory,
    case_codes: row.caseCodes, balance_outstanding: row.balanceOutstanding, balance_kind: row.balanceKind,
    invoiced_amount: row.invoicedAmount, uninvoiced_amount: row.uninvoicedAmount, next_action: row.nextAction,
    accesspay_status: row.accesspayStatus, occta_mandate_status: row.occtaMandateStatus, dd_status: row.ddStatus,
    last_dd_date_raw: row.lastDdDateRaw, last_dd_on: row.lastDdOn, last_dd_amount: row.lastDdAmount, last_dd_result: row.lastDdResult,
    failure_treatment: row.failureTreatment, next_dd_date_raw: row.nextDdDateRaw, next_dd_on: row.nextDdOn, next_dd_amount: row.nextDdAmount,
    bank_payments: row.bankPayments, matched_payout: row.matchedPayout, invoice_balance: row.invoiceBalance, invoice_state: row.invoiceState,
    occta_recorded: row.occtaRecorded, notes: row.notes, linked_account_number: row.linkedAccountNumber,
    linked_invoice_number: row.linkedInvoiceNumber, draft_marked_due_at: row.draftMarkedDueAt, updated_at: new Date().toISOString(),
  };
}
export function accountFromDb(row: Record<string, unknown>): AccountRow {
  return {
    rowKey: String(row.row_key), customerName: String(row.customer_name ?? ""), payerName: str(row.payer_name),
    bankPayerName: str(row.bank_payer_name), nameAliases: list(row.name_aliases), occtaRef: str(row.occta_ref),
    method: str(row.method), occtaMethod: str(row.occta_method), amountDue: num(row.amount_due), dueDateRaw: str(row.due_date_raw),
    dueOn: str(row.due_on), lastPaymentReceived: str(row.last_payment_received), seenIn: str(row.seen_in), statusRaw: str(row.status_raw),
    reconciledStatus: (str(row.reconciled_status) ?? "pending") as ReconStatus, matchCategory: (str(row.match_category) ?? "unlinked") as MatchCategory,
    caseCodes: list(row.case_codes), balanceOutstanding: num(row.balance_outstanding), balanceKind: str(row.balance_kind),
    invoicedAmount: num(row.invoiced_amount), uninvoicedAmount: num(row.uninvoiced_amount), nextAction: str(row.next_action),
    accesspayStatus: str(row.accesspay_status), occtaMandateStatus: str(row.occta_mandate_status), ddStatus: str(row.dd_status),
    lastDdDateRaw: str(row.last_dd_date_raw), lastDdOn: str(row.last_dd_on), lastDdAmount: num(row.last_dd_amount), lastDdResult: str(row.last_dd_result),
    failureTreatment: str(row.failure_treatment), nextDdDateRaw: str(row.next_dd_date_raw), nextDdOn: str(row.next_dd_on), nextDdAmount: num(row.next_dd_amount),
    bankPayments: str(row.bank_payments), matchedPayout: str(row.matched_payout), invoiceBalance: num(row.invoice_balance), invoiceState: str(row.invoice_state),
    occtaRecorded: row.occta_recorded == null ? null : Boolean(row.occta_recorded), notes: str(row.notes),
    linkedAccountNumber: str(row.linked_account_number), linkedInvoiceNumber: str(row.linked_invoice_number), draftMarkedDueAt: str(row.draft_marked_due_at),
  };
}

export function paymentToDb(row: PaymentRow): Record<string, unknown> {
  return {
    event_key: row.eventKey, account_key: row.accountKey, customer_name: row.customerName, payer_name: row.payerName,
    bank_payer_name: row.bankPayerName, name_aliases: row.nameAliases, occta_ref: row.occtaRef, payment_ref: row.paymentRef,
    mandate_ref: row.mandateRef, invoice_number: row.invoiceNumber, method: row.method, occta_method: row.occtaMethod, amount: row.amount, charge_kind: row.chargeKind,
    submitted_at_raw: row.submittedAtRaw, submitted_on: row.submittedOn, collection_date_raw: row.collectionDateRaw, collection_on: row.collectionOn,
    failed_at_raw: row.failedAtRaw, failed_on: row.failedOn, failure_reason: row.failureReason, failure_treatment: row.failureTreatment,
    processed_at_raw: row.processedAtRaw, processed_on: row.processedOn, payout_ref: row.payoutRef, bank_received_at_raw: row.bankReceivedAtRaw,
    bank_received_on: row.bankReceivedOn, bank_description: row.bankDescription, status_raw: row.statusRaw, reconciled_status: row.reconciledStatus,
    match_category: row.matchCategory, case_codes: row.caseCodes, balance_after: row.balanceAfter, occta_recorded: row.occtaRecorded,
    linked_account_number: row.linkedAccountNumber, linked_invoice_number: row.linkedInvoiceNumber, updated_at: new Date().toISOString(),
  };
}
export function paymentFromDb(row: Record<string, unknown>): PaymentRow {
  return {
    eventKey: String(row.event_key), accountKey: str(row.account_key), customerName: str(row.customer_name), payerName: str(row.payer_name),
    bankPayerName: str(row.bank_payer_name), nameAliases: list(row.name_aliases), occtaRef: str(row.occta_ref), paymentRef: str(row.payment_ref),
    mandateRef: str(row.mandate_ref), invoiceNumber: str(row.invoice_number), method: str(row.method), occtaMethod: str(row.occta_method), amount: num(row.amount),
    chargeKind: str(row.charge_kind), submittedAtRaw: str(row.submitted_at_raw), submittedOn: str(row.submitted_on),
    collectionDateRaw: str(row.collection_date_raw), collectionOn: str(row.collection_on), failedAtRaw: str(row.failed_at_raw), failedOn: str(row.failed_on),
    failureReason: str(row.failure_reason), failureTreatment: str(row.failure_treatment), processedAtRaw: str(row.processed_at_raw), processedOn: str(row.processed_on),
    payoutRef: str(row.payout_ref), bankReceivedAtRaw: str(row.bank_received_at_raw), bankReceivedOn: str(row.bank_received_on),
    bankDescription: str(row.bank_description), statusRaw: str(row.status_raw), reconciledStatus: (str(row.reconciled_status) ?? "pending") as ReconStatus,
    matchCategory: (str(row.match_category) ?? "unlinked") as MatchCategory, caseCodes: list(row.case_codes), balanceAfter: num(row.balance_after),
    occtaRecorded: row.occta_recorded == null ? null : Boolean(row.occta_recorded), linkedAccountNumber: str(row.linked_account_number),
    linkedInvoiceNumber: str(row.linked_invoice_number),
  };
}

export function mandateToDb(row: MandateRow): Record<string, unknown> {
  return {
    mandate_key: row.mandateKey, account_key: row.accountKey, customer_name: row.customerName, occta_ref: row.occtaRef,
    payer_name: row.payerName, mandate_reference: row.mandateReference, status: row.status, accesspay_status: row.accesspayStatus,
    created_raw: row.createdRaw, created_on: row.createdOn, submitted_raw: row.submittedRaw, submitted_on: row.submittedOn,
    cancelled_raw: row.cancelledRaw, cancelled_on: row.cancelledOn, is_test: row.isTest, is_duplicate: row.isDuplicate,
    never_submitted: row.neverSubmitted, linked_account_number: row.linkedAccountNumber, updated_at: new Date().toISOString(),
  };
}
export function mandateFromDb(row: Record<string, unknown>): MandateRow {
  return {
    mandateKey: String(row.mandate_key), accountKey: str(row.account_key), customerName: str(row.customer_name), occtaRef: str(row.occta_ref),
    payerName: str(row.payer_name), mandateReference: str(row.mandate_reference), status: str(row.status), accesspayStatus: str(row.accesspay_status),
    createdRaw: str(row.created_raw), createdOn: str(row.created_on), submittedRaw: str(row.submitted_raw), submittedOn: str(row.submitted_on),
    cancelledRaw: str(row.cancelled_raw), cancelledOn: str(row.cancelled_on), isTest: Boolean(row.is_test), isDuplicate: Boolean(row.is_duplicate),
    neverSubmitted: Boolean(row.never_submitted), linkedAccountNumber: str(row.linked_account_number),
  };
}
export function bankToDb(row: BankLine): Record<string, unknown> {
  return {
    line_key: row.lineKey, bank_date_raw: row.bankDateRaw, bank_on: row.bankOn, amount: row.amount, description: row.description,
    payer_name: row.payerName, reference: row.reference, payout_ref: row.payoutRef, match_category: row.matchCategory,
    matched_account_key: row.matchedAccountKey, matched_payment_ref: row.matchedPaymentRef, matched_payout_ref: row.matchedPayoutRef,
    linked_account_number: row.linkedAccountNumber, linked_invoice_number: row.linkedInvoiceNumber, updated_at: new Date().toISOString(),
  };
}
export function bankFromDb(row: Record<string, unknown>): BankLine {
  return {
    lineKey: String(row.line_key), bankDateRaw: str(row.bank_date_raw), bankOn: str(row.bank_on), amount: num(row.amount),
    description: str(row.description), payerName: str(row.payer_name), reference: str(row.reference), payoutRef: str(row.payout_ref),
    matchCategory: (str(row.match_category) ?? "unlinked") as MatchCategory, matchedAccountKey: str(row.matched_account_key),
    matchedPaymentRef: str(row.matched_payment_ref), matchedPayoutRef: str(row.matched_payout_ref),
    linkedAccountNumber: str(row.linked_account_number), linkedInvoiceNumber: str(row.linked_invoice_number),
  };
}
export function payoutToDb(row: PayoutRow): Record<string, unknown> {
  return {
    payout_ref: row.payoutRef, amount: row.amount, fee_amount: row.feeAmount, bank_amount: row.bankAmount,
    processed_raw: row.processedRaw, processed_on: row.processedOn, bank_date_raw: row.bankDateRaw, bank_on: row.bankOn,
    bank_description: row.bankDescription, match_category: row.matchCategory, updated_at: new Date().toISOString(),
  };
}
export function payoutFromDb(row: Record<string, unknown>): PayoutRow {
  return {
    payoutRef: String(row.payout_ref), amount: num(row.amount), feeAmount: num(row.fee_amount), bankAmount: num(row.bank_amount),
    processedRaw: str(row.processed_raw), processedOn: str(row.processed_on), bankDateRaw: str(row.bank_date_raw), bankOn: str(row.bank_on),
    bankDescription: str(row.bank_description), matchCategory: (str(row.match_category) ?? "unlinked") as MatchCategory,
  };
}
export function timelineToDb(row: TimelineRow): Record<string, unknown> {
  return {
    timeline_key: row.timelineKey, subject_type: row.subjectType, subject_key: row.subjectKey, field_name: row.fieldName,
    previous_value: row.previousValue, new_value: row.newValue, recorded_at: row.recordedAt, file_kind: row.fileKind,
    file_sha: row.fileSha, note: row.note,
  };
}
export function timelineFromDb(row: Record<string, unknown>): TimelineRow {
  return {
    timelineKey: String(row.timeline_key), subjectType: String(row.subject_type), subjectKey: String(row.subject_key),
    fieldName: String(row.field_name), previousValue: str(row.previous_value), newValue: str(row.new_value),
    recordedAt: String(row.recorded_at), fileKind: str(row.file_kind), fileSha: str(row.file_sha), note: str(row.note),
  };
}
export function importToDb(row: ImportRecord): Record<string, unknown> {
  return {
    file_kind: row.fileKind, file_name: row.fileName, content_sha256: row.contentSha256, row_count: row.rowCount,
    imported_by: row.importedBy, imported_by_email: row.importedByEmail, first_imported_at: row.firstImportedAt,
    last_imported_at: row.lastImportedAt, import_count: row.importCount,
  };
}
export function importFromDb(row: Record<string, unknown>): ImportRecord {
  return {
    fileKind: String(row.file_kind) as FileKind, fileName: String(row.file_name ?? ""), contentSha256: String(row.content_sha256),
    rowCount: Number(row.row_count ?? 0), importedBy: str(row.imported_by), importedByEmail: str(row.imported_by_email),
    firstImportedAt: String(row.first_imported_at), lastImportedAt: String(row.last_imported_at), importCount: Number(row.import_count ?? 1),
  };
}
export function auditToDb(row: AuditRecord): Record<string, unknown> {
  return {
    audit_key: row.auditKey, created_at: row.createdAt, actor_id: row.actorId, actor_email: row.actorEmail, action: row.action,
    subject_type: row.subjectType, subject_key: row.subjectKey, account_number: row.accountNumber, invoice_number: row.invoiceNumber,
    detail: row.detail,
  };
}
export function auditFromDb(row: Record<string, unknown>): AuditRecord {
  return {
    auditKey: String(row.audit_key), createdAt: String(row.created_at), actorId: str(row.actor_id), actorEmail: str(row.actor_email),
    action: String(row.action), subjectType: String(row.subject_type), subjectKey: String(row.subject_key),
    accountNumber: str(row.account_number), invoiceNumber: str(row.invoice_number), detail: str(row.detail),
  };
}

export interface SyncPlan {
  upserts: { table: string; onConflict: string; rows: Record<string, unknown>[] }[];
  deletes: { table: string; key: string; values: string[] }[];
}

export function buildSyncPlan(previous: ReconState, next: ReconState): SyncPlan {
  const removed = (before: string[], after: string[]) => before.filter((key) => !after.includes(key));
  return {
    upserts: [
      { table: "payment_recon_accounts", onConflict: "row_key", rows: next.accounts.map(accountToDb) },
      { table: "payment_recon_payments", onConflict: "event_key", rows: next.payments.map(paymentToDb) },
      { table: "payment_recon_mandates", onConflict: "mandate_key", rows: next.mandates.map(mandateToDb) },
      { table: "payment_recon_bank_lines", onConflict: "line_key", rows: next.bankLines.map(bankToDb) },
      { table: "payment_recon_payouts", onConflict: "payout_ref", rows: next.payouts.map(payoutToDb) },
      { table: "payment_recon_timeline", onConflict: "timeline_key", rows: next.timeline.map(timelineToDb) },
      { table: "payment_recon_imports", onConflict: "file_kind,content_sha256", rows: next.imports.map(importToDb) },
      { table: "payment_recon_audit", onConflict: "audit_key", rows: next.audit.map(auditToDb) },
    ],
    deletes: [
      { table: "payment_recon_accounts", key: "row_key", values: removed(previous.accounts.map((row) => row.rowKey), next.accounts.map((row) => row.rowKey)) },
      { table: "payment_recon_payments", key: "event_key", values: removed(previous.payments.map((row) => row.eventKey), next.payments.map((row) => row.eventKey)) },
      { table: "payment_recon_mandates", key: "mandate_key", values: removed(previous.mandates.map((row) => row.mandateKey), next.mandates.map((row) => row.mandateKey)) },
      { table: "payment_recon_bank_lines", key: "line_key", values: removed(previous.bankLines.map((row) => row.lineKey), next.bankLines.map((row) => row.lineKey)) },
      { table: "payment_recon_payouts", key: "payout_ref", values: removed(previous.payouts.map((row) => row.payoutRef), next.payouts.map((row) => row.payoutRef)) },
    ],
  };
}

async function readAll(db: any, table: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await db.from(table).select("*").limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadReconState(db: any): Promise<ReconState> {
  const [accounts, payments, mandates, bankLines, payouts, timeline, imports, audit] = await Promise.all([
    readAll(db, "payment_recon_accounts"),
    readAll(db, "payment_recon_payments"),
    readAll(db, "payment_recon_mandates"),
    readAll(db, "payment_recon_bank_lines"),
    readAll(db, "payment_recon_payouts"),
    readAll(db, "payment_recon_timeline"),
    readAll(db, "payment_recon_imports"),
    readAll(db, "payment_recon_audit"),
  ]);
  const state: ReconState = {
    accounts: accounts.map(accountFromDb),
    payments: payments.map(paymentFromDb),
    mandates: mandates.map(mandateFromDb),
    bankLines: bankLines.map(bankFromDb),
    payouts: payouts.map(payoutFromDb),
    timeline: timeline.map(timelineFromDb),
    imports: imports.map(importFromDb),
    audit: audit.map(auditFromDb),
  };
  settleRetriedFailures(state);
  return state;
}

export async function executeSyncPlan(db: any, plan: SyncPlan): Promise<void> {
  for (const op of plan.upserts) {
    for (let i = 0; i < op.rows.length; i += 200) {
      const slice = op.rows.slice(i, i + 200);
      if (!slice.length) continue;
      const { error } = await db.from(op.table).upsert(slice, { onConflict: op.onConflict });
      if (error) throw new Error(error.message);
    }
  }
  for (const op of plan.deletes) {
    if (!op.values.length) continue;
    const { error } = await db.from(op.table).delete().in(op.key, op.values);
    if (error) throw new Error(error.message);
  }
}

export async function applyImport(previous: ReconState, fileKind: FileKind, meta: ImportMeta): Promise<ImportResult> {
  if (fileKind === "customer_status") return importCustomerStatus(previous, meta);
  if (fileKind === "payment_events") return importPaymentEvents(previous, meta);
  if (fileKind === "accesspay_daily") return importAccessPayDaily(previous, meta);
  return importBankStatement(previous, meta);
}
