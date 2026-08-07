import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import { logAudit } from "@/lib/audit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Clock,
} from "lucide-react";

type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'waiting_customer' | 'waiting_occta';
  priority: 'low' | 'medium' | 'normal' | 'high' | 'urgent';
  category: string | null;
  created_at: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff_reply: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const statusOptions = ['open', 'in_progress', 'resolved', 'closed'] as const;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Unknown error");
  }
  return String(error || "Unknown error");
};
const cannedReplies = [
  {
    label: "Acknowledgement",
    message: "Thanks for flagging this. We're investigating now and will update you shortly.",
  },
  {
    label: "Awaiting info",
    message: "We need a little more information to proceed. Please share any recent changes or error details.",
  },
  {
    label: "Resolved",
    message: "We've resolved the issue and confirmed services are stable. Let us know if anything else comes up.",
  },
];

const statusColors: Record<string, string> = {
  open: "bg-warning text-warning-foreground",
  in_progress: "bg-accent text-accent-foreground",
  resolved: "bg-primary text-primary-foreground",
  closed: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive/80 text-destructive-foreground",
  urgent: "bg-destructive text-destructive-foreground",
};

interface TicketReplyDialogProps {
  ticket: SupportTicket | null;
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updatedTicket: SupportTicket) => void;
}

export function TicketReplyDialog({ ticket, profile, open, onOpenChange, onUpdate }: TicketReplyDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState<SupportTicket['status']>('open');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    if (ticket) {
      setCurrentStatus(ticket.status);
      fetchMessages();
    }
  }, [ticket]);

  const fetchMessages = async () => {
    if (!ticket) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      logError("TicketReplyDialog.fetchMessages", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleStatusChange = async (newStatus: SupportTicket['status']) => {
    if (!ticket) return;
    const previousStatus = currentStatus;

    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus })
        .eq("id", ticket.id);

      if (error) throw error;

      // Log audit
      await logAudit({
        action: newStatus === 'closed' ? 'close' : newStatus === 'resolved' ? 'close' : 'update',
        entity: 'support_ticket',
        entityId: ticket.id,
        metadata: {
          previousStatus,
          newStatus,
          subject: ticket.subject,
        },
      });

      setCurrentStatus(newStatus);
      onUpdate({ ...ticket, status: newStatus });
      toast({ title: "Status updated" });
    } catch (error) {
      logError("TicketReplyDialog.handleStatusChange", error);
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };


  const handleSendReply = async () => {
    if (!ticket || !newMessage.trim()) return;
    setIsSending(true);
    let emailFailed: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Sign in again before replying.");

      const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (roleError || !isAdmin) {
        throw new Error("This account does not have admin permission to reply. Sign in with an authorised admin account.");
      }

      const { error: insertError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: newMessage.trim(),
          is_staff_reply: true,
          sender_role: "staff",
        });

      if (insertError) throw new Error(`Reply could not be saved: ${insertError.message}`);

      // Log audit
      await logAudit({
        action: 'reply',
        entity: 'support_ticket',
        entityId: ticket.id,
        metadata: {
          subject: ticket.subject,
          recipientEmail: profile?.email,
        },
      });

      // Resolve the recipient — fall back to the profile record if the list
      // row didn't carry an email, so replies are never silently email-less.
      let recipientEmail = profile?.email ?? null;
      let recipientName = profile?.full_name ?? null;
      if (!recipientEmail && ticket.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", ticket.user_id)
          .maybeSingle();
        recipientEmail = prof?.email ?? null;
        recipientName = recipientName ?? prof?.full_name ?? null;
      }

      if (recipientEmail) {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            type: "ticket_reply",
            to: recipientEmail,
            data: {
              full_name: recipientName || "Customer",
              ticket_subject: ticket.subject,
              message: newMessage.trim(),
            },
            logToCommunications: true,
            userId: ticket.user_id,
          },
        });
        if (emailError) emailFailed = emailError.message;
        else if (emailResult && typeof emailResult === "object" && "error" in emailResult) {
          emailFailed = String((emailResult as { error?: unknown }).error);
        }
      } else {
        emailFailed = "No email address on this customer's account.";
      }

      if (emailFailed) {
        toast({
          title: "Reply saved — email NOT sent",
          description: `${emailFailed} The customer can still see the reply in their dashboard.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Reply sent", description: `Emailed to ${recipientEmail}` });
      }
      setNewMessage("");
      fetchMessages();
    } catch (error) {
      logError("TicketReplyDialog.handleSendReply", error);
      toast({
        title: "Failed to send reply",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl h-[90dvh] max-h-[90dvh] flex flex-col overflow-hidden border-4 border-foreground p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <MessageSquare className="w-6 h-6" />
            TICKET: {ticket.subject}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Ticket Info */}
          <div className="flex-shrink-0 flex flex-wrap items-center gap-3 p-4 border-4 border-foreground bg-secondary">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="font-display">{profile?.full_name || "Unknown"}</span>
              {profile?.email && <span className="text-muted-foreground text-sm">({profile.email})</span>}
            </div>
            <Badge className={`uppercase ${priorityColors[ticket.priority]}`}>
              {ticket.priority}
            </Badge>
            {ticket.category && (
              <Badge variant="outline" className="border-2 border-foreground uppercase">
                {ticket.category}
              </Badge>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Select value={currentStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className={`w-36 border-2 border-foreground ${statusColors[currentStatus]}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status} className="uppercase">
                      {status.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>


          {/* Full conversation: original message + every reply, one scroll region */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain border-4 border-foreground bg-secondary/50"
            role="region"
            aria-label="Full ticket conversation"
            tabIndex={0}
          >
            <div className="space-y-4 p-4">
              <div className="p-3 border-2 border-foreground bg-card mr-8">
                <div className="flex items-center gap-2 text-xs mb-1 opacity-70">
                  <span className="uppercase font-display">Customer · original message</span>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span>{format(new Date(ticket.created_at), "dd MMM yyyy HH:mm")}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{ticket.description}</p>
              </div>

              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 border-2 border-foreground ${
                      msg.is_staff_reply
                        ? "bg-primary text-primary-foreground ml-8"
                        : "bg-card mr-8"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs mb-1 opacity-70">
                      <span className="uppercase font-display">
                        {msg.is_staff_reply ? "OCCTA staff" : "Customer"}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(msg.created_at), "dd MMM yyyy HH:mm")}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{msg.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-sm text-muted-foreground">No replies yet.</p>
              )}
            </div>
          </div>

          {/* Reply Input */}
          <div className="flex-shrink-0 space-y-2">
            <Select
              onValueChange={(value) => {
                const canned = cannedReplies.find((reply) => reply.label === value);
                if (canned) setNewMessage(canned.message);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Insert canned reply" />
              </SelectTrigger>
              <SelectContent>
                {cannedReplies.map((reply) => (
                  <SelectItem key={reply.label} value={reply.label}>
                    {reply.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your reply..."
                className="border-4 border-foreground"
                rows={3}
              />
              <Button
                variant="hero"
                onClick={handleSendReply}
                disabled={isSending || !newMessage.trim()}
                className="px-6"
              >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {profile?.email
                ? `Your reply is emailed to ${profile.email} and appears in their dashboard.`
                : "Your reply appears in the customer's dashboard; we'll email it if their account has an email address."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}