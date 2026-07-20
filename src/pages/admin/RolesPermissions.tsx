import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_ROLES = [
  "super_admin",
  "admin",
  "business_admin",
  "ticket_admin",
  "sales_admin",
  "finance_admin",
  "marketing_admin",
  "compliance_admin",
  "support_agent",
  "sales_agent",
  "auditor",
] as const;
type Role = (typeof ALL_ROLES)[number];

type Row = { user_id: string; email: string | null; full_name: string | null; roles: Role[] };

export const AdminRolesPermissions = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<Role>("business_admin");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    let profiles: any[] = [];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
      profiles = data ?? [];
    }
    const byUser = new Map<string, Row>();
    for (const r of roles ?? []) {
      const p = profiles.find((x) => x.id === r.user_id);
      const existing = byUser.get(r.user_id) ?? {
        user_id: r.user_id,
        email: p?.email ?? null,
        full_name: p?.full_name ?? null,
        roles: [] as Role[],
      };
      existing.roles.push(r.role as Role);
      byUser.set(r.user_id, existing);
    }
    setRows(Array.from(byUser.values()));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => (r.email ?? "").toLowerCase().includes(q) || (r.full_name ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Audit is written automatically by DB trigger on user_roles (grant/revoke).
  const audit = async (_action: string, _detail: Record<string, unknown>) => {};

  const removeRole = async (userId: string, role: Role) => {
    if (!confirm(`Remove role "${role}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    setBusy(false);
    if (error) return toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    await audit("role.remove", { user_id: userId, role });
    toast({ title: "Role removed" });
    load();
  };

  const grantRole = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    const { data: p } = await supabase.from("profiles").select("id, email").eq("email", email).maybeSingle();
    if (!p) {
      setBusy(false);
      return toast({ title: "No user found with that email", variant: "destructive" });
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: p.id, role: addRole });
    setBusy(false);
    if (error && !error.message.includes("duplicate")) {
      return toast({ title: "Failed to grant", description: error.message, variant: "destructive" });
    }
    await audit("role.grant", { user_id: p.id, role: addRole, email });
    toast({ title: "Role granted", description: `${addRole} to ${email}` });
    setAddEmail("");
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl uppercase flex items-center gap-2">
          <ShieldCheck className="w-7 h-7" /> Roles and Permissions
        </h1>
        <p className="text-muted-foreground mt-1">
          Grant staff access to specific admin surfaces. Only super_admin can access this page.
        </p>
      </div>

      <div className="border-4 border-foreground p-4 bg-secondary space-y-3">
        <div className="font-display uppercase text-sm">Grant role</div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="user@occta.co.uk"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            className="max-w-xs"
          />
          <Select value={addRole} onValueChange={(v) => setAddRole(v as Role)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={grantRole} disabled={busy || !addEmail}>
            <UserPlus className="w-4 h-4 mr-2" /> Grant
          </Button>
        </div>
      </div>

      <div>
        <Input
          placeholder="Search staff by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md mb-3"
        />

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">No staff assigned.</p>
        ) : (
          <div className="border-4 border-foreground bg-background divide-y-2 divide-foreground/10">
            {filtered.map((r) => (
              <div key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-display text-sm truncate">{r.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.email ?? r.user_id}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {r.roles.map((role) => (
                    <Badge key={role} variant="outline" className="gap-1">
                      {role}
                      <button
                        aria-label={`Remove ${role}`}
                        onClick={() => removeRole(r.user_id, role)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRolesPermissions;