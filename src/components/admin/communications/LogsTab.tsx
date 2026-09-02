import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdminStatusBadge, AdminEmptyState } from "@/components/admin/primitives";
import { format } from "date-fns";
import { CheckCircle2, Eye, Mail, RefreshCw, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LogEntry = {
  id: string;
  recipient_email: string;
  subject: string | null;
  status: string;
  template_name: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number | null;
  body_html: string | null;
  user_id: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

const formatDate = (value: string | null) =>
  value ? format(new Date(value), "dd/MM/yyyy HH:mm:ss") : "—";

const effectiveStatus = (log: LogEntry) => {
  if (log.opened_at) return "opened";
  if (log.delivered_at) return "delivered";
  return log.status || "pending";
};

export function LogsTab() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: logs, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-comm-logs"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("communications_log")
        .select("id, recipient_email, subject, status, template_name, sent_at, delivered_at, opened_at, last_opened_at, open_count, body_html, user_id, provider_message_id, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(250);
      if (queryError) throw queryError;
      return (data ?? []) as LogEntry[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-communications-log-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "communications_log" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["admin-comm-logs"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs ?? [];
    return (logs ?? []).filter((log) =>
      [log.recipient_email, log.subject, log.template_name, effectiveStatus(log), log.provider_message_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [logs, search]);

  return (
    <div className="space-y-4">
      <Card className="border-2 border-foreground p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email, subject, template or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 border-2 border-foreground"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-green-600 text-green-700">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600" /> Live
            </Badge>
            <span>Updates automatically when an email is sent or opened.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-2 border-destructive p-3 text-sm text-destructive">
          Communications could not be loaded: {error instanceof Error ? error.message : "Unknown error"}
        </Card>
      )}

      <Card className="border-2 border-foreground overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-foreground bg-muted/40">
                <TableHead>Created / Sent</TableHead>
                <TableHead>Recipient email</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Template</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && filteredLogs.map((log) => {
                const displayStatus = effectiveStatus(log);
                return (
                  <TableRow key={log.id} className="border-b border-foreground/10 align-top">
                    <TableCell className="text-xs whitespace-nowrap">
                      <div>{formatDate(log.sent_at || log.created_at)}</div>
                      {!log.sent_at && <div className="text-muted-foreground mt-1">Not sent yet</div>}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{log.recipient_email}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{log.subject || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <AdminStatusBadge status={displayStatus} />
                        {log.status === "failed" && log.error_message && (
                          <div className="max-w-[220px] text-[10px] text-destructive break-words">{log.error_message}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {log.opened_at ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-green-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Opened
                          </div>
                          <div>First: {formatDate(log.opened_at)}</div>
                          <div>Last: {formatDate(log.last_opened_at || log.opened_at)}</div>
                          <div>{log.open_count ?? 1} open{(log.open_count ?? 1) === 1 ? "" : "s"}</div>
                        </div>
                      ) : log.sent_at ? (
                        <span className="text-muted-foreground">Not opened</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {log.template_name?.replace(/[-_]/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label={`View email to ${log.recipient_email}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-4 border-foreground">
                          <DialogHeader>
                            <DialogTitle className="flex items-center justify-between gap-4 pr-8">
                              <span className="truncate">{log.subject || log.template_name}</span>
                              <AdminStatusBadge status={displayStatus} />
                            </DialogTitle>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div>To: <span className="font-mono text-foreground">{log.recipient_email}</span></div>
                              <div>Sent: {formatDate(log.sent_at)}</div>
                              <div>Opened: {formatDate(log.opened_at)}{log.opened_at ? ` · ${log.open_count ?? 1} open${(log.open_count ?? 1) === 1 ? "" : "s"}` : ""}</div>
                              {log.provider_message_id && <div>Provider ID: <span className="font-mono">{log.provider_message_id}</span></div>}
                            </div>
                          </DialogHeader>
                          <div className="flex-1 overflow-y-auto mt-4 border-2 border-foreground p-4 bg-white">
                            {log.body_html ? (
                              <div dangerouslySetInnerHTML={{ __html: log.body_html }} />
                            ) : (
                              <p className="text-muted-foreground italic">No rendered email content was stored for this older communication.</p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <AdminEmptyState
                      icon={<Mail className="h-8 w-8" />}
                      title="No logs found"
                      message="No communications match this view."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
