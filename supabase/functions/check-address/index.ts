import { corsHeaders, jsonResponse, checkRateLimit, getRequestIp } from "../_shared/quoteHelpers.ts";

// Postal address lookup only (Ideal Postcodes / PAF). This is NOT network or
// supplier verification — availability is confirmed separately before any
// binding contract is issued.
const POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;

async function idealPostcodes(postcode: string) {
  const key = Deno.env.get("IDEAL_POSTCODES_API_KEY")?.trim();
  if (!key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(
      `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${encodeURIComponent(key)}`,
      { signal: ctrl.signal },
    );
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const data = await res.json();
    const rows = Array.isArray(data?.result) ? data.result : [];
    return rows
      .filter((r: any) => r && (r.line_1 || r.building_number || r.building_name))
      .map((r: any) => ({
        address_line_1: String(r.line_1 ?? "").trim(),
        address_line_2: [r.line_2, r.line_3].filter(Boolean).join(", ") || null,
        town: String(r.post_town ?? "").trim(),
        county: r.county || null,
        postcode: String(r.postcode ?? postcode).toUpperCase(),
        uprn: r.uprn ? String(r.uprn) : null,
        // Keys used by the website's address display.
        premises_name: String(r.line_1 ?? "").trim(),
        sub_premises: [r.line_2, r.line_3].filter(Boolean).join(", ") || undefined,
        post_town: String(r.post_town ?? "").trim(),
        formatted_address: [r.line_1, r.line_2, r.line_3, r.post_town, r.postcode].filter(Boolean).join(", "),
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(ip, "check_address", 20, 300))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const body = await req.json().catch(() => null);
  const raw = String(body?.postcode ?? "").trim().toUpperCase();
  const compact = raw.replace(/\s+/g, "");
  if (!compact) return jsonResponse({ error: "postcode_required" }, 400);
  if (!POSTCODE_RE.test(compact)) return jsonResponse({ error: "invalid_postcode", addresses: [] }, 400);
  const postcode = `${compact.slice(0, -3)} ${compact.slice(-3)}`;

  const rows = await idealPostcodes(postcode);
  if (rows && rows.length) {
    return jsonResponse({
      addresses: rows,
      source: "paf",
      postalAddressesOnly: true,
      networkValidationRequired: true,
    });
  }
  // Honest empty result — the frontend falls back to full-address search or
  // manual entry. Never fabricate a postcode-only row.
  return jsonResponse({
    addresses: [],
    source: rows === null ? "address_lookup_unavailable" : "no_property_addresses",
    postalAddressesOnly: true,
    networkValidationRequired: true,
    message: "Search for your full address or enter it manually.",
  });
});
