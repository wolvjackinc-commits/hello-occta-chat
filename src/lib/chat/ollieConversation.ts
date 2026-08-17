import {
  detectContextualPublicIntent,
  extractUkPostcode,
  type CompanionMessage,
} from "../../../supabase/functions/_shared/companionCore.ts";

const BASE_URL = "https://www.occta.co.uk";

function withOptions(body: string, options: string[]): string {
  return `${body.trim()}\n\n<<<OPTIONS:${JSON.stringify(options.slice(0, 4))}>>>`;
}

function recentText(messages: CompanionMessage[]): string {
  return messages.slice(-8).map((message) => message.content).join("\n");
}

function findProvider(messages: CompanionMessage[]): string | null {
  const match = recentText(messages).match(/\b(BT|Sky|Virgin(?: Media)?|TalkTalk|Plusnet|Vodafone|EE|Zen)\b/i);
  return match?.[0] ?? null;
}

function routerLightReply(latest: string): string {
  const lower = latest.toLowerCase();

  if (/\b(los|optical)\b.*\bred\b|\bred\b.*\b(los|optical)\b/.test(lower)) {
    return withOptions(
      `That helps — a **red LOS/Optical light on the ONT** normally points to loss of the fibre signal rather than a Wi‑Fi problem.\n\nPlease do these checks only:\n1. Make sure the ONT has power.\n2. Check the Ethernet lead between the ONT and router is firmly seated.\n3. If the thin fibre lead is visible, check it has not been sharply bent, crushed or pulled — **do not remove the fibre connector**.\n4. Restart the ONT/router once if you have not already done so.\n\nIf LOS stays red after that, this needs a line/fibre fault check rather than repeated resets.`,
      ["Open service status", "Talk to a human", "I already restarted it"],
    );
  }

  if (/\binternet\b.*\bred\b|\bred\b.*\binternet\b|\bwan\b.*\bred\b|\bred\b.*\bwan\b/.test(lower)) {
    return withOptions(
      `Got it — the **Internet/WAN light is red**. That usually means the router has power but has not established the broadband session.\n\nCheck the cable from the ONT/modem to the router's WAN/Internet port, restart the router once, and wait several minutes. If you're using your own router, don't post PPPoE credentials here.\n\nIf the light stays red, I can guide you through the next check or pass the fault context to support.`,
      ["The ONT lights are green", "I use my own router", "Talk to a human"],
    );
  }

  if (/\b(no|none)\b.*\b(light|lights|power)\b|\bpower\b.*\b(off|red)\b/.test(lower)) {
    return withOptions(
      `If the router or ONT has **no power lights**, start with power rather than broadband settings. Check the power adapter is fully seated, try the wall socket directly if safe to do so, and make sure any power switch on the device is on.\n\nIf the ONT itself will not power up, tell me that and I’ll point you to the right support route.`,
      ["ONT has no power", "Router has no power", "Talk to a human"],
    );
  }

  if (/\b(all|both)\b.*\bgreen\b|\bpon\b.*\bgreen\b/.test(lower)) {
    return withOptions(
      `Good — **green PON/normal ONT lights** usually mean the fibre signal is present. The next check is the router and local connection.\n\nIs the router's **Internet/WAN** light normal, and can one device connect by Ethernet? If Ethernet works but Wi‑Fi does not, we can focus on Wi‑Fi rather than the line.`,
      ["Internet light is red", "Ethernet works", "Nothing connects"],
    );
  }

  if (/\bred\b|\borange\b|\bamber\b/.test(lower)) {
    return withOptions(
      `Thanks — a red/amber light is useful, but I need the **label** to give you the right next step.\n\nIs the light on the **ONT/fibre box** or on the **router**, and what does the label say? Common labels are **LOS**, **PON**, **Internet/WAN**, **Power** or **Wi‑Fi**.`,
      ["LOS is red", "Internet light is red", "PON is green", "I'm not sure"],
    );
  }

  return withOptions(
    `Tell me the **device** (router or ONT/fibre box), the **light label**, and its colour or whether it is flashing. I’ll use that to continue the same fault check rather than restarting the conversation.`,
    ["LOS is red", "Internet light is red", "All lights are green", "Talk to a human"],
  );
}

