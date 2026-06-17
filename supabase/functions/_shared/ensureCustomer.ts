import { getServiceClient } from "./quoteHelpers.ts";

/**
 * Phase 2 — ensureCustomerFromAcceptedContract
 *
 * Internal helper called from `accept-contract-summary` (journey_mode only)
 * AFTER the immutable Contract Summary acceptance row has been written.
 *
 * Responsibilities (all idempotent, fail-closed):
 *   1. Normalise the customer email from the accepted CS / quote_request.
 *   2. Find an existing customer (profiles → auth.users) by email.
 *   3. If exactly one match: reuse it.
 *   4. If multiple matches: do NOT pick one — open a high-priority
 *      reconciliation task and return without linking.
 *   5. If none: create an auth user with `email_confirm=false` (the journey
 *      does NOT verify control of the email), generate a profile via the
 *      existing `handle_new_user` trigger, assign a sequence-backed
 *      `OCC########` account number, and backfill profile fields.
 *   6. Link the customer onto: order_journeys (customer_id +
 *      linked_customer_id + linked_at), contract_summaries.customer_id,
 *      contract_acceptances.customer_id / accepted_by_user, the active
 *      payment_method, and any dd_mandate already linked to that PM.
 *
 * The helper does NOT send any email and does NOT create a canonical
 * orders row — both are handled at final order submission so the customer
 * only receives the single consolidated onboarding email.
 */

type Supabase = ReturnType<typeof getServiceClient>;

export interface EnsureCustomerInput {
  journey_id: string;
  contract_summary_id: string;
  contract_acceptance_id: string | null;
}

export interface EnsureCustomerResult {
  ok: boolean;
  customer_id?: string;
  account_number?: string | null;
  reused?: boolean;
  conflict?: boolean;
  reconciliation_task_id?: string;
  reason?: string;
}

function normaliseEmail(e: string | null | undefined): string {
  return String(e ?? "").trim().toLowerCase();
}

