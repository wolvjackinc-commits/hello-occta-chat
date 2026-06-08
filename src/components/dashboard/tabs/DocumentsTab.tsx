import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { EmptyState } from "./EmptyState";

type Doc = { id: string; label: string; href: string | null; at: string; kind: string };

export function DocumentsTab({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [inv, cs, uf] = await Promise.all([
        supabase.from("invoices").select("id,invoice_number,pdf_url,issue_date").eq("user_id", userId).order("issue_date", { ascending: false }),
        supabase.from("contract_summaries").select("id,cs_number,plan_name,pdf_url,issued_at").eq("customer_id", userId).order("issued_at", { ascending: false }),
        supabase.from("user_files").select("id,file_name,file_path,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      const combined: Doc[] = [];
      (inv.data || []).forEach((r: any) => combined.push({ id: `inv-${r.id}`, label: `Invoice ${r.invoice_number}`, href: r.pdf_url, at: r.issue_date, kind: "Invoice" }));
      (cs.data || []).forEach((r: any) => combined.push({ id: `cs-${r.id}`, label: `Contract Summary ${r.cs_number || r.plan_name}`, href: r.pdf_url, at: r.issued_at, kind: "Contract Summary" }));
      (uf.data || []).forEach((r: any) => combined.push({ id: `uf-${r.id}`, label: r.file_name, href: null, at: r.created_at, kind: "Document" }));
      combined.sort((a, b) => (a.at < b.at ? 1 : -1));
      setDocs(combined);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (docs.length === 0) return <EmptyState icon={<FileText className="w-8 h-8" />} title="No documents yet" message="Your OCCTA documents will appear here." />;

  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between p-3 border-2 border-foreground bg-background">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="font-display text-sm">{d.label}</p>
              <p className="text-xs text-muted-foreground">{d.kind} · {d.at ? format(new Date(d.at), "dd MMM yyyy") : ""}</p>
            </div>
          </div>
          {d.href ? (
            <a href={d.href} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="border-2 border-foreground"><Download className="w-4 h-4" /></Button></a>
          ) : (
            <span className="text-xs text-muted-foreground">Contact OCCTA</span>
          )}
        </div>
      ))}
    </div>
  );
}