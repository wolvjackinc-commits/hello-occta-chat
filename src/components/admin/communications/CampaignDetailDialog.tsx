import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Users, Mail, Eye, AlertCircle, CheckCircle } from "lucide-react";

type Campaign = {
  id: string;
  campaign_name: string;
  status: string;
  total_recipients: number | null;
  sent_count: number | null;
  failed_count: number | null;
  opened_count: number | null;
  delivered_count: number | null;
  bounced_count: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type CampaignRecipient = {
  id: string;
  email: string;
  full_name: string | null;
  account_number: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  error_message: string | null;
  open_count: number | null;
};

interface CampaignDetailDialogProps {
  campaign: Campaign | null;
  onClose: () => void;
}

export const CampaignDetailDialog = ({ campaign, onClose }: CampaignDetailDialogProps) => {
  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["campaign-recipients", campaign?.id],
    queryFn: async () => {
      if (!campaign) return [];
      const { data, error } = await supabase
        .from("campaign_recipients")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      return data as CampaignRecipient[];
    },
    enabled: !!campaign,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return "bg-green-100 text-green-800 border-green-300";
      case "opened":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "queued":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "failed":
      case "bounced":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (!campaign) return null;

  const stats = [
    { label: "Total", value: campaign.total_recipients || 0, icon: Users },
    { label: "Sent", value: campaign.sent_count || 0, icon: Mail },
    { label: "Opened", value: campaign.opened_count || 0, icon: Eye },
    { label: "Failed", value: campaign.failed_count || 0, icon: AlertCircle },
  ];

  return (
    <Dialog open={!!campaign} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            {campaign.campaign_name}
            <Badge variant="outline" className={getStatusColor(campaign.status)}>
              {campaign.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto">
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Campaign info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Started:</span>{" "}
              {campaign.started_at
                ? format(new Date(campaign.started_at), "dd MMM yyyy HH:mm")
                : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Completed:</span>{" "}
              {campaign.completed_at
                ? format(new Date(campaign.completed_at), "dd MMM yyyy HH:mm")
                : "—"}
            </div>
          </div>

          {/* Recipients table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <div className="flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : recipients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No recipients found
                    </TableCell>
                  </TableRow>
                ) : (
                  recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell>
                        <div className="font-medium">
                          {recipient.full_name || "—"}
                        </div>
                        {recipient.account_number && (
                          <div className="text-xs text-muted-foreground">
                            {recipient.account_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(recipient.status)}>
                          {recipient.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.sent_at
                          ? format(new Date(recipient.sent_at), "HH:mm:ss")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {recipient.opened_at ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-xs">
                              {format(new Date(recipient.opened_at), "HH:mm:ss")}
                              {(recipient.open_count || 0) > 1 && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  (×{recipient.open_count})
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {recipient.error_message && (
                          <span className="text-xs text-destructive">
                            {recipient.error_message}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
