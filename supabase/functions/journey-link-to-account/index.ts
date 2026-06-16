import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getServiceClient, sha256Hex, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Phase G — Authenticated link of a completed journey to a Supabase auth user.
 * - Validates the caller's JWT and email-confirmation status.
 * - Requires a journey token (always) and accepts an optional single-use nonce
 *   in body for URL-exchange flows. If provided, the nonce must match the
 *   stored hash and be unexpired; it is consumed (cleared) on success.
 * - Verified-email match is enforced against the underlying quote_request.
 * - Atomic update guarded by `linked_customer_id IS NULL`. If already linked
 *   to the same user → success. Different user → fail-closed + audit event.
 */

const Schema = z.object({
  token: z.string().min(16),
  nonce: z.string().min(16).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);

  const jwt = authHeader.replace("Bearer ", "");
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: userResp, error: userErr } = await anon.auth.getUser(jwt);
  if (userErr || !userResp?.user) return jsonResponse({ error: "invalid_jwt" }, 401);

  const authedUser = userResp.user;
  if (!authedUser.email_confirmed_at && !(authedUser as any).confirmed_at) {
    return jsonResponse({ error: "email_not_verified" }, 403);
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation" }, 400);
  const { token, nonce } = parsed.data;

  const ip = getRequestIp(req) ?? "noip";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 400);
  if (!(await checkRateLimit(`${authedUser.id}|${ip}`, "journey_link_to_account", 10, 60))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const supabase = getServiceClient();
  const journeyHash = await sha256Hex(token);

  const { data: journey } = await supabase
    .from("order_journeys")
    .select("id, status, quote_id, linked_customer_id, link_nonce_hash, link_nonce_expires_at")
    .eq("token_hash", journeyHash)
    .maybeSingle();

  if (!journey) return jsonResponse({ error: "not_found" }, 404);
  if (journey.status !== "completed") return jsonResponse({ error: "journey_not_completed" }, 409);

  // Idempotent: already linked to this same user.
  if (journey.linked_customer_id === authedUser.id) {
    return jsonResponse({ ok: true, already_linked: true });
  }
  if (journey.linked_customer_id && journey.linked_customer_id !== authedUser.id) {
    await supabase.rpc("log_event", {
      _actor_type: "customer",
      _event_type: "journey_link_mismatch",
      _title: "Attempt to link a journey already owned by another account",
      _details: { journey_id: journey.id, attempted_user: authedUser.id, ip, ua },
      _source_module: "journey",
      _user_id: authedUser.id,
    }).then(() => {}).catch(() => {});
    return jsonResponse({ error: "linked_to_other_account" }, 403);
  }

  // Nonce check (only enforced when caller provides one — typical for URL exchange).
  if (nonce) {
    if (!journey.link_nonce_hash) return jsonResponse({ error: "invalid_nonce" }, 401);
    const nonceHash = await sha256Hex(nonce);
    if (nonceHash !== journey.link_nonce_hash) return jsonResponse({ error: "invalid_nonce" }, 401);
    const exp = journey.link_nonce_expires_at ? new Date(journey.link_nonce_expires_at).getTime() : 0;
    if (!exp || exp < Date.now()) return jsonResponse({ error: "nonce_expired" }, 401);
  }

  // Verified email match against the underlying quote_request.
  const { data: q } = await supabase
    .from("quotes")
    .select("quote_request_id")
    .eq("id", journey.quote_id)
    .maybeSingle();
  const { data: qr } = q?.quote_request_id
    ? await supabase.from("quote_requests").select("email").eq("id", q.quote_request_id).maybeSingle()
    : { data: null };
  const journeyEmail = (qr?.email ?? "").toLowerCase().trim();
  const userEmail = (authedUser.email ?? "").toLowerCase().trim();
  if (!journeyEmail || !userEmail || journeyEmail !== userEmail) {
    return jsonResponse({ error: "email_mismatch" }, 403);
  }

  // Atomic claim — only succeeds if still unlinked.
  const claim = await supabase
    .from("order_journeys")
    .update({
      linked_customer_id: authedUser.id,
      linked_at: new Date().toISOString(),
      link_nonce_hash: null,
      link_nonce_expires_at: null,
    })
    .eq("id", journey.id)
    .is("linked_customer_id", null)
    .select("id, linked_at")
    .maybeSingle();

  if (claim.error) return jsonResponse({ error: "link_failed", details: claim.error.message }, 500);
  if (!claim.data) {
    // Race — someone else claimed in the meantime. Re-check.
    const { data: j2 } = await supabase
      .from("order_journeys")
      .select("linked_customer_id")
      .eq("id", journey.id)
      .maybeSingle();
    if (j2?.linked_customer_id === authedUser.id) return jsonResponse({ ok: true, already_linked: true });
    return jsonResponse({ error: "linked_to_other_account" }, 403);
  }

  // Best-effort: also tag matching guest_orders with customer_id for dashboard surfacing.
  await supabase
    .from("guest_orders")
    .update({ customer_id: authedUser.id })
    .ilike("admin_notes", `%journey:${journey.id}%`)
    .is("customer_id", null)
    .then(() => {}).catch(() => {});

  await supabase.rpc("log_event", {
    _actor_type: "customer",
    _event_type: "journey_linked_to_account",
    _title: "Journey linked to authenticated account",
    _details: { journey_id: journey.id, user_id: authedUser.id },
    _source_module: "journey",
    _user_id: authedUser.id,
  }).then(() => {}).catch(() => {});

  return jsonResponse({ ok: true, linked_at: claim.data.linked_at });
});
