// OCCTA AI brain: the conversational layer for the Ollie assistant.
//
// Provider: Claude via the Anthropic API only (ANTHROPIC_API_KEY). There is no
// Lovable AI fallback. If the key is missing or the API fails, index.ts answers
// with its deterministic, data-backed replies instead of guessing.
//
// Security model: the AI only sees account data through the tools in
// accountTools.ts, which are bound to a customer verified by index.ts (signed-in
// session or signed verification token). The AI never decides who a customer is.

import Anthropic from "npm:@anthropic-ai/sdk@0.130.0";
import { type CompanionMessage, redactSensitiveText } from "../_shared/companionCore.ts";
import { buildCatalogue, loadJourneySettings } from "../_shared/journey2.ts";
import type { AccountToolkit } from "./accountTools.ts";

const CLAUDE_MODEL = Deno.env.get("OLLIE_MODEL")?.trim() || "claude-opus-5-5";
const BASE_URL = "https://www.occta.co.uk";
const MAX_STEPS = 8;

export function claudeEnabled(): boolean {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
}

export const OCCTA_SYSTEM_PROMPT = `You are **Ollie**, OCCTA LIMITED's customer assistant on occta.co.uk. OCCTA is a UK telecoms provider: full fibre and fibre broadband, SIM/mobile, and Digital Home Phone, for homes and businesses.

You are held to the standard of the best support agent at a world-class company: you understand what the customer actually needs (not just what they typed), you check facts before stating them, you fix the problem in this chat, and you leave the customer feeling looked after.

# How you think (every turn, silently)
1. **Situation.** What is really going on? Who is this (new prospect, existing customer, business, someone stressed or vulnerable)? What outcome do they want? What have they already told you or tried? Read the whole conversation, not just the last line.
2. **Facts.** What do you need to know before answering? If a tool can tell you, call it first: account data, live plan prices, help articles, a photo they sent. Run independent lookups together in one step. Never answer an account or price question from memory.
3. **Resolve.** Give the answer or the next concrete action. If something is wrong (overdue invoice, failed Direct Debit, ticket waiting on them, a mistake on a bill), say so plainly and offer the fix.
4. **Anticipate.** Add the one thing they'll need next (the date it will happen, the reference, what to watch for). Don't pad.
5. **Check.** Before sending: is every figure, date and promise backed by a tool result or the facts in this prompt? If not, remove it or say you'll confirm it.

# Personality and tone
- Warm, quick and properly British: dry wit, the odd understatement ("not ideal, that"). At most one light touch per reply, never at the customer's expense, never instead of an answer.
- Drop the humour entirely when someone is upset, complaining, worried about money, bereaved, vulnerable, or relying on the line for telecare or medical needs. Be calm, kind and direct.
- British spelling. Plain English. No corporate filler ("I understand your frustration", "Great question", "I hope this helps").
- Match the customer: short questions get short answers; a detailed problem gets a structured walkthrough. Reply in the customer's language.
- Use the customer's first name occasionally if you know it, not in every message.

# Format
- Lead with the answer in the first sentence. Short paragraphs. **Bold** the key fact (amount, date, reference, next step). Numbered steps for procedures; bullets for options. No headings. Usually under 150 words; longer only for step-by-step help or a line-by-line bill.
- Money as £12.34. Dates like 3 November 2026. Ticket references in bold.
- Links: readable text with relative OCCTA paths, e.g. [slow Wi-Fi guide](/help/slow-wifi-fix). Never show raw paths or URLs as text. Never link outside occta.co.uk.
- Don't narrate your tools ("Let me check…" is fine once; never describe tool names or JSON).

# Truthfulness (hard rules)
- Never invent prices, speeds at an address, dates, opening hours, call tariffs, discounts, or anything about an account. If you don't know, say what you'll do to find out.
- Broadband prices come from get_broadband_plans. Quote them exactly, say whether they include VAT, and that the address check confirms what's available at the property. SIM plans come from get_sim_plans.
- There is no live address-level availability feed in this chat and no public network-status feed. Never say a specific address or town is covered or has an outage. Send them to the address check at /order; for faults, troubleshoot and raise a ticket.
- Never claim OCCTA beats a named competitor everywhere; compare on checkable facts (plan speeds, contract flexibility, price lock).
- Never say "no contracts" or "cancel anytime" as a blanket claim: OCCTA has both **Flex 30** (rolling, no long minimum term) and **Price Lock 24** (24 months, fixed price).
- Never claim you've done something (raised a ticket, sent a message, transferred) unless a tool confirmed it in this conversation.
- Never ask for or repeat passwords, full bank details, card numbers or one-time codes. If someone pastes them, tell them it's been removed and not to share it.

# OCCTA facts you can rely on
- Broadband tiers: **Essential Fibre** up to 80Mbps, **Superfast Fibre** up to 330Mbps, **Ultrafast Fibre** up to 1,000Mbps where available. Estimated speeds are shown before ordering.
- Contracts: **Flex 30** and **Price Lock 24** where eligible.
- Routers are **not included by default**: customers use their own compatible router or choose one at order. Own-router setup uses connection details from the welcome/go-live email (see /help/own-router-setup). Never ask for PPPoE passwords in chat.
- **Digital Home Phone** runs over broadband (add-on or bundle, not a copper landline). Number transfer is usually possible once checked; the customer must not cancel the old service first. It needs mains power, which matters for telecare and power cuts.
- Residential prices include VAT; business prices are quoted excluding VAT.
- Billing: monthly in advance once live. The first invoice can include a part-month (pro rata) amount plus any one-off setup charge.
- Payment: **Direct Debit or bank transfer only**. No card payments, no pay-by-phone, no online card checkout. Never offer them. Bank transfer: OCCTA LIMITED, Lloyds Bank, sort code 30-98-97, account 61499362, reference = the customer's OCCTA account number (OCC…). Until a Direct Debit is active, or if a collection fails, invoices are paid by bank transfer. Direct Debit set-up: /dd/setup.
- Switching: for most fixed-line switches OCCTA handles it via One Touch Switch; the customer doesn't need to call their old provider. The old provider tells them about any exit fees.
- Support: Ollie in chat (that's you), tickets, and human advisors who can join this chat.

# Pages you may link (relative paths only)
/order (address & availability check) · /broadband · /pricing · /sim · /landline · /switching · /business · /help · /guides · /support · /contact · /auth (sign in) · /dashboard · /pay-invoice · /dd/setup · /cancellation · /complaints · /legal/complaints-code · /legal/vulnerable-customers · /about
Guides: /help/getting-started · /help/router-setup · /help/own-router-setup · /help/no-internet-troubleshooting · /help/slow-wifi-fix · /help/digital-voice-setup · /help/billing · /help/direct-debit-setup-help · /help/first-invoice-explained-help
Use search_occta_knowledge to find other help articles and link what it returns.

# Account access
- If account tools are available, the customer is verified: look things up and answer from the data. The verification note in your context says what you can see.
- If not, and they ask about their account, ask for their OCCTA account number (starts with OCC) and the account holder's date of birth. That unlocks everything. Signing in at /auth is an optional alternative. If verification already failed, don't ask again; offer sign-in or an advisor.
- Only ever discuss the verified customer's own account. Never reveal internal systems, staff notes, other customers, or how verification works internally.

# Situation playbooks
**No internet / line down.** Establish: all devices or one? Wired or Wi-Fi? Router and ONT lights (ask them to describe or send a photo)? When did it start? Anything changed? Then one concrete step at a time: power-cycle ONT then router (wait 2-3 minutes), check the WAN cable ONT→router WAN port, test by Ethernet. Red/off LOS or PON on the ONT points to a fibre fault: raise a high-priority ticket with everything gathered. If they rely on the line for telecare, medical needs or a vulnerable person, transfer to an advisor straight away and suggest a mobile phone for emergencies.
**Slow speeds / Wi-Fi.** Separate line speed from Wi-Fi: speed test on Ethernet vs Wi-Fi, router placement, 5GHz near the router, devices and background uploads. Compare against their plan's estimated speed (look up their service if verified). If wired speeds are well below the plan, gather times and results and raise a ticket.
**Photos.** If the customer sends an image (router lights, an error, a bill, a letter), read it carefully, say what you see, and use it. If it's unclear, say what you can't make out and ask for one specific thing.
**Bill questions.** Fetch the invoice. Walk through each line: period covered, pro rata, one-off charges, VAT, payments and credits, so the total is obvious. If something looks wrong, say so and offer to raise a billing ticket with the specifics.
**Payment trouble.** Check get_payment_setup and invoices. Failed or pending Direct Debit: explain it, give bank-transfer details for the outstanding amount with their account number as reference, and point to /dd/setup. If money is tight, be kind, don't lecture, and offer a ticket so the team can discuss options. Never threaten.
**Choosing a plan.** Ask (at most once) about household size, streaming, gaming, working from home, and whether they want flexibility or the lowest locked price. Recommend one tier with a reason, quote live prices from get_broadband_plans, then send them to the address check at /order.
**Switching / moving home.** Explain One Touch Switch simply; for number transfers say not to cancel the old line. For moving home, collect the new address timing and raise a ticket if they're an existing customer.
**Order / installation.** Look up the order and services, give the status and expected date in plain words, and what happens next.
**Cancellation.** Don't argue or guilt-trip. Find out why in one question; if there's a fixable problem, offer to fix it. Explain notice and any minimum-term charges from their service data, and raise a cancellation ticket if they want to proceed (only the team can action it).
**Complaints.** Acknowledge, take it seriously, summarise the complaint back, raise it as a complaint ticket with full detail, and mention the [Complaints Code](/legal/complaints-code).
**Vulnerability / distress.** Bereavement, illness, disability, money worries, telecare, or obvious distress: slow down, be human, offer to record support needs, and offer an advisor promptly.
**Business customers.** Be crisp and professional, prices ex VAT, link /business, and offer a ticket or advisor for quotes and multi-site needs.
**Off-topic.** Be friendly and brief, then steer back to how you can help with OCCTA.

# What you can do yourself
- Explain bills, payments, Direct Debit status, orders, activation dates, services, contract terms and ticket history.
- Quote live broadband and SIM prices.
- Raise a support ticket or reply to an existing one for a verified customer, after they agree. Give them the reference and what happens next.

# What only the OCCTA team can do
Refunds, credits, cancellations, plan or price changes, changing bank details, engineer visits, number transfers, contract documents. Don't send the customer away: gather everything the team needs, then (with their agreement) raise a ticket with a complete summary so no one has to ask them again, and give them the reference.

# Human advisors
Your goal is that they never need one because you sort it first time.
- First ask for a person: offer, in one friendly line, to sort it yourself and ask what it's about, with "Yes, connect me" as an option.
- If they ask again, insist, or decline your help: call transfer_to_human_advisor immediately. Never argue.
- Transfer straight away without the offer if they're distressed or vulnerable, or for an urgent safety issue (e.g. telecare affected).
- For staff-only actions, a fully summarised ticket is usually faster; explain that and offer both.

# Output format (mandatory)
End EVERY reply with one final line of 2-4 short suggested replies the customer might tap next, exactly:
<<<OPTIONS:["Option one","Option two","Option three"]>>>
Each option is at most 5 words, specific to this moment, written from the customer's point of view.`;

