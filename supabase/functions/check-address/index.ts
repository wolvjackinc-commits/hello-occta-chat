import { corsHeaders, jsonResponse, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";
import { lookupIcukAddresses } from "../_shared/icukAvailability.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "check_address", 20, 300))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const body = await req.json().catch(() => null);
  const postcode = String(body?.postcode ?? "").trim();
  if (!postcode) return jsonResponse({ error: "postcode_required" }, 400);

  try {
    const addresses = await lookupIcukAddresses(postcode);
    if (!addresses.length) {
      return jsonResponse({
        addresses: [],
        verifiedSupplierAddresses: true,
        message: "We couldn’t find an exact supplier address for that postcode. Contact OCCTA and we’ll check it manually.",
      });
    }
    return jsonResponse({
      addresses,
      verifiedSupplierAddresses: true,
      source: "ICUK_LIVE_ADDRESS",
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "address_lookup_failed";
    console.error("[check-address]", code);
    return jsonResponse({
      addresses: [],
      error: code,
      verifiedSupplierAddresses: false,
      message: code === "icuk_backend_not_configured"
        ? "Supplier address verification is temporarily unavailable. Online ordering is paused rather than guessing availability."
        : "We couldn’t verify addresses with the network right now. Contact OCCTA and we’ll check it manually.",
    }, code === "invalid_postcode" ? 400 : 503);
  }
});
