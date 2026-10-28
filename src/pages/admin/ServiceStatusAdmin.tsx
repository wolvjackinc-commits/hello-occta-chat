import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import {
  type Incident,
  type IncidentImpact,
  type IncidentKind,
  type IncidentStatus,
  type ServiceKey,
  INCIDENT_STATUSES,
  MAINTENANCE_STATUSES,
  SERVICE_KEYS,
  SERVICE_LABELS,
  STATE_LABELS,
  STATUS_LABELS,
  isClosed,
  overallState,
  serviceStates,
} from "@/lib/serviceStatus";

// Admin-only. RLS on service_incidents restricts writes to admins.
type Db = {
  from: (t: string) => {
    select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }> } };
    insert: (v: unknown) => { select: (c: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } };
    update: (v: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }> };
  };
};
const db = supabase as unknown as Db;

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const emptyDraft = () => ({
  kind: "incident" as IncidentKind,
  title: "",
  summary: "",
  impact: "minor" as IncidentImpact,
  services: [] as ServiceKey[],
  areas: "",
  starts_at: toLocalInput(new Date()),
  ends_at: "",
  firstUpdate: "",
});

export const AdminServiceStatus = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [updateText, setUpdateText] = useState<Record<string, string>>({});
  const [updateStatus, setUpdateStatus] = useState<Record<string, IncidentStatus>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("service_incidents")
      .select("*, updates:service_incident_updates(id, incident_id, status, message, created_at)")
      .order("starts_at", { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      setTableMissing(/does not exist|schema cache/i.test(error.message));
      if (!/does not exist|schema cache/i.test(error.message)) toast({ title: "Couldn't load incidents", description: error.message, variant: "destructive" });
      return;
    }
    setTableMissing(false);
    setRows(((data as Incident[]) ?? []).map((i) => ({ ...i, updates: [...(i.updates ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)) })));
  };

  useEffect(() => { load(); }, []);

  const states = useMemo(() => serviceStates(rows), [rows]);
  const overall = overallState(states);

  const create = async () => {
    if (draft.title.trim().length < 3) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (draft.services.length === 0) { toast({ title: "Pick at least one affected service", variant: "destructive" }); return; }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const status: IncidentStatus = draft.kind === "maintenance" ? "scheduled" : "investigating";
    const { data, error } = await db.from("service_incidents").insert({
      kind: draft.kind,
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      status,
      impact: draft.kind === "maintenance" ? "none" : draft.impact,
      affected_services: draft.services,
      affected_areas: draft.areas.trim() || null,
      starts_at: new Date(draft.starts_at).toISOString(),
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      is_public: true,
      created_by: auth.user?.id ?? null,
    }).select("id").single();
    if (!error && data && draft.firstUpdate.trim()) {
      await db.from("service_incident_updates").insert({ incident_id: (data as { id: string }).id, status, message: draft.firstUpdate.trim(), created_by: auth.user?.id ?? null }).select("id").single();
    }
    setSaving(false);
    if (error) { toast({ title: "Couldn't publish", description: error.message, variant: "destructive" }); return; }
    toast({ title: draft.kind === "maintenance" ? "Maintenance published" : "Incident published", description: "It's now live on /status." });
    setDraft(emptyDraft());
    load();
  };

  const postUpdate = async (i: Incident) => {
    const message = (updateText[i.id] ?? "").trim();
    const status = updateStatus[i.id] ?? i.status;
    if (message.length < 3) { toast({ title: "Write an update first", variant: "destructive" }); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await db.from("service_incident_updates").insert({ incident_id: i.id, status, message, created_by: auth.user?.id ?? null }).select("id").single();
    if (error) { toast({ title: "Couldn't post update", description: error.message, variant: "destructive" }); return; }
    const patch: Record<string, unknown> = { status };
    if ((status === "resolved" || status === "completed") && !i.resolved_at) patch.resolved_at = new Date().toISOString();
    await db.from("service_incidents").update(patch).eq("id", i.id);
    setUpdateText((s) => ({ ...s, [i.id]: "" }));
    toast({ title: "Update posted" });
    load();
  };

  const toggleVisibility = async (i: Incident) => {
    const { error } = await db.from("service_incidents").update({ is_public: !i.is_public }).eq("id", i.id);
    if (error) { toast({ title: "Couldn't change visibility", description: error.message, variant: "destructive" }); return; }
    load();
  };

  const statusOptions = (k: IncidentKind) => (k === "maintenance" ? MAINTENANCE_STATUSES : INCIDENT_STATUSES);

  if (tableMissing) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">Service status</h1>
        <div className="rounded border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
          The service status tables haven't been created yet. Apply migration <code>20261028120000_public_views_and_service_status.sql</code> to enable incident publishing.
          Until then, the public <Link to="/status" className="underline">status page</Link> shows "temporarily unavailable" rather than claiming everything is fine.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Service status</h1>
          <p className="text-sm text-muted-foreground">Publish incidents and planned maintenance to the public status page. Customers see everything marked public.</p>
        </div>
        <a href="/status" target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink className="mr-1 h-4 w-4" /> View public page</Button></a>
      </div>

      <section className="rounded border p-4">
        <p className="text-sm font-semibold">Public summary: <span className={overall === "operational" ? "text-green-700" : "text-amber-700"}>{STATE_LABELS[overall]}</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICE_KEYS.map((k) => (
            <Badge key={k} variant={states[k] === "operational" ? "secondary" : "destructive"}>{SERVICE_LABELS[k].label}: {STATE_LABELS[states[k]]}</Badge>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Publish new</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Type</Label>
            <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as IncidentKind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="incident">Incident (unplanned)</SelectItem>
                <SelectItem value="maintenance">Planned maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft.kind === "incident" && (
            <div>
              <Label>Customer impact</Label>
              <Select value={draft.impact} onValueChange={(v) => setDraft({ ...draft, impact: v as IncidentImpact })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor — degraded performance</SelectItem>
                  <SelectItem value="major">Major — partial outage</SelectItem>
                  <SelectItem value="critical">Critical — major outage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="md:col-span-2">
            <Label htmlFor="ss-title">Title (customer-facing)</Label>
            <Input id="ss-title" value={draft.title} maxLength={160} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Broadband outage affecting parts of Huddersfield" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ss-summary">Summary</Label>
            <Textarea id="ss-summary" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="What customers will notice and what they should do." />
          </div>
          <div className="md:col-span-2">
            <Label>Affected services</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {SERVICE_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.services.includes(k)}
                    onCheckedChange={(c) => setDraft({ ...draft, services: c ? [...draft.services, k] : draft.services.filter((s) => s !== k) })}
                  />
                  {SERVICE_LABELS[k].label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ss-areas">Affected area (optional)</Label>
            <Input id="ss-areas" value={draft.areas} onChange={(e) => setDraft({ ...draft, areas: e.target.value })} placeholder="e.g. HD1, HD2 postcodes" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ss-start">{draft.kind === "maintenance" ? "Window start" : "Started"}</Label>
              <Input id="ss-start" type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ss-end">{draft.kind === "maintenance" ? "Window end" : "Expected end (optional)"}</Label>
              <Input id="ss-end" type="datetime-local" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ss-first">First update (optional)</Label>
            <Textarea id="ss-first" value={draft.firstUpdate} onChange={(e) => setDraft({ ...draft, firstUpdate: e.target.value })} placeholder="We're aware of reports of… and are working with the network to restore service." />
          </div>
        </div>
        <Button onClick={create} disabled={saving}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Publish to status page</Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Incidents and maintenance</h2>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
        {rows.map((i) => (
          <div key={i.id} className="space-y-3 rounded border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{i.title}</p>
                <p className="text-xs text-muted-foreground">
                  {i.kind === "maintenance" ? "Maintenance" : `Incident · ${i.impact}`} · {i.affected_services.map((s) => SERVICE_LABELS[s]?.label ?? s).join(", ")} · from {new Date(i.starts_at).toLocaleString("en-GB")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isClosed(i) ? "secondary" : "destructive"}>{STATUS_LABELS[i.status]}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleVisibility(i)}>{i.is_public ? "Hide from public" : "Make public"}</Button>
              </div>
            </div>
            {i.updates && i.updates.length > 0 && (
              <ul className="space-y-1 border-l-2 pl-3 text-sm">
                {i.updates.map((u) => <li key={u.id}><span className="font-medium">{STATUS_LABELS[u.status]}</span> · {new Date(u.created_at).toLocaleString("en-GB")} — {u.message}</li>)}
              </ul>
            )}
            {!isClosed(i) && (
              <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                <Select value={updateStatus[i.id] ?? i.status} onValueChange={(v) => setUpdateStatus((s) => ({ ...s, [i.id]: v as IncidentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statusOptions(i.kind).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={updateText[i.id] ?? ""} onChange={(e) => setUpdateText((s) => ({ ...s, [i.id]: e.target.value }))} placeholder="Customer-facing update" />
                <Button size="sm" onClick={() => postUpdate(i)}>Post update</Button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};

export default AdminServiceStatus;