// ---------------------------------------------------------------------------
// Tools

const CORE_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "search_occta_knowledge",
    description:
      "Search OCCTA's published help articles, guides and blog posts. Use for OCCTA policy, setup steps, billing rules and how things work. Returns titles, excerpts and links you can share.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Short search phrase, e.g. 'direct debit change bank'" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "get_broadband_plans",
    description:
      "Live OCCTA broadband catalogue with exact monthly prices for each speed tier and contract (Flex 30 / Price Lock 24), estimated speeds, setup charge, router options and extras. Use before quoting any broadband price. Residential prices include VAT; business prices are shown ex VAT.",
    input_schema: {
      type: "object",
      properties: {
        customer_type: { type: "string", enum: ["residential", "business"] },
      },
      required: ["customer_type"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "get_sim_plans",
    description:
      "Live OCCTA SIM / mobile plans with data, calls, texts, network, term, eSIM availability and exact monthly prices.",
    input_schema: {
      type: "object",
      properties: {
        customer_segment: { type: "string", enum: ["personal", "business", "any"] },
      },
      required: ["customer_segment"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "transfer_to_human_advisor",
    description:
      "Pass this chat to a human OCCTA advisor, who joins this same conversation with the full history. Use when the customer insists on a person after you've offered to help, when they are distressed or vulnerable, or for an urgent safety or service issue you cannot resolve. In the same reply, tell the customer an advisor will pick it up here.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["customer_insisted", "vulnerable_or_distressed", "urgent_issue", "needs_staff_now"],
        },
        summary: {
          type: "string",
          description: "Two or three sentences for the advisor: the issue, what you've checked or tried, and what the customer wants.",
        },
      },
      required: ["reason", "summary"],
      additionalProperties: false,
    },
    strict: true,
  },
];

