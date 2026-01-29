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
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, ExternalLink, Users, AlertCircle } from "lucide-react";

const PAGE_SIZE = 10;

type CustomerIssue = {
  id: string;
  account_number: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string;
  issue_type: "no_services" | "suspended_service";
  service_count: number;
  suspended_count: number;
};

const CustomersNeedingAttentionQueueContent = () => {
  const navigate = useNavigate();
  const [page] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["customers-needing-attention-queue", page],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, account_number, full_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (profileError) throw profileError;

      // Get all services grouped by user
      const { data: services, error: serviceError } = await supabase
        .from("services")
        .select("user_id, status");

      if (serviceError) throw serviceError;

      // Build service count map
      const serviceCountMap = new Map<string, { total: number; suspended: number }>();
      (services || []).forEach((s) => {
        const current = serviceCountMap.get(s.user_id) || { total: 0, suspended: 0 };
        current.total += 1;
        if (s.status === "suspended") {
          current.suspended += 1;
        }
        serviceCountMap.set(s.user_id, current);
      });

      // Find customers needing attention
      const issues: CustomerIssue[] = [];
      
      (profiles || []).forEach((profile) => {
        const serviceCounts = serviceCountMap.get(profile.id) || { total: 0, suspended: 0 };
        
        // New customers with no services (created in last 30 days)
        const createdDate = new Date(profile.created_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (serviceCounts.total === 0 && createdDate > thirtyDaysAgo) {
          issues.push({
            id: profile.id,
            account_number: profile.account_number,
            full_name: profile.full_name,
            email: profile.email,
            created_at: profile.created_at,
            issue_type: "no_services",
            service_count: 0,
            suspended_count: 0,
          });
        }
        
        // Customers with suspended services
        if (serviceCounts.suspended > 0) {
          issues.push({
            id: profile.id,
            account_number: profile.account_number,
            full_name: profile.full_name,
            email: profile.email,
            created_at: profile.created_at,
            issue_type: "suspended_service",
            service_count: serviceCounts.total,
            suspended_count: serviceCounts.suspended,
          });
        }
      });

      // Paginate
      const from = (page - 1) * PAGE_SIZE;
      const paginated = issues.slice(from, from + PAGE_SIZE);

      return { customers: paginated, total: issues.length };
    },
  });

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const customers = data?.customers || [];

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="font-display text-lg">Customer Attention</h2>
          <Badge variant="secondary">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/customers")}
        >
          View all
        </Button>
      </div>

      {customers.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No customers need immediate attention.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={`${customer.id}-${customer.issue_type}`}>
                <TableCell>
                  <span className="font-mono text-xs">
                    {customer.account_number || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {customer.full_name || customer.email || "Unknown"}
                </TableCell>
                <TableCell>
                  {customer.issue_type === "no_services" ? (
                    <Badge variant="secondary">No services</Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <Badge variant="destructive">
                        {customer.suspended_count} suspended
                      </Badge>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(customer.created_at), {
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
                        onClick={() => navigate(`/admin/customers/${customer.id}`)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Customer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};

export const CustomersNeedingAttentionQueue = () => (
  <QueueErrorBoundary queueName="Customers Needing Attention">
    <CustomersNeedingAttentionQueueContent />
  </QueueErrorBoundary>
);
