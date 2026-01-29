import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueueSkeleton } from "./QueueSkeleton";
import { QueueErrorBoundary } from "./QueueErrorBoundary";
import { format, differenceInDays } from "date-fns";
import { MoreHorizontal, ExternalLink, Send, AlertTriangle, FileWarning } from "lucide-react";

const PAGE_SIZE = 10;

type OverdueInvoice = {
  id: string;
  user_id: string;
  invoice_number: string;
  total: number;
  due_date: string;
  status: string;
  profile?: {
    account_number: string | null;
    full_name: string | null;
  } | null;
};

const OverdueInvoicesQueueContent = () => {
  const navigate = useNavigate();
  const [page] = useState(1);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["overdue-invoices-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: invoices, error, count } = await supabase
        .from("invoices")
        .select("id, user_id, invoice_number, total, due_date, status", { count: "exact" })
        .in("status", ["sent", "overdue"])
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set((invoices || []).map((i) => i.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, account_number, full_name")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const enrichedInvoices: OverdueInvoice[] = (invoices || []).map((invoice) => ({
        ...invoice,
        due_date: invoice.due_date || today,
        profile: profileMap.get(invoice.user_id) || null,
      }));

      return { invoices: enrichedInvoices, total: count || 0 };
    },
  });

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const invoices = data?.invoices || [];

  return (
    <Card className="border-2 border-destructive/50 bg-destructive/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-destructive" />
          <h2 className="font-display text-lg">Overdue Invoices</h2>
          <Badge variant="destructive">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/billing?status=overdue")}
        >
          View all
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No overdue invoices.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Days Overdue</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const daysOverdue = differenceInDays(new Date(), new Date(invoice.due_date));
              return (
                <TableRow key={invoice.id} className="bg-destructive/5">
                  <TableCell className="font-mono text-xs">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {invoice.profile?.account_number || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {invoice.profile?.full_name || "Unknown"}
                  </TableCell>
                  <TableCell className="font-medium">
                    £{invoice.total.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {daysOverdue > 7 && (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      )}
                      <Badge variant="destructive">{daysOverdue} days</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => navigate(`/admin/billing?invoice=${invoice.id}`)}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/admin/billing?invoice=${invoice.id}&action=send`)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send Payment Link
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};

export const OverdueInvoicesQueue = () => (
  <QueueErrorBoundary queueName="Overdue Invoices">
    <OverdueInvoicesQueueContent />
  </QueueErrorBoundary>
);
