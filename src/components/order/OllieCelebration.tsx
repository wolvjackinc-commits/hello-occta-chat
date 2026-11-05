import { Check } from "lucide-react";

const CONFETTI_COLOURS = ["hsl(var(--primary))", "hsl(var(--foreground))", "#ff5a5f", "#2ec4b6", "#ffffff"];

/**
 * Order-complete celebration: Ollie (the yellow "O" block from chat) in a party
 * hat, waving, with confetti. Motion is skipped for prefers-reduced-motion.
 */
export default function OllieCelebration({ firstName, planTerm, coolingOffEndsAt }: {
  firstName: string | null;
  planTerm: string | null;
  coolingOffEndsAt: string | null;
}) {
  const coolingOff = coolingOffEndsAt
    ? new Date(coolingOffEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
    : null;
  const perks = [
    planTerm === "price_lock_24"
      ? "Your monthly broadband price is fixed for the full 24 months. No mid-contract price rises."
      : planTerm === "flex_30"
        ? "No minimum term. Leave any time with 30 days' notice."
        : null,
    "Nothing is taken today. Billing only starts once your service is live.",
    coolingOff ? `Changed your mind? You can cancel free of charge until ${coolingOff}.` : null,
    "Real UK support whenever you need it — call free on 0800 260 6626.",
    "We'll email you at every step, so you're never left guessing.",
  ].filter(Boolean) as string[];

  return (
    <div className="relative mb-6 overflow-hidden border-4 border-foreground bg-background p-5 md:p-7" data-testid="ollie-celebration">
      <style>{`
        @keyframes ollie-bounce { 0%,100% { transform: translateY(0) rotate(-3deg) } 50% { transform: translateY(-14px) rotate(3deg) } }
        @keyframes ollie-wave { 0%,100% { transform: rotate(-20deg) } 50% { transform: rotate(35deg) } }
        @keyframes ollie-fall { 0% { transform: translateY(-20px) rotate(0) ; opacity: 1 } 100% { transform: translateY(260px) rotate(540deg); opacity: 0 } }
        .ollie-bounce { animation: ollie-bounce 1.1s ease-in-out infinite; transform-origin: 50% 100%; }
        .ollie-arm-l { animation: ollie-wave .6s ease-in-out infinite; transform-origin: 100% 50%; transform-box: fill-box; }
        .ollie-arm-r { animation: ollie-wave .6s ease-in-out infinite reverse; transform-origin: 0% 50%; transform-box: fill-box; }
        .ollie-confetti { animation: ollie-fall 2.6s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ollie-bounce, .ollie-arm-l, .ollie-arm-r, .ollie-confetti { animation: none; } .ollie-confetti { display: none; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            className="ollie-confetti absolute top-0 block h-2.5 w-1.5"
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
              animationDelay: `${(i % 7) * 0.35}s`,
              animationDuration: `${2.2 + (i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-5 md:flex-row md:items-start">
        <svg viewBox="0 0 120 130" className="ollie-bounce h-32 w-28 shrink-0" role="img" aria-label="Ollie celebrating">
          {/* party hat */}
          <polygon points="60,4 44,40 76,40" fill="#ff5a5f" stroke="currentColor" strokeWidth="3" />
          <circle cx="60" cy="5" r="5" fill="#2ec4b6" stroke="currentColor" strokeWidth="2" />
          {/* arms */}
          <rect className="ollie-arm-l" x="6" y="62" width="22" height="8" fill="currentColor" />
          <rect className="ollie-arm-r" x="92" y="62" width="22" height="8" fill="currentColor" />
          {/* body: Ollie's yellow block */}
          <rect x="26" y="38" width="68" height="68" fill="hsl(var(--primary))" stroke="currentColor" strokeWidth="4" />
          {/* face */}
          <path d="M44 62 q5 -7 10 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M66 62 q5 -7 10 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M45 78 q15 16 30 0 z" fill="currentColor" />
          {/* legs */}
          <rect x="40" y="106" width="8" height="18" fill="currentColor" />
          <rect x="72" y="106" width="8" height="18" fill="currentColor" />
        </svg>

        <div className="min-w-0 flex-1">
          <div className="relative border-4 border-foreground bg-primary p-4 text-primary-foreground">
            <p className="font-display uppercase text-lg leading-tight">
              {firstName ? `Brilliant choice, ${firstName}.` : "Brilliant choice."}
            </p>
            <p className="mt-1 text-sm">
              Honestly, I'd high-five you if I had proper hands. You've picked broadband without the price-rise nonsense — now sit back and let us do the boring bit.
            </p>
            <span className="absolute -left-3 top-6 hidden h-5 w-5 rotate-45 border-b-4 border-l-4 border-foreground bg-primary md:block" aria-hidden="true" />
          </div>
          <p className="mt-4 font-display uppercase text-xs tracking-[0.2em]">Why you're in good hands</p>
          <ul className="mt-2 space-y-2">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
