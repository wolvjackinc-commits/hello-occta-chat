/**
 * Fail-closed reconciliation gate for financial automation.
 *
 * Imports (Grok/AccessPay, bank CSV) are evidence, not permission to debit
 * or to rewrite a customer's accepted contract. A case awaiting finance
 * review must never silently become a charge or overdue reminder.
 */
export async function billingReconciliationHold(
  supabase: any,
  userId: string,
): Promise<{ held: boolean; reason: string; accountNumber?: string }> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_number")
    .eq("id", userId)
    .maybeSingle();
  const accountNumber = String(profile?.account_number ?? "").trim();
  if (profileError || !accountNumber) {
    return { held: true, reason: "account_identity_unverified" };
  }

  const { data: account, error } = await supabase
    .from("payment_recon_accounts")
    .select("occta_ref, reconciled_status, match_category, case_codes, next_action, updated_at")
    .eq("occta_ref", accountNumber)
    .maybeSingle();

  if (error || !account) {
    return { held: true, reason: "payment_reconciliation_missing", accountNumber };
  }

  // Stale reconciliation is NOT proof that nothing new was paid.
  const lastSync = account.updated_at ? new Date(account.updated_at).getTime() : NaN;
  if (!Number.isFinite(lastSync) ||
      Date.now() - lastSync > 48 * 60 * 60 * 1000) {
    return { held: true, reason: "reconciliation_not_recent", accountNumber };
  }

  const codes: string[] = Array.isArray(account.case_codes) ? account.case_codes : [];
  const blockers = new Set([
    "opening_balance_uninvoiced",
    "failed_attempt_existing_charge",
    "mandate_cancelled_occta_active",
    "bank_receipt_not_in_occta",
    "mislabeled_card_was_transfer",
    "accesspay_only_no_occta_record",
    "draft_invoice_mark_due_no_email",
    "unallocated_no_invoice",
  ]);
  if (codes.some((code) => blockers.has(code))) {
    return { held: true, reason: "open_financial_exception", accountNumber };
  }
  if (/on hold|manual hold|do not chase|do not issue|leave alone|dispute/i.test(
    String(account.next_action ?? ""),
  )) {
    return { held: true, reason: "manual_or_dispute_hold", accountNumber };
  }
  if (["discrepancy", "unlinked"].includes(String(account.match_category ?? ""))) {
    return { held: true, reason: "unresolved_payment_match", accountNumber };
  }

  return { held: false, reason: "reconciliation_clear", accountNumber };
}
