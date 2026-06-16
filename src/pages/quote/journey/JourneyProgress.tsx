import { Check } from "lucide-react";

export const JOURNEY_STEPS = [
  { key: "quote", label: "Quote" },
  { key: "agreement", label: "Agreement" },
  { key: "start_date", label: "Start date" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review" },
  { key: "complete", label: "Complete" },
] as const;

export type JourneyStepKey = typeof JOURNEY_STEPS[number]["key"];

export default function JourneyProgress({ current }: { current: JourneyStepKey }) {
  const currentIdx = JOURNEY_STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-wrap gap-2 mb-6 text-[10px] font-display uppercase tracking-[0.15em]" aria-label="Order journey progress">
      {JOURNEY_STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li
            key={s.key}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-1 px-2 py-1 border-2 ${
              active ? "border-foreground bg-foreground text-background" :
              done ? "border-foreground/60 bg-muted text-foreground" :
              "border-foreground/20 text-muted-foreground"
            }`}
          >
            <span className="inline-flex items-center justify-center w-4 h-4 border border-current text-[9px]">
              {done ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
