import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Lock, FileText, ShieldAlert } from "lucide-react";
import { computeChecklist, deriveStatus, canGenerateDraftPack, type ChecklistInputs } from "@/lib/provisioning/checklist";
import { READINESS_STATUS_LABEL, SUPPLIER_LOCK_TAG } from "@/lib/provisioning/status";
import { SUPPLIER_SUBMISSION_ENABLED, assertSupplierSubmissionEnabled } from "@/lib/provisioning/flags";

type Row = {
  inputs: ChecklistInputs;
  pr_number: string | null;
  cs_number: string | null;
  created_at: string;
  pack_version: number | null;
};

export const AdminReadiness = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openRow, setOpenRow] = useState<Row | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-readiness"],
    queryFn: async (): Promise<Row[]> => {
      // 1. accepted CSs with linked PRs
      const { data: prs, error } = await (supabase as any)
        .from("payment_requests")
        .select("id, payment_request_number, status, webhook_verified, paid_at, contract_summary_id, quote_id, quote_request_id, user_id, customer_email, customer_name, created_at")
        .not("contract_summary_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const list = (prs ?? []) as any[];
      if (list.length === 0) return [];

      const csIds = [...new Set(list.map(p => p.contract_summary_id))];
      const qIds = [...new Set(list.map(p => p.quote_id).filter(Boolean))];
      const qrIds = [...new Set(list.map(p => p.quote_request_id).filter(Boolean))];
      const userIds = [...new Set(list.map(p => p.user_id).filter(Boolean))];
      const prIds = list.map(p => p.id);

      const [{ data: css }, { data: quotes }, { data: qrs }, { data: profiles }, { data: accs }, { data: ready }, { data: packs }] = await Promise.all([
        (supabase as any).from("contract_summaries").select("id, cs_number, status, pdf_storage_key, pdf_sha256, service_address, customer_email_snapshot").in("id", csIds),
        qIds.length ? (supabase as any).from("quotes").select("id, status, supplier_product_id").in("id", qIds) : { data: [] },
        qrIds.length ? (supabase as any).from("quote_requests").select("id, status").in("id", qrIds) : { data: [] },
        userIds.length ? (supabase as any).from("profiles").select("id, account_number").in("id", userIds) : { data: [] },
        (supabase as any).from("contract_acceptances").select("id, contract_summary_id").in("contract_summary_id", csIds),
        (supabase as any).from("provisioning_readiness").select("payment_request_id, installation_confirmed, router_confirmed, internal_notes_reviewed, admin_review_complete").in("payment_request_id", prIds),
        (supabase as any).from("draft_order_packs").select("payment_request_id, version").in("payment_request_id", prIds),
      ]);

      const csMap = new Map((css ?? []).map((r: any) => [r.id, r]));
      const qMap = new Map((quotes ?? []).map((r: any) => [r.id, r]));
      const qrMap = new Map((qrs ?? []).map((r: any) => [r.id, r]));
      const pMap = new Map((profiles ?? []).map((r: any) => [r.id, r]));
      const aMap = new Map<string, any>();
      (accs ?? []).forEach((a: any) => { if (!aMap.has(a.contract_summary_id)) aMap.set(a.contract_summary_id, a); });
      const rMap = new Map<string, any>((ready ?? []).map((r: any) => [r.payment_request_id, r]));
      const packMap = new Map<string, number>();
      (packs ?? []).forEach((p: any) => {
        const cur = packMap.get(p.payment_request_id) ?? 0;
        if (p.version > cur) packMap.set(p.payment_request_id, p.version);
      });

      return list.map((pr): Row => {
        const cs = csMap.get(pr.contract_summary_id) as any;
        return {
          inputs: {
            pr,
            cs: cs ?? null,
            quote: pr.quote_id ? (qMap.get(pr.quote_id) as any) ?? null : null,
            qr: pr.quote_request_id ? (qrMap.get(pr.quote_request_id) as any) ?? null : null,
            profile: pr.user_id ? (pMap.get(pr.user_id) as any) ?? null : null,
            acceptance: aMap.get(pr.contract_summary_id) ?? null,
            readiness: (rMap.get(pr.id) as any) ?? null,
            hasDraftPack: packMap.has(pr.id),
          },
          pr_number: pr.payment_request_number,
          cs_number: cs?.cs_number ?? null,
          created_at: pr.created_at,
          pack_version: packMap.get(pr.id) ?? null,
        };
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display uppercase">Provisioning Readiness</h1>
          <p className="text-muted-foreground text-sm">
            Post-payment preparation only. No supplier orders, services, invoices, DD mandates or provisioning rows are created here.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="border-2 border-foreground">
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card className="border-2 border-primary bg-primary/10 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong>Payment verification is live via Worldpay SMB webhook.</strong> Webhooks are verified and payments progress to <code>webhook_verified=true</code> automatically.
          Supplier automation remains locked; use manual fulfilment.
        </div>
      </Card>

      <Card className="border-2 border-foreground overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-4 border-foreground bg-muted/50">
              <TableHead className="font-display uppercase">Created</TableHead>
              <TableHead className="font-display uppercase">PR</TableHead>
              <TableHead className="font-display uppercase">CS</TableHead>
              <TableHead className="font-display uppercase">Customer</TableHead>
              <TableHead className="font-display uppercase">Status</TableHead>
              <TableHead className="font-display uppercase">Pack</TableHead>
              <TableHead className="font-display uppercase text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                  <div className="font-display uppercase text-base text-foreground mb-1">No accepted Contract Summaries ready for review</div>
                  <div>
                    Rows appear here once a payment request is linked to an accepted Contract Summary.
                    Until the Worldpay webhook signing secret is live, every row will show
                    <em> &ldquo;Waiting for verified payment&rdquo;</em>.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              (data ?? []).map((row) => {
                const status = deriveStatus(row.inputs);
                return (
                  <TableRow key={row.inputs.pr!.id} className="border-b-2 border-foreground/10">
                    <TableCell className="text-xs">{format(new Date(row.created_at), "dd MMM HH:mm")}</TableCell>
                    <TableCell className="text-xs font-mono">{row.pr_number ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{row.cs_number ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div>{row.inputs.pr?.customer_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.inputs.pr?.customer_email ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="border-2 border-foreground w-fit">{READINESS_STATUS_LABEL[status]}</Badge>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{SUPPLIER_LOCK_TAG}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{row.pack_version ? `v${row.pack_version}` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpenRow(row)} className="border-2 border-foreground">Open</Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <ReadinessDialog row={openRow} onClose={() => { setOpenRow(null); qc.invalidateQueries({ queryKey: ["admin-readiness"] }); }} />
    </div>
  );

  function ReadinessDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [pack, setPack] = useState<any | null>(null);

    const items = useMemo(() => row ? computeChecklist(row.inputs) : [], [row]);
    const status = row ? deriveStatus(row.inputs) : null;
    const canGenerate = row ? canGenerateDraftPack(row.inputs) : false;

    const toggleTick = async (field: "installation_confirmed" | "router_confirmed" | "internal_notes_reviewed" | "admin_review_complete", value: boolean) => {
      if (!row?.inputs.pr || !row?.inputs.cs) return;
      setSaving(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const existing = row.inputs.readiness;
        const payload: any = {
          payment_request_id: row.inputs.pr.id,
          contract_summary_id: row.inputs.cs.id,
          installation_confirmed: existing?.installation_confirmed ?? false,
          router_confirmed: existing?.router_confirmed ?? false,
          internal_notes_reviewed: existing?.internal_notes_reviewed ?? false,
          admin_review_complete: existing?.admin_review_complete ?? false,
          [field]: value,
          reviewer_user_id: u.user?.id,
        };
        const { error } = await (supabase as any)
          .from("provisioning_readiness")
          .upsert(payload, { onConflict: "payment_request_id" });
        if (error) throw error;
        // Optimistic local update
        row.inputs.readiness = {
          installation_confirmed: payload.installation_confirmed,
          router_confirmed: payload.router_confirmed,
          internal_notes_reviewed: payload.internal_notes_reviewed,
          admin_review_complete: payload.admin_review_complete,
        };
        toast({ title: "Checklist updated" });
      } catch (e: any) {
        toast({ title: "Save failed", description: e?.message, variant: "destructive" });
      } finally { setSaving(false); }
    };

    const generatePack = async () => {
      if (!row?.inputs.pr || !row?.inputs.cs) return;
      setGenerating(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const snapshot = {
          payment_request: row.inputs.pr,
          contract_summary: row.inputs.cs,
          quote: row.inputs.quote,
          quote_request: row.inputs.qr,
          profile: row.inputs.profile,
          readiness: row.inputs.readiness,
          checklist: computeChecklist(row.inputs),
          generated_at: new Date().toISOString(),
          phase: "F0",
          note: "Read-only draft. Supplier order NOT submitted. Phase E webhook sign-off pending.",
        };
        const { data, error } = await (supabase as any)
          .from("draft_order_packs")
          .insert({
            payment_request_id: row.inputs.pr.id,
            contract_summary_id: row.inputs.cs.id,
            snapshot,
            generated_by: u.user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        setPack(data);
        toast({ title: `Draft Order Pack v${data.version} generated` });
      } catch (e: any) {
        toast({ title: "Generation blocked", description: e?.message ?? "verified payment required", variant: "destructive" });
      } finally { setGenerating(false); }
    };

    return (
      <Dialog open={!!row} onOpenChange={(o) => { if (!o) { setPack(null); onClose(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Readiness — {row?.pr_number ?? "—"} · {row?.cs_number ?? "—"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {row && status && (
              <Card className="border-2 border-foreground p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Status</div>
                  <div className="font-display">{READINESS_STATUS_LABEL[status]}</div>
                </div>
                <Badge variant="outline" className="border-2 border-foreground">{SUPPLIER_LOCK_TAG}</Badge>
              </Card>
            )}

            <div className="space-y-1">
              {items.map((it) => (
                <div key={it.key} className="flex items-center gap-3 border-2 border-foreground/10 p-2">
                  {it.adminTickable ? (
                    <Checkbox
                      checked={it.ok}
                      disabled={saving}
                      onCheckedChange={(v) => toggleTick(it.key.replace("tick_", "") === "install" ? "installation_confirmed"
                        : it.key === "tick_router" ? "router_confirmed"
                        : it.key === "tick_notes" ? "internal_notes_reviewed"
                        : "admin_review_complete", v === true)}
                    />
                  ) : (
                    <span className={`inline-block w-4 h-4 border-2 border-foreground ${it.ok ? "bg-foreground" : "bg-background"}`} />
                  )}
                  <span className={`text-sm ${it.ok ? "" : "text-muted-foreground"}`}>{it.label}</span>
                </div>
              ))}
            </div>

            {pack && (
              <Card className="border-2 border-foreground p-3">
                <div className="font-display uppercase mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> Draft Order Pack v{pack.version}</div>
                <pre className="text-xs whitespace-pre-wrap break-all max-h-72 overflow-auto">{JSON.stringify(pack.snapshot, null, 2)}</pre>
              </Card>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              disabled
              title="Supplier order is locked until verified payment is received."
              className="border-2 border-foreground opacity-60 cursor-not-allowed"
              onClick={() => assertSupplierSubmissionEnabled()}
            >
              <Lock className="w-3 h-3 mr-2" />
              Submit to supplier (locked)
            </Button>
            <Button
              variant="hero"
              disabled={!canGenerate || generating}
              onClick={generatePack}
              title={canGenerate ? "Generate read-only draft pack" : "All checklist items + verified payment required"}
            >
              {generating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FileText className="w-3 h-3 mr-2" />}
              Generate Draft Order Pack
            </Button>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
};

export default AdminReadiness;

// Compile-time guard — Phase E not complete.
void SUPPLIER_SUBMISSION_ENABLED;