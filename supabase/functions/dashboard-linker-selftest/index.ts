/**
 * Isolated self-test for the customer dashboard account linker.
 *
 * Creates throwaway auth users on an internal, non-routable test domain, links
 * throwaway records, asserts linker behaviour (auth requirement, idempotency,
 * cross-user isolation, empty account, masked Direct Debit) and then deletes
 * every temporary record and user it created. It never touches real customer
 * rows and never calls an external email/provider/supplier.
 *
 * Guarded by a shared secret header so it cannot be triggered by the public.
 */
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TEST_DOMAIN = "occta-test.invalid";
const PASSWORD = `Sf-${crypto.randomUUID()}!A9`;

type Check = { name: string; passed: boolean; detail?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("DASHBOARD_LINKER_TEST_KEY") ?? "";
  if (!expected || req.headers.get("x-selftest-secret") !== expected) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = getServiceClient();
  const checks: Check[] = [];
  const record = (name: string, passed: boolean, detail?: string) => checks.push({ name, passed, detail });

  const suffix = crypto.randomUUID().slice(0, 8);
  const emailA = `linker-a-${suffix}@${TEST_DOMAIN}`;
  const emailB = `linker-b-${suffix}@${TEST_DOMAIN}`;
  const emailC = `linker-c-${suffix}@${TEST_DOMAIN}`;
  const createdUsers: string[] = [];
  const createdOrders: string[] = [];

  const asUser = async (email: string) => {
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error || !data.session) throw new Error(`signin_failed:${email}:${error?.message ?? "no session"}`);
    return client;
  };

  try {
    for (const email of [emailA, emailB, emailC]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error || !data.user) throw new Error(`create_user_failed:${email}:${error?.message}`);
      createdUsers.push(data.user.id);
    }
    const [uidA, uidB] = createdUsers;

    // Throwaway unowned records for A and B.
    for (const [email, orderNumber] of [[emailA, `SELFTEST-A-${suffix}`], [emailB, `SELFTEST-B-${suffix}`]]) {
      const { data, error } = await admin.from("guest_orders").insert({
        order_number: orderNumber, email, full_name: "Self Test", phone: "07000000000",
        address_line1: "1 Test Street", city: "Testville", postcode: "TE5 7ST",
        gdpr_consent: true, plan_name: "Self Test Plan", plan_price: 0, service_type: "broadband", status: "pending",
      }).select("id").single();
      if (error || !data) throw new Error(`seed_failed:${email}:${error?.message}`);
      createdOrders.push(data.id);
    }
    const [orderA, orderB] = createdOrders;

    // 1. anonymous callers are rejected
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const anonCall = await anon.rpc("link_my_customer_account");
    record("anonymous_linker_denied", !!anonCall.error, anonCall.error?.message ?? "unexpectedly succeeded");

    // 2. authenticated linker links the caller's own record
    const clientA = await asUser(emailA);
    const first = await clientA.rpc("link_my_customer_account");
    const linkedFirst = Number((first.data as any)?.guest_orders ?? -1);
    record("authenticated_linker_links_own_record", !first.error && linkedFirst === 1, JSON.stringify(first.data ?? first.error));

    const { data: ownedA } = await admin.from("guest_orders").select("user_id").eq("id", orderA).single();
    record("ownership_written_to_caller", ownedA?.user_id === uidA, String(ownedA?.user_id));

    // 3. idempotency — second call links nothing new
    const second = await clientA.rpc("link_my_customer_account");
    record("idempotent_second_call", !second.error && Number((second.data as any)?.guest_orders ?? -1) === 0,
      JSON.stringify(second.data ?? second.error));

    // 4. cross-user isolation — B must not take A's record, and A keeps ownership
    const clientB = await asUser(emailB);
    const bCall = await clientB.rpc("link_my_customer_account");
    record("cross_user_links_only_own", !bCall.error && Number((bCall.data as any)?.guest_orders ?? -1) === 1,
      JSON.stringify(bCall.data ?? bCall.error));
    const { data: stillA } = await admin.from("guest_orders").select("user_id").eq("id", orderA).single();
    record("existing_ownership_not_reassigned", stillA?.user_id === uidA, String(stillA?.user_id));
    const { data: bRows } = await clientB.from("guest_orders").select("id");
    record("rls_hides_other_customers_orders",
      Array.isArray(bRows) && bRows.every((r: any) => r.id !== orderA) && bRows.some((r: any) => r.id === orderB),
      JSON.stringify(bRows));

    // 5. empty account — linker succeeds with zero links and overview returns a shape
    const clientC = await asUser(emailC);
    const cCall = await clientC.rpc("link_my_customer_account");
    record("empty_account_linker_ok", !cCall.error && Number((cCall.data as any)?.guest_orders ?? -1) === 0,
      JSON.stringify(cCall.data ?? cCall.error));
    const cOverview = await clientC.rpc("get_my_customer_overview");
    record("empty_account_overview_ok", !cOverview.error && !!cOverview.data, JSON.stringify(cOverview.error ?? "ok"));

    // 6. overview never exposes bank secrets
    const aOverview = await clientA.rpc("get_my_customer_overview");
    const raw = JSON.stringify(aOverview.data ?? {}).toLowerCase();
    const leaked = ["account_number_full", "sort_code_encrypted", "account_number_plain", "sort_code_plain", "bank_account_number", "\"sort_code\""]
      .filter((k) => raw.includes(k));
    record("overview_hides_bank_secrets", !aOverview.error && leaked.length === 0, leaked.join(",") || "none");

    // 7. no direct read access to raw mandate bank columns
    const mandate = await clientA.from("dd_mandates").select("account_number_full,sort_code").limit(1);
    record("dd_bank_columns_not_readable", !!mandate.error || (mandate.data ?? []).length === 0,
      mandate.error?.message ?? "no rows");
  } catch (e) {
    record("harness", false, String((e as Error).message));
  } finally {
    if (createdOrders.length) await admin.from("guest_orders").delete().in("id", createdOrders);
    for (const uid of createdUsers) {
      await admin.from("profiles").delete().eq("id", uid);
      await admin.auth.admin.deleteUser(uid);
    }
  }

  const passed = checks.every((c) => c.passed);
  return jsonResponse({ ok: passed, checks, cleaned_up: { users: createdUsers.length, guest_orders: createdOrders.length } }, passed ? 200 : 500);
});
