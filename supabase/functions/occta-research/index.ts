import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { redactSensitiveText, withOptions } from "../_shared/companionCore.ts";

const BASE_URL = "https://www.occta.co.uk";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRUSTED_EXTERNAL_HOSTS = [
  "ofcom.org.uk",
  "www.ofcom.org.uk",
  "gov.uk",
  "www.gov.uk",
  "openreach.com",
  "www.openreach.com",
  "en.wikipedia.org",
];

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("https://")) return null;
  try {
    const url = new URL(value);
    return TRUSTED_EXTERNAL_HOSTS.includes(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function routeFor(row: any): string {
  if (row.kind === "blog") return `/blog/${row.slug}`;
  if (row.kind === "guide") return `/guides/${row.slug}`;
  return `/help/${row.slug}`;
}

function looksPersonalOrCommercial(query: string): boolean {
  return /\bOCC[A-Z0-9]{6,12}\b/i.test(query)
    || /\b(?:my|mine)\s+(?:account|invoice|bill|order|refund|service|ticket|contract)\b/i.test(query)
    || /\b(?:price|quote|setup fee|monthly cost|how much do i owe|pay my bill)\b/i.test(query)
    || /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/.test(query)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(query);
}

async function checkRateLimit(client: any, identifier: string): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("check_rate_limit", {
      _action: "occta_public_research",
      _identifier: identifier,
      _max_requests: 20,
      _window_minutes: 5,
    });
    return error ? true : data === true;
  } catch {
    return true;
  }
}

async function searchOccta(client: any, query: string): Promise<any[]> {
  try {
    const { data, error } = await client.rpc("search_kb_for_ai", {
      _q: query.slice(0, 220),
      _include_customer: true,
      _limit: 5,
    });
    return error || !Array.isArray(data) ? [] : data;
  } catch {
    return [];
  }
}

async function duckDuckGoInstantAnswer(query: string): Promise<{ text: string; url: string; heading: string } | null> {
  const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`;
  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "OCCTA-Support-Research/1.0" },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return null;
    const data = await response.json();

    const abstractUrl = safeUrl(data?.AbstractURL);
    const abstractText = typeof data?.AbstractText === "string" ? data.AbstractText.trim() : "";
    if (abstractUrl && abstractText.length >= 40) {
      return {
        text: abstractText.slice(0, 900),
        url: abstractUrl,
        heading: String(data?.Heading || "External reference").slice(0, 120),
      };
    }

    const topics = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics.flatMap((item: any) => Array.isArray(item?.Topics) ? item.Topics : [item]) : [];
    for (const topic of topics) {
      const url = safeUrl(topic?.FirstURL);
      const text = typeof topic?.Text === "string" ? topic.Text.trim() : "";
      if (url && text.length >= 40) {
        return { text: text.slice(0, 700), url, heading: "External reference" };
      }
    }
  } catch {
    return null;
  }
  return null;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await request.json().catch(() => ({}));
  const rawQuery = typeof body.query === "string" ? body.query.trim().slice(0, 500) : "";
  if (rawQuery.length < 3) return json({ error: "query_required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json({ error: "server_configuration" }, 500);
  const client = createClient(supabaseUrl, serviceRole);

  const identifier = String(body.sessionId || request.headers.get("x-forwarded-for") || "public").slice(0, 120);
  if (!(await checkRateLimit(client, identifier))) return json({ error: "rate_limited" }, 429);

  const safeQuery = redactSensitiveText(rawQuery);
  const kb = await searchOccta(client, safeQuery);
  if (kb.length) {
    const lines = kb.slice(0, 4).map((row: any) => {
      const excerpt = String(row.summary && row.summary.length > 20 ? row.summary : row.content ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 360)
        .trim();
      return `• **${String(row.title ?? "OCCTA guide").slice(0, 140)}**${excerpt ? ` — ${excerpt}` : ""} [Open →](${BASE_URL}${routeFor(row)})`;
    });
    return json({
      source: "occta_knowledge",
      content: withOptions(
        `I found relevant information in OCCTA's published knowledge base:\n\n${lines.join("\n")}\n\nIf you tell me which part you want explained, I'll keep the answer focused.`,
        ["Explain this more simply", "Search another OCCTA guide"],
      ),
    });
  }

  if (looksPersonalOrCommercial(rawQuery)) {
    return json({ source: "none", content: "" });
  }

  const external = await duckDuckGoInstantAnswer(`${safeQuery} UK telecom`);
  if (external) {
    return json({
      source: "trusted_web",
      content: withOptions(
        `For **general background** (not an OCCTA account or price decision), I found this current web reference:\n\n${external.text}\n\n[**Source: ${external.heading} →**](${external.url})\n\nI keep external information separate from OCCTA-specific terms, which must come from OCCTA's own published or account data.`,
        ["Search OCCTA guidance", "Ask a follow-up"],
      ),
    });
  }

  return json({ source: "none", content: "" });
});
