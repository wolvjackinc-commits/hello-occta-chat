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
import { subDays, format } from "date-fns";
import { MoreHorizontal, ExternalLink, Shield, AlertTriangle } from "lucide-react";

const PAGE_SIZE = 10;

type ComplianceIssue = {
  id: string;
  account_number: string | null;
  full_name: string | null;
  email: string | null;
  issue_type: "missing_dob" | "missing_postcode" | "repeated_failures";
  issue_detail: string;
  failure_count?: number;
};

const ComplianceIssuesQueueContent = () => {
  const navigate = useNavigate();
  const [page] = useState(1);

  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["compliance-issues-queue", page],
    queryFn: async () => {
      // Get profiles missing DOB or postcode
      const { data: incompleteProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, account_number, full_name, email, date_of_birth, postcode")
        .or("date_of_birth.is.null,postcode.is.null")
        .limit(100);

      if (profileError) throw profileError;

      // Get repeated payment failures (3+ in 30 days)
      const { data: paymentAttempts, error: paymentError } = await supabase
        .from("payment_attempts")
        .select("user_id, status")
        .eq("status", "failed")
        .gte("attempted_at", thirtyDaysAgo);

      if (paymentError) throw paymentError;

      // Count failures per user
      const failureCountMap = new Map<string, number>();
      (paymentAttempts || []).forEach((attempt) => {
        const current = failureCountMap.get(attempt.user_id) || 0;
        failureCountMap.set(attempt.user_id, current + 1);
      });

      // Get profiles for users with 3+ failures
      const repeatedFailureUserIds = Array.from(failureCountMap.entries())
        .filter(([, count]) => count >= 3)
        .map(([userId]) => userId);

      let repeatedFailureProfiles: Array<{
        id: string;
        account_number: string | null;
        full_name: string | null;
        email: string | null;
      }> = [];
      if (repeatedFailureUserIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, account_number, full_name, email")
          .in("id", repeatedFailureUserIds);
        repeatedFailureProfiles = data || [];
      }

      // Build issues list
      const issues: ComplianceIssue[] = [];

      (incompleteProfiles || []).forEach((profile) => {
        if (!profile.date_of_birth) {
          issues.push({
            id: profile.id,
            account_number: profile.account_number,
            full_name: profile.full_name,
            email: profile.email,
            issue_type: "missing_dob",
            issue_detail: "Missing date of birth",
          });
        }
        if (!profile.postcode) {
          issues.push({
            id: profile.id,
            account_number: profile.account_number,
            full_name: profile.full_name,
            email: profile.email,
            issue_type: "missing_postcode",
            issue_detail: "Missing postcode",
          });
        }
      });

      repeatedFailureProfiles.forEach((profile) => {
        const count = failureCountMap.get(profile.id) || 0;
        issues.push({
          id: profile.id,
          account_number: profile.account_number,
          full_name: profile.full_name,
          email: profile.email,
          issue_type: "repeated_failures",
          issue_detail: `${count} failed payments in 30 days`,
          failure_count: count,
        });
      });

      // Sort by severity (repeated failures first, then missing data)
      issues.sort((a, b) => {
        if (a.issue_type === "repeated_failures" && b.issue_type !== "repeated_failures") return -1;
        if (b.issue_type === "repeated_failures" && a.issue_type !== "repeated_failures") return 1;
        return 0;
      });

      // Paginate
      const from = (page - 1) * PAGE_SIZE;
      const paginated = issues.slice(from, from + PAGE_SIZE);

      return { issues: paginated, total: issues.length };
    },
  });

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const issues = data?.issues || [];

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <h2 className="font-display text-lg">Compliance Issues</h2>
          <Badge variant="secondary">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/compliance")}
        >
          View all
        </Button>
      </div>

      {issues.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No compliance issues detected.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue, index) => (
              <TableRow key={`${issue.id}-${issue.issue_type}-${index}`}>
                <TableCell>
                  <span className="font-mono text-xs">
                    {issue.account_number || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {issue.full_name || issue.email || "Unknown"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {issue.issue_type === "repeated_failures" && (
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                    )}
                    <Badge
                      variant={
                        issue.issue_type === "repeated_failures"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {issue.issue_detail}
                    </Badge>
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
                        onClick={() => navigate(`/admin/customers/${issue.id}`)}
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

export const ComplianceIssuesQueue = () => (
  <QueueErrorBoundary queueName="Compliance Issues">
    <ComplianceIssuesQueueContent />
  </QueueErrorBoundary>
);