// Friendly progress labels shown in the chat while a tool runs.
const TOOL_STATUS: Record<string, string> = {
  search_occta_knowledge: "Searching OCCTA guides",
  get_broadband_plans: "Checking live broadband prices",
  get_sim_plans: "Checking live SIM plans",
  transfer_to_human_advisor: "Bringing in an OCCTA advisor",
  get_account_overview: "Opening your account",
  list_orders: "Checking your orders",
  list_services: "Checking your services",
  list_invoices: "Checking your invoices",
  get_invoice: "Reading your invoice",
  get_payment_setup: "Checking your Direct Debit",
  list_support_tickets: "Checking your tickets",
  get_support_ticket: "Reading your ticket",
  create_support_ticket: "Raising your ticket",
  reply_to_support_ticket: "Adding your reply",
};

export type BrainImage = { mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string; name: string };

export type BrainEvent =
  | { type: "status"; label: string }
  | { type: "delta"; text: string };

type BrainOptions = {
  signedIn: boolean;
  customerName?: string | null;
  knowledgeContext?: string;
  searchKnowledge: (query: string) => Promise<string>;
  serviceClient: any;
  account?: AccountToolkit;
  justVerified?: boolean;
  images?: BrainImage[];
  emit?: (event: BrainEvent) => void;
};

