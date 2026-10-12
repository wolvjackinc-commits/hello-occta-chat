import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { outreachAction, outreachTable, type OutreachSuppression } from "@/lib/outreach/api";
import { downloadText, toCsv } from "@/lib/outreach/csv";

const REASONS: Record<string, string> = {
  unsubscribed: "Unsubscribed",
  hard_bounce: "Address doesn't exist",
  complaint: "Marked as spam",
  manual: "Added by staff",
  invalid: "Invalid",
};

export function OutreachSuppressions() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OutreachSuppression[]>([]);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await outreachTable("outreach_suppressions").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) toast({ title: "Couldn't load list", description: error.message, variant: "destructive" });
    setRows((data ?? []) as unknown as OutreachSuppression[]);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) => !search || r.email.includes(search.toLowerCase())), [rows, search]);

  const add = async () => {
    try {
      await outreachAction("suppress", { email, note });
      setEmail("");
      setNote("");
      toast({ title: "Added to do-not-contact" });
      load();
    } catch (e) {
      toast({ title: "Couldn't add", description: (e as Error).message, variant: "destructive" });
    }
  };

  const remove = async (r: OutreachSuppression) => {
    if (r.reason !== "manual") return;
    if (!window.confirm(`Allow emails to ${r.email} again? Only do this if they asked to be contacted.`)) return;
    const { error } = await outreachTable("outreach_suppressions").delete().eq("email", r.email).eq("reason", "manual");
    if (error) return toast({ title: "Couldn't remove", description: error.message, variant: "destructive" });
    await outreachTable("outreach_contacts").update({ status: "active" } as never).eq("email", r.email).eq("status", "do_not_contact");
    toast({ title: `${r.email} removed from do-not-contact` });
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Nobody on this list is ever emailed again, in any campaign. Unsubscribes, bounced addresses and spam complaints are added automatically and can't be removed. Staff-added entries can be removed if the business asks to hear from you again.
      </p>
      <div className="flex flex-wrap items-end gap-2 border-4 border-foreground p-3 bg-background">
        <div><label className="text-xs" htmlFor="os-email">Email</label><Input id="os-email" className="w-64" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@business.co.uk" /></div>
        <div className="flex-1 min-w-[200px]"><label className="text-xs" htmlFor="os-note">Note</label><Input id="os-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Asked by phone not to email" /></div>
        <Button onClick={add} disabled={!email.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <div className="flex justify-between gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => downloadText("do-not-contact.csv", toCsv([["email", "reason", "source", "note", "added"], ...rows.map((r) => [r.email, r.reason, r.source, r.note, r.created_at])]))}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>
      <div className="border-4 border-foreground bg-background shadow-brutal overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Email</TableHead><TableHead>Reason</TableHead><TableHead>Note</TableHead><TableHead>Added</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nobody on the list.</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.email}>
                <TableCell className="font-mono text-xs">{r.email}</TableCell>
                <TableCell><Badge variant="outline">{REASONS[r.reason] ?? r.reason}</Badge></TableCell>
                <TableCell className="text-xs">{r.note ?? r.source ?? "—"}</TableCell>
                <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                <TableCell>{r.reason === "manual" && <Button size="sm" variant="ghost" onClick={() => remove(r)} aria-label={`Remove ${r.email}`}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
