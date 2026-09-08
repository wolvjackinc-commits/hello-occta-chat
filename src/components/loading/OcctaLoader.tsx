import { useEffect, useMemo, useState } from "react";

/**
 * OCCTA branded loading experience.
 *
 * - Presentation only: never fetches, never blocks, never changes business logic.
 * - Appears after a short delay so very quick waits don't flash a loader.
 * - Rotates short, generic, accurate facts/tips while waiting.
 * - Fully respects prefers-reduced-motion (motion is disabled in CSS).
 * - Fixed minimum height per variant so it never causes layout shift.
 */

export type LoaderContext =
  | "address"
  | "availability"
  | "checkout"
  | "payment"
  | "account"
  | "documents"
  | "page"
  | "admin";

const HEADLINES: Record<LoaderContext, string> = {
  address: "Looking up your address…",
  availability: "Checking the best connection for your address…",
  checkout: "Securing your checkout…",
  payment: "Processing securely…",
  account: "Loading your account…",
  documents: "Preparing your documents…",
  page: "Loading…",
  admin: "Loading…",
};

const GENERAL_TIPS = [
  "Tip: placing your router in the open, off the floor, improves Wi-Fi coverage.",
  "Wi-Fi tip: the 5GHz band is faster over short distances, 2.4GHz reaches further.",
  "Wired devices like TVs and consoles are steadier on an Ethernet cable.",
  "Microwaves, baby monitors and thick walls can all weaken a Wi-Fi signal.",
  "Speed you get over Wi-Fi is usually lower than the speed reaching your router.",
  "Simple telecom. Clear terms.",
];

const CONTEXT_TIPS: Partial<Record<LoaderContext, string[]>> = {
  address: [
    "We match your postcode to the Royal Mail address list.",
    "Your address is only used to check what's available at your property.",
  ],
  availability: [
    "Availability depends on the line and cabinet serving your property.",
    "Estimated speeds are given as a range because every line is different.",
  ],
  checkout: [
    "Your details are sent over an encrypted connection.",
    "You'll see a full breakdown before anything is confirmed.",
  ],
  payment: [
    "Card details are handled by our payment provider, never stored by us.",
    "Please don't refresh this page while the payment completes.",
  ],
  account: [
    "Your account shows your services, invoices and support tickets in one place.",
  ],
  documents: [
    "Your contract documents are generated fresh for your order.",
  ],
};

const SLOW_MESSAGE = "Still working — this is taking a little longer than usual. Please keep this page open.";

interface OcctaLoaderProps {
  context?: LoaderContext;
  /** Overrides the default headline for this context. */
  label?: string;
  /** Compact inline block vs full-height page panel. */
  variant?: "inline" | "page";
  /** Don't show the loader at all until this many ms have passed. */
  delayMs?: number;
  /** Hide the rotating facts (e.g. very small inline slots). */
  showTips?: boolean;
  className?: string;
}

const NetworkMotif = () => (
  <svg
    viewBox="0 0 120 60"
    role="presentation"
    aria-hidden="true"
    className="occta-loader-motif w-[120px] h-[60px]"
  >
    <g stroke="currentColor" strokeWidth="2" fill="none" opacity="0.35">
      <path d="M12 48 L44 24" />
      <path d="M44 24 L76 40" />
      <path d="M76 40 L108 14" />
    </g>
    <path
      d="M12 48 L44 24 L76 40 L108 14"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      className="occta-loader-line"
    />
    {[
      [12, 48],
      [44, 24],
      [76, 40],
      [108, 14],
    ].map(([cx, cy], i) => (
      <circle
        key={`${cx}-${cy}`}
        cx={cx}
        cy={cy}
        r="5"
        fill="currentColor"
        className="occta-loader-node"
        style={{ animationDelay: `${i * 180}ms` }}
      />
    ))}
  </svg>
);

export const OcctaLoader = ({
  context = "page",
  label,
  variant = "inline",
  delayMs = 250,
  showTips = true,
  className = "",
}: OcctaLoaderProps) => {
  const [visible, setVisible] = useState(delayMs <= 0);
  const [slow, setSlow] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  const tips = useMemo(() => {
    const specific = CONTEXT_TIPS[context] ?? [];
    return [...specific, ...GENERAL_TIPS];
  }, [context]);

  useEffect(() => {
    if (delayMs <= 0) return;
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  useEffect(() => {
    const slowTimer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(slowTimer);
  }, []);

  useEffect(() => {
    if (!visible || !showTips) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [visible, showTips, tips.length]);

  // Reserve the space immediately so nothing jumps when the loader appears.
  const shell =
    variant === "page"
      ? "min-h-[50vh] flex items-center justify-center px-4 py-10"
      : "min-h-[180px] flex items-center justify-center px-4 py-6";

  if (!visible) {
    return <div className={`${shell} ${className}`} aria-hidden="true" />;
  }

  return (
    <div className={`${shell} ${className}`}>
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-sm border-4 border-foreground bg-card p-6 text-center"
      >
        <div className="flex justify-center text-primary">
          <NetworkMotif />
        </div>

        <p className="mt-3 font-display text-sm uppercase tracking-wider text-foreground">
          {label ?? HEADLINES[context]}
        </p>

        <div className="mt-3 h-1 w-full overflow-hidden bg-muted">
          <div className="occta-loader-bar h-full w-1/3 bg-primary" />
        </div>

        {showTips && (
          <p className="mt-4 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
            {slow ? SLOW_MESSAGE : tips[tipIndex]}
          </p>
        )}
      </div>
    </div>
  );
};

export default OcctaLoader;
