import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdminStatusBadge, AdminEmptyState } from "@/components/admin/primitives";
import { format } from "date-fns";
import { Mail, Eye, Search } from "lucide-react";
import { useState } from "react";
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
  subject: string;
  status: string;
  template_name: string;
  sent_at: string;
  body_html: string | null;
  user_id: string | null;
};

export function LogsTab() {
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-comm-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as LogEntry[];
    },
  });

  const filteredLogs = logs?.filter(log => 
    log.recipient_email?.toLowerCase().includes(search.toLowerCase()) ||
    log.subject?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card className="border-2 border-foreground p-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search email or subject..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-2 border-foreground"
          />
        </div>
      </Card>

      <Card className="border-2 border-foreground overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground bg-muted/40">
              <TableHead>Sent At</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Template</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && filteredLogs?.map((log) => (
              <TableRow key={log.id} className="border-b border-foreground/10">
                <TableCell className="text-xs whitespace-nowrap">
                  {log.sent_at ? format(new Date(log.sent_at), "dd/MM/yyyy HH:mm") : "Pending"}
                </TableCell>
                <TableCell className="font-medium">{log.recipient_email}</TableCell>
                <TableCell className="max-w-[300px] truncate">{log.subject}</TableCell>
                <TableCell>
                  <AdminStatusBadge status={log.status} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {log.template_name?.replace(/-/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-4 border-foreground">
                      <DialogHeader>
                        <DialogTitle className="flex items-center justify-between pr-8">
                          <span className="truncate">{log.subject}</span>
                          <Badge variant="outline">{log.status}</Badge>
                        </DialogTitle>
                        <div className="text-xs text-muted-foreground">
                          To: {log.recipient_email} | Sent: {log.sent_at ? new Date(log.sent_at).toLocaleString() : 'N/A'}
                        </div>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto mt-4 border-2 border-foreground p-4 bg-white">
                        {log.body_html ? (
                          <div dangerouslySetInnerHTML={{ __html: log.body_html }} />
                        ) : (
                          <p className="text-muted-foreground italic">No content recorded.</p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filteredLogs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <AdminEmptyState 
                    icon={<Mail className="h-8 w-8" />}
                    title="No logs found"
                    message="Check back after sending emails."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
