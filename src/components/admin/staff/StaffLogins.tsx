import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { staffUsers, type J } from "@/lib/care/sales";

const ROLES: [string, string][] = [
  ["sales_agent", "Sales agent (Care Sales Desk)"], ["sales_admin", "Sales supervisor (approves held sales)"], ["support_agent", "Support agent"],
  ["finance_admin", "Finance"], ["compliance_admin", "Compliance"], ["marketing_admin", "Marketing"], ["auditor", "Auditor (read only)"],
  ["ticket_admin", "Tickets"], ["business_admin", "Business"], ["admin", "Admin"],
];

function genPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ", b = "abcdefghijkmnopqrstuvwxyz", c = "23456789";
  const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const chars = [pick(a), pick(b), pick(c), ...Array.from({ length: 11 }, () => pick(a + b + c))];
  return chars.sort(() => (crypto.getRandomValues(new Uint8Array(1))[0] > 127 ? 1 : -1)).join("");
}

export function StaffLogins() {
  const { toast } = useToast();
  const [rows, setRows] = useState<J[]>([]);
  const [f, setF] = useState({ email: "", full_name: "", role: "sales_agent", password: genPassword() });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await staffUsers.list(); if (r.data) setRows(r.data.staff); }, []);
  useEffect(() => { void load(); }, [load]);
  async function run(label: string, p: Promise<{ error: Error | null }>) {
    setBusy(true); const r = await p; setBusy(false);
    if (r.error) toast({ title: `${label} failed`, description: r.error.message, variant: "destructive" }); else { toast({ title: label }); void load(); }
    return !r.error;
  }
  return (
    <section className="border-[3px] border-foreground p-4 space-y-3">
      <div className="font-display uppercase">Staff logins</div>
      <p className="text-sm text-muted-foreground">Create a login for a member of staff. They sign in at /auth with the email and password. Sales agents use the Care Sales Desk at /staff/care-sales. Give the password to them directly (not by email) and ask them to change it.</p>
      <div className="grid gap-2 md:grid-cols-5">
        <Input placeholder="Full name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <Input placeholder="Work email (their username)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <div className="flex gap-1"><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="font-mono" /><Button variant="outline" type="button" onClick={() => setF({ ...f, password: genPassword() })}>New</Button></div>
        <Button disabled={busy} onClick={async () => { if (await run(`Login created for ${f.email}`, staffUsers.create(f))) { void navigator.clipboard?.writeText(`${f.email} / ${f.password}`); setF({ email: "", full_name: "", role: "sales_agent", password: genPassword() }); } }}>Create login</Button>
      </div>
      <p className="text-xs text-muted-foreground">Passwords: at least 12 characters with upper case, lower case and a number. The new email and password are copied to your clipboard.</p>
      <table className="w-full text-sm"><thead><tr className="border-b-2 border-foreground text-left"><th className="p-1">Name</th><th>Email</th><th>Roles</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.user_id} className="border-b"><td className="p-1">{r.full_name ?? "—"}</td><td>{r.email}</td><td>{(r.roles as string[]).map((x) => <Badge key={x} variant="outline" className="mr-1">{x}</Badge>)}</td>
            <td className="text-xs">{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("en-GB") : "never"}</td><td>{r.active ? <Badge>Active</Badge> : <Badge variant="destructive">Off</Badge>}</td>
            <td className="space-x-1 whitespace-nowrap">
              <Button size="sm" variant="outline" disabled={busy} onClick={async () => { const p = genPassword(); if (await run(`New password set for ${r.email}`, staffUsers.resetPassword(r.user_id, p))) { void navigator.clipboard?.writeText(p); toast({ title: "New password copied", description: p }); } }}>Reset password</Button>
              <Button size="sm" variant={r.active ? "destructive" : "default"} disabled={busy} onClick={() => void run(r.active ? "Login switched off" : "Login switched on", staffUsers.setActive(r.user_id, !r.active))}>{r.active ? "Switch off" : "Switch on"}</Button>
            </td></tr>))}</tbody></table>
    </section>
  );
}
