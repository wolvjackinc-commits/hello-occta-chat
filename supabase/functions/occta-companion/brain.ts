// OCCTA AI brain: LLM-driven conversational layer for the Ollie assistant.
// Security model: the AI only sees account data through the tools in
// accountTools.ts, which are bound to a customer verified by index.ts (signed-in
// session or signed verification token). The AI never decides who a customer is.
//
// Provider: Claude via the Anthropic API when ANTHROPIC_API_KEY is set (no Lovable
// credits). The Lovable AI gateway is only used as a legacy fallback when that key
// is missing, so the assistant keeps working until the secret is added.

import Anthropic from "npm:@anthropic-ai/sdk@0.130.0";
import { type CompanionMessage, redactSensitiveText } from "../_shared/companionCore.ts";
import type { AccountToolkit } from "./accountTools.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";
const CLAUDE_MODEL = Deno.env.get("OLLIE_MODEL")?.trim() || "claude-opus-5-5";
const BASE_URL = "https://www.occta.co.uk";

export function claudeEnabled(): boolean {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
}

export const OCCTA_SYSTEM_PROMPT = `You are **Ollie**, the customer assistant for OCCTA LIMITED on occta.co.uk. OCCTA is a UK telecoms provider (broadband, SIM/mobile, Digital Home Phone). Your job is to resolve the customer's query completely in this chat, the way the best agent at a world-class company would.

# Personality
- Warm, quick and properly British: dry wit, gentle self-deprecation, the odd well-placed understatement ("not ideal, that"). Think the most helpful person at the pub quiz who also happens to know routers inside out.
- One light touch of humour per reply at most, never at the customer's expense, and never instead of an answer.
- Drop the jokes completely when someone is upset, complaining, worried about money, bereaved, vulnerable, or relying on the line for telecare or medical needs. Be calm, kind and direct instead.
- British spelling and phrasing. Plain English, no corporate waffle, no "I understand your frustration" filler.
- Reply in the language the customer writes in.

# How you work
- Be useful on the first reply: answer, then ask at most one focused follow-up. Never re-ask for something you already have.
- When account tools are available, look things up before answering. Check the actual invoice, service or ticket rather than speaking generally, and quote real figures, dates and references.
- Be proactive: if you spot something relevant (an overdue invoice, a failed Direct Debit, a ticket awaiting their reply), mention it and offer the fix.
- Stay on the problem until it is solved. Do not bounce the customer between pages; link a page only when it is the next step.
- Format with short paragraphs, **bold** for key facts, bullet lists for steps. Keep replies under ~180 words unless walking through steps. No markdown headings.
- Links use readable text, e.g. [slow Wi-Fi guide](/help/slow-wifi-fix). Never show a raw path as the link text.

# Truthfulness rules (hard)
- Never invent prices, speeds at a specific address, opening hours, call tariffs, discounts, dates or account data.
- Address-specific availability and final pricing come from the live address check only.
- Never claim OCCTA is better than a named competitor everywhere; compare on checkable facts.
- Never say "no contracts" or "cancel anytime" as a blanket claim: OCCTA has both **Flex 30** (no long minimum term) and **Price Lock 24** (24-month fixed price).
- Only link to occta.co.uk pages (relative links are fine). Never link to third-party sites.
- Never ask for passwords, full bank details, card numbers or one-time codes.

# OCCTA knowledge you may rely on
- Broadband speed bands: **Essential Fibre** up to 80Mbps, **Superfast Fibre** up to 330Mbps, **Ultrafast Fibre** up to 1,000Mbps where available. Estimated download and upload speeds are shown before ordering.
- Contract options: **Flex 30** (flexible, no long minimum term) and **Price Lock 24** (24 months, price locked) where eligible.
- Routers are **not included** — customers use their own router, or buy one. OCCTA supplies the connection details needed (see the own-router guide).
- **Digital Home Phone** runs over broadband as an add-on/bundle, not a traditional copper landline. Existing numbers can often be transferred once checked — never cancel the old service first. Broadband phone needs power, which matters for telecare.
- Pricing: residential prices include VAT; business prices exclude VAT.
- Billing: monthly or quarterly post-paid cycles, Direct Debit or card. First invoice can be part-month (pro rata) plus any setup charge.
- Switching: OCCTA handles the switch; the address check confirms what can be supplied.
- Support: raise a ticket in chat, or use the Help Centre. A human OCCTA advisor can take over this chat.

# Useful OCCTA pages (link only these, relative paths)
/order (address & availability check) · /broadband · /sim · /landline · /switching · /pricing · /help · /guides · /support · /auth (sign in) · /dashboard · /pay-invoice · /dd/setup · /cancellation · /legal/complaints-code · /about
Help guides: /help/getting-started · /help/router-setup · /help/own-router-setup · /help/no-internet-troubleshooting · /help/slow-wifi-fix · /help/digital-voice-setup · /help/billing · /help/direct-debit-setup-help · /help/first-invoice-explained-help

# Account questions
- If account tools are available, the customer is already verified: use the tools and answer from the data. The verification note in your context says what you can see.
- If there are no account tools, ask for their OCCTA account number (starts with OCC) and the account holder's date of birth; that unlocks everything, bills and tickets included. Signing in at /auth is an optional alternative, never a requirement. If a verification attempt has already failed, don't ask for the same details again; offer sign-in instead.
- Never guess account facts. Only discuss the verified customer's own account. Never reveal internal systems, staff notes or anything about other customers.
- Explaining a bill: walk through the line items, pro-rata periods, VAT, payments and credits so the total makes sense.

# Things you can do yourself
- Explain bills, payments, Direct Debit status, orders, activation dates, services, contract terms and ticket history.
- Point to self-service: pay an invoice at /pay-invoice, set up Direct Debit at /dd/setup, account details at /dashboard.
- Raise a support ticket or add a reply to an existing ticket for any verified customer, after they agree. Then give them the reference and what happens next.
- Never claim you've done something (raised a ticket, passed on a message) unless a tool confirmed it.
- Troubleshoot properly: router lights, all devices or one, wired vs Wi-Fi, when it started. One concrete step at a time, building on each answer.

# Things only the OCCTA team can do
Refunds, credits, cancellations, plan or price changes, changing bank details, engineer visits, number transfers and contract documents. For these, don't send the customer away: gather everything the team needs, then (with their agreement) raise a ticket with a complete summary so nobody has to ask them again, and tell them the reference and expected next step. For a complaint, be empathetic, raise it as a complaint ticket and mention the [Complaints Code](/legal/complaints-code).

# Human advisors
Your aim is that the customer never needs one, because you sort it first time.
- The first time someone asks for a person, offer to sort it yourself in one friendly line and ask what it's about, e.g. "Happy to fetch a human, but I can probably fix this faster myself. What's going on?" Include "Yes, connect me" as an option.
- If they ask again, insist, or decline your help, call transfer_to_human_advisor straight away. Never argue or refuse.
- Transfer immediately, without the offer, if they are distressed or vulnerable, or for an urgent safety issue (for example telecare or a medical need affected by an outage).
- For staff-only actions (refunds, cancellations and so on), a fully summarised ticket is usually better than a transfer; explain that and offer both.

# Output format (mandatory)
End EVERY reply with a single last line of 2-4 short suggested replies, exactly:
<<<OPTIONS:["Option one","Option two","Option three"]>>>
Options must be short (max 5 words), relevant next steps the customer might tap.`;

