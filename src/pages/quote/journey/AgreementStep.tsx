import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, AlertTriangle, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FullContractTermsBlock from "@/components/legal/FullContractTermsBlock";

const CHECKBOXES = [
  { key: "received_read", text: "I confirm that I have received, read and had the opportunity to download my Contract Summary and Contract Information." },
  { key: "details_correct", text: "I confirm that my personal details and service address shown above are correct." },
  { key: "understand_charges", text: "I understand the monthly charges, one-off charges, contract duration, cancellation rights and payment arrangements." },
  { key: "consent", text: "I expressly consent to enter into the agreement with OCCTA LIMITED on the terms shown in my Contract Summary and Contract Information." },
] as const;

type CbKey = typeof CHECKBOXES[number]["key"];

/**
 * Device, network and (with permission) location signals collected at the moment
 * of signing. Used only to detect fraudulent orders and identity theft.
 */
async function collectRiskSignals(startedAt: number): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; webdriver?: boolean };
    out.browser_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    out.browser_locale = nav.language ?? null;
    out.screen_signature = `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}`;
    out.platform = nav.platform ?? null;
    if (typeof nav.deviceMemory === "number") out.device_memory = nav.deviceMemory;
    if (typeof nav.hardwareConcurrency === "number") out.hardware_concurrency = nav.hardwareConcurrency;
    if (typeof nav.maxTouchPoints === "number") out.touch_points = nav.maxTouchPoints;
    out.cookies_enabled = nav.cookieEnabled;
    out.do_not_track = String(nav.doNotTrack ?? "unset").slice(0, 20);
    out.webdriver_flag = nav.webdriver === true;
    out.page_dwell_ms = Math.max(0, Math.round(Date.now() - startedAt));
  } catch { /* signals are best-effort */ }

  // Precise location only if the browser has already been granted permission —
  // we never interrupt the signing flow with a prompt.
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    out.geo_permission = perm?.state ?? "unknown";
    if (perm?.state === "granted") {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        const t = setTimeout(() => resolve(null), 3000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(t); resolve(p); },
          () => { clearTimeout(t); resolve(null); },
          { timeout: 3000, maximumAge: 300000 },
        );
      });
      if (pos) {
        out.geo_latitude = pos.coords.latitude;
        out.geo_longitude = pos.coords.longitude;
        out.geo_accuracy_m = pos.coords.accuracy;
      }
    }
  } catch { /* location is optional */ }
  return out;
}

