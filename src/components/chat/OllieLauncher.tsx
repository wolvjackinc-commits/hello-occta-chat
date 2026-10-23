import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";

const TEASERS = [
  "Router sulking? I've seen worse. Ask me.",
  "Bill looking like a riddle? I speak fluent invoice.",
  "Wi-Fi slower than a Monday? Let's fix that.",
  "Questions about broadband? I'm unreasonably keen.",
  "Thinking of switching? I'll do the boring bits.",
];
const TEASER_KEY = "ollie-teaser-dismissed-v1";

type Props = {
  onOpen: () => void;
  /** Tailwind bottom offset, e.g. "bottom-4" or "bottom-20" above a bottom nav. */
  bottomClass?: string;
  label?: string;
};

/** Floating "Ask Ollie" button with a one-time-per-session teaser bubble. */
export default function OllieLauncher({ onOpen, bottomClass = "bottom-4", label = "Open chat with Ollie" }: Props) {
  const [teaser, setTeaser] = useState<string | null>(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(TEASER_KEY) === "1"; } catch { /* storage blocked */ }
    if (dismissed) return;
    const timer = window.setTimeout(() => setTeaser(TEASERS[Math.floor(Math.random() * TEASERS.length)]), 7000);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setTeaser(null);
    try { sessionStorage.setItem(TEASER_KEY, "1"); } catch { /* storage blocked */ }
  };

  return (
    <div className={`fixed right-4 ${bottomClass} z-[9999] flex flex-col items-end gap-2`}>
      {teaser && (
        <div className="relative max-w-[240px] animate-in fade-in slide-in-from-bottom-2 border-[3px] border-foreground bg-background p-3 pr-7 text-sm font-medium shadow-[4px_4px_0_hsl(var(--foreground))] duration-300">
          <button type="button" onClick={() => { dismiss(); onOpen(); }} className="text-left">{teaser}</button>
          <button type="button" onClick={dismiss} className="absolute right-1.5 top-1.5 p-0.5 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => { dismiss(); onOpen(); }}
        className="group flex items-center gap-2 border-[3px] border-foreground bg-primary px-4 py-2.5 font-display text-sm uppercase text-primary-foreground shadow-[4px_4px_0_hsl(var(--foreground))] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_hsl(var(--foreground))] active:translate-y-0 active:shadow-none"
        aria-label={label}
      >
        <span className="relative">
          <MessageCircle className="h-5 w-5 transition-transform group-hover:-rotate-12" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-primary bg-emerald-500" aria-hidden="true" />
        </span>
        <span>Ask Ollie</span>
      </button>
    </div>
  );
}
