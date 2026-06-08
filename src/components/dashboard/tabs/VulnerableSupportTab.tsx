import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, HeartHandshake } from "lucide-react";
import { logClientEvent } from "@/lib/activityLog";

export function VulnerableSupportTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logClientEvent({ event_type: "vulnerable_support_view", title: "vulnerable_tab", source_module: "dashboard" });
  }, []);

  const submit = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId,
      subject: "Extra support request",
      description: note.trim().slice(0, 1000),
      category: "vulnerable_support",
      priority: "high",
      status: "open",
    } as any);
    setSubmitting(false);
    if (error) toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
    else { setNote(""); toast({ title: "Thanks — we've got it", description: "Our team will be in touch." }); }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border-4 border-warning bg-warning/10 text-sm flex gap-2">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-display uppercase">Digital Voice & power cuts</p>
          <p className="text-muted-foreground">Digital Voice does not work during a power cut unless backup power is available. If you rely on your phone for emergency calls, medical equipment, telecare or vulnerability reasons, please tell us so we can prepare.</p>
        </div>
      </div>

      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <h3 className="font-display uppercase flex items-center gap-2"><HeartHandshake className="w-5 h-5" /> Tell us if you need extra support</h3>
        <p className="text-sm text-muted-foreground">A short note is enough. Please do not share medical details unless necessary.</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="border-2 border-foreground" rows={4} maxLength={1000} placeholder="How can we help? e.g. larger text on bills, alternative contact, accessible installation…" />
        <div className="flex gap-2 flex-wrap">
          <Button variant="hero" onClick={submit} disabled={submitting || !note.trim()}>{submitting ? "Sending…" : "Send to support"}</Button>
          <Link to="/legal/vulnerable-customers"><Button variant="outline" className="border-2 border-foreground">Read Vulnerable Customers policy</Button></Link>
        </div>
      </div>
    </div>
  );
}