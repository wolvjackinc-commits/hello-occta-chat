import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, Mail, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTIVE_RECENCY_HOURS,
  CONVERSION_DENOMINATOR_LABEL,
  FUNNEL_WINDOW_LABEL,
  isRecentlyActive,
  isTerminal,
  summariseCheckoutFunnel,
} from "@/lib/journey/checkoutFunnel";
import { dbErrorText } from "@/lib/dbErrorText";


type CheckoutSession = {
  source: "journey2" | "web";
  session_id: string;
  journey_session_id: string | null;
  journey_version: string | null;
  status: string;
  current_stage: string | null;
  progress_percent: number | null;
  customer_name: string | null;
  customer_email: string | null;
  postcode: string | null;
  plan_label: string | null;
  current_route: string | null;
  started_at: string;
  last_activity_at: string;
  stage_started_at: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
  reminder_count: number;
  error_count: number;
  last_error: string | null;
  order_id: string | null;
  quote_id: string | null;
  utm_source: string | null;
};

type TimelineEvent = {
  id: string;
  event_type: string;
  title: string;
  stage: string | null;
  severity: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type Filter = "all" | "active" | "abandoned" | "completed" | "errors";

const stageLabel = (value: string | null) => {
  if (!value) return "Started";
  const labels: Record<string, string> = {
    build_plan: "Building plan",
    quote_start: "Quote started",
    quote_journey: "Quote journey",
    contract_summary: "Contract summary",
    agreement: "Contract agreement",
    order_start: "Order started",
    order_journey: "Online order",
    pre_checkout: "Pre-checkout",
    checkout: "Checkout",
    sim_checkout: "SIM checkout",
    business_checkout: "Business checkout",
    address: "Address",
    plan: "Plan",
    router: "Router",
    extras: "Extras",
    details: "Customer details",
    start_date: "Start date",
    billing: "Billing",
    contract: "Contract",
    review: "Review",
    payment: "Payment",
    complete: "Completed",
    quote_complete: "Quote submitted",
  };
  return labels[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsed(value: string | null | undefined, end?: string | null) {
  if (!value) return "—";
  const ms = Math.max(0, new Date(end ?? Date.now()).getTime() - new Date(value).getTime());
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return `${hours}h ${rest}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "abandoned") return "destructive";
  if (status === "cancelled") return "outline";
  return "secondary";
}

function statusLabel(status: string) {
  if (status === "contract_prepared") return "Contract ready";
  if (status === "contract_accepted") return "Contract accepted";
  return status.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function eventSummary(event: TimelineEvent) {
  const d = event.details ?? {};
  const parts: string[] = [];
  if (d.from_stage) parts.push(`${stageLabel(String(d.from_stage))} → ${stageLabel(String(d.stage ?? ""))}`);
  else if (d.stage) parts.push(stageLabel(String(d.stage)));
  if (d.from_status || d.status) parts.push(`${String(d.from_status ?? "")} → ${String(d.status ?? "")}`.replace(/^ → /, ""));
  if (d.reminder_number) parts.push(`Reminder ${String(d.reminder_number)}`);
  if (d.error) parts.push(String(d.error).slice(0, 220));
  if (d.status_code) parts.push(`HTTP ${String(d.status_code)}`);
  return parts.filter(Boolean).join(" · ");
}

export default function CheckoutJourneyMonitor() {
  const [sessions, setSessions] = useState<CheckoutSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Record<string, TimelineEvent[]>>({});
  const [timelineLoading, setTimelineLoading] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<Record<string, string>>({});

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_checkout_session_list", { _limit: 250 });
    if (error) {
      // A failed read must never be shown as an empty funnel.
      setLoadError(dbErrorText(error, "Could not load checkout sessions"));
    } else {
      setSessions((data ?? []) as CheckoutSession[]);
      setLoaded(true);
      setLoadError(null);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const totals = useMemo(() => summariseCheckoutFunnel(sessions), [sessions]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filter === "active" && !isRecentlyActive(s)) return false;
      if (filter === "stale" && (isTerminal(s.status) || isRecentlyActive(s))) return false;
      if (filter === "abandoned" && s.status !== "abandoned") return false;
      if (filter === "completed" && s.status !== "completed") return false;
      if (filter === "errors" && s.error_count < 1) return false;
      if (!q) return true;
      return [s.customer_name, s.customer_email, s.postcode, s.plan_label, s.current_stage, s.status, s.utm_source]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [sessions, filter, search]);

  const loadTimeline = async (row: CheckoutSession, key: string) => {
    setTimelineLoading(key);
    const { data, error } = await (supabase as any).rpc("admin_checkout_timeline", {
      _source: row.source,
      _session_id: row.session_id,
    });
    setTimelineLoading(null);
    if (error) {
      setTimelineError((current) => ({ ...current, [key]: dbErrorText(error, "Could not load this timeline") }));
      return;
    }
    setTimelineError((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setTimeline((current) => ({ ...current, [key]: (data ?? []) as TimelineEvent[] }));
  };

  const toggle = async (row: CheckoutSession) => {
    const key = `${row.source}:${row.session_id}`;
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    if (timeline[key]) return;
    await loadTimeline(row, key);
  };


  return (
    <section className="border-4 border-foreground bg-background p-4 md:p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display uppercase text-lg tracking-wide">Checkout journey monitor</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Start-to-finish checkout progress, inactivity, recovery reminders and technical failures. Refreshes every 30 seconds.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {loadError && (
        <div className="border-2 border-destructive p-3 text-sm text-destructive">
          Journey monitoring could not be loaded: {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {([
          ["Started", totals.total, "all" as Filter],
          ["Active", totals.active, "active" as Filter],
          ["Abandoned", totals.abandoned, "abandoned" as Filter],
          ["Completed", totals.completed, "completed" as Filter],
          ["With errors", totals.errors, "errors" as Filter],
          ["Conversion", `${totals.conversion}%`, "all" as Filter],
        ] as Array<[string, string | number, Filter]>).map(([label, value, target]) => (
          <button key={label} type="button" onClick={() => setFilter(target)}
            className="border-2 border-foreground/30 p-3 text-left hover:border-foreground transition-colors">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="font-display text-2xl mt-1">{value}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, email, postcode or stage" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "abandoned", "completed", "errors"] as Filter[]).map((value) => (
            <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : value === "errors" ? "Errors" : statusLabel(value)}
            </Button>
          ))}
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading checkout journeys…</div>
      ) : visible.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No checkout sessions match this view.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const key = `${row.source}:${row.session_id}`;
            const open = expanded === key;
            const terminal = row.completed_at ?? (row.status === "abandoned" ? row.abandoned_at : null);
            return (
              <article key={key} className={`border-2 ${row.error_count > 0 ? "border-destructive/60" : "border-border"}`}>
                <button type="button" onClick={() => void toggle(row)} className="w-full p-4 text-left hover:bg-muted/30 transition-colors">
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_0.8fr_1.2fr_0.8fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="truncate">{row.customer_name || "Anonymous checkout"}</strong>
                        <Badge variant="outline">{row.source === "journey2" ? "Journey 2" : "Web"}</Badge>
                        {row.utm_source && <Badge variant="outline">{row.utm_source}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {row.customer_email || row.current_route || "Browser session"}
                        {row.postcode ? ` · ${row.postcode}` : ""}
                      </div>
                    </div>
                    <div>
                      <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">Last activity {fmtDate(row.last_activity_at)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3 text-xs mb-1">
                        <span className="font-medium">{stageLabel(row.current_stage)}</span>
                        <span>{row.progress_percent ?? 0}%</span>
                      </div>
                      <div className="h-2 border border-foreground/30 bg-muted overflow-hidden">
                        <div className="h-full bg-foreground transition-all" style={{ width: `${Math.max(2, row.progress_percent ?? 2)}%` }} />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">In this stage {elapsed(row.stage_started_at, terminal)}</div>
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Started {fmtDate(row.started_at)}</div>
                      {row.reminder_count > 0 && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {row.reminder_count} reminder{row.reminder_count === 1 ? "" : "s"}</div>}
                      {row.error_count > 0 && <div className="flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> {row.error_count} error{row.error_count === 1 ? "" : "s"}</div>}
                      {row.status === "completed" && <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Completed {fmtDate(row.completed_at)}</div>}
                    </div>
                    <div>{open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                  </div>
                </button>

                {open && (
                  <div className="border-t-2 border-border p-4 bg-muted/20 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-3 text-sm">
                      <h3 className="font-display uppercase tracking-wider">Session details</h3>
                      <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-xs">
                        <dt className="text-muted-foreground">Current stage</dt><dd>{stageLabel(row.current_stage)}</dd>
                        <dt className="text-muted-foreground">Progress</dt><dd>{row.progress_percent ?? 0}%</dd>
                        <dt className="text-muted-foreground">Time in stage</dt><dd>{elapsed(row.stage_started_at, terminal)}</dd>
                        <dt className="text-muted-foreground">Total elapsed</dt><dd>{elapsed(row.started_at, row.completed_at)}</dd>
                        <dt className="text-muted-foreground">Plan</dt><dd>{row.plan_label || "—"}</dd>
                        <dt className="text-muted-foreground">Route</dt><dd className="break-all">{row.current_route || "—"}</dd>
                        <dt className="text-muted-foreground">Reminders</dt><dd>{row.reminder_count}</dd>
                        <dt className="text-muted-foreground">Errors</dt><dd>{row.error_count}</dd>
                      </dl>
                      {row.last_error && (
                        <div className="border-2 border-destructive/50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-destructive">Latest error</div>
                          <div className="text-xs mt-1 break-words">{row.last_error}</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="font-display uppercase tracking-wider mb-3">Journey timeline</h3>
                      {timelineLoading === key ? (
                        <p className="text-xs text-muted-foreground">Loading timeline…</p>
                      ) : (timeline[key] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No detailed events recorded yet.</p>
                      ) : (
                        <ol className="space-y-0">
                          {(timeline[key] ?? []).map((event, index, all) => (
                            <li key={event.id} className="grid grid-cols-[16px_1fr] gap-3">
                              <div className="flex flex-col items-center">
                                <span className={`mt-1 h-3 w-3 rounded-full border-2 ${event.severity === "error" ? "border-destructive bg-destructive" : "border-foreground bg-background"}`} />
                                {index < all.length - 1 && <span className="w-px flex-1 min-h-8 bg-border" />}
                              </div>
                              <div className="pb-4 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <strong className="text-xs">{event.title || statusLabel(event.event_type)}</strong>
                                  <time className="text-[11px] text-muted-foreground">{fmtDate(event.created_at)}</time>
                                </div>
                                {event.stage && <div className="text-[11px] text-muted-foreground mt-0.5">{stageLabel(event.stage)}</div>}
                                {eventSummary(event) && <div className="text-xs mt-1 break-words">{eventSummary(event)}</div>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
