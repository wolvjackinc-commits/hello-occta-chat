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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { QueueSkeleton } from "./QueueSkeleton";
import { QueueErrorBoundary } from "./QueueErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { subDays, format, formatDistanceToNow } from "date-fns";
import { MoreHorizontal, ExternalLink, Send, FileText, AlertCircle } from "lucide-react";

const PAGE_SIZE = 10;

type PaymentAttempt = {
  id: string;
  user_id: string;
  invoice_id: string | null;
  amount: number;
  status: string;
  reason: string | null;
  attempted_at: string;
  profile?: {
    account_number: string | null;
  } | null;
};

const FailedPaymentsQueueContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["failed-payments-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: attempts, error, count } = await supabase
        .from("payment_attempts")
        .select("id, user_id, invoice_id, amount, status, reason, attempted_at", { count: "exact" })
        .eq("status", "failed")
        .gte("attempted_at", thirtyDaysAgo)
        .order("attempted_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch profiles for all attempts
      const userIds = [...new Set((attempts || []).map((a) => a.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, account_number")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const enrichedAttempts: PaymentAttempt[] = (attempts || []).map((attempt) => ({
        ...attempt,
        profile: profileMap.get(attempt.user_id) || null,
      }));

      return { attempts: enrichedAttempts, total: count || 0 };
    },
  });

  const handleSendPaymentLink = async (attempt: PaymentAttempt) => {
    if (!attempt.invoice_id) {
      toast({
        title: "No invoice linked",
        description: "This payment attempt has no associated invoice.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/admin/billing?invoice=${attempt.invoice_id}&action=send`);
  };

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const attempts = data?.attempts || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <h2 className="font-display text-lg">Failed Payments</h2>
          <Badge variant="destructive">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/payments-dd?tab=attempts")}
        >
          View all
        </Button>
      </div>

      {attempts.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No failed payments in the last 30 days.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attempt ID</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="font-mono text-xs">
                    {attempt.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {attempt.profile?.account_number || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    £{attempt.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                    {attempt.reason || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {attempt.invoice_id ? (
                      <span className="font-mono text-xs">
                        {attempt.invoice_id.slice(0, 8)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(attempt.attempted_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {attempt.invoice_id && (
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/admin/billing?invoice=${attempt.invoice_id}`)
                            }
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Open Invoice
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleSendPaymentLink(attempt)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send payment link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(
                              `/admin/customers/${attempt.profile?.account_number}`
                            )
                          }
                          disabled={!attempt.profile?.account_number}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View customer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
                  (p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        onClick={() => setPage(p)}
                        isActive={page === p}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </Card>
  );
};

export const FailedPaymentsQueue = () => (
  <QueueErrorBoundary queueName="Failed Payments">
    <FailedPaymentsQueueContent />
  </QueueErrorBoundary>
);
