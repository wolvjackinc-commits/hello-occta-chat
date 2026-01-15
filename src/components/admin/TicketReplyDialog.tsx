import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  created_at: string;
  assigned_to?: string | null;
  internal_notes?: string | null;
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
  const [assignedTo, setAssignedTo] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    if (ticket) {
      setCurrentStatus(ticket.status);
      setAssignedTo(ticket.assigned_to || "");
      setInternalNotes(ticket.internal_notes || "");
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

    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus })
        .eq("id", ticket.id);

      if (error) throw error;

      setCurrentStatus(newStatus);
      onUpdate({ ...ticket, status: newStatus });
      toast({ title: "Status updated" });
    } catch (error) {
      logError("TicketReplyDialog.handleStatusChange", error);
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleInternalUpdate = async () => {
    if (!ticket) return;
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ assigned_to: assignedTo || null, internal_notes: internalNotes || null })
        .eq("id", ticket.id);
      if (error) throw error;
      onUpdate({ ...ticket, assigned_to: assignedTo || null, internal_notes: internalNotes || null });
      toast({ title: "Internal notes updated" });
    } catch (error) {
      logError("TicketReplyDialog.handleInternalUpdate", error);
      toast({ title: "Failed to update notes", variant: "destructive" });
    }
  };

  const handleSendReply = async () => {
    if (!ticket || !newMessage.trim()) return;
    setIsSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { error: insertError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: newMessage.trim(),
          is_staff_reply: true,
        });

      if (insertError) throw insertError;

      // Send email notification if we have user email
      if (profile?.email) {
        const { error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            type: "ticket_reply",
            to: profile.email,
            data: {
              full_name: profile.full_name || "Customer",
              ticket_subject: ticket.subject,
              message: newMessage.trim(),
            },
          },
        });
        if (emailError) throw emailError;
      }

      toast({ title: "Reply sent successfully" });
      setNewMessage("");
      fetchMessages();
    } catch (error) {
      logError("TicketReplyDialog.handleSendReply", error);
      toast({ title: "Failed to send reply", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden border-4 border-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <MessageSquare className="w-6 h-6" />
            TICKET: {ticket.subject}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ticket Info */}
          <div className="flex flex-wrap items-center gap-3 p-4 border-4 border-foreground bg-secondary">
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

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Assigned to</div>
              <Input
                placeholder="Staff user ID"
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Internal notes</div>
              <Textarea
                placeholder="Add internal context"
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" onClick={handleInternalUpdate}>
            Save internal notes
          </Button>

          {/* Original Description */}
          <div className="p-4 border-4 border-foreground bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Clock className="w-3 h-3" />
              {format(new Date(ticket.created_at), "dd MMM yyyy HH:mm")}
            </div>
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Messages */}
          <ScrollArea className="h-[250px] border-4 border-foreground p-4 bg-secondary/50">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((msg) => (
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
                        {msg.is_staff_reply ? "Staff" : "Customer"}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(msg.created_at), "dd MMM HH:mm")}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No replies yet.</p>
              </div>
            )}
          </ScrollArea>

          {/* Reply Input */}
          <div className="space-y-2">
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
          </div>
          <p className="text-xs text-muted-foreground">
            Customer will receive an email notification with your reply.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
