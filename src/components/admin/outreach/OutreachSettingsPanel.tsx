import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { outreachTable, type OutreachSettings } from "@/lib/outreach/api";
import { Section } from "./shared";

const FUNCTIONS_URL = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "")}/functions/v1`;

export function OutreachSettingsPanel({ settings, onSaved }: { settings: OutreachSettings | null; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<OutreachSettings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [confirmOn, setConfirmOn] = useState(false);
  useEffect(() => { setForm(settings); }, [settings]);

  if (!form) return <p className="mt-4 text-sm text-muted-foreground">Loading settings… If this doesn't load, your account may not have outreach access (admin or super admin).</p>;

  const valid =
    (!form.from_email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.from_email)) &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.reply_to) &&
    form.window_end_hour > form.window_start_hour &&
    form.daily_cap >= 0 && form.hourly_cap >= 0;

  const save = async (patch: Partial<OutreachSettings> = {}) => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const next = { ...form, ...patch };
    const { error } = await outreachTable("outreach_settings").update({
      sending_enabled: next.sending_enabled,
      from_name: next.from_name.trim(),
      from_email: next.from_email?.trim().toLowerCase() || null,
      reply_to: next.reply_to.trim().toLowerCase(),
      daily_cap: next.daily_cap,
      hourly_cap: next.hourly_cap,
      window_start_hour: next.window_start_hour,
      window_end_hour: next.window_end_hour,
      weekdays_only: next.weekdays_only,
      recontact_cooldown_days: next.recontact_cooldown_days,
      postal_address: next.postal_address.trim(),
      updated_by: u.user?.id ?? null,
    } as never).eq("id", 1);
    setSaving(false);
    if (error) return toast({ title: "Couldn't save settings", description: error.message, variant: "destructive" });
    toast({ title: "Settings saved" });
    onSaved();
  };

  const num = (v: string) => (v === "" ? 0 : Math.max(0, Math.floor(Number(v))));

  return (
    <div className="space-y-6 mt-4">
      <Section title="Sending">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-semibold">{form.sending_enabled ? "Sending is ON" : "Sending is OFF"}</div>
            <p className="text-sm text-muted-foreground">Master switch. When off, launched campaigns wait and nothing is emailed.</p>
          </div>
          <Switch
            checked={form.sending_enabled}
            disabled={saving || (!form.sending_enabled && !form.from_email)}
            onCheckedChange={(on) => (on ? setConfirmOn(true) : save({ sending_enabled: false }))}
            aria-label="Sending on or off"
          />
        </div>
        {!form.from_email && <p className="text-sm text-amber-700 mt-2">Set and save a sending address before switching on.</p>}
      </Section>

      <Section title="Sender">
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label htmlFor="os-from-name">From name</Label><Input id="os-from-name" value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} /></div>
          <div><Label htmlFor="os-from">From address</Label><Input id="os-from" value={form.from_email ?? ""} placeholder="business@mail.occta.co.uk" onChange={(e) => setForm({ ...form, from_email: e.target.value })} /></div>
          <div><Label htmlFor="os-reply">Replies go to</Label><Input id="os-reply" value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} /></div>
          <div className="md:col-span-3"><Label htmlFor="os-addr">Company address shown in every email</Label><Textarea id="os-addr" rows={2} value={form.postal_address} onChange={(e) => setForm({ ...form, postal_address: e.target.value })} /></div>
        </div>
      </Section>

      <Section title="Limits and timing">
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label htmlFor="os-daily">Emails per day</Label><Input id="os-daily" type="number" min={0} max={5000} value={form.daily_cap} onChange={(e) => setForm({ ...form, daily_cap: num(e.target.value) })} /></div>
          <div><Label htmlFor="os-hourly">Emails per hour</Label><Input id="os-hourly" type="number" min={0} max={1000} value={form.hourly_cap} onChange={(e) => setForm({ ...form, hourly_cap: num(e.target.value) })} /></div>
          <div><Label htmlFor="os-cool">Don't re-email the same business for (days)</Label><Input id="os-cool" type="number" min={0} max={365} value={form.recontact_cooldown_days} onChange={(e) => setForm({ ...form, recontact_cooldown_days: num(e.target.value) })} /></div>
          <div><Label htmlFor="os-start">Send from (hour, UK time)</Label><Input id="os-start" type="number" min={0} max={23} value={form.window_start_hour} onChange={(e) => setForm({ ...form, window_start_hour: Math.min(23, num(e.target.value)) })} /></div>
          <div><Label htmlFor="os-end">Send until (hour, UK time)</Label><Input id="os-end" type="number" min={1} max={24} value={form.window_end_hour} onChange={(e) => setForm({ ...form, window_end_hour: Math.min(24, num(e.target.value)) })} /></div>
          <div className="flex items-end gap-2 pb-2"><Switch id="os-wd" checked={form.weekdays_only} onCheckedChange={(v) => setForm({ ...form, weekdays_only: v })} /><Label htmlFor="os-wd">Weekdays only</Label></div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">A new sending domain should start low (about 30 a day) and increase gradually over 2–4 weeks while bounces stay under 2% and spam complaints under 0.1%.</p>
        <div className="mt-4"><Button onClick={() => save()} disabled={saving || !valid}>{saving ? "Saving…" : "Save settings"}</Button></div>
      </Section>

      <Section title="Setup checklist">
        <ol className="list-decimal pl-5 space-y-3 text-sm">
          <li>
            <strong>Add a sending subdomain in Resend</strong> (for example <code>mail.occta.co.uk</code>), then add the DNS records Resend shows you (SPF, DKIM and the return-path record) at your DNS provider. Wait until Resend shows it as verified.
          </li>
          <li>
            <strong>Add a DMARC record</strong> for the subdomain if you don't have one: <code>_dmarc.mail.occta.co.uk</code> TXT <code>v=DMARC1; p=none; rua=mailto:dmarc@occta.co.uk</code>.
          </li>
          <li><strong>Set the From address</strong> above to an address on that subdomain and save.</li>
          <li>
            <strong>Add a Resend webhook</strong> pointing to <code className="break-all">{FUNCTIONS_URL}/outreach-resend-webhook</code> with the events <em>email.delivered, email.delivery_delayed, email.bounced, email.complained</em>. Copy its signing secret into the Supabase secret <code>RESEND_WEBHOOK_SECRET</code>. Without it, deliveries, bounces and spam complaints aren't recorded.
          </li>
          <li><strong>Send yourself a test</strong> from a draft campaign and check it lands in your inbox, not spam.</li>
          <li><strong>Switch sending on</strong>, then launch your first campaign.</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-3">Last sender run: {form.last_worker_run_at ? new Date(form.last_worker_run_at).toLocaleString("en-GB") : "never"}{form.last_worker_result ? ` · ${JSON.stringify(form.last_worker_result)}` : ""}</p>
      </Section>

      <AlertDialog open={confirmOn} onOpenChange={setConfirmOn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch sending on?</AlertDialogTitle>
            <AlertDialogDescription>
              Launched campaigns will start emailing from {form.from_email} in your sending window, up to {form.daily_cap} a day. Make sure the domain is verified in Resend and you've sent yourself a test.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOn(false); save({ sending_enabled: true }); }}>Switch on</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
