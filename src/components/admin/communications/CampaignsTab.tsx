import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, Mail, Users } from "lucide-react";
import { format } from "date-fns";
import { CreateCampaignDialog } from "./CreateCampaignDialog";
import { CampaignDetailDialog } from "./CampaignDetailDialog";

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
  template_id: string;
  email_templates?: {
    template_name: string;
  } | null;
};

export const CampaignsTab = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ["email-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          email_templates (
            template_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-300";
      case "sending":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "failed":
        return "bg-red-100 text-red-800 border-red-300";
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getOpenRate = (campaign: Campaign) => {
    const sent = campaign.sent_count || 0;
    const opened = campaign.opened_count || 0;
    if (sent === 0) return "—";
    return `${Math.round((opened / sent) * 100)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Send bulk emails to customers using your templates
        </p>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <div className="rounded-lg border-4 border-foreground">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-foreground hover:bg-transparent">
              <TableHead className="font-bold">Campaign</TableHead>
              <TableHead className="font-bold">Template</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Recipients
                </div>
              </TableHead>
              <TableHead className="font-bold">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Sent
                </div>
              </TableHead>
              <TableHead className="font-bold">
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Opened
                </div>
              </TableHead>
              <TableHead className="font-bold">Created</TableHead>
              <TableHead className="font-bold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No campaigns yet. Create your first campaign to start sending emails.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id} className="border-b border-border">
                  <TableCell className="font-medium">{campaign.campaign_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.email_templates?.template_name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{campaign.total_recipients || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600">{campaign.sent_count || 0}</span>
                      {(campaign.failed_count || 0) > 0 && (
                        <span className="text-xs text-destructive">
                          ({campaign.failed_count} failed)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span>{campaign.opened_count || 0}</span>
                      <span className="text-xs text-muted-foreground">
                        ({getOpenRate(campaign)})
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(campaign.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedCampaign(campaign)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateCampaignDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          refetch();
        }}
      />

      <CampaignDetailDialog
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>
  );
};
