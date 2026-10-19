// OCCTA AI brain: LLM-driven conversational layer for the public Ollie assistant.
// Security model: this layer NEVER receives account data. Verified account answers
// stay in the deterministic path in index.ts.
//
// Provider: Claude via the Anthropic API when ANTHROPIC_API_KEY is set (no Lovable
// credits). The Lovable AI gateway is only used as a legacy fallback when that key
// is missing, so the assistant keeps working until the secret is added.

import Anthropic from "npm:@anthropic-ai/sdk@0.130.0";
import type { CompanionMessage } from "../_shared/companionCore.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";
const CLAUDE_MODEL = Deno.env.get("OLLIE_MODEL")?.trim() || "claude-opus-5-5";
const BASE_URL = "https://www.occta.co.uk";

export const OCCTA_SYSTEM_PROMPT = `You are **Ollie**, the OCCTA LIMITED customer assistant on occta.co.uk. OCCTA is a UK telecoms provider (broadband, SIM/mobile, Digital Home Phone).

# How you behave
- Talk like a sharp, warm, UK-based human expert. Plain English, no corporate filler, light dry humour is fine. Never robotic.
- Be genuinely useful on the FIRST reply: answer the question, then ask at most one focused follow-up.
- Build the conversation. Use everything the customer already told you; never re-ask for information you have.
- Stay on the same problem until it is solved or a human is genuinely needed. Do not bounce the customer between pages.
- Format with short paragraphs, **bold** for key facts, and bullet lists for steps. Keep replies under ~180 words unless walking through steps. No markdown headings.
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
If the customer asks about THEIR bill, order, services or tickets, tell them you can look it up securely and ask them to either sign in at /auth or give their OCCTA account number (starts with OCC) plus the account holder's date of birth. Never guess account facts. If a verification attempt has already failed, do not ask for the same details again — offer sign-in or a secure account link by email instead.

# Troubleshooting
Diagnose properly: ask what the router lights show, whether it affects all devices, wired vs Wi-Fi, and when it started. Give one concrete step at a time.

# Escalation
Offer a human advisor when the customer asks, when they are clearly frustrated, or when the issue needs account changes you cannot make. Say you will pass the conversation across so they do not start again.

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
];

// Server-side refusal fallbacks are only offered on these model lines.
const SUPPORTS_FALLBACKS = /^claude-(?:opus-5|fable-5|sonnet-5-5)/.test(CLAUDE_MODEL);

type BrainOptions = {
  signedIn: boolean;
  customerName?: string | null;
  knowledgeContext?: string;
  searchKnowledge: (query: string) => Promise<string>;
};

function trimHistory(messages: CompanionMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-16)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 4000) }));
}

function ensureOptions(text: string): string {
  const body = text.trim();
  if (/<<<OPTIONS:\[[\s\S]*\]>>>\s*$/.test(body)) return body;
  return `${body}\n\n<<<OPTIONS:["Tell me more","Check my address","Talk to an advisor"]>>>`;
}

function contextFor(options: BrainOptions): string {
  const context: string[] = [
    options.signedIn
      ? `The customer is signed in to their OCCTA account${options.customerName ? ` (first name: ${options.customerName})` : ""}. Account lookups run automatically for them.`
      : `The customer is NOT signed in.`,
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
): Promise<string | null> {
  // The widget history opens with Ollie's welcome; the API conversation must start with the customer.
  const history = trimHistory(messages);
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return null;

  const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
  const conversation: Anthropic.Beta.BetaMessageParam[] = history.map((message) => ({
    role: message.role as "user" | "assistant",
    content: message.content,
  }));

  try {
    for (let step = 0; step < 4; step += 1) {
      const response = await client.beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        output_config: { effort: "low" },
        ...(SUPPORTS_FALLBACKS ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        system: [
          { type: "text", text: OCCTA_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: contextFor(options) },
        ],
        tools: CLAUDE_TOOLS,
        messages: conversation,
      });

      if (response.stop_reason === "refusal") return null;

      if (response.stop_reason === "tool_use") {
        conversation.push({ role: "assistant", content: response.content });
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const input = block.input as { query?: unknown };
          const query = typeof input?.query === "string" ? input.query : "";
          const result = block.name === "search_occta_knowledge" && query ? await options.searchKnowledge(query) : "";
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result || "No matching published OCCTA content found.",
          });
        }
        conversation.push({ role: "user", content: results });
        continue;
      }

      const text = response.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("\n")
        .trim();
      return text ? ensureOptions(text.replaceAll("https://occta.co.uk", BASE_URL)) : null;
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
): Promise<string | null> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) return runWithClaude(anthropicKey, messages, options);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const conversation: ChatMessage[] = [
    { role: "system", content: OCCTA_SYSTEM_PROMPT },
    { role: "system", content: contextFor(options) },
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
    return ensureOptions(content.replaceAll("https://occta.co.uk", BASE_URL));
  }

  return null;
}
