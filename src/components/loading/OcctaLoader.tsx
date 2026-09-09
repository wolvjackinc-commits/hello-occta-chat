import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Delayed, destination-shaped wait state. It never delays the underlying work.
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
  address: "Finding matching properties…",
  availability: "Checking the best connection for your address…",
  checkout: "Preparing your order…",
  payment: "Processing securely…",
  account: "Loading your account…",
  documents: "Preparing your documents…",
  page: "Loading…",
  admin: "Loading…",
};

const FACTS = [
  {
    title: "The Web began at CERN in 1989.",
    detail: "Tim Berners-Lee created it to help scientists share information.",
  },
  {
    title: "Router position matters.",
    detail: "Keep it in the open, off the floor and roughly central.",
  },
  {
    title: "Ethernet is usually more reliable than Wi-Fi.",
    detail: "Useful for stationary TVs, consoles and work computers.",
  },
  {
    title: "Walls and electrical devices can weaken Wi-Fi.",
    detail: "Microwaves, baby monitors and thick walls can affect the signal.",
  },
  {
    title: "Wi-Fi speed is not the same as line speed.",
    detail: "Distance, interference and your device can change wireless performance.",
  },
  {
    title: "Full fibre reaches the property using fibre.",
    detail: "It does not rely on a final copper section to the premises.",
  },
];

interface OcctaLoaderProps {
  context?: LoaderContext;
  /** Overrides the default headline for this context. */
  label?: string;
  /** Retained for existing call sites; both modes now stay within content flow. */
  variant?: "inline" | "page";
  /** Don't show any loading treatment until this many ms have passed. */
  delayMs?: number;
  /** Hide the long-wait information strip. */
  showTips?: boolean;
  className?: string;
}

const Line = ({ className }: { className?: string }) => <Skeleton className={cn("h-3", className)} />;

const ContentSkeleton = ({ context }: { context: LoaderContext }) => {
  if (context === "address") {
    return <div className="space-y-3"><Line className="h-11 w-full" /><Line className="h-11 w-full" /><Line className="h-11 w-5/6" /></div>;
  }
  if (context === "availability") {
    return <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  }
  if (context === "checkout") {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
        <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40" /><Skeleton className="h-32" /></div>
        <div className="space-y-3 border-l-0 border-foreground/15 lg:border-l lg:pl-5"><Line className="h-6 w-36" /><Skeleton className="h-28" /><Line className="w-full" /><Line className="w-4/5" /></div>
      </div>
    );
  }
  if (context === "account") {
    return (
      <div className="space-y-5"><Skeleton className="h-9 w-56" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><div className="space-y-3"><Line className="h-6 w-40" /><Line className="h-12 w-full" /><Line className="h-12 w-full" /><Line className="h-12 w-5/6" /></div></div>
    );
  }
  if (context === "documents") {
    return <div className="space-y-5"><Skeleton className="h-9 w-64 max-w-full" /><Line className="w-full" /><Line className="w-11/12" /><Line className="w-4/5" /><div className="grid gap-3 pt-2 sm:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>;
  }
  if (context === "payment") {
    return <div className="mx-auto max-w-md space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Skeleton className="h-12" /></div>;
  }
  if (context === "admin") {
    return <div className="space-y-3"><div className="grid gap-3 md:grid-cols-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div><Line className="h-10" /><Line className="h-10" /><Line className="h-10" /></div>;
  }
  return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Line className="w-full" /><Line className="w-5/6" /><Skeleton className="h-32" /></div>;
};

export const OcctaLoader = ({
  context = "page",
  label,
  variant = "inline",
  delayMs = 900,
  showTips = true,
  className = "",
}: OcctaLoaderProps) => {
  const [visible, setVisible] = useState(delayMs <= 0);
  const [showLongWait, setShowLongWait] = useState(false);
  const [factIndex, setFactIndex] = useState(0);

  const canShowFacts = showTips && context !== "payment" && context !== "admin";
  const fact = useMemo(() => FACTS[factIndex], [factIndex]);

  useEffect(() => {
    if (delayMs <= 0) return;
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  useEffect(() => {
    const slowTimer = window.setTimeout(() => setShowLongWait(true), 3000);
    return () => window.clearTimeout(slowTimer);
  }, []);

  useEffect(() => {
    if (!showLongWait || !canShowFacts) return;
    const id = window.setInterval(() => {
      setFactIndex((i) => (i + 1) % FACTS.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [showLongWait, canShowFacts]);

  if (!visible) {
    return null;
  }

  return (
    <div className={cn("w-full px-4 py-6 sm:px-6", variant === "page" && "container mx-auto max-w-6xl py-10", className)} aria-busy="true">
      <p role="status" aria-live="polite" className="mb-5 text-sm font-medium text-foreground">
        <span className="mr-2 inline-block h-2 w-2 bg-primary align-middle" aria-hidden="true" />
        {label ?? HEADLINES[context]}
        {context === "payment" && <span className="mt-1 block text-xs font-normal text-muted-foreground">Keep this page open.</span>}
      </p>
      <ContentSkeleton context={context} />

      {showLongWait && canShowFacts && (
        <aside className="occta-wait-panel mt-8 border-y border-foreground/20 py-6 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-8" aria-label="While you wait">
          <div className="mb-4 sm:mb-0">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">While we get this ready</p>
            <div className="occta-signal-line mt-3 h-px w-full overflow-hidden bg-foreground/15" aria-hidden="true"><span className="block h-full w-1/3 bg-primary" /></div>
          </div>
          <div key={factIndex} className="occta-fact-fade" aria-hidden="true">
            <p className="font-display text-xl uppercase text-foreground sm:text-2xl">{fact.title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{fact.detail}</p>
          </div>
        </aside>
      )}
    </div>
  );
};

export default OcctaLoader;
