import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Loader2, Phone } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { BrandSection, HeroKicker, HeroTitle, PosterStage, TicketSlab } from "@/components/brand/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getCampaignUtmForSubmit } from "@/lib/campaignAttribution";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";
import { buildLineCheckMessage, CALL_TIMES, LINE_ITEMS, lineCheckUtm, outreachTokenFromSearch, type CallTime } from "@/lib/lineCheck";

/**
 * The hero is a dark poster, which flips the design tokens for everything in
 * it. The form reads best as a white card, so it gets the light tokens back.
 */
const LIGHT_SURFACE = {
  "--background": "60 5% 96%",
  "--foreground": "0 0% 5%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 5%",
  "--muted": "40 5% 88%",
  "--muted-foreground": "0 0% 35%",
  "--border": "0 0% 0%",
  "--input": "0 0% 0%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "0 0% 5%",
  colorScheme: "light",
} as React.CSSProperties;

/**
 * Landing page for the landline switch-off emails and flyers. The email
 * promises a free 15-minute line check, so this page asks only for what we
 * need to ring someone back, and greets the business by name when the visitor
 * arrives from their email.
 */
const LineCheck = () => {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const token = useMemo(() => outreachTokenFromSearch(search), [search]);
  // Captured on first render: the attribution the visitor arrived with.
  const [landingUtm] = useState(() => lineCheckUtm(search));

  const [form, setForm] = useState({ company_name: "", contact_name: "", phone: "", email: "", consent: false });
  const [knownBusiness, setKnownBusiness] = useState<string | null>(null);
  const [callTime, setCallTime] = useState<CallTime>("any");
  const [items, setItems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("outreach_line_check_prefill", { p_token: token });
        if (cancelled || !data || typeof data !== "object") return;
        const name = typeof data.business_name === "string" ? data.business_name.trim() : "";
        const email = typeof data.email === "string" ? data.email.trim() : "";
        if (name) setKnownBusiness(name);
        setForm((f) => ({
          ...f,
          company_name: f.company_name || name,
          email: f.email || email,
        }));
      } catch {
        // Prefill is a convenience; the form works without it.
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const update = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const toggleItem = (item: string) =>
    setItems((cur) => (cur.includes(item) ? cur.filter((i) => i !== item) : [...cur, item]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.phone.trim() || !form.email.trim()) {
      setError("Please fill in your business, name, phone and email.");
      return;
    }
    if (!form.consent) {
      setError("Please tick the box so we can call you about your line check.");
      return;
    }
    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("submit-business-lead", {
      body: {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        interest: "line_check",
        message: buildLineCheckMessage({ callTime, items }),
        source: "line_check",
        consent: true,
        utm: { ...(getCampaignUtmForSubmit() ?? {}), ...landingUtm },
      },
    });
    setSubmitting(false);
    if (fnError || !data?.ok) {
      setError(`Sorry, that didn't go through. Please try again or call ${CONTACT_PHONE_DISPLAY}.`);
      return;
    }
    window.gtag?.("event", "conversion", { send_to: "AW-18222446720/YOuSCLXKzMQcEIDxkfFD", value: 1.0, currency: "GBP" });
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const firstName = form.contact_name.trim().split(/\s+/)[0] ?? "";
  const when = CALL_TIMES.find((t) => t.value === callTime)?.confirm ?? "soon";

  return (
    <Layout>
      <SEO
        title="Free 15-minute landline switch-off check for businesses — OCCTA"
        description="Card machines, alarms, door entry and lift lines can stop working when your area's copper lines are switched off. Book a free 15-minute line check with OCCTA's UK team."
        canonical="/business/line-check"
      />

      <PosterStage>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6 lg:pt-4">
            <HeroKicker>Free line check · 15 minutes · no obligation</HeroKicker>
            <HeroTitle size="sm">
              {knownBusiness ? <>Is {knownBusiness} ready for the switch-off?</> : <>Is your business ready for the switch-off?</>}
            </HeroTitle>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Old copper phone lines are being switched off area by area, with Openreach aiming to finish by January 2027.
              Anything still using that line can stop working the day your exchange moves.
            </p>
            <ul className="mt-6 space-y-3 text-white/85">
              {[
                "We find what's on your line: phones, card machine, alarm, door entry, lift, fax",
                "We check what's available at your address",
                "You get a written quote only if something needs to move, and keep your number",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-primary text-black"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <a href={CONTACT_PHONE_TEL} className="mt-8 hidden items-center gap-3 text-white lg:inline-flex">
              <span className="inline-flex h-11 w-11 items-center justify-center bg-primary text-black"><Phone className="h-5 w-5" /></span>
              <span>
                <span className="block font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Rather talk now?</span>
                <span className="font-display text-3xl leading-none hover:underline">{CONTACT_PHONE_DISPLAY}</span>
              </span>
            </a>
          </div>

          <div className="lg:col-span-6">
            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-foreground bg-card p-6 text-foreground sm:p-8" style={LIGHT_SURFACE}>
                {done ? (
                  <div className="py-6 text-center" role="status">
                    <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-primary" />
                    <h2 className="font-display text-3xl uppercase">You're booked in{firstName ? `, ${firstName}` : ""}.</h2>
                    <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                      We'll call you {when} on <strong className="text-foreground">{form.phone}</strong>. It takes about 15 minutes.
                    </p>
                    <div className="mx-auto mt-6 max-w-md border-t-2 border-foreground/15 pt-5 text-left text-sm">
                      <p className="font-semibold">Handy to have nearby:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                        <li>A recent phone or broadband bill</li>
                        <li>Anything plugged into a phone socket (card machine, alarm panel, door entry, fax)</li>
                      </ul>
                    </div>
                    <p className="mt-6 text-sm text-muted-foreground">
                      Can't wait? Call <a href={CONTACT_PHONE_TEL} className="font-semibold text-foreground underline">{CONTACT_PHONE_DISPLAY}</a>, Mon–Fri 9am–6pm.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-5" noValidate>
                    <div>
                      <h2 className="font-display text-2xl uppercase sm:text-3xl">Book your free line check</h2>
                      <p className="mt-1 text-sm text-muted-foreground">We'll ring you back, usually within one working day.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="lc-company">Business name</Label>
                        <Input id="lc-company" autoComplete="organization" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="lc-name">Your name</Label>
                        <Input id="lc-name" autoComplete="name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="lc-phone">Phone</Label>
                        <Input id="lc-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="lc-email">Email</Label>
                        <Input id="lc-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
                      </div>
                    </div>

                    <fieldset>
                      <legend className="text-sm font-medium">Best time to call</legend>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {CALL_TIMES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            aria-pressed={callTime === t.value}
                            onClick={() => setCallTime(t.value)}
                            className={`border-[3px] px-2 py-2.5 text-sm font-semibold transition ${callTime === t.value ? "border-foreground bg-primary text-black" : "border-foreground/25 hover:border-foreground"}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="text-sm font-medium">What uses your phone line? <span className="font-normal text-muted-foreground">(optional)</span></legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {LINE_ITEMS.map((item) => {
                          const on = items.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleItem(item)}
                              className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 text-sm transition ${on ? "border-foreground bg-foreground text-background" : "border-foreground/25 hover:border-foreground"}`}
                            >
                              {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <label className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Checkbox checked={form.consent} onCheckedChange={(v) => update("consent", !!v)} className="mt-0.5" />
                      <span>OCCTA can call and email me about this line check. See our <a href="/privacy" className="underline">privacy notice</a>.</span>
                    </label>

                    {error && <p className="border-l-4 border-destructive bg-destructive/10 px-3 py-2 text-sm" role="alert">{error}</p>}

                    <Button type="submit" variant="hero" size="lg" disabled={submitting} className="w-full">
                      {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Booking…</> : "Book my free line check"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">Free and no obligation. We won't share your details.</p>
                  </form>
                )}
              </div>
            </TicketSlab>
            <a href={CONTACT_PHONE_TEL} className="mt-8 flex items-center justify-center gap-2 text-white/80 lg:hidden">
              <Phone className="h-4 w-4 text-primary" /> Rather talk now? <span className="font-semibold text-white underline">{CONTACT_PHONE_DISPLAY}</span>
            </a>
          </div>
        </div>
      </PosterStage>

      <BrandSection tone="paper">
        <div className="grid gap-10 md:grid-cols-3">
          {[
            { n: "01", t: "We list what's on your line", d: "Phones, card machine, alarm, door entry, lift line, fax. Most businesses have more on it than they think." },
            { n: "02", t: "We check your address", d: "What's available at your site, and whether your numbers can move with you." },
            { n: "03", t: "You decide", d: "If anything needs to change, you get a written quote with ex- and inc-VAT prices first. No hard sell." },
          ].map((s) => (
            <div key={s.n} className="border-t-[3px] border-foreground pt-5">
              <span className="font-display text-4xl text-foreground/30">{s.n}</span>
              <h3 className="mt-2 font-display text-2xl uppercase">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          OCCTA is not Openreach. Switch-off dates vary by exchange. Number porting is subject to eligibility. Compatibility of
          card machines, alarms and other third-party equipment must be confirmed with their supplier.
        </p>
      </BrandSection>
    </Layout>
  );
};

export default LineCheck;
