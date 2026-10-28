import { useEffect, useMemo, useState, type ReactNode } from "react";
import CategoryLinks from "@/components/seo/CategoryLinks";
import { Link, useNavigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { SEO, StructuredData, createServiceSchema, createBreadcrumbSchema, createFAQSchema } from "@/components/seo";
import { loadSimCatalogue, formatGbp, type SimPlanPublic, type SimSettingsPublic } from "@/lib/sim/catalogue";
import { Check, Smartphone, ArrowRight, ArrowDown } from "lucide-react";
import { BrandSection, HeroKicker, HeroTitle, PosterStage, Reveal, SectionEyebrow, SectionTitle, TicketSlab } from "@/components/brand/kit";
import { SimArt } from "@/components/brand/illustrations";

const simFaqs = [
  { question: 'Which networks do OCCTA SIMs use?', answer: 'OCCTA SIM plans are available on O2, Vodafone and EE — pick the coverage that works best at your address.' },
  { question: 'Can I keep my mobile number?', answer: 'Yes. Request a PAC code from your current provider and enter it during checkout to transfer your number.' },
  { question: 'Do you offer eSIM?', answer: 'Yes. Select eSIM at checkout on compatible devices and get connected without waiting for a physical SIM.' },
  { question: 'Is there a minimum term?', answer: '30-day rolling SIM plans are available alongside 24-month plans on eligible tariffs.' },
];

const FilterGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <div role="group" aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
    <span className="w-32 flex-shrink-0 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">{label}</span>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

const SimIndex = () => {
  const [plans, setPlans] = useState<SimPlanPublic[]>([]);
  const [settings, setSettings] = useState<SimSettingsPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<"consumer" | "business">("consumer");
  const [network, setNetwork] = useState<"all" | "O2" | "Vodafone" | "EE">("all");
  const [term, setTerm] = useState<"all" | "30_day" | "24_month">("all");
  const [category, setCategory] = useState<"all" | "single_user" | "mobile_broadband" | "promo_unlimited">("all");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    loadSimCatalogue().then(({ settings, plans }) => {
      if (cancelled) return;
      setSettings(settings);
      setPlans(plans);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const isOpen = !!settings?.standalone_enabled && plans.length > 0;

  const filtered = useMemo(() => plans.filter((p) =>
    p.customer_segment === segment
    && (network === "all" || p.source_network === network)
    && (term === "all" || p.term_type === term)
    && (category === "all" || p.plan_category === category)
  ), [plans, segment, network, term, category]);

  const pill = (active: boolean) =>
    `px-3 py-2 text-xs font-display uppercase tracking-wider border-[3px] border-foreground transition-colors ${active ? "bg-foreground text-background" : "bg-card hover:bg-primary hover:text-black"}`;

  return (
    <Layout>
      <SEO
        title="5G SIM Only Deals UK — Cheap SIM Plans"
        description="Affordable UK SIM only plans from OCCTA on O2, Vodafone and EE networks. eSIM or physical SIM. Keep your number with a PAC, or start fresh. Clear terms, honest pricing."
        canonical="/sim"
        keywords="SIM only deals UK, 5G SIM UK, cheap SIM only, eSIM UK, O2 SIM, Vodafone SIM, EE SIM, 30 day SIM plans UK, OCCTA SIM"
      />
      <StructuredData
        customSchema={{
          '@context': 'https://schema.org',
          '@graph': [
            createServiceSchema({
              name: 'OCCTA 5G SIM Plans',
              description: 'UK SIM only plans on O2, Vodafone and EE networks. 30-day rolling and 24-month options where eligible. eSIM or physical SIM.',
              url: '/sim',
            }),
            createBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'SIM Plans', url: '/sim' },
            ]),
            createFAQSchema(simFaqs),
          ],
        }}
      />
      <MotionConfig reducedMotion="user">
        <PosterStage ghost="SIM">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px] xl:gap-20">
            <div>
              <HeroKicker>SIM only</HeroKicker>
              <HeroTitle>
                <span className="sm:block">SIM only plans.</span>{" "}
                <span className="sm:block">Simple telecom.</span>{" "}
                {" "}<span className="block text-primary">Clear terms.</span>
              </HeroTitle>
              <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-white/70">
                eSIM or physical SIM. Keep your number or start fresh. Pay by Direct Debit or bank transfer.
                Your SIM is activated and confirmed before billing starts — no surprise charges.
              </p>
              <a
                href="#plans"
                className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-primary"
              >
                <span className="underline decoration-white/30 underline-offset-4 group-hover:decoration-primary">Choose a plan</span>
                <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </a>
            </div>

            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-white">
                <div className="flex items-center justify-center bg-secondary px-6 py-8">
                  <SimArt className="h-auto w-full max-w-[300px]" />
                </div>
                <ul className="border-t-[3px] border-black">
                  {["eSIM or physical SIM", "Keep your number or start fresh", "Direct Debit or bank transfer"].map((line) => (
                    <li key={line} className="flex items-center gap-3 border-b border-black/10 px-5 py-3 text-sm font-semibold text-black last:border-b-0">
                      <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-black text-primary" aria-hidden>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        <BrandSection id="plans" tone="paper">
          <Reveal>
            <SectionEyebrow index="01" label="Plans" />
            <SectionTitle className="mt-5">Choose a plan</SectionTitle>
          </Reveal>

          {!loading && isOpen && (
            <div className="mt-10 space-y-4 border-[3px] border-foreground bg-card p-4 sm:p-6">
              <FilterGroup label="I'm buying for">
                <button className={pill(segment === "consumer")} aria-pressed={segment === "consumer"} onClick={() => setSegment("consumer")}>Personal</button>
                <button className={pill(segment === "business")} aria-pressed={segment === "business"} onClick={() => setSegment("business")}>Business</button>
              </FilterGroup>
              <FilterGroup label="Network">
                {(["all", "O2", "Vodafone", "EE"] as const).map((n) => (
                  <button key={n} className={pill(network === n)} aria-pressed={network === n} onClick={() => setNetwork(n)}>{n === "all" ? "All" : n}</button>
                ))}
              </FilterGroup>
              <FilterGroup label="Term">
                <button className={pill(term === "all")} aria-pressed={term === "all"} onClick={() => setTerm("all")}>All</button>
                <button className={pill(term === "30_day")} aria-pressed={term === "30_day"} onClick={() => setTerm("30_day")}>30-day rolling</button>
                <button className={pill(term === "24_month")} aria-pressed={term === "24_month"} onClick={() => setTerm("24_month")}>24 months</button>
              </FilterGroup>
              <FilterGroup label="Type">
                <button className={pill(category === "all")} aria-pressed={category === "all"} onClick={() => setCategory("all")}>All</button>
                <button className={pill(category === "single_user")} aria-pressed={category === "single_user"} onClick={() => setCategory("single_user")}>Voice + data</button>
                <button className={pill(category === "mobile_broadband")} aria-pressed={category === "mobile_broadband"} onClick={() => setCategory("mobile_broadband")}>Mobile broadband</button>
                <button className={pill(category === "promo_unlimited")} aria-pressed={category === "promo_unlimited"} onClick={() => setCategory("promo_unlimited")}>Promo unlimited</button>
              </FilterGroup>
              <p className="border-t-2 border-foreground/10 pt-3 text-xs text-muted-foreground">
                {segment === "consumer"
                  ? "Consumer prices shown include VAT."
                  : "Business prices shown exclude VAT. VAT-compliant invoice provided."}
              </p>
            </div>
          )}

          {loading && (
            <div className="py-16 text-center text-muted-foreground">Loading plans…</div>
          )}

          {!loading && !isOpen && (
            <div className="mt-10 max-w-2xl border-[3px] border-foreground bg-card p-8 shadow-[8px_8px_0_0_hsl(var(--foreground))]">
              <h3 className="mb-2 font-display text-3xl uppercase leading-none">Order your SIM with our team</h3>
              <p className="mb-4 text-muted-foreground">
                Online plan listings are temporarily unavailable. Our UK team can take your SIM order by phone or email,
                recommend the best network for your area and arrange your number transfer.
              </p>
              <ul className="mb-5 space-y-1.5 text-sm">
                <li><strong>Call:</strong> <a href="tel:08002606626" className="underline">0800 260 6626</a> (Mon–Fri, 8am–6pm)</li>
                <li><strong>Email:</strong> <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a> with "SIM order" in the subject</li>
                <li><strong>Keeping your number?</strong> Text PAC to 65075 first and have the code ready.</li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <a href="tel:08002606626"><Button variant="hero">Call to order</Button></a>
                <Link to="/help/keep-your-mobile-number-pac"><Button variant="outline">Keeping your number</Button></Link>
              </div>
            </div>
          )}

          {!loading && isOpen && (
            <>
            {filtered.length === 0 && (
              <div className="mt-8 max-w-xl border-[3px] border-foreground bg-card p-6">
                <p className="text-sm text-muted-foreground">No plans match those filters. Try changing network or term.</p>
              </div>
            )}
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((plan) => (
                <article
                  key={plan.id}
                  className="group flex flex-col border-[3px] border-foreground bg-card transition-shadow duration-300 hover:shadow-[8px_8px_0_0_hsl(var(--foreground))]"
                >
                  <div className="flex items-start justify-between gap-3 border-b-[3px] border-foreground bg-primary px-5 py-4 text-black">
                    <h3 className="font-display text-2xl uppercase leading-none">{plan.name}</h3>
                    <span className="flex-shrink-0 border-2 border-black bg-white px-2 py-0.5 font-display text-lg leading-none">{plan.data_label}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-baseline gap-1">
                      <span className="font-display text-5xl leading-none">{formatGbp(plan.monthly_price_minor)}</span>
                      <span className="text-sm font-medium text-foreground/70">/mo</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {plan.vat_mode === "included" ? "(incl. VAT)" : "(ex VAT)"}
                      </span>
                    </div>
                    {plan.vat_mode === "excluded" && plan.retail_price_inc_vat_minor != null && (
                      <p className="mt-1 text-xs text-muted-foreground">{formatGbp(plan.retail_price_inc_vat_minor)}/mo incl. VAT</p>
                    )}
                    <ul className="mb-5 mt-4 flex-grow space-y-2 border-t-2 border-foreground/10 pt-4 text-sm">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 flex-shrink-0" />{plan.calls_label}</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 flex-shrink-0" />{plan.texts_label}</li>
                      {plan.esim_available && <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 flex-shrink-0" />eSIM available</li>}
                      <li className="flex items-center gap-2 text-muted-foreground">
                        {plan.is_rolling ? "Rolling monthly" : `${plan.min_term_months}-month term`}
                      </li>
                      {plan.plan_category === "promo_unlimited" && (
                        <li className="text-xs text-muted-foreground">Promo: port-in only. Fair usage applies.</li>
                      )}
                    </ul>
                    <Button
                      variant="hero"
                      className="w-full"
                      onClick={() => navigate(`/sim/checkout?plan_id=${plan.id}`)}
                    >
                      Get this SIM <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-xs text-muted-foreground">
              Available on selected O2, Vodafone or EE network options. All mobile plans are subject to network
              availability, fair usage policies and annual price adjustments. 24-month plans may have early
              termination charges. 30-day plans may have cease charges depending on the service and circumstances.
            </p>
            </>
          )}
        </BrandSection>

        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <Reveal>
            <SectionEyebrow index="02" label="Good to know" tone="yellow" />
            <SectionTitle className="mt-5">SIM questions, answered.</SectionTitle>
          </Reveal>
          <Reveal as="ol" className="mt-12 grid gap-[3px] border-[3px] border-black bg-black md:grid-cols-2">
            {simFaqs.map((faq, i) => (
              <li key={faq.question} className="bg-white p-6 text-black md:p-8">
                <span className="inline-flex h-7 min-w-7 items-center justify-center bg-black px-1.5 font-display text-sm leading-none text-primary">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 font-display text-2xl uppercase leading-none sm:text-3xl">{faq.question}</h3>
                <p className="mt-3 text-sm leading-relaxed text-black/70">{faq.answer}</p>
              </li>
            ))}
          </Reveal>
        </BrandSection>
        <CategoryLinks family="sim" />
      </MotionConfig>
    </Layout>
  );
};

export default SimIndex;
