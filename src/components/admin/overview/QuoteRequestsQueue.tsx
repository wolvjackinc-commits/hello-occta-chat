import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Inbox, Phone, Mail, ExternalLink } from "lucide-react";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { QueueSkeleton } from "./QueueSkeleton";
import { QueueErrorBoundary } from "./QueueErrorBoundary";

const PAGE_SIZE = 8;
const LIVE_STATUSES = ["new", "in_review", "needs_info", "assigned", "draft_quote_created"];

type QuoteRequest = {
  id: string;
  reference: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  service_interest: string | null;
  plan_preference: string | null;
  status: string | null;
  created_at: string;
};

const QuoteRequestsQueueContent = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["quote-requests-overview-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: quoteRequests, error, count } = await (supabase as any)
        .from("quote_requests")
        .select("id, reference, full_name, email, phone, postcode, service_interest, plan_preference, status, created_at", { count: "exact" })
        .in("status", LIVE_STATUSES)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { quoteRequests: (quoteRequests ?? []) as QuoteRequest[], total: count ?? 0 };
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <QueueSkeleton rows={5} />;

  const quoteRequests = data?.quoteRequests ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          <h2 className="font-display text-lg">Quote Requests</h2>
          <Badge variant="secondary">{data?.total ?? 0}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/quote-requests")}>View all</Button>
      </div>

      {quoteRequests.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No live quote requests.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Postcode</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[72px]">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{request.full_name || "Unknown"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{request.reference || request.id.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell className="space-y-1 text-xs">
                      {request.email ? (
                        <a href={`mailto:${request.email}`} className="flex items-center gap-1 underline hover:text-primary">
                          <Mail className="h-3 w-3" /> {request.email}
                        </a>
                      ) : null}
                      {request.phone ? (
                        <a href={`tel:${request.phone}`} className="flex items-center gap-1 font-mono underline hover:text-primary">
                          <Phone className="h-3 w-3" /> {request.phone}
                        </a>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{request.postcode || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {request.service_interest || "Quote"}
                      {request.plan_preference ? <span className="text-muted-foreground"> · {request.plan_preference}</span> : null}
                      <div className="text-muted-foreground">
                        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{request.status || "new"}</Badge></TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/admin/quote-requests?search=${encodeURIComponent(request.reference || request.email || "")}`)}
                        aria-label={`Open quote request ${request.reference || request.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} />
                </PaginationItem>
                <PaginationItem><PaginationLink>{page}</PaginationLink></PaginationItem>
                <PaginationItem>
                  <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </Card>
  );
};

export const QuoteRequestsQueue = () => (
  <QueueErrorBoundary queueName="quote requests">
    <QuoteRequestsQueueContent />
  </QueueErrorBoundary>
);