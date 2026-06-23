import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  customer: { id: string; full_name: string | null; email: string | null; account_number: string | null };
  onSent?: () => void;
  trigger?: React.ReactNode;
}

export function CustomerSendEmailDialog({ customer, onSent, trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!customer.email) {
      toast({ title: "Customer has no email on file", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "custom_admin",
          to: customer.email,
          userId: customer.id,
          logToCommunications: true,
          data: {
            subject: subject.trim(),
            message_html: body.trim().replace(/\n/g, "<br>"),
            customer_name: customer.full_name || "there",
            account_number: customer.account_number || "",
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Email sent", description: `Delivered to ${customer.email}` });
      setSubject("");
      setBody("");
      setOpen(false);
      onSent?.();
    } catch (e) {
      toast({ title: "Couldn't send email", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="border-2 border-foreground">
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-2 border-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Send email to {customer.full_name || customer.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="font-display text-xs uppercase">Recipient</Label>
            <div className="text-sm border-2 border-foreground/30 px-3 py-2 bg-muted/30">{customer.email || "—"}</div>
          </div>
          <div>
            <Label className="font-display text-xs uppercase">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="border-2 border-foreground" placeholder="e.g. Update on your account" />
          </div>
          <div>
            <Label className="font-display text-xs uppercase">Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="border-2 border-foreground" placeholder="Plain text — line breaks are preserved. The OCCTA email template wraps your message automatically." />
            <p className="text-[10px] text-muted-foreground mt-1">Wrapped in the standard OCCTA branded email template. Logs to Communications.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="border-2 border-foreground">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}