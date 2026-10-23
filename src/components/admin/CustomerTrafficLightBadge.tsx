import type { CustomerTrafficLight } from "@/lib/admin/customerTrafficLight";

const colourClasses = {
  green: "bg-emerald-500 ring-emerald-200",
  yellow: "bg-amber-400 ring-amber-200",
  red: "bg-red-500 ring-red-200",
  grey: "bg-slate-400 ring-slate-200",
} as const;

/** Shape + text as well as colour for accessibility. Not an editable service state. */
export function CustomerTrafficLightBadge({ status }: { status: CustomerTrafficLight }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
      title={status.reason}
      aria-label={`${status.label}. ${status.reason}`}
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ${colourClasses[status.colour]}`} />
      <span>{status.label}</span>
    </span>
  );
}

export function CustomerTrafficLightLegend() {
  const items = [
    { colour: "green", label: "Live" },
    { colour: "yellow", label: "Provisioning" },
    { colour: "red", label: "Action needed" },
    { colour: "grey", label: "Inactive / unknown" },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Customer status legend">
      {items.map(({ colour, label }) => (
        <span key={colour} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ring-1 ${colourClasses[colour]}`} />
          {label}
        </span>
      ))}
      <span className="italic">Updated from order, service and invoice records every 30 seconds</span>
    </div>
  );
}
