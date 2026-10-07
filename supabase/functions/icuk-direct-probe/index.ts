// TEMPORARY staff-only diagnostic. Returns only status codes / safe counts. Remove after use.
import { corsHeaders, jsonResponse, requireStaff } from "../_shared/quoteHelpers.ts";

const T = 8000;
async function f(url: string, init: RequestInit) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), T);
  try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireStaff(req, ["admin", "super_admin"]);
  if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

  const out: Record<string, unknown> = {};
  const user = Deno.env.get("ICUK_API_USER") ?? "";
  const key = Deno.env.get("ICUK_API_KEY") ?? "";
  const base = (Deno.env.get("ICUK_BASE_URL") || "https://api.interdns.co.uk").trim().replace(/\/+$/, "");
  out.config = { user: !!user, key: !!key, base_https: /^https:\/\//.test(base), base_host_is_interdns: /api\.interdns\.co\.uk/.test(base) };
  try {
    const ip = await (await f("https://api.ipify.org?format=json", {})).json();
    out.egress_ip = ip?.ip ?? null;
  } catch { out.egress_ip = null; }

  let token = "";
  try {
    const r = await f("https://api.interdns.co.uk/oauth/token?grant_type=client_credentials", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${user}:${key}`), APIPlatform: "LIVE", Accept: "application/json" },
    });
    out.oauth_status = r.status;
    const txt = await r.text();
    try { const j = JSON.parse(txt); token = j?.access_token ?? ""; out.oauth_has_token = !!token; out.oauth_error = j?.error ?? j?.message ?? null; }
    catch { out.oauth_body_class = txt.slice(0, 0) || "non_json"; }
  } catch (e) { out.oauth_status = "network_error"; out.oauth_error = (e as Error).name; }
  if (!token) return jsonResponse(out);

  const h = { Authorization: `Bearer ${token}`, APIPlatform: "LIVE", Accept: "application/json" };
  let rows: any[] = [];
  try {
    const r = await f(`${base}/broadband/address/HD33WU`, { headers: h });
    out.address_status = r.status;
    const j = await r.json().catch(() => null);
    rows = Array.isArray(j) ? j : (j?.addresses ?? j?.results ?? []);
    out.address_count = Array.isArray(rows) ? rows.length : 0;
    out.address_keys = rows[0] ? Object.keys(rows[0]) : [];
    if (!r.ok) out.address_error = j?.message ?? j?.error ?? null;
  } catch (e) { out.address_status = "network_error"; out.address_error = (e as Error).name; }

  const exact = rows.filter((a) => String(a?.thoroughfare_number ?? "").trim() === "22" && /PAVILION/i.test(String(a?.thoroughfare_name ?? "")));
  out.exact_matches = exact.length;
  if (exact.length !== 1) return jsonResponse(out);

  try {
    const r = await f(`${base}/broadband/availability`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify(exact[0]) });
    out.availability_status = r.status;
    const j: any = await r.json().catch(() => null);
    const prods = j?.products ?? j?.broadband_products ?? j?.data?.products ?? [];
    out.top_level_keys = j && typeof j === "object" ? Object.keys(j) : [];
    out.product_count = Array.isArray(prods) ? prods.length : 0;
    out.product_keys = prods[0] ? Object.keys(prods[0]) : [];
    out.products = Array.isArray(prods) ? prods.map((p: any) => ({ name: p?.name, technology: p?.technology, availability: p?.availability, flag: p?.availability_flag, likely_down: p?.likely_down_speed, range: p?.speed_range })) : [];
    if (!r.ok) out.availability_error = j?.message ?? j?.error ?? null;
  } catch (e) { out.availability_status = "network_error"; }
  return jsonResponse(out);
});