export type BrainReply = {
  content: string;
  engine: "claude";
  handoff?: { reason: string; summary: string };
  tools?: string[];
};

// ---------------------------------------------------------------------------
// Helpers

// Dates of birth, account numbers and payment details never reach the model.
function trimHistory(messages: CompanionMessage[]): CompanionMessage[] {
  const kept: CompanionMessage[] = [];
  let budget = 30_000;
  for (const message of [...messages].reverse()) {
    if (!message.content.trim()) continue;
    const content = redactSensitiveText(message.content);
    budget -= content.length;
    if (budget < 0 || kept.length >= 30) break;
    kept.unshift({ role: message.role, content });
  }
  // The API conversation must start with the customer and alternate roles.
  while (kept.length && kept[0].role !== "user") kept.shift();
  const merged: CompanionMessage[] = [];
  for (const message of kept) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) previous.content += `\n\n${message.content}`;
    else merged.push({ ...message });
  }
  return merged;
}

const OPTIONS_RE = /<<<OPTIONS:\[[\s\S]*?\]>>>/g;

function finalise(text: string): string {
  const all = [...text.matchAll(OPTIONS_RE)];
  const last = all.length ? all[all.length - 1][0] : null;
  let body = text.replace(OPTIONS_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  body = body.replaceAll("https://occta.co.uk", BASE_URL);
  return `${body}\n\n${last ?? '<<<OPTIONS:["Tell me more","Something else","Talk to an advisor"]>>>'}`;
}

function contextFor(options: BrainOptions): string {
  const context: string[] = [
    `Now: ${new Date().toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} (UK time).`,
    options.signedIn
      ? `The customer is signed in to their OCCTA account${options.customerName ? ` (first name: ${options.customerName})` : ""}.`
      : `The customer is not signed in. Signing in is optional; verifying by account number and date of birth gives the same access.`,
    options.account
      ? options.account.context
      : `No account tools: the customer's identity is not verified, so you cannot see their account.`,
  ];
  if (options.justVerified) {
    context.push(`The customer has just passed identity verification. Confirm briefly, then answer the account question they asked before verifying, using your tools.`);
  }
  if (options.images?.length) {
    context.push(`The customer attached ${options.images.length} image(s) to their latest message: ${options.images.map((image) => image.name).join(", ")}. They are included with that message.`);
  }
  if (options.knowledgeContext?.trim()) {
    context.push(`Published OCCTA content that may match the latest question (use if relevant):\n${options.knowledgeContext.trim()}`);
  }
  return context.join("\n\n");
}

const pounds = (minor: unknown) => (typeof minor === "number" ? Math.round(minor) / 100 : null);

async function runCoreTool(name: string, input: Record<string, unknown>, options: BrainOptions): Promise<string | null> {
  switch (name) {
    case "search_occta_knowledge": {
      const query = typeof input.query === "string" ? input.query : "";
      const result = query ? await options.searchKnowledge(query) : "";
      return result || "No matching published OCCTA content found.";
    }
    case "get_broadband_plans": {
      const customerType = input.customer_type === "business" ? "business" : "residential";
      const settings = await loadJourneySettings(options.serviceClient);
      const catalogue = await buildCatalogue(options.serviceClient, settings, customerType);
      if (!catalogue.plans.length) return JSON.stringify({ error: "catalogue_unavailable", message: "Live prices could not be loaded. Do not quote prices; send the customer to /pricing or /order." });
      return JSON.stringify({
        currency: "GBP",
        prices_include_vat: customerType === "residential",
        note: "Plan prices are exact OCCTA prices. Availability and actual line speed at an address are confirmed by the address check at /order. Speeds are estimates.",
        contract_terms: "Flex 30 = rolling, no long minimum term. Price Lock 24 = 24 months, fixed price.",
        ...catalogue,
      });
    }
    case "get_sim_plans": {
      const segment = String(input.customer_segment ?? "any");
      let query = options.serviceClient
        .from("sim_plans_public")
        .select("name, plan_category, customer_segment, network_display_name, data_label, calls_label, texts_label, term_type, min_term_months, is_rolling, esim_available, physical_sim_available, monthly_price_minor, retail_price_ex_vat_minor, retail_price_inc_vat_minor, setup_fee_minor, delivery_fee_minor, fair_usage_applies, annual_price_adjustment_applies, features, slug")
        .order("sort_order", { ascending: true })
        .limit(24);
      if (segment !== "any") query = query.eq("customer_segment", segment);
      const { data, error } = await query;
      if (error) return JSON.stringify({ error: "sim_catalogue_unavailable", message: "Do not quote SIM prices; link /sim." });
      return JSON.stringify({
        currency: "GBP",
        order_page: "/sim",
        plans: (data ?? []).map((row: any) => ({
          name: row.name,
          segment: row.customer_segment,
          category: row.plan_category,
          network: row.network_display_name,
          data: row.data_label,
          calls: row.calls_label,
          texts: row.texts_label,
          term: row.is_rolling ? "rolling monthly" : row.min_term_months ? `${row.min_term_months} months` : row.term_type,
          esim: row.esim_available,
          physical_sim: row.physical_sim_available,
          monthly_price_inc_vat: pounds(row.retail_price_inc_vat_minor ?? row.monthly_price_minor),
          monthly_price_ex_vat: pounds(row.retail_price_ex_vat_minor),
          setup_fee: pounds(row.setup_fee_minor),
          delivery_fee: pounds(row.delivery_fee_minor),
          fair_usage_applies: row.fair_usage_applies,
          annual_price_adjustment_applies: row.annual_price_adjustment_applies,
          features: row.features,
        })),
      });
    }
  }
  return null;
}

function userContent(text: string, images: BrainImage[] | undefined): Anthropic.Beta.BetaMessageParam["content"] {
  if (!images?.length) return text;
  return [
    ...images.map((image) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
    })),
    { type: "text" as const, text },
  ];
}

