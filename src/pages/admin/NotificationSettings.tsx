import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const EVENTS: { key: string; label: string; description: string }[] = [
  { key: "dd_mandate_submitted", label: "Direct Debit mandate submitted", description: "A customer completes the DD setup form." },
  { key: "invoice_paid", label: "Invoice paid", description: "A Worldpay or DD invoice payment is confirmed." },
  { key: "contract_signed", label: "Contract signed", description: "A customer accepts a contract summary." },
  { key: "order_live", label: "Order live / activated", description: "A service transitions to live/active." },
  { key: "new_order", label: "New order (authenticated)", description: "A signed-in customer places an order." },
  { key: "new_guest_order", label: "New order (guest)", description: "A guest completes checkout." },
  { key: "new_ticket", label: "New support ticket", description: "A ticket is raised in dashboard or chat." },
  { key: "new_quote_request", label: "New quote request", description: "A residential quote request is submitted." },
  { key: "new_business_enquiry", label: "New business enquiry", description: "A B2B lead form is submitted." },
  { key: "customer_proceeded_quote", label: "Quote → proceeded", description: "Customer chooses to proceed with a quote." },
  { key: "human_chat_request", label: "Human chat requested", description: "A customer asks to talk to a person in chat." },
  { key: "failed_payment", label: "Failed payment", description: "A Worldpay or DD payment attempt failed." },
];

export default function AdminNotificationSettings() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("admin_notification_prefs")
        .select("event_type, email_enabled")
        .eq("user_id", uid);
      const map: Record<string, boolean> = {};
      EVENTS.forEach((e) => { map[e.key] = true; });
      (data ?? []).forEach((r: any) => { map[r.event_type] = !!r.email_enabled; });
      setPrefs(map);
      setLoading(false);
    })();
  }, []);

  const toggle = (key: string, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const rows = EVENTS.map((e) => ({
        user_id: userId,
        event_type: e.key,
        email_enabled: !!prefs[e.key],
      }));
      const { error } = await supabase
        .from("admin_notification_prefs")
        .upsert(rows, { onConflict: "user_id,event_type" });
      if (error) throw error;
      toast({ title: "Preferences saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Notification Settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose which admin events email you. Applies to your account only.
        </p>
      </div>

      <Card className="border-2 border-foreground divide-y-2 divide-foreground/10">
        {EVENTS.map((e) => (
          <div key={e.key} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-bold">{e.label}</div>
              <div className="text-xs text-muted-foreground">{e.description}</div>
            </div>
            <Switch checked={!!prefs[e.key]} onCheckedChange={(v) => toggle(e.key, v)} />
          </div>
        ))}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          Save preferences
        </Button>
      </div>
    </div>
  );
}