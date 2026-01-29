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
import { format, addDays, differenceInDays } from "date-fns";
import { MoreHorizontal, ExternalLink, Send, Clock } from "lucide-react";

const PAGE_SIZE = 10;

type DueSoonInvoice = {
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

const InvoicesDueSoonQueueContent = () => {
  const navigate = useNavigate();
  const [page] = useState(1);

  const today = format(new Date(), "yyyy-MM-dd");
  const fiveDaysFromNow = format(addDays(new Date(), 5), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["invoices-due-soon-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: invoices, error, count } = await supabase
        .from("invoices")
        .select("id, user_id, invoice_number, total, due_date, status", { count: "exact" })
        .eq("status", "sent")
        .gte("due_date", today)
        .lte("due_date", fiveDaysFromNow)
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

      const enrichedInvoices: DueSoonInvoice[] = (invoices || []).map((invoice) => ({
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
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-lg">Due Within 5 Days</h2>
          <Badge variant="secondary">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/billing?status=sent")}
        >
          View all
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No invoices due within 5 days.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Days Until Due</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const daysUntilDue = differenceInDays(new Date(invoice.due_date), new Date());
              return (
                <TableRow key={invoice.id}>
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
                    <Badge 
                      variant={daysUntilDue <= 2 ? "destructive" : "secondary"}
                    >
                      {daysUntilDue === 0 ? "Today" : `${daysUntilDue} days`}
                    </Badge>
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
                          Send Reminder
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

export const InvoicesDueSoonQueue = () => (
  <QueueErrorBoundary queueName="Invoices Due Soon">
    <InvoicesDueSoonQueueContent />
  </QueueErrorBoundary>
);
