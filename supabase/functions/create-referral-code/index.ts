// Retired (refer-a-friend scheme raf-2026-11-v1).
//
// Referral codes, link clicks and order attribution now live in the database:
//   referral_my_code()        — issues a code with the terms version shown
//   referral_record_click()   — stores click evidence (hashed IP, UA, URL)
//   referral_bind_order()     — attributes an order only from evidence
//                               captured BEFORE the order existed
// This endpoint used to attach codes after the fact without proof of a click
// (the SWITCH50 weakness), so it now does nothing.
import { corsHeaders, jsonResponse } from "../_shared/quoteHelpers.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return jsonResponse({ ok: false, error: "retired" }, 410);
});
