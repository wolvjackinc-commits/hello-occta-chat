import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  CreditCard,
  Building2,
  FileText,
  Bell,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface CustomerCommunicationsTimelineProps {
  userId: string;
}

type CommunicationLog = {
  id: string;
  user_id: string | null;
  recipient_email: string;
  template_name: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  error_message: string | null;
  provider_message_id: string | null;
  metadata: Json;
  created_at: string;
  invoice_id: string | null;
  payment_request_id: string | null;
};

const TEMPLATE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  // DD status emails
  dd_status_pending: { label: "DD Received", icon: <Building2 className="w-3 h-3" />, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500" },
  dd_status_verified: { label: "DD Verified", icon: <Building2 className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-500" },
  dd_status_submitted_to_provider: { label: "DD Submitted", icon: <Building2 className="w-3 h-3" />, color: "bg-purple-500/10 text-purple-600 border-purple-500" },
  dd_status_active: { label: "DD Active", icon: <Building2 className="w-3 h-3" />, color: "bg-green-500/10 text-green-600 border-green-500" },
  dd_status_failed: { label: "DD Failed", icon: <AlertTriangle className="w-3 h-3" />, color: "bg-red-500/10 text-red-600 border-red-500" },
  dd_status_cancelled: { label: "DD Cancelled", icon: <XCircle className="w-3 h-3" />, color: "bg-red-500/10 text-red-600 border-red-500" },
  
  // Invoice emails
  due_soon: { label: "Due Soon Reminder", icon: <FileText className="w-3 h-3" />, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500" },
  due_today: { label: "Due Today", icon: <FileText className="w-3 h-3" />, color: "bg-orange-500/10 text-orange-600 border-orange-500" },
  overdue_7: { label: "Overdue (7 days)", icon: <AlertTriangle className="w-3 h-3" />, color: "bg-red-500/10 text-red-600 border-red-500" },
  invoice_sent: { label: "Invoice Sent", icon: <FileText className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-500" },
  invoice_paid: { label: "Payment Received", icon: <CheckCircle className="w-3 h-3" />, color: "bg-green-500/10 text-green-600 border-green-500" },
  
  // Payment requests
  payment_link: { label: "Payment Link", icon: <CreditCard className="w-3 h-3" />, color: "bg-primary/10 text-primary border-primary" },
  dd_setup_link: { label: "DD Setup Link", icon: <Building2 className="w-3 h-3" />, color: "bg-primary/10 text-primary border-primary" },
  
  // Order/ticket emails
  order_confirmation: { label: "Order Confirmation", icon: <Bell className="w-3 h-3" />, color: "bg-green-500/10 text-green-600 border-green-500" },
  status_update: { label: "Status Update", icon: <Bell className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-500" },
  ticket_reply: { label: "Ticket Reply", icon: <Mail className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-500" },
};

export function CustomerCommunicationsTimeline({ userId }: CustomerCommunicationsTimelineProps) {
  const { data: communications, isLoading } = useQuery({
    queryKey: ["customer-communications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications_log")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as CommunicationLog[];
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactNode; className: string }> = {
      sent: { icon: <CheckCircle className="w-3 h-3" />, className: "bg-green-500/10 text-green-600 border-green-500" },
      delivered: { icon: <CheckCircle className="w-3 h-3" />, className: "bg-green-500/10 text-green-600 border-green-500" },
      opened: { icon: <Mail className="w-3 h-3" />, className: "bg-blue-500/10 text-blue-600 border-blue-500" },
      pending: { icon: <Clock className="w-3 h-3" />, className: "bg-yellow-500/10 text-yellow-600 border-yellow-500" },
      failed: { icon: <XCircle className="w-3 h-3" />, className: "bg-red-500/10 text-red-600 border-red-500" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge className={`${config.className} border gap-1 text-[10px]`}>
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getTemplateInfo = (templateName: string) => {
    return TEMPLATE_CONFIG[templateName] || {
      label: templateName.replace(/_/g, " "),
      icon: <Mail className="w-3 h-3" />,
      color: "bg-muted text-muted-foreground border-muted-foreground",
    };
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-foreground p-4">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5" />
          <h3 className="font-display text-lg">Communications</h3>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          <h3 className="font-display text-lg">Communications</h3>
        </div>
        {communications && communications.length > 0 && (
          <Badge variant="outline" className="border-2 border-foreground">
            {communications.length} email{communications.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {(!communications || communications.length === 0) ? (
        <div className="py-6 text-center text-muted-foreground">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No communications logged</p>
          <p className="text-xs mt-1">Emails sent to this customer will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {communications.map((comm) => {
            const templateInfo = getTemplateInfo(comm.template_name);
            const metadata = comm.metadata as Record<string, unknown> | null;
            
            return (
              <div
                key={comm.id}
                className="border-2 border-foreground/10 p-3 hover:border-foreground/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${templateInfo.color} border gap-1`}>
                      {templateInfo.icon}
                      {templateInfo.label}
                    </Badge>
                    {getStatusBadge(comm.status)}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(comm.created_at), "dd MMM HH:mm")}
                  </span>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  <span>To: {comm.recipient_email}</span>
                  {comm.sent_at && (
                    <span className="ml-3">Sent: {format(new Date(comm.sent_at), "HH:mm:ss")}</span>
                  )}
                </div>

                {comm.error_message && (
                  <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                    Error: {comm.error_message}
                  </div>
                )}

                {metadata && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {metadata.mandate_reference && (
                      <Badge variant="outline" className="text-[10px]">
                        Ref: {String(metadata.mandate_reference)}
                      </Badge>
                    )}
                    {metadata.invoice_number && (
                      <Badge variant="outline" className="text-[10px]">
                        Inv: {String(metadata.invoice_number)}
                      </Badge>
                    )}
                    {metadata.old_status && metadata.new_status && (
                      <Badge variant="outline" className="text-[10px]">
                        {String(metadata.old_status)} → {String(metadata.new_status)}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default CustomerCommunicationsTimeline;