export default function AgreementStep({
  token,
  quote,
  onAccepted,
}: {
  token: string;
  quote: any;
  onAccepted: () => void;
}) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [cs, setCs] = useState<any>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<{ number: string; signed_url: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [dob, setDob] = useState("");
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [checks, setChecks] = useState<Record<CbKey, boolean>>({ received_read: false, details_correct: false, understand_charges: false, consent: false });
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const loadDetail = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("journey-cs-detail", { body: { token } });
    if (error || (data as any)?.error) return null;
    return data as any;
  }, [token]);

  const ensureCs = useCallback(async () => {
    setGenerating(true); setGenError(null);
    try {
      // Trigger (or reuse) CS generation
      const { data: gen, error: genErr } = await supabase.functions.invoke("journey-generate-cs", { body: { token } });
      if (genErr || (gen as any)?.error) {
        setGenError((gen as any)?.error || genErr?.message || "We couldn't prepare your Contract Summary.");
        return;
      }
      // Poll once more for the signed detail (waits for PDF)
      let detail = await loadDetail();
      let waited = 0;
      while (detail && !detail.pdf_ready && waited < 8) {
        await new Promise((r) => setTimeout(r, 800));
        detail = await loadDetail();
        waited += 1;
      }
      if (!detail) {
        setGenError("Couldn't load your Contract Summary.");
        return;
      }
      setCs(detail.contract_summary);
      setSignedPdfUrl(detail.signed_pdf_url ?? null);
      setPdfReady(!!detail.pdf_ready);
      setAcceptedAt(detail.accepted_at ?? null);
      setCertificate(detail.certificate ? { number: detail.certificate.number, signed_url: detail.certificate.signed_url } : null);
      // Prefill the form snapshots
      if (detail.contract_summary) {
        setFullName((prev) => prev || detail.contract_summary.customer_name_snapshot || "");
        setEmailConfirm((prev) => prev || detail.contract_summary.customer_email_snapshot || "");
      }
    } finally { setGenerating(false); }
  }, [token, loadDetail]);

  useEffect(() => { ensureCs(); }, [ensureCs]);

  const allChecksTicked = CHECKBOXES.every((c) => checks[c.key]);
  // Compute age from DOB (YYYY-MM-DD)
  const dobAge = (() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return -1;
    const d = new Date(dob + "T00:00:00Z");
    if (isNaN(d.getTime())) return -1;
    const now = new Date();
    let a = now.getUTCFullYear() - d.getUTCFullYear();
    const m = now.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a -= 1;
    return a;
  })();
  const dobValid = dobAge >= 18 && dobAge <= 120;
  const formValid =
    fullName.trim().length >= 2 &&
    emailConfirm.trim().length > 4 &&
    mobileVerified &&
    dobValid &&
    addressConfirmed &&
    allChecksTicked &&
    pdfReady;

  const submit = async () => {
    if (!formValid || submitting || acceptedAt) return;
    setSubmitting(true);
    try {
      const riskSignals = await collectRiskSignals(startedAt);
      const { data, error } = await supabase.functions.invoke("accept-contract-summary", {
        body: {
          token,
          journey_mode: true,
          accepted_by_name: fullName.trim(),
          accepted_by_email: emailConfirm.trim().toLowerCase(),
          accepted_by_mobile: phoneMasked ?? "verified",
          address_confirmed: true,
          date_of_birth: dob,
          checkbox_received_read: checks.received_read,
          checkbox_details_correct: checks.details_correct,
          checkbox_understand_charges: checks.understand_charges,
          checkbox_consent: checks.consent,
          cs_version: cs?.version,
          source_route: typeof window !== "undefined" ? window.location.pathname : null,
          session_id: typeof window !== "undefined" ? window.sessionStorage.getItem("occta_session_id") || crypto.randomUUID() : null,
          risk_signals: riskSignals,
        },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "We couldn't record your acceptance",
          description: (data as any)?.error || error?.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Agreement accepted", description: "Your signed certificate is being prepared." });
        // Refresh detail to pull certificate
        const detail = await loadDetail();
        if (detail) {
          setAcceptedAt(detail.accepted_at ?? new Date().toISOString());
          setCertificate(detail.certificate ? { number: detail.certificate.number, signed_url: detail.certificate.signed_url } : null);
        }
        onAccepted();
      }
    } catch (e) {
      toast({ title: "Network error", description: String((e as Error).message), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (generating) {
    return (
      <div className="border-4 border-foreground p-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        <p className="font-display uppercase text-sm">Preparing your Contract Summary…</p>
        <p className="text-xs text-muted-foreground mt-2">No charges are taken. You can review and download before deciding.</p>
      </div>
    );
  }

  if (genError || !cs) {
    return (
      <div className="border-4 border-destructive p-6 bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-display uppercase text-sm mb-1">We couldn't prepare your Contract Summary</p>
            <p className="text-xs text-muted-foreground mb-3">{genError ?? "Please try again or contact OCCTA support."}</p>
            <Button variant="outline" size="sm" onClick={ensureCs}><RefreshCw className="w-3 h-3 mr-1" /> Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  const isBusiness = cs.customer_type === "business";
  const oneOff = (cs.one_off_charges_json as Array<{ label: string; amount: number }>) ?? [];

  return (
    <div className="space-y-5">
      {/* Branded CS card */}
      <div className="border-4 border-foreground">
        <div className="bg-foreground text-background px-5 py-3 flex items-center justify-between">
          <div>
            <p className="font-display uppercase text-[10px] tracking-[0.2em] opacity-80">OCCTA · Contract Summary</p>
            <p className="font-display uppercase text-base">{cs.cs_number} · v{cs.version}</p>
          </div>
          <Button asChild={!!signedPdfUrl} variant="secondary" size="sm" disabled={!signedPdfUrl}>
            {signedPdfUrl ? (
              <a href={signedPdfUrl} target="_blank" rel="noreferrer"><Download className="w-4 h-4 mr-1" /> Download</a>
            ) : (
              <span><Download className="w-4 h-4 mr-1" /> Preparing…</span>
            )}
          </Button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <section>
            <h3 className="font-display uppercase text-xs mb-1">Customer & service</h3>
            <p><strong>{cs.customer_name_snapshot}</strong> — {cs.customer_email_snapshot}</p>
            <p className="text-muted-foreground">{cs.service_address}</p>
          </section>

          <section>
            <h3 className="font-display uppercase text-xs mb-1">Plan</h3>
            <p><strong>{cs.plan_name}</strong> — {cs.service_type?.replaceAll("_", " ")}</p>
            <p className="text-muted-foreground">{cs.contract_length} · Notice: {cs.notice_period}</p>
            <p className="text-muted-foreground">Estimated speed: {cs.estimated_download_speed ?? "—"} / {cs.estimated_upload_speed ?? "—"} Mbps</p>
            <p className="text-xs text-muted-foreground">Speeds shown are estimates for your line, not guarantees.</p>
          </section>

          <section>
            <h3 className="font-display uppercase text-xs mb-1">Price</h3>
            {isBusiness ? (
              <>
                <p>Monthly (ex VAT): <strong>£{Number(cs.business_monthly_ex_vat ?? 0).toFixed(2)}</strong></p>
                <p>Monthly (incl VAT): <strong>£{Number(cs.business_monthly_incl_vat ?? 0).toFixed(2)}</strong></p>
              </>
            ) : (
              <p>Monthly (incl VAT): <strong>£{Number(cs.monthly_price_incl_vat).toFixed(2)}</strong></p>
            )}
            {oneOff.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {oneOff.map((c, i) => (
                  <li key={i} className="flex justify-between border-b border-muted py-1">
                    <span>{c.label}</span><span>£{Number(c.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="text-xs text-muted-foreground space-y-2">
            <p><strong className="text-foreground">Price rises:</strong> {cs.price_rise_policy}</p>
            <p><strong className="text-foreground">Cancellation:</strong> {cs.cease_cancellation_charges}</p>
            {cs.digital_voice_warning && (
              <p className="border-l-4 border-destructive pl-3 text-foreground">{cs.digital_voice_warning}</p>
            )}
            <p>{cs.complaints_adr_info}</p>
            <p>{cs.payment_schedule}</p>
          </section>
        </div>
      </div>

      {/* Full multi-page terms — mirrors the downloadable PDF */}
      <FullContractTermsBlock />

      {acceptedAt ? (
        <div className="border-4 border-primary bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <Check className="w-6 h-6 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="font-display uppercase text-sm">Agreement accepted</p>
              <p className="text-xs text-muted-foreground">Accepted at {new Date(acceptedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} (Europe/London).</p>
              {certificate && (
                <p className="text-xs mt-2">
                  Certificate <strong>{certificate.number}</strong>
                  {certificate.signed_url && (
                    <> · <a className="underline" href={certificate.signed_url} target="_blank" rel="noreferrer">download</a></>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Next: pick your preferred start date — we'll email you a secure link when that step is ready.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-4 border-primary p-5 space-y-4">
          <div>
            <p className="font-display uppercase text-sm mb-1">Sign and enter into the agreement</p>
            <p className="text-xs text-muted-foreground">All four confirmations below must be ticked. Nothing is binding until you click the button at the bottom.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ag-name">Typed full legal name</Label>
              <Input id="ag-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="ag-email">Confirm email</Label>
              <Input id="ag-email" type="email" value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} autoComplete="email" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ag-mobile">Mobile number (from your details)</Label>
              <Input id="ag-mobile" type="tel" value={phoneMasked ?? ""} readOnly disabled placeholder="******0000" />
              <p className="text-xs text-muted-foreground mt-1">
                To change this, go back to your customer details step — any earlier verification is cleared.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ag-dob">Date of birth (you must be 18 or older)</Label>
              <Input
                id="ag-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                autoComplete="bday"
              />
              {dob && !dobValid && (
                <p className="text-xs text-destructive mt-1">
                  {dobAge >= 0 && dobAge < 18
                    ? "You must be at least 18 years old to enter into this agreement."
                    : "Please enter a valid date of birth."}
                </p>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm border border-dashed border-foreground/40 p-3">
            <Checkbox checked={addressConfirmed} onCheckedChange={(v) => setAddressConfirmed(v === true)} />
            <span>I confirm the service address shown above (<strong>{cs.service_address}</strong>) is correct.</span>
          </label>

          <div className="space-y-3">
            {CHECKBOXES.map((c) => (
              <label key={c.key} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={checks[c.key]}
                  onCheckedChange={(v) => setChecks((s) => ({ ...s, [c.key]: v === true }))}
                />
                <span>{c.text}</span>
              </label>
            ))}
          </div>

          {!pdfReady && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Preparing the downloadable PDF before you can sign…
            </p>
          )}

          <ContractSmsVerification
            token={token}
            onVerifiedChange={setMobileVerified}
            onMaskedChange={setPhoneMasked}
          />

          <Button
            variant="hero"
            className="w-full font-display uppercase"
            disabled={!formValid || submitting}
            onClick={submit}
          >
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Sign and enter into the agreement"}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3">
            For your protection we record the date and time, IP address, approximate location and device details of this
            signature. We use this only to prevent fraudulent orders and identity theft, as explained in our Privacy Policy.
          </p>
        </div>
      )}
    </div>
  );
}