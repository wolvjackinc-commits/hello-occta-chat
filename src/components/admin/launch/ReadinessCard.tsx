import { ReadinessStatus, statusLabel, statusTone } from "@/lib/launchSafety/checks";

interface ReadinessCardProps {
  title: string;
  status: ReadinessStatus;
  reason?: string;
  facts?: Array<{ label: string; value: string | number | boolean | null }>;
}

function renderValue(v: ReadinessCardProps["facts"][number]["value"]) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export const ReadinessCard = ({ title, status, reason, facts }: ReadinessCardProps) => {
  return (
    <div className="border-2 border-foreground bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base uppercase tracking-tight">{title}</h3>
        <span className={`px-2 py-0.5 text-xs uppercase ${statusTone[status]}`}>
          {statusLabel[status]}
        </span>
      </div>
      {reason && (
        <p className="mt-2 text-xs text-muted-foreground">{reason}</p>
      )}
      {facts && facts.length > 0 && (
        <dl className="mt-3 space-y-1 text-xs">
          {facts.map((f) => (
            <div key={f.label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="font-mono">{renderValue(f.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};