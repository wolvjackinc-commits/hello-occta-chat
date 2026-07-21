import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quoteId?: string;
  quoteNumber?: string;
  /** Called after successful send. Receives the newly minted public token, if any. */
  onSent?: (info: { public_token?: string | null }) => void;
  /** Optional: extra body params passed to send-quote-email on both preview and send. */
  extraBody?: Record<string, any>;
  /** Label for primary send button (default "Send & lock quote"). */
  sendLabel?: string;
};

export function ComposeQuoteEmailDialog({
  open, onOpenChange, quoteId, quoteNumber, onSent, extraBody, sendLabel,
}: Props) {
  const { toast } = useToast();
  const [customMessage, setCustomMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | undefined>(undefined);
  const [previewSubject, setPreviewSubject] = useState<string | undefined>(undefined);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const reset = () => {
    setCustomMessage("");
    setPreviewHtml(undefined);
    setPreviewSubject(undefined);
    setRecipient(null);
    setSending(false);
    setPreviewLoading(false);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const runPreview = async () => {
    if (!quoteId) return;
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          quote_id: quoteId,
          preview_only: true,
          custom_message: customMessage,
          ...(extraBody ?? {}),
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Preview failed");
      }
      setPreviewHtml((data as any)?.html ?? "");
      setPreviewSubject((data as any)?.subject ?? "");
      setRecipient((data as any)?.recipient ?? null);
    } catch (e: any) {
      toast({ title: "Preview failed", description: e?.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const send = async () => {
    if (!quoteId || !quoteNumber) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          quote_id: quoteId,
          rotate_token: true,
          custom_message: customMessage,
          ...(extraBody ?? {}),
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.message || (data as any)?.error || error?.message;
        if ((data as any)?.error === "blocked_low_margin") {
          toast({ title: "Blocked by margin guard", description: "Run a margin check and use override to send.", variant: "destructive" });
          setSending(false);
          return;
        }
        throw new Error(msg);
      }
      toast({ title: `Quote ${quoteNumber} sent — locked` });
      const token = (data as any)?.public_token ?? null;
      onSent?.({ public_token: token });
      close();
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Compose quote email{quoteNumber ? ` — ${quoteNumber}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-2">
              Custom note to customer{" "}
              <span className="text-muted-foreground font-normal normal-case tracking-normal">
                (optional — appears above quote details)
              </span>
            </label>
            <textarea
              className="w-full border-2 border-foreground p-3 text-sm min-h-[140px] font-sans"
              value={customMessage}
              onChange={(e) => { setCustomMessage(e.target.value); setPreviewHtml(undefined); }}
              placeholder="e.g. Hi Sam — following our call today, here's the updated quote. I've included the router upgrade we discussed. Any questions just reply to this email."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Plain text only. Blank lines create paragraphs. HTML is escaped for safety.
            </p>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runPreview}
              disabled={previewLoading || sending}
            >
              {previewLoading
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Rendering…</>
                : <><Eye className="w-3 h-3 mr-1" /> Preview email</>}
            </Button>
            {recipient && (
              <span className="text-xs text-muted-foreground">
                Recipient: <strong className="text-foreground">{recipient}</strong>
              </span>
            )}
          </div>

          {previewHtml !== undefined && (
            <div className="border-2 border-foreground">
              <div className="bg-muted px-3 py-2 border-b-2 border-foreground text-xs font-black uppercase tracking-wider">
                Subject: <span className="normal-case tracking-normal font-mono">{previewSubject}</span>
              </div>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={previewHtml}
                className="w-full h-[500px] bg-white"
              />
              <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border">
                The secure quote link shown here is a placeholder. A fresh one-time-use link is generated when you press Send.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="pt-3 border-t-2 border-foreground">
          <Button variant="outline" onClick={close} disabled={sending}>Cancel</Button>
          <Button variant="hero" onClick={send} disabled={sending || previewLoading}>
            {sending
              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending…</>
              : <><Mail className="w-3 h-3 mr-1" /> {sendLabel ?? "Send & lock quote"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ComposeQuoteEmailDialog;