export async function ensureCustomerFromAcceptedContract(
  supabase: Supabase,
  input: EnsureCustomerInput,
): Promise<EnsureCustomerResult> {
  try {
    return await ensureCustomerImpl(supabase, input);
  } catch (e) {
    const message = (e as Error)?.message ?? "unknown_error";
    const code = safeErrorCode(message);
    // Durable, high-priority reconciliation task. Never include tokens,
    // passwords or full bank details — only the safe identifiers needed
    // for an operator to triage.
    const task = await supabase
      .from("admin_reconciliation_tasks")
      .insert({
        kind: "ensure_customer_failed",
        severity: "high",
        payload: {
          journey_id: input.journey_id,
          contract_summary_id: input.contract_summary_id,
          contract_acceptance_id: input.contract_acceptance_id,
          email_normalised: await safeEmailForTask(supabase, input.contract_summary_id),
          error_code: code,
          occurred_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();
    return {
      ok: false,
      reason: `exception:${code}`,
      reconciliation_task_id: task.data?.id,
    };
  }
}

function safeErrorCode(message: string): string {
  // Strip URLs, emails, tokens, bank refs; keep a short tag.
  const compact = String(message).slice(0, 120).replace(/[^a-zA-Z0-9 _:-]/g, "_");
  return compact.replace(/\s+/g, "_").slice(0, 80) || "unknown";
}

async function safeEmailForTask(
  supabase: Supabase,
  contract_summary_id: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("contract_summaries")
      .select("customer_email_snapshot")
      .eq("id", contract_summary_id)
      .maybeSingle();
    return normaliseEmail(data?.customer_email_snapshot) || null;
  } catch {
    return null;
  }
}

async function ensureCustomerImpl(
  supabase: Supabase,
  input: EnsureCustomerInput,
): Promise<EnsureCustomerResult> {
  const { journey_id, contract_summary_id, contract_acceptance_id } = input;

  // 1. Load the CS + journey + quote_request to find the canonical email.
  const { data: cs } = await supabase
    .from("contract_summaries")
    .select(
      "id, quote_id, quote_request_id, customer_id, customer_email_snapshot, customer_name_snapshot, service_address",
    )
    .eq("id", contract_summary_id)
    .maybeSingle();
  if (!cs) return { ok: false, reason: "cs_not_found" };

  // Already linked — nothing to do.
  if (cs.customer_id) {
    await linkAll(supabase, {
      journey_id,
      contract_summary_id,
      contract_acceptance_id,
      customer_id: cs.customer_id,
    });
    const { data: p } = await supabase
      .from("profiles").select("account_number").eq("id", cs.customer_id).maybeSingle();
    return { ok: true, customer_id: cs.customer_id, account_number: p?.account_number ?? null, reused: true };
  }

  const email = normaliseEmail(cs.customer_email_snapshot);
  if (!email) return { ok: false, reason: "no_email" };

  // 2. Find existing customer(s) by email via profiles (canonical mirror of auth.users.email).
  const { data: matches } = await supabase
    .from("profiles")
    .select("id, email, account_number")
    .ilike("email", email)
    .limit(5);

  // 3. Multiple matches → fail closed, raise reconciliation task, do NOT link.
  if (matches && matches.length > 1) {
    const { data: task } = await supabase
      .from("admin_reconciliation_tasks")
      .insert({
        kind: "duplicate_customer_email",
        severity: "high",
        payload: {
          email,
          journey_id,
          contract_summary_id,
          candidate_ids: matches.map((m) => m.id),
        },
      })
      .select("id")
      .single();
    return { ok: false, conflict: true, reconciliation_task_id: task?.id, reason: "duplicate_email" };
  }

  let customerId: string | null = matches?.[0]?.id ?? null;
  let reused = !!customerId;

  // 4. Create the auth user when there's no match.
  if (!customerId) {
    // email_confirm:false — journey has NOT verified control of the email.
    const fullName = String(cs.customer_name_snapshot ?? "").trim();
    const created = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data?.user) {
      // Most likely cause: race created the user concurrently. Re-read.
      const { data: again } = await supabase
        .from("profiles").select("id").ilike("email", email).maybeSingle();
      customerId = again?.id ?? null;
      if (!customerId) {
        return { ok: false, reason: `user_create_failed:${created.error?.message ?? "unknown"}` };
      }
      reused = true;
    } else {
      customerId = created.data.user.id;
    }
  }

  if (!customerId) return { ok: false, reason: "customer_id_unresolved" };

  // 5. Pull quote_request for profile backfill fields.
  const { data: qr } = await supabase
    .from("quote_requests")
    .select("full_name, email, phone, address_line_1, address_line_2, town, postcode, date_of_birth")
    .eq("id", cs.quote_request_id)
    .maybeSingle();

  // 6. Ensure account number (use the sequence-backed allocator).
  const { data: profileNow } = await supabase
    .from("profiles").select("account_number").eq("id", customerId).maybeSingle();
  let accountNumber = profileNow?.account_number ?? null;
  if (!accountNumber) {
    const { data: gen } = await supabase.rpc("generate_safe_account_number");
    accountNumber = (gen as unknown as string) ?? null;
  }

  // 7. Backfill profile fields (never overwrite existing non-null values).
  const profileUpd: Record<string, unknown> = { account_number: accountNumber };
  if (qr) {
    if (qr.full_name) profileUpd.full_name = qr.full_name;
    if (qr.phone) profileUpd.phone = qr.phone;
    if (qr.address_line_1) profileUpd.address_line1 = qr.address_line_1;
    if (qr.address_line_2) profileUpd.address_line2 = qr.address_line_2;
    if (qr.town) profileUpd.city = qr.town;
    if (qr.postcode) profileUpd.postcode = qr.postcode;
    if (qr.date_of_birth) profileUpd.date_of_birth = qr.date_of_birth;
  }
  await supabase.from("profiles").update(profileUpd).eq("id", customerId);

  // 8. Link everything to this customer.
  await linkAll(supabase, {
    journey_id,
    contract_summary_id,
    contract_acceptance_id,
    customer_id: customerId,
  });

  return { ok: true, customer_id: customerId, account_number: accountNumber, reused };
}

async function linkAll(
  supabase: Supabase,
  args: {
    journey_id: string;
    contract_summary_id: string;
    contract_acceptance_id: string | null;
    customer_id: string;
  },
) {
  const { journey_id, contract_summary_id, contract_acceptance_id, customer_id } = args;
  const nowIso = new Date().toISOString();

  // Journey
  await supabase
    .from("order_journeys")
    .update({
      customer_id,
      linked_customer_id: customer_id,
    })
    .eq("id", journey_id);

  // Contract summary
  await supabase
    .from("contract_summaries")
    .update({ customer_id })
    .eq("id", contract_summary_id)
    .is("customer_id", null);

  // Contract acceptance
  if (contract_acceptance_id) {
    await supabase
      .from("contract_acceptances")
      .update({ customer_id, accepted_by_user: customer_id })
      .eq("id", contract_acceptance_id)
      .is("customer_id", null);
  }

  // Quote + quote_request
  const { data: cs } = await supabase
    .from("contract_summaries")
    .select("quote_id, quote_request_id")
    .eq("id", contract_summary_id)
    .maybeSingle();
  if (cs?.quote_id) {
    await supabase
      .from("quotes")
      .update({ customer_id })
      .eq("id", cs.quote_id)
      .is("customer_id", null);
  }
  if (cs?.quote_request_id) {
    await supabase
      .from("quote_requests")
      .update({ customer_id, updated_at: nowIso })
      .eq("id", cs.quote_request_id)
      .is("customer_id", null);
  }

  // Payment method captured during the journey
  const { data: pm } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("journey_id", journey_id)
    .eq("active", true)
    .maybeSingle();
  if (pm?.id) {
    await supabase
      .from("payment_methods")
      .update({ customer_id })
      .eq("id", pm.id)
      .is("customer_id", null);
  }

  // DD mandates: a DD intake created during the journey will only have a
  // user_id once payment is verified; nothing to backfill here without an
  // explicit FK. The DD intake/verification flow handles that linkage.
}