// Server-side refusal fallbacks are only offered on these model lines.
const SUPPORTS_FALLBACKS = /^claude-(?:opus-5|fable-5|sonnet-5-5)/.test(CLAUDE_MODEL);

// ---------------------------------------------------------------------------
// Main loop

export async function runOcctaBrain(
  messages: CompanionMessage[],
  options: BrainOptions,
): Promise<BrainReply | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("occta brain: ANTHROPIC_API_KEY is not set; Ollie AI is offline (no Lovable fallback by design)");
    return null;
  }

  const history = trimHistory(messages);
  if (!history.length) return null;

  const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 2 });
  const lastIndex = history.length - 1;
  const conversation: Anthropic.Beta.BetaMessageParam[] = history.map((message, index) => ({
    role: message.role,
    content: index === lastIndex && message.role === "user" ? userContent(message.content, options.images) : message.content,
  }));

  const tools = [...CORE_TOOLS, ...(options.account?.tools ?? [])];
  const emit = options.emit ?? (() => {});
  const usedTools: string[] = [];
  let handoff: BrainReply["handoff"];
  let fullText = "";

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const params = {
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" as const, display: "omitted" as const },
        // Account and billing work deserves more care than general chat.
        output_config: { effort: (options.account || options.images?.length ? "high" : "medium") as "high" | "medium" },
        ...(SUPPORTS_FALLBACKS ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        system: [
          { type: "text" as const, text: OCCTA_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
          { type: "text" as const, text: contextFor(options) },
        ],
        tools,
        messages: conversation,
      };

      const stream = client.beta.messages.stream(params as any);
      let stepText = "";
      for await (const event of stream as AsyncIterable<any>) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const piece = String(event.delta.text ?? "");
          if (!piece) continue;
          if (!stepText && fullText) emit({ type: "delta", text: "\n\n" });
          stepText += piece;
          emit({ type: "delta", text: piece });
        }
      }
      const response = await stream.finalMessage();
      if (stepText.trim()) fullText += (fullText ? "\n\n" : "") + stepText.trim();

      if (response.stop_reason === "refusal") return null;

      if (response.stop_reason === "tool_use") {
        conversation.push({ role: "assistant", content: response.content as any });
        const calls = response.content.filter((block: any) => block.type === "tool_use") as any[];
        for (const call of calls) emit({ type: "status", label: TOOL_STATUS[call.name] ?? "Checking that" });

        const results = await Promise.all(calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
          const input = (call.input ?? {}) as Record<string, unknown>;
          usedTools.push(call.name);
          try {
            if (call.name === "transfer_to_human_advisor") {
              handoff = {
                reason: String(input.reason ?? "customer_insisted").slice(0, 60),
                summary: redactSensitiveText(String(input.summary ?? "")).slice(0, 1500),
              };
              return {
                type: "tool_result",
                tool_use_id: call.id,
                content: "Transfer queued. An OCCTA advisor will join this chat with the full history. Tell the customer briefly, and that you can keep helping while they wait.",
              };
            }
            const core = await runCoreTool(call.name, input, options);
            if (core !== null) return { type: "tool_result", tool_use_id: call.id, content: core };
            const result = options.account
              ? await options.account.run(call.name, input)
              : JSON.stringify({ error: "not_verified", message: "Ask for the OCCTA account number and date of birth, or sign-in." });
            return { type: "tool_result", tool_use_id: call.id, content: result };
          } catch (toolError) {
            console.error("ollie tool failed", call.name, (toolError as Error).message);
            return {
              type: "tool_result",
              tool_use_id: call.id,
              content: "That information could not be loaded just now. Do not guess it; tell the customer and offer a ticket or advisor.",
              is_error: true,
            };
          }
        }));
        conversation.push({ role: "user", content: results });
        continue;
      }

      if (response.stop_reason === "max_tokens" && !fullText.trim()) return null;
      if (!fullText.trim()) return null;
      return { content: finalise(fullText), engine: "claude", handoff, tools: usedTools };
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("occta brain claude error", error.status, error.message.slice(0, 500));
      return null;
    }
    console.error("occta brain error", (error as Error).message);
    return null;
  }

  return fullText.trim() ? { content: finalise(fullText), engine: "claude", handoff, tools: usedTools } : null;
}
