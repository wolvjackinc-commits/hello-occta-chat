import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_STYLES, MESSAGE_STATUS_STYLES } from "@/lib/outreach/api";

export function StatTile({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass = tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "text-foreground";
  return (
    <div className="border-4 border-foreground bg-background p-4 shadow-brutal min-w-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-3xl leading-tight ${toneClass}`}>{value}</div>
      {sub != null && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export function CampaignStatusBadge({ status }: { status: string }) {
  return <Badge className={CAMPAIGN_STATUS_STYLES[status] ?? ""}>{status}</Badge>;
}

export function MessageStatusBadge({ status }: { status: string }) {
  return <Badge className={MESSAGE_STATUS_STYLES[status] ?? ""}>{status}</Badge>;
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-4 border-foreground bg-background shadow-brutal">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-foreground px-4 py-3">
        <h2 className="font-display text-xl">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
