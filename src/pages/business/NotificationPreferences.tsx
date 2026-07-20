import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Bell, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Prefs = {
  in_app_status_changes: boolean;
  email_status_changes: boolean;
  in_app_attachments: boolean;
  email_attachments: boolean;
};

const DEFAULT_PREFS: Prefs = {
  in_app_status_changes: true,
  email_status_changes: true,
  in_app_attachments: true,
  email_attachments: false,
};

const BusinessNotificationPreferences = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      const { data: row } = await supabase
        .from("notification_preferences" as any)
        .select("*").eq("user_id", uid).maybeSingle();
      if (row) setPrefs({
        in_app_status_changes: (row as any).in_app_status_changes,
        email_status_changes: (row as any).email_status_changes,
        in_app_attachments: (row as any).in_app_attachments,
        email_attachments: (row as any).email_attachments,
      });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences" as any)
      .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    toast({ title: "Preferences saved" });
  };

  const toggle = (k: keyof Prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const Row = ({ label, help, k }: { label: string; help: string; k: keyof Prefs }) => (
    <div className="flex items-start justify-between gap-4 border-b-2 border-foreground/10 py-4 last:border-b-0">
      <div className="min-w-0">
        <Label className="text-sm font-display uppercase">{label}</Label>
        <p className="text-xs text-muted-foreground mt-1">{help}</p>
      </div>
      <Switch checked={prefs[k]} onCheckedChange={() => toggle(k)} aria-label={label} />
    </div>
  );

  return (
    <Layout>
      <SEO title="Notification preferences | OCCTA Business" description="Choose how you receive ticket and document alerts." />
      <section className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="font-display text-3xl uppercase flex items-center gap-2">
            <Bell className="w-7 h-7" /> Notification preferences
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure in-app and email alerts for ticket status changes and document uploads. Applies to this account only.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading
          </div>
        ) : (
          <div className="border-4 border-foreground p-6 bg-background">
            <h2 className="font-display uppercase text-sm mb-2">Ticket status changes</h2>
            <Row label="In-app" help="Show a bell notification when a ticket status changes." k="in_app_status_changes" />
            <Row label="Email" help="Email me on status changes (Open, In progress, Waiting, Resolved, Closed)." k="email_status_changes" />

            <h2 className="font-display uppercase text-sm mt-6 mb-2">Document uploads</h2>
            <Row label="In-app" help="Notify me when a document is attached to my ticket." k="in_app_attachments" />
            <Row label="Email" help="Email me when a document is attached to my ticket." k="email_attachments" />

            <div className="pt-4 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save preferences
              </Button>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
};

export default BusinessNotificationPreferences;