export function resolvePublicConversationReply(messages: CompanionMessage[]): string | null {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
  if (!latest) return null;
  const intent = detectContextualPublicIntent(messages);

  switch (intent) {
    case "availability": {
      const postcode = extractUkPostcode(latest) ?? extractUkPostcode(recentText(messages));
      if (!postcode) {
        return withOptions(
          `Yes — I can help check availability. Send the **postcode** first. I’ll then take you to the live property selector because availability can differ between addresses in the same postcode.`,
          ["Open availability checker", "View broadband plans", "Talk to a human"],
        );
      }
      const compact = postcode.replace(/\s+/g, "");
      return withOptions(
        `I’ve got **${postcode}**. A postcode can contain several properties, so the next step is to choose the exact address — that is what confirms technology, estimated speed, setup and final price.\n\n[**Check ${postcode} now →**](${BASE_URL}/order?postcode=${encodeURIComponent(compact)})`,
        ["Open availability checker", "View broadband plans", "Talk to a human"],
      );
    }

    case "provider_comparison": {
      const provider = findProvider(messages) ?? "your current provider";
      const hasPrice = /£\s*\d|\d+(?:\.\d+)?\s*(?:a month|monthly|pm|p\/m)/i.test(latest);
      const hasSpeed = /\d+\s*(?:mbps|mb|gbps|gb)/i.test(latest);
      if (hasPrice || hasSpeed) {
        return withOptions(
          `Thanks — I’ll keep that **${provider}** figure in this comparison. To tell you the real saving, I need the matching **OCCTA address quote** as well; otherwise I’d be comparing a live competitor offer with a guessed OCCTA price.\n\nUse the same speed/technology and compare monthly price, minimum term, setup/router charges and any price changes. Once you have the OCCTA quote, the difference is straightforward.`,
          ["Check availability", "Compare Flex and Price Lock", "View broadband plans"],
        );
      }
      return withOptions(
        `I can compare OCCTA with **${provider}** properly. I won’t make up a “£X cheaper” claim because ${provider} offers vary by postcode and promotion.\n\nSend me the **monthly price and advertised speed** you’re comparing, or check your OCCTA address first, and I’ll keep the comparison like-for-like.`,
        ["Check availability", "Compare Flex and Price Lock", "View broadband plans"],
      );
    }

    case "no_internet":
      return withOptions(
        `Okay — let’s diagnose this one step at a time.\n\nFirst, look at the router and, if you have full fibre, the **ONT/fibre box**. Tell me whether you can see a **red/LOS**, red Internet/WAN, no-power light, or whether everything looks green.\n\nDon’t factory-reset anything and don’t send passwords or PPPoE details here.`,
        ["Red lights", "All lights are green", "No lights / no power", "Open service status"],
      );

    case "router_lights":
      return routerLightReply(latest);

    case "slow_wifi":
      return withOptions(
        `Let’s separate **Wi‑Fi coverage** from **broadband speed**. If possible, run one test close to the router and one by Ethernet. If Ethernet is healthy but Wi‑Fi is slow, the line is probably fine and we can focus on placement, interference or coverage.\n\nKeep the router in the open and avoid hiding it behind the TV or inside a cupboard.`,
        ["Ethernet is fast", "Ethernet is also slow", "Improve Wi-Fi coverage", "Open Help Centre"],
      );

    case "contract_choice":
      return withOptions(
        `If flexibility matters most, **Flex 30** is the natural fit. If you expect to stay and want a longer fixed-term option, **Price Lock 24** is designed for price certainty and long-term value.\n\nThe final monthly price and setup depend on the address and chosen service, so I’ll keep those separate from the contract-choice advice.`,
        ["Check availability", "Which speed do I need?", "View broadband plans"],
      );

    case "speed_need":
      return withOptions(
        `As a practical guide: up to **80Mbps** suits lighter households; **150–330Mbps** gives more headroom for several people streaming, gaming and video calling; **500–1,000Mbps** is most useful for very busy homes, creators and large downloads where available.\n\nIf you tell me roughly how many people/devices use the connection and what they do, I’ll narrow it down.`,
        ["1–2 people", "3–5 people", "Heavy gaming / 4K / work", "Check availability"],
      );

    case "switching":
    case "number_porting":
      return withOptions(
        `For an eligible UK fixed-line switch, the new provider normally manages the One Touch Switch process. If keeping a number matters, tell me that before the order is finalised — number transfer is checked against the actual services and cannot be promised blindly.`,
        ["I want to keep my number", "Start a switch", "Check availability", "Talk to a human"],
      );

    case "service_status":
      return withOptions(
        `You can check current OCCTA notices on the [**service-status page →**](${BASE_URL}/status). If nothing is listed and only your line is affected, come back here and we’ll continue with the router/ONT checks.`,
        ["My internet is not working", "Open service status", "Talk to a human"],
      );

    case "router":
    case "pppoe_missing":
      return withOptions(
        `On full fibre, the ONT connects to the router's **WAN/Internet** port by Ethernet. If you use your own router, never paste PPPoE usernames or passwords into chat. If the issue is a light or a connection fault, tell me the exact light label and colour and I’ll continue from there.`,
        ["My router has a red light", "I can't find PPPoE details", "Open own-router guide", "Talk to a human"],
      );

    case "broadband":
      return withOptions(
        `OCCTA's broadband range is built around **Essential Fibre** (up to 80Mbps), **Superfast Fibre** (up to 330Mbps) and **Ultrafast Fibre** (up to 1,000Mbps where available), with Flex 30 and Price Lock 24 options where eligible.\n\nThe live address check is what confirms the actual technology, speed, setup and price.`,
        ["Check availability", "Which speed do I need?", "Compare Flex and Price Lock"],
      );

    case "sim":
    case "esim":
      return withOptions(
        `For SIMs, I’ll point you to the **current live catalogue** rather than repeat an old allowance or offer. Data, roaming, network and eSIM availability can vary by plan. [**View current SIM plans →**](${BASE_URL}/sim).`,
        ["View SIM plans", "Explain eSIM", "Talk to a human"],
      );

    case "voice":
      return withOptions(
        `OCCTA Digital Home Phone works through broadband. It is a broadband add-on/bundle rather than a standalone traditional copper landline. Keeping an existing number is often possible but must be confirmed for the actual order.`,
        ["Can I keep my number?", "Digital Voice information", "Check availability"],
      );

    case "direct_debit":
      return withOptions(
        `Never put bank details into this chat. Direct Debit setup is handled through OCCTA's secure flow. If you’re signed in I can help you get to the account/billing area, or the billing team can check a pending mandate.`,
        ["Set up Direct Debit", "Check my latest invoice", "Talk to a human"],
      );

    case "first_invoice":
    case "vat":
      return withOptions(
        `Your **actual invoice** is the source of truth. A first bill can include the first full billing period, a part-month amount from activation, and any disclosed one-off setup/equipment items. I won’t calculate VAT or charges from a guessed plan price.`,
        ["Check my latest invoice", "Open my dashboard", "Raise a billing ticket"],
      );

    case "cancellation":
      return withOptions(
        `Cancellation depends on the plan you actually chose. Flex 30 follows its flexible notice terms; Price Lock 24 has a fixed minimum term and early termination charges may apply. [**Read the cancellation information →**](${BASE_URL}/cancellation).`,
        ["Check my account", "Read cancellation terms", "Talk to a human"],
      );

    case "complaints":
      return withOptions(
        `I can help you get the issue recorded without making you repeat everything. OCCTA's Complaints Code explains the escalation route and independent ADR process. [**Read the Complaints Code →**](${BASE_URL}/legal/complaints-code).`,
        ["Talk to a human", "Read the Complaints Code", "Open Help Centre"],
      );

    case "human":
      return withOptions(
        `Of course. I can pass this conversation to an OCCTA advisor with the context attached, so you don’t have to start again.`,
        ["Connect me to a human", "Keep troubleshooting"],
      );

    default:
      return null;
  }
}
