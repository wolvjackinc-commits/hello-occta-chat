import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const DISMISS_KEY = "occta_marketing_optin_dismissed_v1";
const DISMISS_DAYS = 90;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Asks customers who haven't opted in whether they'd like offers by email.
 * Opting in is a clear, separate choice (PECR consent); saying no hides the
 * card for 90 days. The setting stays editable in Account settings.
 */
export function MarketingOptInCard({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dismissedRecently()) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("marketing_email_consent, email")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const row = data as { marketing_email_consent?: boolean | null; email?: string | null };
        setShow(!row.marketing_email_consent && Boolean(row.email));
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (!show) return null;

  const optIn = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ marketing_email_consent: true, consent_updated_at: new Date().toISOString() } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save your choice", description: error.message, variant: "destructive" });
      return;
    }
    setShow(false);
    toast({ title: "You're in", description: "We'll email you OCCTA offers and news. Unsubscribe any time." });
  };

  const noThanks = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* best-effort */ }
    setShow(false);
  };

  return (
    <div className="mb-6 border-4 border-foreground bg-primary/10 p-4 sm:p-5 shadow-brutal" role="region" aria-label="Email offers">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Mail className="w-6 h-6 shrink-0 text-foreground mt-0.5" aria-hidden />
          <div>
            <p className="font-display uppercase text-lg leading-tight">Want OCCTA offers by email?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Customer-only offers, new plans and tips for the landline switch-off. Unsubscribe any time
              from any email or in <Link to="/dashboard?tab=account" className="underline">Account settings</Link>.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={noThanks} disabled={saving}>No thanks</Button>
          <Button type="button" variant="hero" onClick={optIn} disabled={saving}>{saving ? "Saving…" : "Yes, email me offers"}</Button>
        </div>
      </div>
    </div>
  );
}

export default MarketingOptInCard;
