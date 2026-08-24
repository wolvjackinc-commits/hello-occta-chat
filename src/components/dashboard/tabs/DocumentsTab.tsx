import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Loader2, Lock, Receipt as ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { EmptyState } from "./EmptyState";
import { useToast } from "@/hooks/use-toast";

type Doc = {
  id: string;
  label: string;
  href: string | null;
  at: string;
  kind: string;
  csId?: string;
  csHasPdf?: boolean;
  csAccepted?: boolean;
  receiptPrId?: string;
};

export function DocumentsTab({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const [inv, cs, uf, pr] = await Promise.all([
        supabase.from("invoices").select("id,invoice_number,pdf_url,issue_date").eq("user_id", userId).order("issue_date", { ascending: false }),
        supabase.from("customer_contract_summaries" as any).select("id,cs_number,plan_name,pdf_url,pdf_storage_key,issued_at,accepted_at").eq("customer_id", userId).order("issued_at", { ascending: false }),
        supabase.from("user_files").select("id,file_name,file_path,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("payment_requests").select("id,payment_request_number,paid_at,status,webhook_verified").eq("user_id", userId).in("status", ["paid","completed"]).eq("webhook_verified", true).order("paid_at", { ascending: false }),
      ]);
      const combined: Doc[] = [];
      (inv.data || []).forEach((r: any) => combined.push({ id: `inv-${r.id}`, label: `Invoice ${r.invoice_number}`, href: r.pdf_url, at: r.issue_date, kind: "Invoice" }));
      (cs.data || []).forEach((r: any) => combined.push({
        id: `cs-${r.id}`,
        label: `Contract Summary ${r.cs_number || r.plan_name}`,
        href: r.pdf_url,
        at: r.accepted_at ?? r.issued_at,
        kind: r.accepted_at ? "Contract Summary · Accepted" : "Contract Summary",
        csId: r.id,
        csHasPdf: !!r.pdf_storage_key,
        csAccepted: !!r.accepted_at,
      }));
      (pr.data || []).forEach((r: any) => combined.push({
        id: `pr-${r.id}`,
        label: `Payment receipt ${r.payment_request_number}`,
        href: null,
        at: r.paid_at,
        kind: "Receipt · Verified",
        receiptPrId: r.id,
      }));
      (uf.data || []).forEach((r: any) => combined.push({ id: `uf-${r.id}`, label: r.file_name, href: null, at: r.created_at, kind: "Document" }));
      combined.sort((a, b) => (a.at < b.at ? 1 : -1));
      setDocs(combined);
      setLoading(false);
    })();
  }, [userId]);

  const openCsPdf = async (csId: string) => {
    setBusyId(csId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract-summary-pdf", {
        body: { contract_summary_id: csId },
      });
      const err = (data as any)?.error || error?.message;
      if (err) throw new Error(err);
      const url = (data as any)?.signed_url;
      if (!url) throw new Error("no_signed_url");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Couldn't open document", description: String((e as Error).message), variant: "destructive" });
    } finally { setBusyId(null); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (docs.length === 0) return <EmptyState icon={<FileText className="w-8 h-8" />} title="No documents yet" message="Your OCCTA documents will appear here." />;

  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
          <div className="flex items-center gap-3">
            {d.receiptPrId ? <ReceiptIcon className="w-5 h-5 text-primary" /> : d.csAccepted ? <Lock className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-primary" />}
            <div>
              <p className="font-display text-sm">{d.label}</p>
              <p className="text-xs text-muted-foreground">{d.kind} · {d.at ? format(new Date(d.at), "dd MMM yyyy") : ""}</p>
            </div>
          </div>
          {d.receiptPrId ? (
            <Link to={`/dashboard/receipt/${d.receiptPrId}`}>
              <Button size="sm" variant="outline" className="border-2 border-foreground">
                <ReceiptIcon className="w-4 h-4 mr-1" /> View
              </Button>
            </Link>
          ) : d.csId ? (
            <Button
              size="sm"
              variant="outline"
              className="border-2 border-foreground"
              disabled={busyId === d.csId || !d.csHasPdf}
              onClick={() => openCsPdf(d.csId!)}
              aria-label="Download Contract Summary"
            >
              {busyId === d.csId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </Button>
          ) : d.href ? (
            <a href={d.href} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="border-2 border-foreground" aria-label="Download Document"><Download className="w-4 h-4" /></Button></a>
          ) : (
            <span className="text-xs text-muted-foreground">Contact OCCTA</span>
          )}
        </div>
      ))}
    </div>
  );
}