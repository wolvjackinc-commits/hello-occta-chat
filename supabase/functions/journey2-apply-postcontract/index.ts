/**
 * Journey 2 — apply the pre-contract start date and Direct Debit selections to
 * the shared order journey immediately after contract acceptance.
 *
 * Journey 2 collects the start date and billing details BEFORE the contract is
 * generated, but the shared production services deliberately refuse them until
 * an agreement exists. This function replays the customer's already captured
 * choices into those same services the moment acceptance is recorded, so
 * Journey 1 keeps its exact behaviour and Journey 2 gets the required order.
 *
 * Idempotent: replaying it never creates a second payment method or order.
 * Test sessions never send customer communications.
 */
import {
  corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp,
} from "../_shared/quoteHelpers.ts";
import { decryptJson } from "../_shared/ddCrypto.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ token: z.string().min(16), quote_token: z.string().min(16) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);
  const { token, quote_token } = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "journey2_apply_postcontract", 30, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const sessionHash = await sha256Hex(token);

  const { data: session } = await supabase
    .from("customer_journey_sessions")
    .select("*")
    .eq("public_token_hash", sessionHash)
    .maybeSingle();
  if (!session) return jsonResponse({ error: "session_not_found" }, 404);
  if (!session.preferred_start_date || !session.billing_anchor_day) {
    return jsonResponse({ error: "selections_incomplete" }, 409);
  }

  const quoteHash = await sha256Hex(quote_token);
  if (session.quote_public_token_hash && session.quote_public_token_hash !== quoteHash) {
    return jsonResponse({ error: "quote_token_mismatch" }, 403);
  }

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, quote_id, current_step, status, contract_accepted_at, preferred_start_date, payment_method, billing_anchor_day")
    .eq("token_hash", quoteHash)
    .maybeSingle();
  if (!journey) return jsonResponse({ error: "no_journey" }, 404);
  if (!journey.contract_accepted_at) return jsonResponse({ error: "contract_not_accepted" }, 409);

  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const callShared = async (fn: string, body: Record<string, unknown>) => {
    const res = await fetch(`${projectUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && !(json as any).error, status: res.status, json: json as any };
  };

  const failures: { step: string; error: string }[] = [];

  // 1 · Preferred start date, chosen before the contract was generated.
  if (!journey.preferred_start_date) {
    const sd = await callShared("journey-start-date", {
      token: quote_token,
      preferred_start_date: session.preferred_start_date,
      cooling_off_acknowledged: true,
    });
    if (!sd.ok) failures.push({ step: "start_date", error: sd.json?.error ?? `http_${sd.status}` });
  }

  // 2 · Direct Debit, decrypted only here and handed to the existing service.
  if (!journey.payment_method) {
    const { data: intake } = await supabase
      .from("journey2_dd_intake")
      .select("id, bank_details_ciphertext, nonce")
      .eq("session_id", session.id)
      .maybeSingle();
    if (!intake) {
      failures.push({ step: "direct_debit", error: "dd_details_missing" });
    } else {
      try {
        const bank = await decryptJson<{
          account_holder_name: string; sort_code: string; account_number: string;
          bank_name: string; billing_address: string; postcode: string;
        }>(intake.bank_details_ciphertext, intake.nonce);
        const pm = await callShared("journey-payment-method", {
          token: quote_token,
          method: "direct_debit",
          billing_anchor_day: session.billing_anchor_day,
          consent: true,
          idempotency_key: session.checkout_session_id,
          // Test sessions must never send a real customer communication.
          suppress_customer_email: !!session.test_session,
          dd_details: {
            account_holder_name: bank.account_holder_name,
            sort_code: bank.sort_code,
            account_number: bank.account_number,
            bank_name: bank.bank_name,
            billing_address: bank.billing_address,
            postcode: bank.postcode,
            uk_account_confirmed: true,
            payer_authorised_confirmed: true,
          },
        });
        if (!pm.ok) failures.push({ step: "direct_debit", error: pm.json?.error ?? `http_${pm.status}` });
        else {
          await supabase.from("journey2_dd_intake")
            .update({ consumed_at: new Date().toISOString() }).eq("id", intake.id);
          await supabase.from("payment_methods")
            .update({ journey_version: "v2", checkout_session_id: session.checkout_session_id })
            .eq("journey_id", journey.id).eq("active", true);
          const masked = { ...(session.dd_masked as Record<string, unknown> ?? {}), status: "setup_requested" };
          await supabase.from("customer_journey_sessions")
            .update({ dd_masked: masked }).eq("id", session.id);
        }
      } catch (e) {
        failures.push({ step: "direct_debit", error: `decrypt_failed:${(e as Error).message}` });
      }
    }
  }

  // Traceability on the acceptance record.
  await supabase.from("contract_acceptances")
    .update({ journey_version: "v2", checkout_session_id: session.checkout_session_id })
    .eq("quote_id", journey.quote_id)
    .is("checkout_session_id", null);

  if (failures.length > 0) {
    // The session is preserved and retryable — never converted into a quote.
    await supabase.from("customer_journey_sessions")
      .update({ last_error: failures.map((f) => `${f.step}:${f.error}`).join("; ") })
      .eq("id", session.id);
    await supabase.from("admin_tasks").insert({
      task_type: "journey2_post_contract_failed",
      title: "Journey 2 order needs attention after contract acceptance",
      description: `Session ${session.id} could not apply: ${failures.map((f) => `${f.step} (${f.error})`).join(", ")}`,
      priority: "high",
      status: "open",
      related_quote_id: journey.quote_id,
    }).then(() => {}).catch(() => {});
    await supabase.rpc("log_event", {
      _actor_type: "public",
      _event_type: "journey2_post_contract_failed",
      _title: "Journey 2 post-contract application failed",
      _details: { session_id: session.id, failures, test_session: session.test_session },
      _source_module: "journey2",
      _severity: "error",
      _quote_id: journey.quote_id,
    }).then(() => {}).catch(() => {});
    return jsonResponse({
      ok: false,
      retryable: true,
      failures,
      message: "Your agreement is saved. We couldn't finish setting up your billing just now — please try again in a moment.",
    }, 503);
  }

  await supabase.from("customer_journey_sessions")
    .update({
      status: "contract_accepted",
      current_step: "review",
      post_contract_applied_at: new Date().toISOString(),
      last_error: null,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  return jsonResponse({ ok: true, applied: true });
});
