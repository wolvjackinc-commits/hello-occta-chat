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
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, ExternalLink, Mail, CreditCard } from "lucide-react";

const PAGE_SIZE = 10;

type DDMandate = {
  id: string;
  user_id: string;
  status: string;
  mandate_reference: string | null;
  bank_last4: string | null;
  account_holder: string | null;
  created_at: string;
  profile?: {
    account_number: string | null;
    full_name: string | null;
  } | null;
};

const DDMandatesQueueContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["dd-mandates-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: mandates, error, count } = await supabase
        .from("dd_mandates")
        .select("id, user_id, status, mandate_reference, bank_last4, account_holder, created_at", { count: "exact" })
        .in("status", ["pending", "submitted"])
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch profiles for all mandates
      const userIds = [...new Set((mandates || []).map((m) => m.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, account_number, full_name")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const enrichedMandates: DDMandate[] = (mandates || []).map((mandate) => ({
        ...mandate,
        profile: profileMap.get(mandate.user_id) || null,
      }));

      return { mandates: enrichedMandates, total: count || 0 };
    },
  });

  const handleSendDDRequest = (mandate: DDMandate) => {
    if (mandate.profile?.account_number) {
      navigate(
        `/admin/customers/${mandate.profile.account_number}?action=dd-request`
      );
    } else {
      toast({
        title: "No customer linked",
        description: "This mandate has no associated customer account.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const mandates = data?.mandates || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <h2 className="font-display text-lg">DD Mandates Pending</h2>
          <Badge variant="secondary">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/payments-dd?tab=mandates")}
        >
          View all
        </Button>
      </div>

      {mandates.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No pending DD mandates.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mandate ID</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mandates.map((mandate) => (
                <TableRow key={mandate.id}>
                  <TableCell className="font-mono text-xs">
                    {mandate.mandate_reference || mandate.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {mandate.profile?.account_number || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {mandate.bank_last4 ? (
                      <span className="text-xs">****{mandate.bank_last4}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        mandate.status === "pending" ? "secondary" : "default"
                      }
                    >
                      {mandate.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(mandate.created_at), {
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
                        <DropdownMenuItem
                          onClick={() => handleSendDDRequest(mandate)}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send DD request email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(
                              `/admin/customers/${mandate.profile?.account_number}`
                            )
                          }
                          disabled={!mandate.profile?.account_number}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open customer
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

export const DDMandatesQueue = () => (
  <QueueErrorBoundary queueName="DD Mandates">
    <DDMandatesQueueContent />
  </QueueErrorBoundary>
);
