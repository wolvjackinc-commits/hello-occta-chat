import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import {
  ShieldCheck,
  History,
  Info,
  Check,
  X,
  Mail,
  MessageSquare,
  BellRing,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConsentHistoryEntry = {
  id: string;
  consent_type: "marketing_email" | "marketing_sms" | "service_updates";
  previous_value: boolean | null;
  new_value: boolean;
  source: string;
  created_at: string;
};

const CONSENT_LABELS: Record<string, { title: string; icon: any; short: string }> = {
  marketing_email: { title: "Marketing emails", icon: Mail, short: "Emails" },
  marketing_sms: { title: "Marketing text messages", icon: MessageSquare, short: "SMS" },
  service_updates: { title: "Service updates & notices", icon: BellRing, short: "Service" },
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  date_of_birth?: string | null;
  marketing_email_consent?: boolean | null;
  marketing_sms_consent?: boolean | null;
  service_updates_consent?: boolean | null;
  consent_updated_at?: string | null;
  updated_at?: string | null;
};

export function AccountSettingsTab({ profile }: { profile: Profile | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Profile>(
    profile ||
      ({
        id: "",
        full_name: "",
        email: "",
        phone: "",
        address_line1: "",
        address_line2: "",
        city: "",
        postcode: "",
        date_of_birth: "",
        marketing_email_consent: false,
        marketing_sms_consent: false,
        service_updates_consent: true,
      } as Profile)
  );
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ConsentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem("occta:consent:type-filter") || "all";
  });
  const [historyDirectionFilter, setHistoryDirectionFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem("occta:consent:direction-filter") || "all";
  });
  useEffect(() => {
    try { window.localStorage.setItem("occta:consent:type-filter", historyTypeFilter); } catch {}
  }, [historyTypeFilter]);
  useEffect(() => {
    try { window.localStorage.setItem("occta:consent:direction-filter", historyDirectionFilter); } catch {}
  }, [historyDirectionFilter]);
  const [confirmOpen, setConfirmOpen] = useState<null | { text: string; onConfirm: () => void }>(null);
  const initialConsent = {
    marketing_email_consent: profile?.marketing_email_consent ?? false,
    marketing_sms_consent: profile?.marketing_sms_consent ?? false,
    service_updates_consent: profile?.service_updates_consent ?? true,
  };
  const [baseline, setBaseline] = useState(initialConsent);

  // Consent columns are not exposed on the customer_profile view, so fetch them
  // directly from profiles (RLS restricts to the caller's own row).
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("marketing_email_consent, marketing_sms_consent, service_updates_consent, consent_updated_at")
        .eq("id", profile.id)
        .maybeSingle();
      if (data) {
        const c = {
          marketing_email_consent: (data as any).marketing_email_consent ?? false,
          marketing_sms_consent: (data as any).marketing_sms_consent ?? false,
          service_updates_consent: (data as any).service_updates_consent ?? true,
        };
        setForm((f) => ({
          ...f,
          ...c,
          consent_updated_at: (data as any).consent_updated_at ?? null,
        }));
        setBaseline(c);
      }
    })();
  }, [profile?.id]);

  const loadHistory = async () => {
    if (!profile?.id) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("consent_history" as any)
      .select("id, consent_type, previous_value, new_value, source, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory(((data as unknown) as ConsentHistoryEntry[]) || []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, profile?.id]);

  const performSave = async () => {
    if (!form.id) return;
    // Light client-side validation — server still enforces RLS scoped to auth.uid().
    if (form.phone && !/^[+\d\s()-]{7,20}$/.test(form.phone)) {
      toast({ title: "Check your phone number", description: "Use digits, spaces, +, -, () only.", variant: "destructive" });
      return;
    }
    if (form.postcode && form.postcode.length > 10) {
      toast({ title: "Postcode looks wrong", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      full_name: form.full_name?.trim() || null,
      phone: form.phone?.trim() || null,
      address_line1: form.address_line1?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim() || null,
      postcode: form.postcode?.trim().toUpperCase() || null,
      date_of_birth: form.date_of_birth || null,
      marketing_email_consent: !!form.marketing_email_consent,
      marketing_sms_consent: !!form.marketing_sms_consent,
      service_updates_consent: !!form.service_updates_consent,
      consent_updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", form.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setBaseline({
      marketing_email_consent: payload.marketing_email_consent,
      marketing_sms_consent: payload.marketing_sms_consent,
      service_updates_consent: payload.service_updates_consent,
    });
    setForm((f) => ({ ...f, consent_updated_at: payload.consent_updated_at }));
    await logAudit({ action: "update", entity: "profile", entityId: form.id, metadata: { source: "customer_self_serve", updatedFields: Object.keys(payload) } }).catch(() => {});
    toast({ title: "Saved", description: "Your details are updated — our team sees the same info." });
    if (historyOpen) loadHistory();
  };

  const save = async () => {
    // Detect consent changes that require an explicit confirmation.
    const changes: string[] = [];
    if (form.marketing_email_consent !== baseline.marketing_email_consent) {
      changes.push(form.marketing_email_consent ? "opt IN to marketing emails" : "opt OUT of marketing emails");
    }
    if (form.marketing_sms_consent !== baseline.marketing_sms_consent) {
      changes.push(form.marketing_sms_consent ? "opt IN to marketing SMS" : "opt OUT of marketing SMS");
    }
    if (form.service_updates_consent !== baseline.service_updates_consent) {
      changes.push(
        form.service_updates_consent
          ? "opt IN to service updates"
          : "opt OUT of service updates (you may miss important notices)"
      );
    }
    if (changes.length === 0) {
      performSave();
      return;
    }
    setConfirmOpen({
      text: `You're about to ${changes.join(" and ")}. Do you want to continue?`,
      onConfirm: () => {
        setConfirmOpen(null);
        performSave();
      },
    });
  };

  const field = (label: string, key: keyof Profile, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={(form[key] as string) || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="border-2 border-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="p-3 border-2 border-foreground/30 bg-muted/40 text-xs">
        Any change you make here is the single source of truth — our support team sees the same details instantly. To change your email, please contact us.
      </div>

      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <h3 className="font-display uppercase">Your details</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {field("Full name", "full_name")}
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={form.email || ""} disabled className="border-2 border-foreground" />
          </div>
          {field("Phone", "phone", "tel")}
          {field("Date of birth", "date_of_birth", "date")}
        </div>
      </div>

      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <h3 className="font-display uppercase">Billing & service address</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {field("Address line 1", "address_line1")}
          {field("Address line 2", "address_line2")}
          {field("City", "city")}
          {field("Postcode", "postcode")}
        </div>
      </div>

      <div className="p-4 border-4 border-foreground bg-background space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="font-display uppercase">Communication preferences</h3>
        </div>
        <div className="p-3 border-2 border-foreground/30 bg-muted/40 text-xs space-y-1">
          <p className="flex items-center gap-1 font-display uppercase">
            <Info className="w-3 h-3" /> Your data, your choice
          </p>
          <p className="text-muted-foreground">
            Under UK GDPR, you decide how we contact you. We only use your details for the services you've asked for.
            You can change these at any time and every marketing message includes a one-tap unsubscribe.
          </p>
          <p className="text-muted-foreground">
            We never sell or share your details for marketing. See our{" "}
            <a href="/privacy-policy" className="underline">privacy policy</a> for full details.
          </p>
        </div>

        <div className="divide-y-2 divide-foreground/10 border-2 border-foreground/20">
          <ConsentRow
            title="Service updates & notices"
            description="Outage alerts, planned maintenance, engineer visits, billing changes, price notices. Turning this off means you may miss important messages about your service — we'll still contact you for anything legally required."
            required
            checked={!!form.service_updates_consent}
            onChange={(v) => setForm({ ...form, service_updates_consent: v })}
          />
          <ConsentRow
            title="Marketing emails"
            description="Occasional offers, product news and tips from OCCTA only. Roughly once a month. One-tap unsubscribe on every email."
            checked={!!form.marketing_email_consent}
            onChange={(v) => setForm({ ...form, marketing_email_consent: v })}
          />
          <ConsentRow
            title="Marketing text messages"
            description="Time-limited offers to the mobile number on your account. Reply STOP at any time. Standard network rates never apply — we cover the cost."
            checked={!!form.marketing_sms_consent}
            onChange={(v) => setForm({ ...form, marketing_sms_consent: v })}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {form.consent_updated_at ? (
            <p className="text-xs text-muted-foreground">
              Preferences last updated {format(new Date(form.consent_updated_at), "dd MMM yyyy 'at' HH:mm")}.
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">No changes recorded yet.</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-2 border-foreground"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History className="w-4 h-4 mr-1" />
            {historyOpen ? "Hide history" : "View consent history"}
          </Button>
        </div>

        {historyOpen && (
          <div className="mt-2 border-2 border-foreground/30 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="font-display uppercase text-xs">Consent history</p>
              <div className="flex flex-wrap gap-2">
                <Select value={historyTypeFilter} onValueChange={setHistoryTypeFilter}>
                  <SelectTrigger className="h-8 text-xs border-2 border-foreground min-w-[9rem]">
                    <SelectValue placeholder="Preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All preferences</SelectItem>
                    <SelectItem value="marketing_email">Marketing emails</SelectItem>
                    <SelectItem value="marketing_sms">Marketing SMS</SelectItem>
                    <SelectItem value="service_updates">Service updates</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={historyDirectionFilter} onValueChange={setHistoryDirectionFilter}>
                  <SelectTrigger className="h-8 text-xs border-2 border-foreground min-w-[8rem]">
                    <SelectValue placeholder="Change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All changes</SelectItem>
                    <SelectItem value="in">Opt-in only</SelectItem>
                    <SelectItem value="out">Opt-out only</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-2 border-foreground"
                  onClick={() => {
                    const filtered = history.filter((h) => {
                      if (historyTypeFilter !== "all" && h.consent_type !== historyTypeFilter) return false;
                      if (historyDirectionFilter === "in" && !h.new_value) return false;
                      if (historyDirectionFilter === "out" && h.new_value) return false;
                      return true;
                    });
                    if (filtered.length === 0) {
                      toast({ title: "Nothing to export", description: "Adjust filters to include some entries first." });
                      return;
                    }
                    const rows = [
                      ["Timestamp (ISO)", "Preference", "Change", "Previous", "New", "Source"],
                      ...filtered.map((h) => [
                        new Date(h.created_at).toISOString(),
                        CONSENT_LABELS[h.consent_type]?.title ?? h.consent_type,
                        h.new_value ? "Opt-in" : "Opt-out",
                        h.previous_value === null ? "" : h.previous_value ? "Yes" : "No",
                        h.new_value ? "Yes" : "No",
                        h.source,
                      ]),
                    ];
                    const csv = rows
                      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
                      .join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `occta-consent-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "Consent history exported", description: `${filtered.length} entr${filtered.length === 1 ? "y" : "ies"} downloaded as CSV.` });
                  }}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (() => {
              const filtered = history.filter((h) => {
                if (historyTypeFilter !== "all" && h.consent_type !== historyTypeFilter) return false;
                if (historyDirectionFilter === "in" && !h.new_value) return false;
                if (historyDirectionFilter === "out" && h.new_value) return false;
                return true;
              });
              if (history.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground">
                    No consent changes recorded yet. When you update a preference, it will appear here.
                  </p>
                );
              }
              if (filtered.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground">
                    No entries match these filters. Try widening your selection.
                  </p>
                );
              }
              return (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                {filtered.map((h) => {
                  const meta = CONSENT_LABELS[h.consent_type];
                  const Icon = meta?.icon ?? History;
                  return (
                    <li key={h.id} className="flex items-start gap-2 text-xs">
                      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p>
                          <span className="font-display uppercase">{meta?.short ?? h.consent_type}</span>{" "}
                          {h.new_value ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Check className="w-3 h-3" /> opted in
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <X className="w-3 h-3" /> opted out
                            </span>
                          )}
                          <span className="text-muted-foreground"> · {h.source.replace(/_/g, " ")}</span>
                        </p>
                        <p className="text-muted-foreground">
                          {format(new Date(h.created_at), "dd MMM yyyy 'at' HH:mm")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              );
            })()}
          </div>
        )}
      </div>

      <Button variant="hero" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>

      <AlertDialog open={!!confirmOpen} onOpenChange={(v) => { if (!v) setConfirmOpen(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm consent changes</AlertDialogTitle>
            <AlertDialogDescription>{confirmOpen?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current settings</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmOpen?.onConfirm()}>Yes, update</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  onChange,
  required,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 p-3 cursor-pointer">
      <div className="min-w-0">
        <p className="font-display uppercase text-sm flex items-center gap-2">
          {title}
          {required && (
            <span className="text-[10px] px-1.5 py-0.5 border border-foreground/50 uppercase tracking-wider">
              Recommended
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-1" />
    </label>
  );
}