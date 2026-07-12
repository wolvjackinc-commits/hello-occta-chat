import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { SEO, StructuredData, createServiceSchema, createBreadcrumbSchema, createFAQSchema } from "@/components/seo";
import { loadSimCatalogue, formatGbp, type SimPlanPublic, type SimSettingsPublic } from "@/lib/sim/catalogue";
import { Check, Signal, Smartphone, ArrowRight } from "lucide-react";

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
    `px-3 py-1.5 text-xs font-display uppercase border-2 border-foreground ${active ? "bg-foreground text-background" : "bg-card"}`;

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
            createFAQSchema([
              { question: 'Which networks do OCCTA SIMs use?', answer: 'OCCTA SIM plans are available on O2, Vodafone and EE — pick the coverage that works best at your address.' },
              { question: 'Can I keep my mobile number?', answer: 'Yes. Request a PAC code from your current provider and enter it during checkout to transfer your number.' },
              { question: 'Do you offer eSIM?', answer: 'Yes. Select eSIM at checkout on compatible devices and get connected without waiting for a physical SIM.' },
              { question: 'Is there a minimum term?', answer: '30-day rolling SIM plans are available alongside 24-month plans on eligible tariffs.' },
            ]),
          ],
        }}
      />
      <section className="min-h-[60vh] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <div className="inline-block stamp text-accent border-accent mb-4">
              <Signal className="w-4 h-4 inline mr-2" />
              SIM only
            </div>
            <h1 className="text-5xl md:text-6xl font-display uppercase leading-[0.95] mb-4">
              SIM plans. Simple telecom.<br /><span className="text-gradient">Clear terms.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
              eSIM or physical SIM. Keep your number or start fresh. Card or Direct Debit.
              Admin activates your service before billing starts — no surprise charges.
            </p>
          </div>
        </div>
      </section>

      <section id="plans" className="py-12 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <h2 className="text-display-md mb-4">Choose a plan</h2>

          {!loading && isOpen && (
            <div className="mb-6 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs uppercase text-muted-foreground mr-2">I'm buying for</span>
                <button className={pill(segment === "consumer")} onClick={() => setSegment("consumer")}>Personal</button>
                <button className={pill(segment === "business")} onClick={() => setSegment("business")}>Business</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs uppercase text-muted-foreground mr-2">Network</span>
                {(["all", "O2", "Vodafone", "EE"] as const).map((n) => (
                  <button key={n} className={pill(network === n)} onClick={() => setNetwork(n)}>{n === "all" ? "All" : n}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs uppercase text-muted-foreground mr-2">Term</span>
                <button className={pill(term === "all")} onClick={() => setTerm("all")}>All</button>
                <button className={pill(term === "30_day")} onClick={() => setTerm("30_day")}>30-day rolling</button>
                <button className={pill(term === "24_month")} onClick={() => setTerm("24_month")}>24 months</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs uppercase text-muted-foreground mr-2">Type</span>
                <button className={pill(category === "all")} onClick={() => setCategory("all")}>All</button>
                <button className={pill(category === "single_user")} onClick={() => setCategory("single_user")}>Voice + data</button>
                <button className={pill(category === "mobile_broadband")} onClick={() => setCategory("mobile_broadband")}>Mobile broadband</button>
                <button className={pill(category === "promo_unlimited")} onClick={() => setCategory("promo_unlimited")}>Promo unlimited</button>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {segment === "consumer"
                  ? "Consumer prices shown include VAT."
                  : "Business prices shown exclude VAT. VAT-compliant invoice provided."}
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-16 text-muted-foreground">Loading plans…</div>
          )}

          {!loading && !isOpen && (
            <div className="card-brutal bg-card p-8 max-w-2xl">
              <h3 className="font-display text-2xl mb-2 uppercase">Not currently available</h3>
              <p className="text-muted-foreground mb-4">
                SIM-only plans are not open for online ordering right now. Our team can confirm
                current availability and options for you.
              </p>
              <Link to="/support"><Button variant="hero">Contact support</Button></Link>
            </div>
          )}

          {!loading && isOpen && (
            <>
            {filtered.length === 0 && (
              <div className="card-brutal bg-card p-6 max-w-xl">
                <p className="text-sm text-muted-foreground">No plans match those filters. Try changing network or term.</p>
              </div>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((plan) => (
                <div key={plan.id} className="card-brutal bg-card p-5 flex flex-col">
                  <h3 className="font-display text-2xl mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-4xl">{formatGbp(plan.monthly_price_minor)}</span>
                    <span className="text-foreground/70 text-sm font-medium">/mo</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {plan.vat_mode === "included" ? "(incl. VAT)" : "(ex VAT)"}
                    </span>
                  </div>
                  {plan.vat_mode === "excluded" && plan.retail_price_inc_vat_minor != null && (
                    <p className="text-xs text-muted-foreground -mt-1 mb-2">{formatGbp(plan.retail_price_inc_vat_minor)}/mo incl. VAT</p>
                  )}
                  <div className="inline-block px-2 py-1 bg-accent border-2 border-foreground mb-3 w-fit">
                    <span className="font-display text-lg text-accent-foreground">{plan.data_label}</span>
                  </div>
                  <ul className="space-y-1.5 mb-4 flex-grow text-sm">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{plan.calls_label}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{plan.texts_label}</li>
                    {plan.esim_available && <li className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-primary" />eSIM available</li>}
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
                    Get this SIM <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-6 max-w-3xl">
              Available on selected O2, Vodafone or EE network options. All mobile plans are subject to network
              availability, fair usage policies and annual price adjustments. 24-month plans may have early
              termination charges. 30-day plans may have cease charges depending on the service and circumstances.
            </p>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default SimIndex;