export type CompanionMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AccountIntent =
  | "overview"
  | "invoices"
  | "orders"
  | "services"
  | "tickets"
  | "documents"
  | "installation";

const ACCOUNT_NUMBER_RE = /\bOCC[A-Z0-9]{6,12}\b/i;
const ISO_DOB_RE = /\b(19\d{2}|20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/;
const UK_DOB_RE = /\b([0-2]?\d|3[01])[/.-](0?\d|1[0-2])[/.-]((?:19|20)\d{2})\b/;
const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

export function normaliseMessages(value: unknown): CompanionMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is { role?: unknown; content?: unknown } => Boolean(row && typeof row === "object"))
    .map((row) => ({
      role: row.role === "assistant" ? "assistant" as const : "user" as const,
      content: typeof row.content === "string" ? row.content.trim().slice(0, 4000) : "",
    }))
    .filter((row) => row.content.length > 0)
    .slice(-24);
}

export function lastUserText(messages: CompanionMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

export function conversationUserText(messages: CompanionMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
}

export function detectAccountIntent(messages: CompanionMessage[]): AccountIntent | null {
  const userMessages = messages.filter((message) => message.role === "user");
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const text = userMessages[index].content.toLowerCase();
    const personal = /\b(my|mine|me|account|customer|logged in|signed in|am i on|do i have)\b/.test(text)
      || /^(view|show|check|track|explain)\s+(invoices?|orders?|services?|tickets?|account|installation)/.test(text);
    if (!personal) continue;
    if (/\b(invoice|invoices|bill|billing statement|latest bill|amount due|how much do i owe|payment status)\b/.test(text)) return "invoices";
    if (/\b(installation|activation|engineer|go live|go-live|appointment|start date)\b/.test(text)) return "installation";
    if (/\b(order|orders|track|tracking)\b/.test(text)) return "orders";
    if (/\b(service|services|broadband line|mobile line|sim service|digital voice|my plan|my package|plan am i on)\b/.test(text)) return "services";
    if (/\b(ticket|tickets|support case|support request|complaint status)\b/.test(text)) return "tickets";
    if (/\b(document|documents|contract summary|receipt|receipts)\b/.test(text)) return "documents";
    if (/\b(account|profile|details|overview)\b/.test(text)) return "overview";
  }
  return null;
}

