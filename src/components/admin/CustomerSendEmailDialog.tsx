import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Loader2, Eye, ArrowLeft, Paperclip, FileText, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DD_GUARANTEE_TEXT } from "@/lib/legal/directDebitGuarantee";
import { generateDDMandatePdf } from "@/lib/generateDDMandatePdf";
import { format } from "date-fns";

interface Props {
  customer: { id: string; full_name: string | null; email: string | null; account_number: string | null };
  onSent?: () => void;
  trigger?: React.ReactNode;
}

export function CustomerSendEmailDialog({ customer, onSent, trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeMandate, setIncludeMandate] = useState(false);
  const [sending, setSending] = useState(false);

  // Load DD mandate + billing context so preview / append can show the real
  // next collection date, mandate reference and guarantee.
  const { data: ddCtx } = useQuery({
    queryKey: ["customer-email-dd-ctx", customer.id],
    enabled: open,
    queryFn: async () => {
      const [{ data: mandate }, { data: billing }, { data: cs }, { data: profile }] = await Promise.all([
        supabase
          .from("dd_mandates_list")
          .select("*")
          .eq("user_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("billing_settings")
          .select("next_invoice_date, payment_terms_days")
          .eq("user_id", customer.id)
          .maybeSingle(),
        supabase
          .from("contract_summaries")
          .select("cs_number, plan_name, monthly_price_incl_vat, contract_length")
          .eq("customer_id", customer.id)
          .eq("status", "accepted")
          .order("accepted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, email, address_line1, city, postcode")
          .eq("id", customer.id)
          .maybeSingle(),
      ]);
      return { mandate, billing, cs, profile };
    },
  });

  const nextCollectionDate = (() => {
    const nextInv = ddCtx?.billing?.next_invoice_date as string | undefined;
    const terms = (ddCtx?.billing?.payment_terms_days as number | undefined) ?? 14;
    if (!nextInv) return null;
    const d = new Date(nextInv);
    d.setDate(d.getDate() + terms);
    return d.toISOString().slice(0, 10);
  })();

  const nextCollectionAmount = (() => {
    const monthly = Number(ddCtx?.cs?.monthly_price_incl_vat ?? 0);
    if (!monthly) return null;
    // Quarterly cadence (matches CustomerDDSection default).
    return Number((monthly * 3).toFixed(2));
  })();

  const mandate = ddCtx?.mandate as any;
  const hasMandate = !!mandate;

  const mandateBlockHtml = (() => {
    if (!includeMandate) return "";
    const rows: string[] = [];
    if (mandate?.mandate_reference)
      rows.push(`<tr><td style="padding:4px 12px 4px 0"><strong>Mandate reference</strong></td><td>${mandate.mandate_reference}</td></tr>`);
    if (mandate?.account_holder)
      rows.push(`<tr><td style="padding:4px 12px 4px 0"><strong>Account holder</strong></td><td>${mandate.account_holder}</td></tr>`);
    if (mandate?.sort_code_masked || mandate?.account_number_masked)
      rows.push(`<tr><td style="padding:4px 12px 4px 0"><strong>Bank account</strong></td><td>${mandate?.sort_code_masked ?? "—"} / ${mandate?.account_number_masked ?? "—"}</td></tr>`);
    const mandateTable = rows.length
      ? `<h3 style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;margin-top:24px">Direct Debit — set up</h3>
         <p>We have captured your Direct Debit details from your account:</p>
         <table style="border-collapse:collapse;margin:12px 0;font-size:14px">${rows.join("")}</table>
         <p style="font-size:13px;color:#555">You can view and download your full Direct Debit mandate from your OCCTA dashboard under <em>Direct Debit</em>.</p>`
      : "";

    const nextBlock = nextCollectionDate && nextCollectionAmount
      ? `<h3 style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;margin-top:24px">Your next collection</h3>
         <p><strong>£${nextCollectionAmount.toFixed(2)}</strong> will be collected by Direct Debit on <strong>${format(new Date(nextCollectionDate), "dd MMMM yyyy")}</strong>.</p>
         <p style="font-size:13px;color:#555">Advance notice will be issued at least 10 working days beforehand.</p>`
      : "";

    const guarantee = `<h3 style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;margin-top:24px">The Direct Debit Guarantee</h3>
       <p style="white-space:pre-line;font-size:13px;line-height:1.6;border-left:3px solid #facc15;padding:8px 14px;background:#fafafa">${DD_GUARANTEE_TEXT}</p>`;

    return `${mandateTable}${nextBlock}${guarantee}`;
  })();

  const composedHtml = (() => {
    const bodyHtml = body.trim().replace(/\n/g, "<br>");
    return `${bodyHtml}${mandateBlockHtml}`;
  })();

  const previewShellHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f0;color:#0d0d0d}
    .wrap{max-width:640px;margin:0 auto;background:#fff;border:3px solid #0d0d0d}
    .hd{background:#0d0d0d;color:#facc15;padding:18px 24px;font-weight:900;letter-spacing:.25em}
    .content{padding:24px}
    h3{font-size:14px;text-transform:uppercase}
    p{line-height:1.55;font-size:14px;margin:8px 0}
  </style></head><body><div class="wrap">
    <div class="hd">OCCTA · TELECOM</div>
    <div class="content">${composedHtml}</div>
  </div></body></html>`;

  const openMandatePdf = () => {
    if (!mandate) return;
    const p = ddCtx?.profile as any;
    const address = p ? [p.address_line1, p.city, p.postcode].filter(Boolean).join(", ") : "";
    generateDDMandatePdf({
      mandate_reference: mandate.mandate_reference || "—",
      status: mandate.status,
      account_holder: mandate.account_holder,
      sort_code_masked: mandate.sort_code_masked,
      account_number_masked: mandate.account_number_masked,
      bank_last4: mandate.bank_last4,
      consent_timestamp: mandate.consent_timestamp,
      created_at: mandate.created_at,
      customer_name: p?.full_name ?? null,
      customer_email: p?.email ?? null,
      customer_address: address || null,
      next_collection_date: nextCollectionDate,
      next_collection_amount: nextCollectionAmount,
      contract_reference: ddCtx?.cs?.cs_number ?? null,
    });
  };

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
            message_html: composedHtml,
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
      setIncludeMandate(false);
      setPreviewOpen(false);
      setOpen(false);
      onSent?.();
    } catch (e) {
      toast({ title: "Couldn't send email", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openPreview = () => {
    if (!customer.email) {
      toast({ title: "Customer has no email on file", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    setPreviewOpen(true);
  };

  return (
    <>
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
          <div className="border-2 border-foreground/30 p-3 flex items-start gap-3 bg-muted/20">
            <Checkbox
              id="include-mandate"
              checked={includeMandate}
              onCheckedChange={(v) => setIncludeMandate(!!v)}
              disabled={!hasMandate}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="include-mandate" className="font-display text-xs uppercase cursor-pointer">
                Append DD mandate summary, next collection & guarantee
              </Label>
              {hasMandate ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Adds mandate ref <span className="font-mono">{mandate?.mandate_reference}</span>
                  {nextCollectionDate && nextCollectionAmount ? (
                    <> · next collection <strong>£{nextCollectionAmount.toFixed(2)}</strong> on <strong>{format(new Date(nextCollectionDate), "dd MMM yyyy")}</strong></>
                  ) : null}
                  {" "}and the full Direct Debit Guarantee text.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1">No Direct Debit mandate captured for this customer yet.</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
          <Button onClick={openPreview} disabled={sending} className="border-2 border-foreground">
            <Eye className="h-4 w-4 mr-2" />
            Preview & send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Preview modal */}
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="border-2 border-foreground max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b-2 border-foreground/10">
          <DialogTitle className="font-display uppercase">Review email before sending</DialogTitle>
          <DialogDescription className="text-xs">
            To <span className="font-mono">{customer.email}</span> · logs to Communications on send.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span className="font-display text-xs uppercase text-muted-foreground">Subject</span>
            <span className="font-medium">{subject || <em className="text-muted-foreground">—</em>}</span>

            <span className="font-display text-xs uppercase text-muted-foreground">Recipient</span>
            <span className="font-mono">{customer.email}</span>

            {includeMandate && nextCollectionDate && nextCollectionAmount && (
              <>
                <span className="font-display text-xs uppercase text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Next collection
                </span>
                <span className="font-medium">
                  £{nextCollectionAmount.toFixed(2)} on {format(new Date(nextCollectionDate), "dd MMMM yyyy")}
                  <span className="text-xs text-muted-foreground"> (10 working days' notice)</span>
                </span>
              </>
            )}

            {includeMandate && hasMandate && (
              <>
                <span className="font-display text-xs uppercase text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Mandate reference
                </span>
                <span className="font-mono">{mandate?.mandate_reference}</span>
              </>
            )}
          </div>

          {includeMandate && hasMandate && (
            <div className="border-2 border-foreground p-3 flex items-center justify-between gap-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Direct Debit mandate document</p>
                  <p className="text-[11px] text-muted-foreground">
                    Emailed as a link to the customer's dashboard. Click to preview the printable mandate now.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={openMandatePdf} className="border-2 border-foreground">
                Open mandate
              </Button>
            </div>
          )}

          <div>
            <p className="font-display text-xs uppercase text-muted-foreground mb-1">Rendered email</p>
            <div className="border-2 border-foreground">
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={previewShellHtml}
                className="w-full h-[420px] bg-background"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Preview shows a simplified OCCTA shell. Live email uses the full branded template + footer.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-3 border-t-2 border-foreground/10">
          <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={sending}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to edit
          </Button>
          <Button onClick={handleSend} disabled={sending} className="border-2 border-foreground">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Send now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}