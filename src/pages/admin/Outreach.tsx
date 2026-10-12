import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { outreachTable, type OutreachSettings } from "@/lib/outreach/api";
import { OutreachDashboard } from "@/components/admin/outreach/OutreachDashboard";
import { OutreachCampaigns } from "@/components/admin/outreach/OutreachCampaigns";
import { OutreachContacts } from "@/components/admin/outreach/OutreachContacts";
import { OutreachTemplates } from "@/components/admin/outreach/OutreachTemplates";
import { OutreachSuppressions } from "@/components/admin/outreach/OutreachSuppressions";
import { OutreachSettingsPanel } from "@/components/admin/outreach/OutreachSettingsPanel";

const TABS = ["dashboard", "campaigns", "contacts", "templates", "suppressions", "settings"] as const;
type Tab = (typeof TABS)[number];

const AdminOutreach = () => {
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "dashboard";
  const [settings, setSettings] = useState<OutreachSettings | null>(null);

  const loadSettings = useCallback(async () => {
    const { data } = await outreachTable("outreach_settings").select("*").eq("id", 1).maybeSingle();
    setSettings((data ?? null) as OutreachSettings | null);
  }, []);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    next.delete("campaign");
    setParams(next, { replace: true });
  };

  const ready = Boolean(settings?.sending_enabled && settings?.from_email);
  const workerResult = settings?.last_worker_result as { skipped?: string; sent?: number } | null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Outreach</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Email campaigns to business prospects, with consent rules, unsubscribe handling and full tracking built in.
          </p>
        </div>
        {settings && (
          <div className={`flex items-start gap-2 border-4 px-3 py-2 text-sm ${ready ? "border-green-700 bg-green-50" : "border-amber-600 bg-amber-50"}`}>
            {ready ? <CheckCircle2 className="h-5 w-5 text-green-700 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />}
            <div>
              <div className="font-semibold">
                {ready ? `Sending on · ${settings.from_email}` : !settings.from_email ? "Sending address not set" : "Sending is switched off"}
              </div>
              <div className="text-xs text-muted-foreground">
                {settings.last_worker_run_at
                  ? `Sender last ran ${formatDistanceToNow(new Date(settings.last_worker_run_at), { addSuffix: true })}${workerResult?.skipped ? ` (${workerResult.skipped.replace(/_/g, " ")})` : workerResult?.sent != null ? ` · sent ${workerResult.sent}` : ""}`
                  : "Sender has not run yet"}
              </div>
            </div>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="suppressions">Do not contact</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><OutreachDashboard onOpenCampaign={(id) => { const n = new URLSearchParams(); n.set("tab", "campaigns"); n.set("campaign", id); setParams(n); }} /></TabsContent>
        <TabsContent value="campaigns"><OutreachCampaigns settings={settings} /></TabsContent>
        <TabsContent value="contacts"><OutreachContacts /></TabsContent>
        <TabsContent value="templates"><OutreachTemplates settings={settings} /></TabsContent>
        <TabsContent value="suppressions"><OutreachSuppressions /></TabsContent>
        <TabsContent value="settings"><OutreachSettingsPanel settings={settings} onSaved={loadSettings} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOutreach;
