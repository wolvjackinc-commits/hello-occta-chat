import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Phone, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { outreachAction, outreachTable, type OutreachCampaign } from "@/lib/outreach/api";
import { engagementLabel, rankCallList, telHref, type CallListRow } from "@/lib/outreach/callList";
import { Section } from "./shared";

/**
 * Everyone who opened or clicked an outreach email and has a phone number,
 * warmest first. An email open is the best moment for a short call.
 */
export function OutreachCallList() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CallListRow[]>([]);
  const [campaignNames, setCampaignNames] = useState<Map<string, string>>(new Map());
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, c] = await Promise.all([
      outreachTable("outreach_messages")
        .select("id, campaign_id, email, business_name, sent_at, first_opened_at, open_count, first_clicked_at, click_count, replied_at, converted_at, unsubscribed_at, bounced_at, complained_at, contact:outreach_contacts(phone, category, area, district, website)")
        .not("first_opened_at", "is", null)
        .order("first_opened_at", { ascending: false })
        .limit(1000),
      outreachTable("outreach_campaigns").select("id, name"),
    ]);
    if (m.error) toast({ title: "Couldn't load the call list", description: m.error.message, variant: "destructive" });
    setRows((m.data ?? []) as unknown as CallListRow[]);
    setCampaignNames(new Map(((c.data ?? []) as unknown as Pick<OutreachCampaign, "id" | "name">[]).map((x) => [x.id, x.name])));
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  // One row per business: the warmest of their emails.
  const ranked = useMemo(() => {
    const seen = new Set<string>();
    return rankCallList(rows).filter((r) => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return showDone || !(r.replied_at || r.converted_at);
    });
  }, [rows, showDone]);

  const markSpoken = async (id: string) => {
    setBusy(id);
    try {
      await outreachAction("mark_replied", { message_id: id });
      toast({ title: "Marked as spoken to", description: "They won't get the automatic follow-up email." });
      await load();
    } catch (e) {
      toast({ title: "Couldn't update", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section
      title={`Call list${loading ? "" : ` · ${ranked.length}`}`}
      actions={
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={showDone} onCheckedChange={setShowDone} /> Show done</label>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
      }
    >
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        Businesses that opened or clicked a campaign email, warmest first. A quick call works best within a few days of the open:
        offer the free 15-minute line check. Before ringing a number for the first time, check it isn't registered with the
        Corporate Telephone Preference Service (CTPS). Mark someone as spoken to and they're left out of the automatic follow-up email.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Sector · area</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map((r) => (
              <TableRow key={r.id} className={r.replied_at || r.converted_at ? "opacity-60" : ""}>
                <TableCell className="min-w-[180px]">
                  <div className="font-medium">{r.business_name ?? r.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.contact?.website ? <a href={r.contact.website} target="_blank" rel="noreferrer" className="underline">{r.email}</a> : r.email}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.contact?.phone && (
                    <a href={telHref(r.contact.phone)} className="inline-flex items-center gap-1.5 font-semibold underline">
                      <Phone className="h-3.5 w-3.5" /> {r.contact.phone}
                    </a>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge className={r.converted_at ? "bg-green-700 text-white" : r.first_clicked_at ? "bg-primary text-black" : "bg-muted text-foreground"}>
                    {engagementLabel(r)}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.first_opened_at ? `opened ${formatDistanceToNow(new Date(r.first_opened_at), { addSuffix: true })}` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {[r.contact?.category, r.contact?.area ?? r.contact?.district].filter(Boolean).join(" · ")}
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={campaignNames.get(r.campaign_id)}>
                  {campaignNames.get(r.campaign_id) ?? ""}
                </TableCell>
                <TableCell className="text-right">
                  {r.replied_at ? (
                    <span className="text-xs text-muted-foreground">Spoken to</span>
                  ) : r.converted_at ? (
                    <span className="text-xs text-muted-foreground">Enquiry in</span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => markSpoken(r.id)}>Spoke to them</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && ranked.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nobody to call yet. Opens with a phone number on file appear here.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}
