// Service status: incidents and planned maintenance published on /status and
// managed at /admin/service-status. Data lives in public.service_incidents and
// public.service_incident_updates (see migration 20261028120000).
//
// The page only ever reports what OCCTA staff have published. If the tables
// can't be read, callers must say "status unavailable" — never "all good".

import { supabase } from "@/integrations/supabase/client";

export const SERVICE_KEYS = ["broadband", "digital_voice", "mobile", "account", "billing", "support"] as const;
export type ServiceKey = typeof SERVICE_KEYS[number];

export const SERVICE_LABELS: Record<ServiceKey, { label: string; desc: string }> = {
  broadband: { label: "Broadband", desc: "Full fibre and part fibre connections" },
  digital_voice: { label: "Digital Voice", desc: "Home phone calls over broadband" },
  mobile: { label: "Mobile & SIM", desc: "Calls, texts and data on OCCTA SIMs" },
  account: { label: "Online account", desc: "Website sign-in and customer dashboard" },
  billing: { label: "Billing & payments", desc: "Invoices and Direct Debit collections" },
  support: { label: "Customer support", desc: "Phone, email, chat and tickets" },
};

export type IncidentKind = "incident" | "maintenance";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved" | "scheduled" | "in_progress" | "completed";
export type IncidentImpact = "none" | "minor" | "major" | "critical";

export const INCIDENT_STATUSES: IncidentStatus[] = ["investigating", "identified", "monitoring", "resolved"];
export const MAINTENANCE_STATUSES: IncidentStatus[] = ["scheduled", "in_progress", "completed"];

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  status: IncidentStatus;
  message: string;
  created_at: string;
}

export interface Incident {
  id: string;
  kind: IncidentKind;
  title: string;
  summary: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  affected_services: ServiceKey[];
  affected_areas: string | null;
  starts_at: string;
  ends_at: string | null;
  resolved_at: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  updates?: IncidentUpdate[];
}

export type ServiceState = "operational" | "maintenance" | "degraded" | "partial_outage" | "major_outage";

export const STATE_LABELS: Record<ServiceState, string> = {
  operational: "Operating normally",
  maintenance: "Maintenance in progress",
  degraded: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
};

const STATE_RANK: Record<ServiceState, number> = { operational: 0, maintenance: 1, degraded: 2, partial_outage: 3, major_outage: 4 };

export function isClosed(i: Pick<Incident, "status">): boolean {
  return i.status === "resolved" || i.status === "completed";
}

/** An incident that is affecting service right now. */
export function isActiveIncident(i: Incident): boolean {
  return i.kind === "incident" && !isClosed(i);
}

/** Maintenance happening now (in progress, or scheduled with a start time already passed). */
export function isActiveMaintenance(i: Incident, now = new Date()): boolean {
  if (i.kind !== "maintenance" || isClosed(i)) return false;
  if (i.status === "in_progress") return true;
  const start = new Date(i.starts_at).getTime();
  const end = i.ends_at ? new Date(i.ends_at).getTime() : Infinity;
  return start <= now.getTime() && now.getTime() < end;
}

export function isUpcomingMaintenance(i: Incident, now = new Date()): boolean {
  return i.kind === "maintenance" && i.status === "scheduled" && new Date(i.starts_at).getTime() > now.getTime();
}

function impactToState(impact: IncidentImpact): ServiceState {
  if (impact === "critical") return "major_outage";
  if (impact === "major") return "partial_outage";
  if (impact === "minor") return "degraded";
  return "operational";
}

/** Current state per service, worst-wins across everything happening now. */
export function serviceStates(incidents: Incident[], now = new Date()): Record<ServiceKey, ServiceState> {
  const out = Object.fromEntries(SERVICE_KEYS.map((k) => [k, "operational"])) as Record<ServiceKey, ServiceState>;
  for (const i of incidents) {
    let state: ServiceState | null = null;
    if (isActiveIncident(i)) state = impactToState(i.impact);
    else if (isActiveMaintenance(i, now)) state = "maintenance";
    if (!state || state === "operational") continue;
    for (const s of i.affected_services) {
      if (STATE_RANK[state] > STATE_RANK[out[s]]) out[s] = state;
    }
  }
  return out;
}

export function overallState(states: Record<ServiceKey, ServiceState>): ServiceState {
  return Object.values(states).reduce<ServiceState>((worst, s) => (STATE_RANK[s] > STATE_RANK[worst] ? s : worst), "operational");
}

export type StatusLoad =
  | { ok: true; incidents: Incident[] }
  | { ok: false };

/** Public incidents from the last `days` days plus anything still open or upcoming. */
export async function loadPublicStatus(days = 30): Promise<StatusLoad> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: unknown) => {
          or: (f: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }> };
        };
      };
    };
  };
  try {
    const { data, error } = await client
      .from("service_incidents")
      .select("*, updates:service_incident_updates(id, incident_id, status, message, created_at)")
      .eq("is_public", true)
      .or(`starts_at.gte.${since},status.in.(investigating,identified,monitoring,scheduled,in_progress)`)
      .order("starts_at", { ascending: false });
    if (error) return { ok: false };
    const incidents = ((data as Incident[]) ?? []).map((i) => ({
      ...i,
      affected_services: (i.affected_services ?? []).filter((s): s is ServiceKey => (SERVICE_KEYS as readonly string[]).includes(s)),
      updates: [...(i.updates ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
    return { ok: true, incidents };
  } catch {
    return { ok: false };
  }
}
