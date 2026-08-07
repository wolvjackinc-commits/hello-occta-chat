import {
  detectAccountIntent,
  type CompanionMessage,
} from "../../../supabase/functions/_shared/companionCore.ts";
import { resolvePublicConversationReply } from "./ollieConversation";

const BASE_URL = "https://www.occta.co.uk";

function withOptions(body: string, options: string[]): string {
  return `${body.trim()}\n\n<<<OPTIONS:${JSON.stringify(options.slice(0, 4))}>>>`;
}

function latestUser(messages: CompanionMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

function previousAssistant(messages: CompanionMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9£.%@+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recentText(messages: CompanionMessage[], turns = 10): string {
  return messages.slice(-turns).map((message) => normalise(message.content)).join("\n");
}

export function isExplicitHumanRequest(text: string): boolean {
  const value = normalise(text);
  return /\b(?:human|advisor|agent|person|someone|member of staff|customer service)\b/.test(value)
    && /\b(?:speak|talk|connect|transfer|contact|need|want|like)\b/.test(value);
}

export function shouldOfferHuman(messages: CompanionMessage[]): boolean {
  const users = messages.filter((message) => message.role === "user").slice(-8);
  if (users.some((message) => isExplicitHumanRequest(message.content))) return true;

  const dissatisfied = users.filter((message) => {
    const value = normalise(message.content);
    return /\b(?:still|again|already|tried|not fixed|not working|didn't work|doesn't work|wrong|not right|not helpful|not satisfied|frustrat|annoy|same problem|same issue|you keep|i told you)\b/.test(value);
  }).length;

  const assistantFailures = messages
    .filter((message) => message.role === "assistant")
    .slice(-6)
    .filter((message) => /couldn't|unable|can't safely|not enough verified|try again|temporarily unavailable/i.test(message.content))
    .length;

  return dissatisfied >= 2 || assistantFailures >= 2;
}

function generalServicesReply(): string {
  return withOptions(
    `OCCTA can help with **broadband**, **SIM/mobile**, and **Digital Home Phone**.\n\nFor broadband, the public speed bands are **Essential Fibre up to 80Mbps**, **Superfast Fibre up to 330Mbps**, and **Ultrafast Fibre up to 1,000Mbps where available**. Broadband can be offered as **Flex 30** or **Price Lock 24** where eligible.\n\nI won't guess a postcode-specific speed or price — the live address check confirms those before you order.`,
    ["Check broadband availability", "Which broadband speed do I need?", "View SIM plans", "How switching works"],
  );
}

function fastInternetReply(): string {
  return withOptions(
    `Yes — OCCTA can offer **full-fibre speeds up to 1,000Mbps where the address supports it**. That doesn't mean every property can get the same speed, so the sensible next step is to check the exact address rather than promise a headline speed.\n\nIf you tell me how many people/devices will use it, I can also help you decide whether you actually need 80, 330 or 1,000Mbps.`,
    ["Check broadband availability", "Help me choose a speed", "What is full fibre?"],
  );
}

function reputationReply(): string {
  return withOptions(
    `I'm OCCTA's own assistant, so I shouldn't pretend to be an independent reviewer and tell you we're “good” just because I work here.\n\nWhat I *can* do is help you judge us on things that are checkable: the service available at your address, the exact price and term before ordering, our published policies, support routes, and independent sources when relevant. If you tell me what matters most — price, speed, flexibility or support — I'll show you the relevant information.`,
    ["Compare broadband options", "Check availability", "Read OCCTA policies"],
  );
}

function companyReply(): string {
  return withOptions(
    `OCCTA is **OCCTA LIMITED**, a UK telecommunications provider. For company background I’ll use the information OCCTA actually publishes rather than inventing an owner or shareholder.\n\n[**About OCCTA →**](${BASE_URL}/about)\n\nIf you mean the legal company ownership/shareholders specifically, say that and I’ll point you to the appropriate public company record rather than guess.`,
    ["Open About OCCTA", "I mean legal ownership", "What services do you provide?"],
  );
}

function supportHoursReply(): string {
  return withOptions(
    `I don't want to invent opening hours. The reliable contact routes are kept on OCCTA's support/contact pages.\n\n[**Open OCCTA Support →**](${BASE_URL}/support)\n\nIf you tell me what you need help with, I'll try to resolve it here first rather than sending you away.`,
    ["Open Help Centre", "Tell you my problem"],
  );
}

function callChargesReply(): string {
  return withOptions(
    `Call setup fees and per-minute charges are commercial tariff details, so I won't make up a “no setup fee” answer. The correct figure depends on the actual Digital Home Phone/call package and current tariff.\n\nI can help you find the relevant published tariff or explain how Digital Home Phone works, but the final charge must come from current OCCTA price information for that service.`,
    ["Digital Voice information", "Open pricing", "Search Help Centre"],
  );
}

function orderTimescaleReply(): string {
  return withOptions(
    `If you **haven't placed an order yet**, there isn't an account/order status to verify. The processing and activation time depends on the technology available at the address, whether an engineer visit is needed, and any number-transfer or supplier dependencies.\n\nStart with the address check; the order journey can then show the relevant setup expectations before you commit.`,
    ["Check broadband availability", "How installation works", "How switching works"],
  );
}

function loginHelpReply(): string {
  return withOptions(
    `I can help with that. If the dashboard won't accept your login, first use the **forgot/reset password** route on the sign-in page rather than repeatedly retrying the same password. Make sure you're using the email registered to the OCCTA account.\n\n[**Open secure sign-in →**](${BASE_URL}/auth)\n\nIf the reset email doesn't arrive or the dashboard still fails after a successful reset, tell me exactly what happens on screen and I'll keep diagnosing it.`,
    ["Open sign in", "Reset email didn't arrive", "I can sign in but dashboard fails"],
  );
}

function refundPolicyReply(): string {
  return withOptions(
    `For a **refund or final-bill policy** question, the safest route is the published cancellation/final-bill guidance rather than a made-up timescale.\n\n[**Cancellation information →**](${BASE_URL}/cancellation)\n[**Help Centre →**](${BASE_URL}/help)\n\nIf you're asking about a refund that OCCTA already owes *you*, that is account-specific and should be checked against the signed-in account/support history rather than generic policy text.`,
    ["I am waiting for my refund", "Open cancellation information", "Open Help Centre"],
  );
}

function verificationLoopReply(): string {
  return withOptions(
    `I can see the previous verification attempt didn't work. **I'm not going to keep asking you for the same date of birth.**\n\nUse secure account sign-in instead. If you cannot sign in, enter the **email registered on the OCCTA account** and I can request a secure account-access link without exposing whether that email exists in our records.`,
    ["I'll enter my registered email", "Open sign in"],
  );
}

export function resolveIntelligentPublicReply(messages: CompanionMessage[]): string | null {
  const latest = latestUser(messages);
  if (!latest) return null;
  const value = normalise(latest);
  const context = recentText(messages);
  const priorAssistant = normalise(previousAssistant(messages));

  if (/couldn't verify those details|could not verify those details/.test(priorAssistant)
    && (/try verification again|details.*correct|date of birth|dob|^\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}$/.test(value))) {
    return verificationLoopReply();
  }

  if (/\b(?:not placed|haven't placed|have not placed|no order|before i order|if i order)\b/.test(value)
    && /\border\b/.test(`${value}\n${context}`)) return orderTimescaleReply();

  if (/^(?:hi|hello|hey|hiya|good morning|good afternoon|good evening|hello there)[!. ]*$/.test(value)) {
    return withOptions(
      `Hi — I'm here. Tell me what you need in normal words and I'll stay with the same issue until we've either solved it or reached the point where a person genuinely needs to take over.`,
      ["My internet isn't working", "What plans do you have?", "I need billing help"],
    );
  }

  if (/^(?:thanks|thank you|cheers|great|perfect|sorted|that worked)[!. ]*$/.test(value)) {
    return withOptions(
      `You're welcome. If that solved it, you're all set. If not, tell me what's still wrong and I'll continue from where we left off.`,
      ["It's sorted", "I'm still stuck"],
    );
  }

  if (
    /\b(?:what|which|show|tell me about|list)\b.*\b(?:plans?|packages?|services?|products?|offers?|deals?)\b/.test(value)
    || /^(?:plans?|packages?|services?|offers?|deals?)$/.test(value)
  ) return generalServicesReply();

  if (/\b(?:fast|faster|quick|gigabit|1 ?gb|1000 ?mbps)\b.*\b(?:internet|broadband|fibre|fiber)\b/.test(value)
    || /\b(?:internet|broadband)\b.*\b(?:fast|faster|gigabit)\b/.test(value)) return fastInternetReply();

  if (/\b(?:good|bad|trustworthy|reliable|worth it|reviews?|rating)\b/.test(value) && /\b(?:occta|you|your company|provider)\b/.test(value)) {
    return reputationReply();
  }

  if (/\b(?:who owns|owner of|owns occta|who is occta|what is occta|company behind occta)\b/.test(value)) return companyReply();

  if (/\b(?:opening hours|support hours|what time.*open|when.*support.*open|when can i call)\b/.test(value)) return supportHoursReply();

  if (/\b(?:call setup fee|call connection fee|setup fee for calls|call charges?|per minute|pence per minute)\b/.test(value)) return callChargesReply();

  if (/\b(?:how long|time|timescale)\b.*\b(?:order|processed|processing|activation|go live)\b/.test(value)
    && /\b(?:not placed|haven't placed|have not placed|before i order|if i order)\b/.test(`${value}\n${context}`)) {
    return orderTimescaleReply();
  }

  if (/\b(?:dashboard|login|log in|sign in)\b/.test(value)
    && /\b(?:not working|won't|wont|can't|cannot|failed|problem|issue|stuck)\b/.test(value)) return loginHelpReply();

  if (/\b(?:refund|money back)\b/.test(value) && /\b(?:policy|rules?|terms?|how does|cancellation)\b/.test(value)) return refundPolicyReply();

  if (detectAccountIntent(messages)) return null;

  if (/^(?:yes|yeah|yep|no|nope|it is|it's on|its on|yes it on|still|same|not yet|i did|done)$/.test(value)) {
    if (/light|router|ont|internet|wan|los|pon|power/.test(priorAssistant)) return resolvePublicConversationReply(messages);
    if (/postcode|address|availability/.test(priorAssistant)) return resolvePublicConversationReply(messages);
  }

  return resolvePublicConversationReply(messages);
}

export function verificationFailureFallback(): string {
  return withOptions(
    `I couldn't complete date-of-birth verification. **I won't keep asking you to repeat the same details.** Some older OCCTA customer profiles do not have a date of birth stored, which means that verification method cannot work for those records.\n\nFor private billing/account information, enter the **email address registered on the OCCTA account** and I can request a secure sign-in/reset link. The response is deliberately generic so chat cannot be used to discover whether an email has an account.`,
    ["I'll enter my registered email", "Open sign in"],
  );
}

export function secureAccessLinkSentReply(): string {
  return withOptions(
    `Done. If that email matches an OCCTA customer record, a **secure account-access email** will be sent to it. For privacy I won't confirm in chat whether the address exists in our records.\n\nUse the link in the email to sign in, then come back here and I can read the account data available to your authenticated session.`,
    ["Open sign in", "I didn't receive the email"],
  );
}
