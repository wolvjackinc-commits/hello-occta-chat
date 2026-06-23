import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LifeBuoy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIES = [
  { value: "billing", label: "Billing & Payments" },
  { value: "technical", label: "Technical / Service Issue" },
  { value: "account", label: "Account & Profile" },
  { value: "cancellation", label: "Cancellation Request" },
  { value: "complaint", label: "Complaint" },
  { value: "switching", label: "Switching / Provider" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface Props {
  customer: { id: string; full_name: string | null; email: string | null; account_number: string | null };
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

export function CustomerCreateTicketDialog({ customer, onCreated, trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("billing");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) {
      toast({ title: "Subject and description are required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: customer.id,
          subject: subject.trim(),
          description: description.trim(),
          category: category as any,
          priority: priority as any,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;

      // Notify customer by email
      if (customer.email) {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "custom_admin",
              to: customer.email,
              userId: customer.id,
              logToCommunications: true,
              data: {
                subject: `Support ticket opened — ${subject.trim()}`,
                message_html: `We've opened a support ticket on your behalf.<br><br><strong>Subject:</strong> ${subject.trim()}<br><strong>Category:</strong> ${category}<br><strong>Reference:</strong> ${ticket.id.slice(0,8).toUpperCase()}<br><br>${description.trim().replace(/\n/g, "<br>")}<br><br>We'll be in touch as soon as we have an update. You can also reply directly to this email.`,
                customer_name: customer.full_name || "there",
                account_number: customer.account_number || "",
              },
            },
          });
        } catch (mailErr) {
          console.error("Ticket created but notification failed:", mailErr);
        }
      }

      toast({ title: "Ticket created", description: `Notified ${customer.email ?? "customer"}.` });
      setSubject("");
      setDescription("");
      setCategory("billing");
      setPriority("normal");
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast({ title: "Couldn't create ticket", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="border-2 border-foreground">
            <LifeBuoy className="h-4 w-4 mr-2" />
            Create Ticket
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-2 border-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Create support ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-display text-xs uppercase">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-display text-xs uppercase">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="border-2 border-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="font-display text-xs uppercase">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="border-2 border-foreground" />
          </div>
          <div>
            <Label className="font-display text-xs uppercase">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} className="border-2 border-foreground" />
            <p className="text-[10px] text-muted-foreground mt-1">Visible to the customer in their dashboard and emailed to them.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleCreate} disabled={busy} className="border-2 border-foreground">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LifeBuoy className="h-4 w-4 mr-2" />}
            Create ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}