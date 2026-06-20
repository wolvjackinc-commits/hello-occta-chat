import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Banknote, FileText, Mail, ShieldCheck, Loader2, Copy } from "lucide-react";

interface Customer {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
}

interface Props {
  customer: Customer;
  invoices: Invoice[];
  onChanged?: () => void;
}

export function CustomerActionsCard({ customer, invoices, onChanged }: Props) {
  const [open, setOpen] = useState<null | "dd" | "email" | "invoice">(null);

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Customer 360 actions</div>
          <div className="text-sm">Send links, invoices and direct comms — all logged.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => setOpen("dd")}>
            <ShieldCheck className="h-4 w-4 mr-2" /> Send DD setup link
          </Button>
          <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => setOpen("invoice")}>
            <FileText className="h-4 w-4 mr-2" /> Send / resend invoice
          </Button>
          <Button size="sm" variant="outline" className="border-2 border-foreground" onClick={() => setOpen("email")}>
            <Mail className="h-4 w-4 mr-2" /> Direct email
          </Button>
        </div>
      </div>

      <SendDDLinkDialog open={open === "dd"} onClose={() => { setOpen(null); onChanged?.(); }} customer={customer} />
      <SendDirectEmailDialog open={open === "email"} onClose={() => { setOpen(null); onChanged?.(); }} customer={customer} />
      <SendInvoiceDialog open={open === "invoice"} onClose={() => { setOpen(null); onChanged?.(); }} customer={customer} invoices={invoices} />
    </Card>
  );
}

/* -------------------- DD setup -------------------- */

function SendDDLinkDialog({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: Customer }) {
  const { toast } = useToast();
  const [email, setEmail] = useState(customer.email ?? "");
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);

  const submit = async () => {
    if (!email) { toast({ title: "Email required", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "admin-create-dd-link",
          user_id: customer.id,
          customer_email: email,
          customer_name: customer.full_name,
          account_number: customer.account_number,
          expires_in_days: days,
        },
      });
      if (error || !(data as any)?.success) throw new Error((data as any)?.error || error?.message || "Failed");
      const url = `${window.location.origin}${(data as any).setup_url_path}`;
      setResult({ url });
      toast({ title: "DD setup link sent", description: email });
    } catch (e: any) {
      toast({ title: "Couldn't send DD link", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setResult(null); onClose(); } }}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader><DialogTitle>Send Direct Debit setup link</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Email sent. Customer link:</p>
            <div className="flex gap-2">
              <Input readOnly value={result.url} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(result.url); toast({ title: "Copied" }); }}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Recipient email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Link valid for (days)</Label>
              <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value) || 14)} />
            </div>
            <p className="text-xs text-muted-foreground">Sends a branded email with the DD Guarantee, mandate form link and expiry. The mandate stays "pending" until you verify it in the Billing / DD tab.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {!result && (
            <Button onClick={submit} disabled={busy} className="border-2 border-foreground">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}Send DD link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Direct email -------------------- */

function SendDirectEmailDialog({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: Customer }) {
  const { toast } = useToast();
  const [to, setTo] = useState(customer.email ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!to || !subject || !message) { toast({ title: "All fields required", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: {
          action: "admin-send-direct-email",
          user_id: customer.id,
          to,
          subject,
          message,
          customer_name: customer.full_name,
        },
      });
      if (error || !(data as any)?.success) throw new Error((data as any)?.error || error?.message || "Failed");
      toast({ title: "Email sent", description: to });
      setSubject(""); setMessage("");
      onClose();
    } catch (e: any) {
      toast({ title: "Couldn't send email", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader><DialogTitle>Send direct email</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>To</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={4000} />
          </div>
          <p className="text-xs text-muted-foreground">Sent via the standard OCCTA template and logged to communications.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="border-2 border-foreground">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Send invoice -------------------- */

function SendInvoiceDialog({ open, onClose, customer, invoices }: { open: boolean; onClose: () => void; customer: Customer; invoices: Invoice[] }) {
  const { toast } = useToast();
  const unpaid = invoices.filter((i) => i.status !== "paid" && i.status !== "void" && i.status !== "cancelled");
  const [invoiceId, setInvoiceId] = useState<string | null>(unpaid[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!invoiceId) { toast({ title: "Pick an invoice", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-request", {
        body: { action: "admin-send-invoice", invoice_id: invoiceId },
      });
      if (error || !(data as any)?.success) throw new Error((data as any)?.error || error?.message || "Failed");
      toast({ title: "Invoice email sent", description: customer.email ?? undefined });
      onClose();
    } catch (e: any) {
      toast({ title: "Couldn't send invoice", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader><DialogTitle>Send / resend invoice</DialogTitle></DialogHeader>
        {unpaid.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outstanding invoices to send. Create one from the Billing tab first.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Invoice</Label>
              <Select value={invoiceId ?? undefined} onValueChange={setInvoiceId}>
                <SelectTrigger className="border-2 border-foreground"><SelectValue placeholder="Pick invoice" /></SelectTrigger>
                <SelectContent>
                  {unpaid.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_number} · £{Number(i.total).toFixed(2)} · {i.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Uses the standard invoice template. A new send event is recorded each time.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {unpaid.length > 0 && (
            <Button onClick={submit} disabled={busy || !invoiceId} className="border-2 border-foreground">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Banknote className="h-4 w-4 mr-2" />}Send invoice email
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}