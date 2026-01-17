import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";

const ITEMS_PER_PAGE = 25;

const actionColors: Record<string, string> = {
  create: "bg-primary text-primary-foreground",
  update: "bg-accent text-accent-foreground",
  delete: "bg-destructive text-destructive-foreground",
  suspend: "bg-warning text-warning-foreground",
  resume: "bg-primary text-primary-foreground",
  cancel: "bg-destructive text-destructive-foreground",
  close: "bg-muted text-muted-foreground",
  reply: "bg-secondary text-secondary-foreground",
  late_fee: "bg-warning text-warning-foreground",
};

const entityOptions = [
  "all",
  "order",
  "guest_order",
  "support_ticket",
  "service",
  "invoice",
  "payment",
  "user",
] as const;

const actionOptions = [
  "all",
  "create",
  "update",
  "delete",
  "suspend",
  "resume",
  "cancel",
  "close",
  "reply",
  "late_fee",
] as const;

export const AdminAuditLog = () => {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-audit-logs", page, entityFilter, actionFilter, searchQuery, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (entityFilter !== "all") {
        query = query.eq("entity", entityFilter);
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (dateFrom) {
        query = query.gte("created_at", dateFrom.toISOString());
      }

      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data: logs, count, error } = await query;

      if (error) throw error;

      // Get unique actor IDs
      const actorIds = [...new Set(logs?.map((l) => l.actor_user_id).filter(Boolean) as string[])];
      
      let profiles: { id: string; full_name: string | null; email: string | null }[] = [];
      if (actorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", actorIds);
        profiles = profilesData ?? [];
      }

      return {
        logs: logs ?? [],
        profiles,
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / ITEMS_PER_PAGE),
      };
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, { full_name: string | null; email: string | null }>();
    data?.profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [data?.profiles]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim() || !data?.logs) return data?.logs ?? [];
    const q = searchQuery.toLowerCase();
    return data.logs.filter(
      (log) =>
        log.entity.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entity_id?.toLowerCase().includes(q) ||
        JSON.stringify(log.metadata).toLowerCase().includes(q)
    );
  }, [data?.logs, searchQuery]);

  const clearFilters = () => {
    setEntityFilter("all");
    setActionFilter("all");
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Audit Log</h1>
          <p className="text-muted-foreground">
            Complete history of system actions and changes.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-2 border-foreground"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-2 border-foreground p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 border-2 border-foreground"
              />
            </div>
          </div>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-40 border-2 border-foreground">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              {entityOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === "all" ? "All Entities" : opt.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40 border-2 border-foreground">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {actionOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === "all" ? "All Actions" : opt.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-2 border-foreground">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {dateFrom ? format(dateFrom, "dd/MM/yy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-4 border-foreground">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-2 border-foreground">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {dateTo ? format(dateTo, "dd/MM/yy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-4 border-foreground">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            Clear
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-2 border-foreground overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-4 border-foreground bg-muted/50">
              <TableHead className="font-display uppercase">Timestamp</TableHead>
              <TableHead className="font-display uppercase">Actor</TableHead>
              <TableHead className="font-display uppercase">Action</TableHead>
              <TableHead className="font-display uppercase">Entity</TableHead>
              <TableHead className="font-display uppercase">Entity ID</TableHead>
              <TableHead className="font-display uppercase">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="animate-pulse text-muted-foreground">Loading audit logs...</div>
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const actor = log.actor_user_id ? profileMap.get(log.actor_user_id) : null;
                const metadata = log.metadata as Record<string, any> | null;
                
                return (
                  <TableRow key={log.id} className="border-b-2 border-foreground/20">
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {actor?.full_name || actor?.email?.split("@")[0] || "System"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${actionColors[log.action] || "bg-secondary"} border-2 border-foreground capitalize`}>
                        {log.action.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {log.entity.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {metadata ? (
                        <span title={JSON.stringify(metadata, null, 2)}>
                          {Object.entries(metadata)
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, data.totalCount)} of {data.totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-2 border-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="border-2 border-foreground"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
