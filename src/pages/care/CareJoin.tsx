import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { BrandContainer } from "@/components/brand/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { logClientEvent } from "@/lib/activityLog";
import { careApi, careJoin, CARE_REASON_TEXT, type CareEligibility, type JoinStart } from "@/lib/care/api";
import { CareDDGuarantee, CareNotIncluded } from "@/components/care/CareBits";
import {
  CARE_DD, CARE_FREQUENCIES, CARE_PLANS, CARE_TERMS_PATH, CARE_TERMS_SUMMARY, CARE_TERMS_VERSION, carePlan, carePriceMinor, pounds,
  type CareFrequency, type CarePlanCode,
} from "../../../supabase/functions/_shared/careTerms.ts";
import { providerInstructionText } from "../../../supabase/functions/_shared/directDebitGuarantee.ts";

type Step = "choose" | "facts" | "bank" | "support" | "verify" | "review" | "done";
const STEPS: { id: Step; label: string }[] = [
  { id: "choose", label: "Plan" }, { id: "facts", label: "Key facts" }, { id: "bank", label: "Direct Debit" },
  { id: "support", label: "Support" }, { id: "verify", label: "Confirm it's you" }, { id: "review", label: "Agree" },
];

const NEEDS: { code: string; label: string }[] = [
  { code: "large_print", label: "Letters in large print" },
  { code: "braille", label: "Letters in Braille" },
  { code: "carer_copy", label: "Send a copy of letters to someone who helps me" },
  { code: "extra_time", label: "Give me more time on calls" },
  { code: "phone_preferred", label: "I prefer phone calls" },
  { code: "email_preferred", label: "I prefer email" },
  { code: "no_sales_contact", label: "Don't contact me with offers" },
];

const ERROR_TEXT: Record<string, string> = {
  sign_in_required: "Please sign in again.",
  not_eligible: "Sorry, you can't join right now.",
  invite_invalid: "That link has expired or was already used. You can still join below.",
  invite_other_account: "That link was sent to a different OCCTA account. Sign in with that account, or join below.",
  too_soon: "Please wait a minute before asking for another code.",
  send_limit_reached: "You've asked for too many codes. Please wait an hour or call us.",
  sms_unavailable: "Text messages aren't available for your account. Use email instead.",
  provider_unavailable: "We couldn't send a text just now. Try email instead.",
  incorrect_code: "That code isn't right. Check and try again.",
  code_expired: "That code has expired. Ask for a new one.",
  too_many_attempts: "Too many tries. Ask for a new code.",
  bank_details_invalid: "Check the sort code (6 digits) and account number (8 digits).",
  application_expired: "This took longer than 24 hours, so please start again.",
  terms_changed: "Our terms changed while you were signing up. Please start again so you see the latest version.",
  price_changed: "The price changed while you were signing up. Please start again.",
  not_verified: "Please confirm it's you with a code first.",
  rate_limited: "Too many attempts. Please wait a few minutes.",
  encryption_unavailable: "We can't take bank details safely right now. Please try again shortly or call us.",
  support_needs_consent_required: "Please tick to let us record your support needs, or untick them.",
  date_of_birth_required: "Please enter your date of birth.",
};

// New OCCTA accounts often have no address yet; Care letters are posted, so ask for it here.
function CareAddressForm({ onSaved }: { onSaved: () => void }) {
  const [a, setA] = useState({ address_line1: "", address_line2: "", city: "", postcode: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const pcOk = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(a.postcode.trim());
  async function save() {
    setBusy(true); setErr(null);
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ address_line1: a.address_line1.trim(), address_line2: a.address_line2.trim() || null,
      city: a.city.trim(), postcode: a.postcode.trim().toUpperCase() }).eq("id", data.user?.id ?? "");
    setBusy(false);
    if (error) setErr("Couldn't save your address. Please try again or call us."); else onSaved();
  }
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {([["address_line1", "Address line 1"], ["address_line2", "Address line 2 (optional)"], ["city", "Town or city"], ["postcode", "Postcode"]] as const).map(([k, l]) => (
        <div key={k}><Label htmlFor={`addr-${k}`}>{l}</Label><Input id={`addr-${k}`} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} /></div>
      ))}
      {err && <p className="text-sm text-destructive sm:col-span-2" role="alert">{err}</p>}
      <Button className="sm:col-span-2" disabled={busy || a.address_line1.trim().length < 3 || a.city.trim().length < 2 || !pcOk} onClick={() => void save()}>Save my address</Button>
    </div>
  );
}

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return ERROR_TEXT[m] ?? m;
}

