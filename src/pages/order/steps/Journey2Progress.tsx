const STEPS: { key: string; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "plan", label: "Plan" },
  { key: "router", label: "Router" },
  { key: "extras", label: "Extras" },
  { key: "details", label: "Your details" },
  { key: "start_date", label: "Start date" },
  { key: "billing", label: "Billing" },
  { key: "contract", label: "Contract" },
  { key: "review", label: "Review" },
  { key: "complete", label: "Done" },
];

export default function Journey2Progress({ current }: { current: string }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === current));
  const pct = Math.round(((idx + 1) / STEPS.length) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <p className="font-display uppercase text-xs tracking-widest text-muted-foreground">
          <span>Step {idx + 1} of {STEPS.length} · {STEPS[idx]?.label}</span>
        </p>
        <p className="text-xs text-muted-foreground">{pct}%</p>
      </div>
      <div
        className="h-3 border-2 border-foreground bg-background"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Order progress"
      >
        <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 hidden md:flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i <= idx ? "font-bold" : "text-muted-foreground"}>
            {i < idx ? "✓ " : ""}{s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}