export function extractUkPostcode(text: string): string | null {
  const match = text.toUpperCase().match(UK_POSTCODE_RE);
  if (!match) return null;
  const compact = match[1].replace(/\s+/g, "");
  if (compact.length < 5) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function detectPublicIntent(text: string): string {
  const lower = text.toLowerCase();
  const postcode = extractUkPostcode(text);

  if (postcode && /\b(occta|broadband|fibre|fiber|internet|availab\w*|coverage|cover\w*|serve\w*|get)\b/.test(lower)) return "availability";

  if (
    /\b(no internet|internet down|broadband down|offline|total outage|los light|no connection|lost connection)\b/.test(lower)
    || /\b(internet|broadband|wi-?fi|connection)\b.{0,24}\b(not working|isn['’]?t working|stopped working|won['’]?t work|doesn['’]?t work|keeps dropping|disconnected)\b/.test(lower)
    || /\b(can['’]?t|cannot|unable to)\s+(?:get online|connect|access (?:the )?internet)\b/.test(lower)
    || /\bfix\s+(?:my\s+)?(?:internet|broadband|wi-?fi)\b/.test(lower)
  ) return "no_internet";

  if (/\b(router lights?|red lights?|orange lights?|amber lights?|flashing lights?|blinking lights?|ont lights?|los lights?|pon lights?|internet lights?)\b/.test(lower)) return "router_lights";
  if (/\b(slow wi-?fi|slow broadband|buffering|poor signal|weak wi-?fi)\b/.test(lower)) return "slow_wifi";
  if (/\b(pppoe details|pppoe password|cannot find pppoe|can't find pppoe|missing pppoe)\b/.test(lower)) return "pppoe_missing";
  if (/\b(router|pppoe|wan port|ont|mesh|wi-?fi setup)\b/.test(lower)) return "router";
  if (/\b(e-?sim|embedded sim)\b/.test(lower)) return "esim";
  if (/\b(flex 30.*price lock|price lock.*flex 30|rolling.*fixed|fixed.*rolling|which contract|contract options?)\b/.test(lower)) return "contract_choice";
  if (/\b(how much speed|which speed|speed do i need|how fast.*need|mbps.*need)\b/.test(lower)) return "speed_need";
  if (/\b(service status|network status|known outage|status page)\b/.test(lower)) return "service_status";
  if (/\b(vat|value added tax|tax invoice|reclaim vat)\b/.test(lower)) return "vat";
  if (/\b(keep my number|port my number|number transfer|transfer my number)\b/.test(lower)) return "number_porting";
  if (/\b(direct debit|dd mandate|bank mandate|payment method)\b/.test(lower)) return "direct_debit";
  if (/\b(first invoice|first bill|pro[- ]?rata|part month)\b/.test(lower)) return "first_invoice";
  if (/\b(cancel|cancellation|leave occta|notice period|termination|exit fee)\b/.test(lower)) return "cancellation";
  if (/\b(switch|one touch switch|change provider)\b/.test(lower)) return "switching";
  if (/\b(complaint|complain|adr|ombudsman)\b/.test(lower)) return "complaints";
  if (/\b(vulnerable|telecare|medical alarm|priority support|battery backup)\b/.test(lower)) return "vulnerable";

  if (
    /\b(bt|sky|virgin(?: media)?|talktalk|plusnet|vodafone|ee|zen)\b/.test(lower)
    && /\b(cheap\w*|price|cost|compare|comparison|better|difference|versus|vs\.?|save|saving|same)\b/.test(lower)
  ) return "provider_comparison";

  if (/\b(sim|mobile plan|mobile data|roaming)\b/.test(lower)) return "sim";
  if (/\b(landline|digital voice|home phone|pstn)\b/.test(lower)) return "voice";
  if (/\b(broadband|full fibre|fttp|sogea|internet plan|price lock|flex 30)\b/.test(lower)) return "broadband";
  if (/\b(human|advisor|agent|person|speak to support)\b/.test(lower)) return "human";
  return "general";
}

/**
 * Resolve short, natural follow-ups against the recent conversation.
 * This is deliberately deterministic: it remembers the active support topic
 * without asking a language model to invent facts or actions.
 */
export function detectContextualPublicIntent(messages: CompanionMessage[]): string {
  const latest = lastUserText(messages).trim();
  const direct = detectPublicIntent(latest);
  if (direct !== "general") return direct;
  if (!latest) return "general";

  const prior = messages.slice(0, -1).slice(-10);
  if (!prior.length) return "general";

  const latestLower = latest.toLowerCase();
  const priorText = prior.map((message) => message.content.toLowerCase()).join("\n");
  const previousAssistant = [...prior].reverse().find((message) => message.role === "assistant")?.content.toLowerCase() ?? "";

  const postcode = extractUkPostcode(latest);
  if (postcode && /availab|postcode|address|coverage|property|build-plan/.test(priorText)) return "availability";

  const faultContext = /no internet|internet.*down|broadband.*down|router|ont|los|pon|light label|lights can you see|line fault|wi-?fi.*internet|troubleshoot/.test(priorText);
  if (faultContext) {
    if (
      /^(?:the\s+)?(?:red|orange|amber|green|blue|white)(?:\s+lights?)?$/.test(latestLower)
      || /^(?:los|pon|internet|wan|power|broadband|dsl|wifi|wi-fi)(?:\s+(?:is\s+)?)?(?:red|orange|amber|green|off|on|flashing|blinking)?$/.test(latestLower)
      || /^(?:router|ont)(?:\s+(?:light|lights|is red|red))?$/.test(latestLower)
      || /^(?:all|both)\s+(?:lights?\s+)?(?:green|red|off)$/.test(latestLower)
      || /^(?:no|none)\s+(?:lights?|power)$/.test(latestLower)
    ) return "router_lights";

    if (/^(yes|no|same|still down|still not working|didn['’]?t work|not fixed|working now|fixed|connected now|keeps dropping)$/.test(latestLower)) return "no_internet";
  }

  const comparisonContext = /provider_comparison|compare occta|\b(bt|sky|virgin(?: media)?|talktalk|plusnet|vodafone|ee|zen)\b.*(?:price|cost|speed|cheaper|compare)|monthly price and advertised speed/.test(priorText);
  if (comparisonContext && /(?:£|\d+\s*(?:mbps|mb|gbps|gb)|per month|monthly|p\/m|pm|contract|months?)/.test(latestLower)) return "provider_comparison";

  const contractContext = /flex 30|price lock 24|rolling.*fixed|fixed.*rolling|contract choice/.test(priorText);
  if (contractContext && /^(flex(?: 30)?|price lock(?: 24)?|rolling|fixed|24 months?|30 day|monthly)$/.test(latestLower)) return "contract_choice";

  const speedContext = /which speed|speed do i need|80mbps|330mbps|1,?000mbps|500.*1,?000/.test(priorText);
  if (speedContext && /^\s*\d+(?:\.\d+)?\s*(?:mbps|mb|gbps|gb)?\s*$/.test(latestLower)) return "speed_need";

  const switchingContext = /one touch switch|switching|keep my number|number transfer/.test(priorText);
  if (switchingContext && /^(yes|no|keep it|keep my number|same number|transfer it|port it)$/.test(latestLower)) return "number_porting";

  const billingContext = /first invoice|first bill|billing|invoice/.test(priorText);
  if (billingContext && /^(why|how|vat|tax|part month|pro[- ]?rata|setup|activation charge)$/.test(latestLower)) {
    return /vat|tax/.test(latestLower) ? "vat" : "first_invoice";
  }

  // If the assistant explicitly asked for a light label, keep that context even
  // for terse answers such as "red" that would otherwise be impossible to route.
  if (/light label|what lights|which light|los.*pon|internet.*light/.test(previousAssistant) && latestLower.length <= 40) return "router_lights";

  return "general";
}

export function extractAccountNumber(messages: CompanionMessage[]): string | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const match = message.content.match(ACCOUNT_NUMBER_RE);
    if (match) return match[0].toUpperCase();
  }
  return null;
}

function validIsoDate(candidate: string): string | null {
  const [year, month, day] = candidate.split("-");
  const date = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() + 1 !== Number(month)
    || date.getUTCDate() !== Number(day)
  ) return null;
  return candidate;
}

export function extractDateOfBirth(messages: CompanionMessage[]): string | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const iso = message.content.match(ISO_DOB_RE);
    if (iso) {
      const validated = validIsoDate(iso[0]);
      if (validated) return validated;
    }
    const uk = message.content.match(UK_DOB_RE);
    if (!uk) continue;
    const candidate = `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
    const validated = validIsoDate(candidate);
    if (validated) return validated;
  }
  return null;
}

export function maskAccountNumber(value: string | null | undefined): string {
  if (!value) return "not available";
  const clean = value.toUpperCase();
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 3)}••••${clean.slice(-4)}`;
}

export function maskEmail(value: string | null | undefined): string {
  if (!value || !value.includes("@")) return "not available";
  const [local, domain] = value.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > 2 ? "•••" : ""}@${domain}`;
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) return "not available";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••••••${digits.slice(-4)}`;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(ACCOUNT_NUMBER_RE, (match) => maskAccountNumber(match))
    .replace(ISO_DOB_RE, "[date of birth provided securely]")
    .replace(UK_DOB_RE, "[date of birth provided securely]")
    .replace(/\b\d{2}[- ]?\d{2}[- ]?\d{2}(?:\s*(?:account(?:\s+number)?|a\/c)?\s*)\d{8}\b/gi, "[bank details removed]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[payment number removed]")
    .replace(/\b(password|passcode|pin)\s*[:=]\s*\S+/gi, "$1: [removed]")
    .slice(0, 4000);
}

export function formatMoney(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? `£${number.toFixed(2)}` : "amount unavailable";
}

export function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "date not confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date not confirmed";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function withOptions(body: string, options: string[]): string {
  const safeOptions = options.map((option) => option.trim()).filter(Boolean).slice(0, 4);
  return `${body.trim()}\n\n<<<OPTIONS:${JSON.stringify(safeOptions)}>>>`;
}
