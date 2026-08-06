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
const UK_DOB_RE = /\b([0-2]?\d|3[01])[\/.\-](0?\d|1[0-2])[\/.\-]((?:19|20)\d{2})\b/;

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
    const personal = /\b(my|mine|me|account|customer|logged in|signed in)\b/.test(text)
      || /^(view|show|check|track|explain)\s+(invoices?|orders?|services?|tickets?|account|installation)/.test(text);
    if (!personal) continue;
    if (/\b(invoice|invoices|bill|billing statement|latest bill|payment status)\b/.test(text)) return "invoices";
    if (/\b(installation|activation|engineer|go live|go-live|appointment)\b/.test(text)) return "installation";
    if (/\b(order|orders|track|tracking)\b/.test(text)) return "orders";
    if (/\b(service|services|broadband line|mobile line|sim service|digital voice)\b/.test(text)) return "services";
    if (/\b(ticket|tickets|support case|support request|complaint status)\b/.test(text)) return "tickets";
    if (/\b(document|documents|contract summary|receipt|receipts)\b/.test(text)) return "documents";
    if (/\b(account|profile|details|overview)\b/.test(text)) return "overview";
  }
  return null;
}

export function detectPublicIntent(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(no internet|internet down|broadband down|offline|red light|los light)\b/.test(lower)) return "no_internet";
  if (/\b(slow wi-?fi|slow broadband|buffering|poor signal|weak wi-?fi)\b/.test(lower)) return "slow_wifi";
  if (/\b(router|pppoe|wan port|ont|mesh|wi-?fi setup)\b/.test(lower)) return "router";
  if (/\b(direct debit|dd mandate|bank mandate|payment method)\b/.test(lower)) return "direct_debit";
  if (/\b(first invoice|first bill|pro[- ]?rata|part month)\b/.test(lower)) return "first_invoice";
  if (/\b(cancel|cancellation|leave occta|notice period|termination|exit fee)\b/.test(lower)) return "cancellation";
  if (/\b(switch|one touch switch|change provider|keep my number|port number)\b/.test(lower)) return "switching";
  if (/\b(complaint|complain|adr|ombudsman)\b/.test(lower)) return "complaints";
  if (/\b(vulnerable|telecare|medical alarm|priority support|battery backup)\b/.test(lower)) return "vulnerable";
  if (/\b(sim|esim|mobile plan|mobile data|roaming)\b/.test(lower)) return "sim";
  if (/\b(landline|digital voice|home phone|pstn)\b/.test(lower)) return "voice";
  if (/\b(broadband|full fibre|fttp|sogea|internet plan|price lock|flex 30)\b/.test(lower)) return "broadband";
  if (/\b(human|advisor|agent|person|speak to support)\b/.test(lower)) return "human";
  return "general";
}

export function extractAccountNumber(messages: CompanionMessage[]): string | null {
  const match = conversationUserText(messages).match(ACCOUNT_NUMBER_RE);
  return match ? match[0].toUpperCase() : null;
}

export function extractDateOfBirth(messages: CompanionMessage[]): string | null {
  const text = conversationUserText(messages);
  const iso = text.match(ISO_DOB_RE);
  if (iso) return iso[0];
  const uk = text.match(UK_DOB_RE);
  if (!uk) return null;
  const day = uk[1].padStart(2, "0");
  const month = uk[2].padStart(2, "0");
  const year = uk[3];
  const candidate = `${year}-${month}-${day}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null;
  return candidate;
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
    .replace(/\b\d{6}\s?\d{8}\b/g, "[bank details removed]")
    .replace(/\b(?:password|passcode|pin)\s*[:=]\s*\S+/gi, "$1: [removed]")
    .slice(0, 2000);
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
