import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quoteId?: string;
  quoteNumber?: string;
}

type Row = {
  id: string;
  recipient_email: string | null;
  subject: string | null;
  status: string | null;
  sent_at: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number | null;
  error_message: string | null;
  template_name: string | null;
  provider_message_id: string | null;
  created_at: string;
};

const fmt = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "d MMM yyyy HH:mm:ss") : "—";

const StatusBadge = ({ row }: { row: Row }) => {
  if (row.status === "failed") {
    return (
      <Badge className="bg-red-600 text-white border-2 border-foreground gap-1">
        <AlertTriangle className="w-3 h-3" /> Failed
      </Badge>
    );
  }
  if (row.opened_at) {
    return (
      <Badge className="bg-green-600 text-white border-2 border-foreground gap-1">
        <Eye className="w-3 h-3" /> Opened{(row.open_count ?? 0) > 1 ? ` × ${row.open_count}` : ""}
      </Badge>
    );
  }
  if (row.status === "sent") {
    return (
      <Badge className="bg-blue-600 text-white border-2 border-foreground gap-1">
        <CheckCircle2 className="w-3 h-3" /> Sent · unread
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-2 border-foreground capitalize">
      {row.status ?? "queued"}
    </Badge>
  );
};

export const QuoteReadReceiptsDialog = ({ open, onOpenChange, quoteId, quoteNumber }: Props) => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["quote-read-receipts", quoteId, quoteNumber],
    enabled: open && !!quoteId,
    queryFn: async (): Promise<Row[]> => {
      // Match by metadata->>quote_id OR by subject containing quote_number.
      // The subject check catches older log rows written before metadata was populated.
      const orClause: string[] = [];
      if (quoteId) orClause.push(`metadata->>quote_id.eq.${quoteId}`);
      if (quoteNumber) orClause.push(`subject.ilike.%${quoteNumber}%`);
      const { data, error } = await (supabase as any)
        .from("communications_log")
        .select("id, recipient_email, subject, status, sent_at, opened_at, last_opened_at, open_count, error_message, template_name, provider_message_id, created_at")
        .or(orClause.join(","))
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Read receipts — {quoteNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading receipts…
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="p-8 text-sm text-muted-foreground border-2 border-dashed border-foreground/30">
              No emails logged yet for this quote.
            </div>
          ) : (
            <div className="border-2 border-foreground">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>First opened</TableHead>
                    <TableHead>Last opened</TableHead>
                    <TableHead className="text-right">Opens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.recipient_email ?? "—"}</TableCell>
                      <TableCell><StatusBadge row={r} /></TableCell>
                      <TableCell className="text-xs">{fmt(r.sent_at ?? r.created_at)}</TableCell>
                      <TableCell className="text-xs">{fmt(r.opened_at)}</TableCell>
                      <TableCell className="text-xs">{fmt(r.last_opened_at)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.open_count ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {data?.some((r) => r.error_message) && (
            <div className="mt-3 border-2 border-red-600 bg-red-50 p-3 text-xs text-red-900">
              <div className="font-black uppercase tracking-wider mb-1">Delivery errors</div>
              <ul className="space-y-1">
                {data!.filter((r) => r.error_message).map((r) => (
                  <li key={r.id} className="font-mono">
                    {fmt(r.created_at)} · {r.recipient_email} · {r.error_message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Opens are counted via a 1×1 tracking pixel. Recipients who block remote images (some corporate mail clients, Apple Mail Privacy Protection) may show as unread even after reading.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs underline text-muted-foreground hover:text-foreground"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteReadReceiptsDialog;