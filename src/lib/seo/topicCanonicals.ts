/**
 * One primary URL per overlapping topic.
 * Canonical overrides are only for pages that repeat the same job.
 * Everything else keeps its own URL and is cross-linked.
 */
export const CANONICAL_OVERRIDES: Record<string, string> = {
  "/privacy-policy": "/privacy",
  "/guides/how-to-switch-broadband-uk": "/guides/how-to-switch-broadband",
};

export function resolveCanonicalPath(pathname: string): string {
  let path = (pathname || "/").split("?")[0].split("#")[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return CANONICAL_OVERRIDES[path] ?? path;
}

export const TOPIC_LINKS: Record<string, { to: string; label: string }> = {
  "/switching": { to: "/guides/how-to-switch-broadband", label: "How to switch broadband" },
  "/switch-broadband-provider": { to: "/guides/how-to-switch-broadband", label: "How to switch broadband" },
  "/guides/how-to-switch-broadband-uk": { to: "/guides/how-to-switch-broadband", label: "How to switch broadband" },
  "/learn/how-to-switch-broadband": { to: "/guides/how-to-switch-broadband", label: "How to switch broadband" },
  "/learn/one-touch-switch-broadband-guide": { to: "/guides/how-to-switch-broadband", label: "How to switch broadband" },
  "/blog/switching-broadband-provider-uk": { to: "/guides/how-to-switch-broadband", label: "How to switch broadband" },

  "/guides/no-contract-broadband-uk": { to: "/no-contract-broadband-uk", label: "Flex 30 broadband" },
  "/compare/no-contract-broadband": { to: "/no-contract-broadband-uk", label: "Flex 30 broadband" },
  "/broadband/flex": { to: "/no-contract-broadband-uk", label: "Flex 30 broadband" },
  "/rolling-vs-fixed-broadband-comparison": { to: "/no-contract-broadband-uk", label: "Flex 30 broadband" },
  "/blog/no-contract-broadband-what-it-means": { to: "/no-contract-broadband-uk", label: "Flex 30 broadband" },
  "/blog/monthly-rolling-vs-long-contracts": { to: "/no-contract-broadband-uk", label: "Flex 30 and Price Lock 24" },

  "/guides/no-credit-check-broadband-uk": { to: "/broadband-no-credit-check", label: "Broadband eligibility" },
  "/guides/how-to-get-broadband-with-bad-credit": { to: "/broadband-no-credit-check", label: "Broadband eligibility" },

  "/guides/broadband-for-gaming": { to: "/broadband-for-gaming", label: "Broadband for gaming" },
  "/guides/broadband-for-students": { to: "/broadband-for-students", label: "Broadband for students" },
  "/guides/broadband-for-working-from-home": { to: "/broadband-for-working-from-home", label: "Broadband for working from home" },
  "/guides/working-from-home-broadband": { to: "/broadband-for-working-from-home", label: "Broadband for working from home" },

  "/help/first-invoice-explained-help": { to: "/first-invoice-explained", label: "First invoice explained" },
  "/help/why-your-first-bill-may-be-higher": { to: "/first-invoice-explained", label: "First invoice explained" },
  "/blog/why-your-first-broadband-bill-can-be-higher": { to: "/first-invoice-explained", label: "First invoice explained" },
  "/guides/first-invoice-and-billing-timeline-guide": { to: "/first-invoice-explained", label: "First invoice explained" },

  "/help/direct-debit-setup-help": { to: "/direct-debit-setup", label: "Direct Debit setup" },
  "/help/how-direct-debit-setup-works": { to: "/direct-debit-setup", label: "Direct Debit setup" },
  "/learn/direct-debit-explained": { to: "/direct-debit-setup", label: "Direct Debit setup" },

  "/learn/digital-voice-explained": { to: "/guides/digital-voice-uk", label: "Digital Voice explained" },
  "/blog/digital-voice-explained-uk-homes": { to: "/guides/digital-voice-uk", label: "Digital Voice explained" },
  "/help/what-is-digital-voice": { to: "/guides/digital-voice-uk", label: "Digital Voice explained" },
  "/guides/digital-voice-vs-landline": { to: "/guides/digital-voice-uk", label: "Digital Voice explained" },

  "/help/slow-wifi-troubleshooting": { to: "/help/slow-wifi-fix", label: "Slow Wi-Fi fixes" },
  "/guides/why-your-wifi-is-slow": { to: "/help/slow-wifi-fix", label: "Slow Wi-Fi fixes" },
  "/learn/slow-broadband-fixes": { to: "/help/slow-wifi-fix", label: "Slow Wi-Fi fixes" },
  "/guides/wifi-troubleshooting-checklist": { to: "/help/slow-wifi-fix", label: "Slow Wi-Fi fixes" },
};
