import { supabase } from "@/integrations/supabase/client";
import { isOutstandingInvoice } from "@/lib/dashboard/status";
import {
  applyImport,
  buildSyncPlan,
  executeSyncPlan,
  linkSubject,
  loadReconState,
  markDraftDue,
  type FileKind,
  type ImportResult,
  type ReconState,
} from "./engine";

export async function fetchReconState(): Promise<ReconState> {
  return loadReconState(supabase);
}

async function actor(): Promise<{ id: string | null; email: string | null }> {
  const { data } = await supabase.auth.getUser();
  return { id: data.user?.id ?? null, email: data.user?.email ?? null };
}

async function persist(previous: ReconState, next: ReconState): Promise<void> {
  await executeSyncPlan(supabase, buildSyncPlan(previous, next));
}

export async function importReconFile(fileKind: FileKind, fileName: string, csvText: string): Promise<ImportResult> {
  const who = await actor();
  const previous = await fetchReconState();
  const result = await applyImport(previous, fileKind, {
    csvText,
    fileName,
    importedBy: who.id,
    importedByEmail: who.email,
    importedAt: new Date().toISOString(),
  });
  if (result.errors.length) return result;
  await persist(previous, result.state);
  return result;
}

export async function linkReconSubject(input: {
  subjectType: "account" | "payment" | "bank" | "mandate";
  subjectKey: string;
  accountNumber: string | null;
  invoiceNumber: string | null;
}): Promise<void> {
  const who = await actor();
  const previous = await fetchReconState();
  const at = new Date().toISOString();
  const next = linkSubject(previous, { ...input, actorId: who.id, actorEmail: who.email, at });
  await persist(previous, next);
  await (supabase as unknown as { from: (t: string) => { insert: (r: unknown) => Promise<unknown> } }).from("audit_logs").insert({
    actor_user_id: who.id,
    action: "link",
    entity: "payment_reconciliation",
    entity_id: null,
    metadata: {
      subject_type: input.subjectType,
      subject_key: input.subjectKey,
      account_number: input.accountNumber,
      invoice_number: input.invoiceNumber,
      note: "Reconciliation link only. Invoice ledger was not changed.",
    },
  });
}

export async function markReconDraftDue(rowKey: string): Promise<void> {
  const who = await actor();
  const previous = await fetchReconState();
  const next = markDraftDue(previous, { rowKey, at: new Date().toISOString(), actorId: who.id, actorEmail: who.email });
  await persist(previous, next);
}

export async function fetchLiveInvoiceBalances(userIds: string[]): Promise<Record<string, number>> {
  const balances: Record<string, number> = {};
  if (!userIds.length) return balances;
  const { data, error } = await supabase.from("invoices").select("user_id, status, total").in("user_id", userIds);
  if (error) throw error;
  for (const invoice of data ?? []) {
    if (!isOutstandingInvoice(invoice.status)) continue;
    balances[invoice.user_id] = (balances[invoice.user_id] ?? 0) + Number(invoice.total ?? 0);
  }
  return balances;
}