const nowIso = () => new Date().toISOString();

export default function CareJoin() {
  const [params] = useSearchParams();
  const invite = params.get("invite");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [elig, setElig] = useState<CareEligibility | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [plan, setPlan] = useState<CarePlanCode>((params.get("plan") as CarePlanCode) === "plus" ? "plus" : "essentials");
  const [freq, setFreq] = useState<CareFrequency>((["monthly", "quarterly", "annual"].includes(params.get("frequency") ?? "") ? params.get("frequency") : "monthly") as CareFrequency);
  const [day, setDay] = useState<1 | 15>(1);
  const [inviteNote, setInviteNote] = useState<string | null>(null);

  const [app, setApp] = useState<JoinStart | null>(null);
  const [ticks, setTicks] = useState<Record<string, string | null>>({ terms: null, over_18: null, early_start: null, dd: null, account_holder: null });
  const [bank, setBank] = useState({ account_holder_name: "", sort_code: "", account_number: "", bank_name: "" });
  const [dob, setDob] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [carer, setCarer] = useState({ name: "", contact: "" });
  const [supportOther, setSupportOther] = useState("");
  const [verification, setVerification] = useState<{ id: string; destination: string; method: "sms" | "email" } | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [result, setResult] = useState<{ reference: string; status: string; first_collection_date: string; cooling_off_ends_on: string; price_minor: number } | null>(null);

  const tick = (k: string, on: boolean) => setTicks((t) => ({ ...t, [k]: on ? nowIso() : null }));

  useEffect(() => {
    logClientEvent({ event_type: "page_view", title: "OCCTA Care join", source_module: "care" });
    supabase.auth.getSession().then(async ({ data }) => {
      const ok = !!data.session;
      setSignedIn(ok);
      if (!ok) return;
      try {
        const o = await careApi.myOverview();
        setElig(o.eligibility ?? null);
      } catch { /* shown as generic error later */ }
      if (invite) {
        try {
          const i = await careJoin.invite(invite);
          setPlan(i.plan_code as CarePlanCode); setFreq(i.frequency as CareFrequency); setDay(i.collection_day === 15 ? 15 : 1);
          setInviteNote("We've filled in what you talked about with our team. You can change anything.");
        } catch (e) { setInviteNote(errText(e)); }
      }
    });
  }, [invite]);

  const price = useMemo(() => carePriceMinor(plan, freq) ?? 0, [plan, freq]);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  async function start() {
    setBusy(true); setError(null);
    try {
      const r = await careJoin.start({ plan, frequency: freq, collection_day: day, invite_token: invite });
      setApp(r);
      setStep("facts");
      logClientEvent({ event_type: "tab_view", title: "Care key facts shown", source_module: "care", details: { plan, freq } });
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function sendCode(method: "sms" | "email") {
    if (!app) return;
    setBusy(true); setError(null);
    try {
      const r = await careJoin.sendCode(app.application_id, method);
      setVerification({ id: r.verification_id, destination: r.destination, method });
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function verifyCode() {
    if (!verification) return;
    setBusy(true); setError(null);
    try {
      await careJoin.verifyCode(verification.id, code.trim());
      setVerified(true);
      setStep("review");
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function submit() {
    if (!app || !verification) return;
    setBusy(true); setError(null);
    try {
      const r = await careJoin.submit({
        application_id: app.application_id, verification_id: verification.id, terms_version: app.terms_version,
        ticks: {
          terms: !!ticks.terms, terms_at: ticks.terms, over_18: !!ticks.over_18, dd: !!ticks.dd, dd_at: ticks.dd,
          account_holder: !!ticks.account_holder, account_holder_at: ticks.account_holder, early_start: !!ticks.early_start, early_start_at: ticks.early_start,
        },
        bank,
        date_of_birth: app.date_of_birth_known ? null : dob || null,
        support_needs: needs, support_needs_consent: needsConsent, support_other: supportOther || null,
        carer_name: needs.includes("carer_copy") ? carer.name || null : null, carer_contact: needs.includes("carer_copy") ? carer.contact || null : null,
        page_url: window.location.pathname,
        client_snapshot: { plan, freq, day, price_shown_minor: price, key_facts_sha256: app.key_facts_sha256, viewport: `${window.innerWidth}x${window.innerHeight}`, invite: !!invite, dd_shown: app.dd ?? null },
      });
      setResult(r);
      setStep("done");
      logClientEvent({ event_type: "form_submit", title: "Joined OCCTA Care", source_module: "care", details: { reference: r.reference } });
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  const sortOk = bank.sort_code.replace(/\D/g, "").length === 6;
  const acctLen = bank.account_number.replace(/\D/g, "").length;
  const acctOk = acctLen === 8 || acctLen === 7;
  const bankOk = sortOk && acctOk && bank.account_holder_name.trim().length >= 2 && !!ticks.dd && !!ticks.account_holder;
  const supportOk = needs.length === 0 || needsConsent;
  const dobOk = /^\d{4}-\d{2}-\d{2}$/.test(dob) && dob > "1900-01-01" && dob <= new Date().toISOString().slice(0, 10);

  return (
    <Layout>
      <SEO title="Join OCCTA Care" description="Join OCCTA Care in a few minutes. Nothing is taken for 14 days and you can cancel any time." canonical="/care/join" noIndex />
      <BrandContainer className="py-10 md:py-14">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground"><Link to="/care" className="underline">OCCTA Care</Link> / Join</p>
        <h1 className="mt-2 font-display text-4xl uppercase md:text-5xl">Join OCCTA Care</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Take your time: nothing starts until the last step, nothing is taken for 14 days, and you can cancel any time. Prefer to talk? Call 0800 260 6626.
        </p>

        {step !== "done" && (
          <ol className="mt-6 flex flex-wrap gap-1" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s.id} aria-current={s.id === step ? "step" : undefined}
                className={`border-2 border-foreground px-2 py-1 font-display text-[11px] uppercase ${i < stepIndex ? "bg-secondary" : i === stepIndex ? "bg-primary text-black" : "opacity-50"}`}>
                {i + 1}. {s.label}
              </li>
            ))}
          </ol>
        )}

        {error && <p role="alert" className="mt-6 border-[3px] border-destructive p-3 text-sm" data-testid="care-join-error">{error}</p>}

        {signedIn === null && <p className="mt-10 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}

        {signedIn === false && (
          <div className="mt-8 max-w-xl border-[3px] border-foreground p-6">
            <p className="font-display uppercase">Sign in to join</p>
            <p className="mt-2 text-sm">OCCTA Care is open to any UK home, even if you don't get broadband from us. Sign in, or create a free OCCTA account, and we'll bring you back here.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild><Link to={`/auth?next=${encodeURIComponent(`/care/join${window.location.search}`)}`}>Sign in</Link></Button>
              <Button asChild variant="outline"><Link to={`/auth?mode=signup&next=${encodeURIComponent(`/care/join${window.location.search}`)}`}>Create a free account</Link></Button>
            </div>
          </div>
        )}

        {signedIn && elig && !elig.eligible && step !== "done" && (
          <div className="mt-8 max-w-xl border-[3px] border-foreground p-6" data-testid="care-not-eligible">
            <p className="font-display uppercase">You can't join just now</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{elig.reasons.map((r) => <li key={r}>{CARE_REASON_TEXT[r] ?? r}</li>)}</ul>
            {elig.reasons.includes("already_member") && <Button asChild className="mt-4"><Link to="/dashboard?tab=care">Go to My Care</Link></Button>}
            {elig.reasons.includes("no_postal_address") && <CareAddressForm onSaved={() => void careApi.myOverview().then((o) => setElig(o.eligibility ?? null))} />}
          </div>
        )}

        {signedIn && (!elig || elig.eligible) && (
          <div className="mt-8 max-w-3xl space-y-6">
            {inviteNote && <p className="border-l-4 border-primary bg-secondary p-3 text-sm">{inviteNote}</p>}

            {step === "choose" && (
              <section className="space-y-6">
                <fieldset>
                  <legend className="font-display uppercase">Which plan?</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {CARE_PLANS.map((p) => (
                      <label key={p.code} className={`cursor-pointer border-[3px] p-4 ${plan === p.code ? "border-foreground bg-primary/20" : "border-foreground/30"}`}>
                        <input type="radio" name="plan" value={p.code} checked={plan === p.code} onChange={() => setPlan(p.code)} className="mr-2" />
                        <span className="font-display uppercase">{p.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{p.tagline}</span>
                        <span className="mt-2 block font-display">{pounds(carePriceMinor(p.code, freq))} {freq === "monthly" ? "a month" : freq === "quarterly" ? "every 3 months" : "a year"}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="font-display uppercase">How often do you want to pay?</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CARE_FREQUENCIES.map((f) => (
                      <label key={f.code} className={`cursor-pointer border-[3px] px-3 py-2 text-sm ${freq === f.code ? "border-foreground bg-primary/20" : "border-foreground/30"}`}>
                        <input type="radio" name="freq" value={f.code} checked={freq === f.code} onChange={() => setFreq(f.code)} className="mr-2" />{f.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="font-display uppercase">Which day suits you for payments?</legend>
                  <div className="mt-3 flex gap-2">
                    {[1, 15].map((d) => (
                      <label key={d} className={`cursor-pointer border-[3px] px-3 py-2 text-sm ${day === d ? "border-foreground bg-primary/20" : "border-foreground/30"}`}>
                        <input type="radio" name="day" checked={day === d} onChange={() => setDay(d as 1 | 15)} className="mr-2" />The {d === 1 ? "1st" : "15th"} of the month
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-sm">You've picked <strong>{carePlan(plan)?.name}</strong> at <strong>{pounds(price)}</strong> {freq === "monthly" ? "a month" : freq === "quarterly" ? "every 3 months" : "a year"}, VAT included.</p>
                <Button onClick={() => void start()} disabled={busy} data-testid="care-join-start">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}See the key facts</Button>
              </section>
            )}

            {step === "facts" && app && (
              <section className="space-y-5">
                <div className="border-[3px] border-foreground bg-secondary p-5" data-testid="care-key-facts">
                  <p className="font-display uppercase">Key facts: please read before you go on</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{app.key_facts.map((k) => <li key={k}>{k}</li>)}</ul>
                </div>
                <CareNotIncluded />
                <p className="text-sm">{CARE_TERMS_SUMMARY}</p>
                <p className="text-sm"><a href={CARE_TERMS_PATH} target="_blank" rel="noreferrer" className="underline">Read the full terms (version {CARE_TERMS_VERSION})</a> — opens in a new tab.</p>
                <div className="space-y-3 border-[3px] border-foreground p-4">
                  <label className="flex items-start gap-3 text-sm"><Checkbox checked={!!ticks.terms} onCheckedChange={(v) => tick("terms", v === true)} data-testid="tick-terms" /> <span>I've read the key facts and agree to the OCCTA Care terms (version {CARE_TERMS_VERSION}). I understand Care is a support service, not insurance.</span></label>
                  <label className="flex items-start gap-3 text-sm"><Checkbox checked={!!ticks.over_18} onCheckedChange={(v) => tick("over_18", v === true)} data-testid="tick-18" /> <span>I'm 18 or over.</span></label>
                  {!app.date_of_birth_known && (
                    <div className="max-w-xs">
                      <Label htmlFor="dob">Your date of birth</Label>
                      <Input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={dob} onChange={(e) => setDob(e.target.value)} data-testid="care-dob" />
                      <p className="mt-1 text-xs text-muted-foreground">We don't have this on your account yet. We use it to check you're 18 or over and to give extra time and a call to customers who might want it.</p>
                    </div>
                  )}
                  <label className="flex items-start gap-3 text-sm"><Checkbox checked={!!ticks.early_start} onCheckedChange={(v) => tick("early_start", v === true)} /> <span><strong>Optional:</strong> I'd like to start using Care straight away, during my 14-day cooling-off period. (It's free during this time and I can still cancel.)</span></label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("choose")}>Back</Button>
                  <Button disabled={!ticks.terms || !ticks.over_18 || (!app.date_of_birth_known && !dobOk)} onClick={() => setStep("bank")} data-testid="care-facts-next">Continue</Button>
                </div>
              </section>
            )}

            {step === "bank" && app && (
              <section className="space-y-5">
                <p className="text-sm">Care has its own Direct Debit, separate from your broadband. Payments are collected by <strong>{app.dd?.name ?? CARE_DD.collectionName}</strong>. OCCTA never asks for card details.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label htmlFor="holder">Name on the bank account</Label><Input id="holder" autoComplete="name" value={bank.account_holder_name} onChange={(e) => setBank({ ...bank, account_holder_name: e.target.value })} /></div>
                  <div><Label htmlFor="sort">Sort code</Label><Input id="sort" inputMode="numeric" placeholder="12-34-56" maxLength={8} value={bank.sort_code} onChange={(e) => setBank({ ...bank, sort_code: e.target.value })} aria-invalid={bank.sort_code !== "" && !sortOk} /></div>
                  <div><Label htmlFor="acct">Account number</Label><Input id="acct" inputMode="numeric" placeholder="12345678" maxLength={8} value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} aria-invalid={bank.account_number !== "" && !acctOk} /></div>
                  <div className="sm:col-span-2"><Label htmlFor="bankname">Bank name (optional)</Label><Input id="bankname" value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} /></div>
                </div>
                <div className="space-y-3 border-[3px] border-foreground p-4 text-sm">
                  <label className="flex items-start gap-3"><Checkbox checked={!!ticks.account_holder} onCheckedChange={(v) => tick("account_holder", v === true)} data-testid="tick-holder" /> <span>This is a UK bank account in my name, or I'm allowed to set up Direct Debits from it on my own.</span></label>
                  <label className="flex items-start gap-3"><Checkbox checked={!!ticks.dd} onCheckedChange={(v) => tick("dd", v === true)} data-testid="tick-dd" />
                    <span><strong>Instruction to your bank or building society:</strong> {providerInstructionText({ legal_collection_name: app.dd?.name ?? CARE_DD.collectionName, service_user_number: app.dd?.sun ?? CARE_DD.serviceUserNumber, advance_notice_working_days: CARE_DD.noticeWorkingDays })} Reference: given on your confirmation (starts OCCTA CARE-).</span>
                  </label>
                </div>
                <CareDDGuarantee dd={app.dd} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("facts")}>Back</Button>
                  <Button disabled={!bankOk} onClick={() => setStep("support")} data-testid="care-bank-next">Continue</Button>
                </div>
              </section>
            )}

            {step === "support" && (
              <section className="space-y-5">
                <p className="font-display uppercase">Is there anything that would help? (optional)</p>
                <p className="text-sm text-muted-foreground">Only tick what's useful. You can change this any time in My OCCTA.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {NEEDS.map((n) => (
                    <label key={n.code} className="flex items-start gap-3 border-2 border-foreground/30 p-3 text-sm">
                      <Checkbox checked={needs.includes(n.code)} onCheckedChange={(v) => setNeeds((cur) => v === true ? [...cur, n.code] : cur.filter((x) => x !== n.code))} />
                      <span>{n.label}</span>
                    </label>
                  ))}
                </div>
                {needs.includes("carer_copy") && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label htmlFor="cn">Their name</Label><Input id="cn" value={carer.name} onChange={(e) => setCarer({ ...carer, name: e.target.value })} /></div>
                    <div><Label htmlFor="cc">Their address or email</Label><Input id="cc" value={carer.contact} onChange={(e) => setCarer({ ...carer, contact: e.target.value })} /></div>
                  </div>
                )}
                <div><Label htmlFor="other">Anything else? (optional)</Label><Input id="other" maxLength={500} value={supportOther} onChange={(e) => setSupportOther(e.target.value)} /></div>
                {(needs.length > 0 || supportOther) && (
                  <label className="flex items-start gap-3 border-[3px] border-foreground p-3 text-sm">
                    <Checkbox checked={needsConsent} onCheckedChange={(v) => setNeedsConsent(v === true)} data-testid="tick-needs-consent" />
                    <span>I'm happy for OCCTA to record this so they can support me. I can ask for it to be removed at any time.</span>
                  </label>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("bank")}>Back</Button>
                  <Button disabled={!supportOk || (needs.includes("carer_copy") && carer.name.trim().length < 2)} onClick={() => setStep("verify")} data-testid="care-support-next">Continue</Button>
                </div>
              </section>
            )}

            {step === "verify" && app && (
              <section className="space-y-5">
                <p className="text-sm">To make sure it's really you, we'll send a 6-digit code. We'll never ask for this code on the phone.</p>
                {!verification && (
                  <div className="flex flex-wrap gap-2">
                    {app.verification.sms && <Button onClick={() => void sendCode("sms")} disabled={busy}>Text a code to {app.verification.sms}</Button>}
                    {app.verification.email && <Button variant={app.verification.sms ? "outline" : "default"} onClick={() => void sendCode("email")} disabled={busy} data-testid="care-send-email-code">Email a code to {app.verification.email}</Button>}
                  </div>
                )}
                {verification && !verified && (
                  <div className="max-w-xs space-y-3">
                    <p className="text-sm">We've sent a code to <strong>{verification.destination}</strong>.</p>
                    <Label htmlFor="code">Code</Label>
                    <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                    <div className="flex gap-2">
                      <Button onClick={() => void verifyCode()} disabled={busy || code.length !== 6}>Confirm</Button>
                      <Button variant="outline" onClick={() => void sendCode(verification.method)} disabled={busy}>Send again</Button>
                    </div>
                  </div>
                )}
                <Button variant="outline" onClick={() => setStep("support")}>Back</Button>
              </section>
            )}

            {step === "review" && app && verified && (
              <section className="space-y-5">
                <div className="border-[3px] border-foreground p-5">
                  <p className="font-display uppercase">Check everything</p>
                  <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
                    <dt className="font-semibold">Plan</dt><dd>{carePlan(plan)?.name}</dd>
                    <dt className="font-semibold">Price</dt><dd>{pounds(app.price_minor)} {freq === "monthly" ? "a month" : freq === "quarterly" ? "every 3 months" : "a year"}, VAT included</dd>
                    <dt className="font-semibold">First payment</dt><dd>On or just after {new Date(`${app.first_collection_date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd>
                    <dt className="font-semibold">Bank account</dt><dd>{bank.account_holder_name}, sort code ending {bank.sort_code.replace(/\D/g, "").slice(-2)}, account ending {bank.account_number.replace(/\D/g, "").slice(-4)}</dd>
                    <dt className="font-semibold">Start using Care</dt><dd>{ticks.early_start ? "Straight away" : "When your cooling-off period ends"}</dd>
                    <dt className="font-semibold">Minimum term</dt><dd>None. Cancel any time, no exit fee.</dd>
                  </dl>
                </div>
                <p className="text-sm">By pressing <strong>Join OCCTA Care</strong>, you're agreeing to OCCTA Care and setting up the Direct Debit above. We'll confirm everything by post and email.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("bank")}>Change bank details</Button>
                  <Button onClick={() => void submit()} disabled={busy} data-testid="care-submit">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Join OCCTA Care</Button>
                </div>
              </section>
            )}

            {step === "done" && result && (
              <section className="border-[3px] border-foreground p-6" data-testid="care-joined">
                <p className="font-display text-2xl uppercase">You're in. Welcome to OCCTA Care.</p>
                <p className="mt-2 text-sm">Your reference is <strong>{result.reference}</strong>.</p>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
                  <li>{result.status === "pending_review" ? "A member of our team will quickly check everything's right for you before your Direct Debit is set up. We may call you." : "We're setting up your Direct Debit now."}</li>
                  <li>Your welcome pack and Direct Debit confirmation are on their way by post and email.</li>
                  <li>Nothing is taken until your cooling-off period ends on {new Date(`${result.cooling_off_ends_on}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Changed your mind? Cancel in My OCCTA before then and you pay nothing.</li>
                </ul>
                <Button asChild className="mt-5"><Link to="/dashboard?tab=care">Go to My Care</Link></Button>
              </section>
            )}
          </div>
        )}
      </BrandContainer>
    </Layout>
  );
}