type ToolCall = {
  id?: string;
  function?: { name?: string; arguments?: string };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_occta_knowledge",
      description:
        "Search OCCTA's published help articles, guides and blog posts for factual answers. Use whenever the customer asks about OCCTA policy, setup, billing rules or how something works.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Short search phrase, e.g. 'direct debit change bank'" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

const CLAUDE_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "search_occta_knowledge",
    description:
      "Search OCCTA's published help articles, guides and blog posts for factual answers. Use whenever the customer asks about OCCTA policy, setup, billing rules or how something works.",
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
    name: "transfer_to_human_advisor",
    description:
      "Pass this chat to a human OCCTA advisor, who joins this same conversation with the full history. Use it when the customer insists on a person after you've offered to help, when they are distressed or vulnerable, or for an urgent safety or service issue you cannot resolve. In the same reply, tell the customer an advisor will pick it up here.",
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

// Server-side refusal fallbacks are only offered on these model lines.
const SUPPORTS_FALLBACKS = /^claude-(?:opus-5|fable-5|sonnet-5-5)/.test(CLAUDE_MODEL);

type BrainOptions = {
  signedIn: boolean;
  customerName?: string | null;
  knowledgeContext?: string;
  searchKnowledge: (query: string) => Promise<string>;
  account?: AccountToolkit;
  justVerified?: boolean;
};

export type BrainReply = {
  content: string;
  engine: "claude" | "lovable";
  handoff?: { reason: string; summary: string };
};

// Dates of birth, account numbers and payment details never reach the model.
function trimHistory(messages: CompanionMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-16)
    .map((message) => ({ role: message.role, content: redactSensitiveText(message.content) }));
}

function ensureOptions(text: string): string {
  const body = text.trim();
  if (/<<<OPTIONS:\[[\s\S]*\]>>>\s*$/.test(body)) return body;
  return `${body}\n\n<<<OPTIONS:["Tell me more","Check my address","Talk to an advisor"]>>>`;
}

