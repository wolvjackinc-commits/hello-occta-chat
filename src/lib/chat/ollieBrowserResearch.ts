const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ACCOUNT_RE = /\bOCC[A-Z0-9]{6,12}\b/i;

function blockedForExternalResearch(query: string): boolean {
  const lower = query.toLowerCase();
  return EMAIL_RE.test(query)
    || ACCOUNT_RE.test(query)
    || /\b(?:my|mine)\s+(?:account|invoice|bill|order|refund|ticket|contract|service)\b/.test(lower)
    || /\b(?:occta)\b.{0,30}\b(?:price|cost|fee|charge|refund|contract|order status|bill|invoice)\b/.test(lower)
    || /\b(?:password|passcode|pin|sort code|bank account|card number|date of birth|dob)\b/.test(lower);
}

function cleanText(value: unknown, max = 900): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function withOptions(body: string, options: string[]): string {
  return `${body.trim()}\n\n<<<OPTIONS:${JSON.stringify(options.slice(0, 4))}>>>`;
}

async function duckDuckGo(query: string): Promise<{ title: string; text: string; url: string } | null> {
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`);
    if (!response.ok) return null;
    const data = await response.json();
    const text = cleanText(data?.AbstractText);
    const url = cleanText(data?.AbstractURL, 500);
    const title = cleanText(data?.Heading, 140) || "Web reference";
    if (text.length >= 60 && /^https:\/\//i.test(url)) return { title, text, url };
  } catch {
    // Browser CORS or network failure: Wikipedia is the no-key fallback below.
  }
  return null;
}

async function wikipedia(query: string): Promise<{ title: string; text: string; url: string } | null> {
  try {
    const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
    searchUrl.searchParams.set("origin", "*");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("list", "search");
    searchUrl.searchParams.set("srlimit", "3");
    searchUrl.searchParams.set("srsearch", `${query} UK telecommunications`);
    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) return null;
    const searchData = await searchResponse.json();
    const title = cleanText(searchData?.query?.search?.[0]?.title, 160);
    if (!title) return null;

    const extractUrl = new URL("https://en.wikipedia.org/w/api.php");
    extractUrl.searchParams.set("origin", "*");
    extractUrl.searchParams.set("action", "query");
    extractUrl.searchParams.set("format", "json");
    extractUrl.searchParams.set("prop", "extracts");
    extractUrl.searchParams.set("exintro", "1");
    extractUrl.searchParams.set("explaintext", "1");
    extractUrl.searchParams.set("redirects", "1");
    extractUrl.searchParams.set("titles", title);
    const extractResponse = await fetch(extractUrl.toString());
    if (!extractResponse.ok) return null;
    const extractData = await extractResponse.json();
    const pages = extractData?.query?.pages ? Object.values(extractData.query.pages) as Array<Record<string, unknown>> : [];
    const text = cleanText(pages[0]?.extract);
    if (text.length < 60) return null;
    return {
      title,
      text,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
    };
  } catch {
    return null;
  }
}

/**
 * No-key browser fallback for general public background questions. This is not
 * permitted to answer OCCTA account/commercial facts and is intentionally kept
 * separate from the authoritative OCCTA knowledge/account pipelines.
 */
export async function researchGeneralQuestion(query: string): Promise<string | null> {
  const trimmed = query.trim().slice(0, 300);
  if (trimmed.length < 4 || blockedForExternalResearch(trimmed)) return null;

  const result = await duckDuckGo(trimmed) ?? await wikipedia(trimmed);
  if (!result) return null;

  return withOptions(
    `I couldn't find this in OCCTA's own published support material, so I checked a **general web reference** instead. This is background information, not an OCCTA price, contract or account decision.\n\n**${result.title}** — ${result.text}\n\n[**Open external source →**](${result.url})`,
    ["Search OCCTA guidance", "Ask a follow-up"],
  );
}
