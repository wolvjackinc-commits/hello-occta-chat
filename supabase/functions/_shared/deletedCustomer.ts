// Last-line guard: never email a customer the owner has deleted (admin_delete_customer).
// Fails open on a lookup error so a DB blip can't stop every legitimate email.
// deno-lint-ignore no-explicit-any
export async function isDeletedCustomerEmail(supabase: any, email: string | null | undefined): Promise<boolean> {
  if (!email || !email.includes("@")) return false;
  const { data, error } = await supabase.rpc("is_deleted_customer_email", { p_email: email });
  if (error) console.error("[deleted-customer-guard] lookup failed", error.message);
  return data === true;
}

// deno-lint-ignore no-explicit-any
export async function anyDeletedCustomerEmail(supabase: any, emails: (string | null | undefined)[]): Promise<boolean> {
  for (const e of emails) if (await isDeletedCustomerEmail(supabase, e)) return true;
  return false;
}