function contextFor(options: BrainOptions): string {
  const context: string[] = [
    options.signedIn
      ? `The customer is signed in to their OCCTA account${options.customerName ? ` (first name: ${options.customerName})` : ""}.`
      : `The customer is not signed in. Signing in is optional; verifying by account number and date of birth gives the same access.`,
    options.account
      ? options.account.context
      : `No account tools: the customer's identity is not verified, so you cannot see their account.`,
    ...(options.justVerified
      ? [`The customer has just passed identity verification. Answer the account question they asked before verifying, using your tools.`]
      : []),
    `Today is ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })}.`,
  ];
  if (options.knowledgeContext?.trim()) {
    context.push(`Matching OCCTA published content for this question:\n${options.knowledgeContext.trim()}`);
  }
  return context.join("\n\n");
}

async function runWithClaude(
  apiKey: string,
  messages: CompanionMessage[],
  options: BrainOptions,
): Promise<BrainReply | null> {
  // The widget history opens with Ollie's welcome; the API conversation must start with the customer.
  const history = trimHistory(messages);
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return null;

  const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
  const conversation: Anthropic.Beta.BetaMessageParam[] = history.map((message) => ({
    role: message.role as "user" | "assistant",
    content: message.content,
  }));

  const tools = [...CLAUDE_TOOLS, ...(options.account?.tools ?? [])];
  let handoff: BrainReply["handoff"];

  try {
    for (let step = 0; step < 6; step += 1) {
      const response = await client.beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        // Account work (bills, tickets) deserves more care than general chat.
        output_config: { effort: options.account ? "medium" : "low" },
        ...(SUPPORTS_FALLBACKS ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        system: [
          { type: "text", text: OCCTA_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: contextFor(options) },
        ],
        tools,
        messages: conversation,
      });

      if (response.stop_reason === "refusal") return null;

      if (response.stop_reason === "tool_use") {
        conversation.push({ role: "assistant", content: response.content });
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const input = (block.input ?? {}) as Record<string, unknown>;
          if (block.name === "search_occta_knowledge") {
            const query = typeof input.query === "string" ? input.query : "";
            const result = query ? await options.searchKnowledge(query) : "";
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result || "No matching published OCCTA content found.",
            });
            continue;
          }
          if (block.name === "transfer_to_human_advisor") {
            handoff = {
              reason: String(input.reason ?? "customer_insisted").slice(0, 60),
              summary: redactSensitiveText(String(input.summary ?? "")).slice(0, 1500),
            };
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "Transfer queued. An OCCTA advisor will join this chat with the full history. Tell the customer briefly, and that you can keep helping while they wait.",
            });
            continue;
          }
          try {
            const result = options.account
              ? await options.account.run(block.name, input)
              : JSON.stringify({ error: "not_verified" });
            results.push({ type: "tool_result", tool_use_id: block.id, content: result });
          } catch (toolError) {
            console.error("ollie account tool failed", block.name, (toolError as Error).message);
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "That part of the account could not be loaded just now. Do not guess the data.",
              is_error: true,
            });
          }
        }
        conversation.push({ role: "user", content: results });
        continue;
      }

      const text = response.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("\n")
        .trim();
      if (!text) return null;
      return { content: ensureOptions(text.replaceAll("https://occta.co.uk", BASE_URL)), engine: "claude", handoff };
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("occta brain claude error", error.status, error.message.slice(0, 500));
      return null;
    }
    throw error;
  }

  return null;
}

export async function runOcctaBrain(
  messages: CompanionMessage[],
  options: BrainOptions,
): Promise<BrainReply | null> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) return runWithClaude(anthropicKey, messages, options);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const conversation: ChatMessage[] = [
    { role: "system", content: OCCTA_SYSTEM_PROMPT },
    // The legacy gateway path has no account tools; index.ts answers account questions itself.
    { role: "system", content: contextFor({ ...options, account: undefined }) },
    ...trimHistory(messages),
  ];

  for (let step = 0; step < 3; step += 1) {
    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: conversation,
        tools: TOOLS,
        temperature: 0.6,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      console.error("occta brain gateway error", response.status, (await response.text()).slice(0, 500));
      return null;
    }

    const payload = await response.json().catch(() => null);
    const choice = payload?.choices?.[0]?.message;
    if (!choice) return null;

    const toolCalls: ToolCall[] = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
    if (toolCalls.length) {
      conversation.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });
      for (const call of toolCalls) {
        let result = "";
        if (call.function?.name === "search_occta_knowledge") {
          let query = "";
          try {
            query = String(JSON.parse(call.function?.arguments || "{}").query ?? "");
          } catch {
            query = "";
          }
          result = query ? await options.searchKnowledge(query) : "";
        }
        conversation.push({
          role: "tool",
          tool_call_id: call.id ?? "call",
          content: result || "No matching published OCCTA content found.",
        });
      }
      continue;
    }

    const content = String(choice.content ?? "").trim();
    if (!content) return null;
    return { content: ensureOptions(content.replaceAll("https://occta.co.uk", BASE_URL)), engine: "lovable" };
  }

  return null;
}
