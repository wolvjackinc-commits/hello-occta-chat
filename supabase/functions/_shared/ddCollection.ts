// Decides whether an invoice will be collected by Direct Debit or must be
// paid by bank transfer. OCCTA accepts only these two (see paymentOptions.ts).
//
// An invoice is "DD-collected" only when the customer has an active, non-test
// mandate AND the invoice is not already overdue. An overdue invoice was not
// collected, so the customer is asked to pay it by bank transfer.

// deno-lint-ignore no-explicit-any
type Client = any;

export async function hasActiveDirectDebit(supabase: Client, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("dd_mandates")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .or("is_test.is.null,is_test.eq.false")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function invoicePaymentRoute(
  supabase: Client,
  inv: { user_id?: string | null; status?: string | null },
): Promise<{ payment_method: "direct_debit" | "bank_transfer"; dd_active: boolean }> {
  const active = await hasActiveDirectDebit(supabase, inv.user_id ?? null);
  const overdue = inv.status === "overdue";
  return active
    ? { payment_method: "direct_debit", dd_active: !overdue }
    : { payment_method: "bank_transfer", dd_active: false };
}
