import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ArrowRight, Check, Smartphone } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import PostcodeChecker from "@/components/home/PostcodeChecker";
import { AvailabilityProvider } from "@/contexts/AvailabilityContext";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import NotFound from "@/pages/NotFound";
import { getProductLandingBySlug, type ProductLanding, type SimPlanFilter } from "@/data/productLandings";
import { CHARGED_PRICES } from "@/lib/pricing/chargedPrices";
import { getFromPrices, getRetailBroadbandCards } from "@/lib/pricing/engine";
import { businessBroadband, businessVoice, type BusinessProduct } from "@/lib/business/catalogue";
import { loadSimCatalogue, formatGbp, type SimPlanPublic } from "@/lib/sim/catalogue";

const SITE = "https://www.occta.co.uk";
const BAND_LABEL: Record<string, string> = { essential: "Essential", superfast: "Superfast", ultrafast: "Ultrafast", gigabit: "Gigabit" };
const BAND_SPEED: Record<string, string> = { essential: "Up to 80Mbps", superfast: "Up to 330Mbps", ultrafast: "Up to 550Mbps", gigabit: "Up to 1000Mbps" };

function priceTokens(): Record<string, string> {
  const from = getFromPrices();
  const voip = businessVoice.find((p) => p.id === "biz-voip-seat")?.priceExVat;
  const sip = businessVoice.find((p) => p.id === "biz-sip-trunk")?.priceExVat;
  const tokens: Record<string, string> = {
    bb: `£${from.broadband}`,
    sim: `£${from.sim}`,
    landline: `£${from.landline}`,
    voip: voip != null ? `£${voip.toFixed(2)}` : "",
    sip: sip != null ? `£${sip.toFixed(2)}` : "",
  };
  for (const [band, price] of Object.entries(CHARGED_PRICES)) {
    tokens[band] = `£${price.lock24.toFixed(2)}`;
    tokens[`${band}Flex`] = `£${price.flex30.toFixed(2)}`;
  }
  return tokens;
}

/** Replaces {token} placeholders throughout a landing definition. */
function fill(page: ProductLanding, tokens: Record<string, string>): ProductLanding {
  const sub = (value: unknown): unknown => {
    if (typeof value === "string") return value.replace(/\{(\w+)\}/g, (m, key) => tokens[key] ?? m);
    if (Array.isArray(value)) return value.map(sub);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sub(v)]));
    return value;
  };
  return sub(page) as ProductLanding;
}

function matchesSim(plan: SimPlanPublic, filter: SimPlanFilter): boolean {
  if (plan.customer_segment !== "consumer") return false;
  if (filter.networks && !filter.networks.includes(plan.source_network ?? "")) return false;
  if (filter.term && plan.term_type !== filter.term) return false;
  if (filter.categories && !filter.categories.includes(plan.plan_category ?? "single_user")) return false;
  if (filter.unlimitedOnly && !/unlimited/i.test(plan.data_label)) return false;
  if (filter.esimOnly && !plan.esim_available) return false;
  return true;
}

const priceIncVat = (plan: SimPlanPublic) => plan.retail_price_inc_vat_minor ?? plan.monthly_price_minor;

function useSimPlans(filter?: SimPlanFilter) {
  const [state, setState] = useState<{ loading: boolean; plans: SimPlanPublic[] }>({ loading: !!filter, plans: [] });
  useEffect(() => {
    if (!filter) return;
    let cancelled = false;
    loadSimCatalogue()
      .then(({ settings, plans }) => {
        if (cancelled) return;
        const open = !!settings?.standalone_enabled;
        const matched = open ? plans.filter((p) => matchesSim(p, filter)).sort((a, b) => priceIncVat(a) - priceIncVat(b)) : [];
        setState({ loading: false, plans: matched });
      })
      .catch(() => !cancelled && setState({ loading: false, plans: [] }));
    return () => {
      cancelled = true;
    };
  }, [filter]);
  return state;
}

const BandCards = ({ bands }: { bands: string[] }) => {
  const cards = getRetailBroadbandCards().filter((c) => bands.includes(c.id));
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <article key={card.id} className="flex flex-col border-[3px] border-foreground bg-card">
          <div className="border-b-[3px] border-foreground bg-primary px-5 py-4 text-black">
            <h3 className="font-display text-3xl uppercase leading-none">{BAND_LABEL[card.id]}</h3>
            <p className="mt-1 text-sm font-semibold">{BAND_SPEED[card.id]}</p>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Price Lock 24</p>
            <p className="mt-1"><span className="font-display text-5xl leading-none">£{card.fromPrice}</span><span className="text-sm text-foreground/70">/mo incl. VAT</span></p>
            {card.flex30Price && <p className="mt-2 text-sm text-foreground/70">Flex 30: £{card.flex30Price}/mo where eligible</p>}
            <p className="mt-4 text-xs text-muted-foreground">Availability, speed estimate and any one-off charges confirmed for your address before you accept.</p>
          </div>
        </article>
      ))}
    </div>
  );
};

const SimPlanList = ({ loading, plans }: { loading: boolean; plans: SimPlanPublic[] }) => {
  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading plans…</div>;
  if (!plans.length) {
    return (
      <p className="mt-8 max-w-xl border-[3px] border-foreground bg-card p-6 text-sm text-muted-foreground">
        These plans aren't open for online ordering right now. See <Link className="underline" to="/sim">all SIM plans</Link> or contact our team.
      </p>
    );
  }
  return (
    <div className="mt-8 overflow-x-auto border-[3px] border-foreground">
      <table className="w-full min-w-[560px] bg-card text-left text-sm">
        <caption className="sr-only">Current OCCTA SIM plans and monthly prices including VAT</caption>
        <thead className="bg-foreground font-display uppercase tracking-wide text-background">
          <tr>
            <th scope="col" className="px-4 py-3">Network</th>
            <th scope="col" className="px-4 py-3">Data</th>
            <th scope="col" className="px-4 py-3">Calls &amp; texts</th>
            <th scope="col" className="px-4 py-3">Term</th>
            <th scope="col" className="px-4 py-3">Monthly</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Order</span></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id} className="border-t-2 border-foreground/10">
              <td className="px-4 py-3 font-semibold">{plan.network_display_name ?? plan.source_network}</td>
              <td className="px-4 py-3">{plan.data_label}{plan.esim_available && <Smartphone aria-label="eSIM available" className="ml-2 inline h-4 w-4" />}</td>
              <td className="px-4 py-3">{plan.calls_label === plan.texts_label ? plan.calls_label : `${plan.calls_label}, ${plan.texts_label}`}</td>
              <td className="px-4 py-3">{plan.is_rolling ? "30-day rolling" : `${plan.min_term_months} months`}</td>
              <td className="px-4 py-3 font-display text-2xl">{formatGbp(priceIncVat(plan))}</td>
              <td className="px-4 py-3"><Link className="font-semibold underline" to={`/sim/checkout?plan_id=${plan.id}`}>Choose</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t-2 border-foreground/10 bg-card px-4 py-3 text-xs text-muted-foreground">Prices include VAT. Fair usage and annual price adjustments apply; any cease or early termination charge is shown before you order.</p>
    </div>
  );
};

const BusinessCards = ({ ids }: { ids: string[] }) => {
  const all: BusinessProduct[] = [...businessBroadband, ...businessVoice];
  const products = ids.map((id) => all.find((p) => p.id === id)).filter((p): p is BusinessProduct => !!p);
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <article key={p.id} className="flex flex-col border-[3px] border-foreground bg-card">
          <div className="border-b-[3px] border-foreground bg-primary px-5 py-4 text-black">
            <h3 className="font-display text-2xl uppercase leading-none">{p.name}</h3>
            {p.speed && <p className="mt-1 text-sm font-semibold">{p.speed}</p>}
          </div>
          <div className="flex flex-1 flex-col p-5">
            <p className="font-display text-3xl leading-none">
              {p.pricingMode === "quote" || p.priceExVat == null ? "Priced by quote" : <>From £{p.priceExVat.toFixed(2)}<span className="text-sm text-foreground/70">{p.unit} ex VAT</span></>}
            </p>
            <p className="mt-3 text-sm text-foreground/75">{p.summary}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0" />{f}</li>)}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
};

function offerSchema(page: ProductLanding, simPlans: SimPlanPublic[]) {
  const url = `${SITE}/${page.slug}`;
  const provider = { "@type": "Organization", name: "OCCTA LIMITED", url: `${SITE}/` };
  const base = { "@type": "Service", name: page.breadcrumb, description: page.metaDescription, url, provider, areaServed: { "@type": "Country", name: "United Kingdom" } };
  if (page.bands?.length) {
    const prices = page.bands.map((b) => CHARGED_PRICES[b].lock24);
    return {
      ...base,
      serviceType: "Broadband",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "GBP",
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
        offerCount: page.bands.length,
        offers: page.bands.map((b) => ({
          "@type": "Offer",
          name: `OCCTA ${BAND_LABEL[b]} broadband (${BAND_SPEED[b]}) — Price Lock 24`,
          price: CHARGED_PRICES[b].lock24.toFixed(2),
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
          url,
        })),
      },
    };
  }
  if (simPlans.length) {
    const prices = simPlans.map((p) => priceIncVat(p) / 100);
    return {
      ...base,
      serviceType: "Mobile SIM only plan",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "GBP",
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
        offerCount: simPlans.length,
      },
    };
  }
  if (page.businessProducts?.length) {
    const priced = [...businessBroadband, ...businessVoice].filter((p) => page.businessProducts!.includes(p.id) && p.pricingMode !== "quote" && p.priceExVat != null);
    return {
      ...base,
      serviceType: "Business telecoms",
      ...(priced.length
        ? { offers: priced.map((p) => ({ "@type": "Offer", name: p.name, price: p.priceExVat!.toFixed(2), priceCurrency: "GBP", priceSpecification: { "@type": "UnitPriceSpecification", price: p.priceExVat!.toFixed(2), priceCurrency: "GBP", valueAddedTaxIncluded: false }, url })) }
        : {}),
    };
  }
  return base;
}

const ProductLandingPage = () => {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\/|\/$/g, "");
  const raw = getProductLandingBySlug(slug);
  const page = useMemo(() => (raw ? fill(raw, priceTokens()) : undefined), [raw]);
  const sim = useSimPlans(raw?.simFilter);

  if (!page) return <NotFound />;

  const familyCrumb =
    page.family === "sim" ? { name: "SIM Plans", url: "/sim" } : page.family === "business" ? { name: "Business", url: "/business" } : { name: "Broadband", url: "/broadband" };
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      offerSchema(page, sim.plans),
      createBreadcrumbSchema([{ name: "Home", url: "/" }, familyCrumb, { name: page.breadcrumb, url: `/${page.slug}` }]),
      createFAQSchema(page.faqs),
    ],
  };

  return (
    <Layout>
      <SEO title={page.metaTitle} description={page.metaDescription} canonical={`/${page.slug}`} keywords={page.keywords} />
      <StructuredData customOnly customSchema={schema} />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: familyCrumb.name, to: familyCrumb.url }, { label: page.breadcrumb }]} />
          <div className="max-w-3xl">
            <HeroKicker>{page.kicker}</HeroKicker>
            <HeroTitle size="md">
              {page.heroTitle} <span className="block text-primary">{page.heroHighlight}</span>
            </HeroTitle>
            <p className="mb-8 mt-6 max-w-2xl text-lg leading-relaxed text-white/70">{page.heroSubtitle}</p>
            {page.family === "broadband" ? (
              <PostcodeChecker variant="hero" />
            ) : (
              <Link to={page.cta.to}>
                <Button variant="hero" size="lg">{page.cta.button} <ArrowRight className="h-5 w-5" /></Button>
              </Link>
            )}
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          <Reveal>
            <SectionEyebrow index="01" label={page.family === "sim" ? "Live plans" : page.family === "business" ? "Products" : "Prices"} />
            <SectionTitle className="mt-5">{page.breadcrumb}</SectionTitle>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-foreground/80">{page.intro}</p>
          </Reveal>
          {page.bands && <BandCards bands={page.bands} />}
          {page.simFilter && <SimPlanList loading={sim.loading} plans={sim.plans} />}
          {page.businessProducts && <BusinessCards ids={page.businessProducts} />}
        </BrandSection>

        <BrandSection tone="paper" className="border-t-[3px] border-foreground">
          <div className="mx-auto max-w-4xl">
            {page.sections.map((section, i) => (
              <Reveal key={section.heading} className="grid gap-4 border-t-[3px] border-foreground py-10 first:border-t-0 first:pt-0 sm:grid-cols-[5.5rem_1fr]">
                <span aria-hidden className="font-display text-5xl leading-[0.8] text-foreground/25 sm:text-7xl">{String(i + 2).padStart(2, "0")}</span>
                <div>
                  <h2 className="font-display text-3xl uppercase leading-[0.95] md:text-4xl">{section.heading}</h2>
                  {section.paragraphs.map((p) => <p key={p} className="mt-4 text-base leading-relaxed text-foreground/75">{p}</p>)}
                  {section.bullets && (
                    <ul className="mt-5 space-y-2">
                      {section.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-black text-primary" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                          <span className="text-foreground/80">{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </BrandSection>

        <BrandSection tone="dark">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <SectionEyebrow index="Q" label="Questions" tone="dark" />
              <SectionTitle className="mt-5">{page.breadcrumb}: your questions</SectionTitle>
            </Reveal>
            <Accordion type="single" collapsible className="border-t-[3px] border-white/25">
              {page.faqs.map((faq, i) => (
                <AccordionItem key={faq.question} value={`faq-${i}`} className="border-b-[3px] border-white/25">
                  <AccordionTrigger className="py-5 text-left font-display text-xl uppercase leading-tight text-white hover:text-primary hover:no-underline sm:text-2xl">{faq.question}</AccordionTrigger>
                  <AccordionContent className="pb-6 text-base leading-relaxed text-white/75">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </BrandSection>

        <BrandSection tone="paper">
          <Reveal>
            <SectionEyebrow index="→" label="Keep reading" />
            <nav aria-label="Related pages" className="mt-6">
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {page.related.map((r) => (
                  <li key={r.to}>
                    <Link to={r.to} className="flex items-center justify-between border-[3px] border-foreground bg-card px-5 py-4 font-display text-lg uppercase hover:bg-primary hover:text-black">
                      {r.label} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>
        </BrandSection>

        <BrandSection tone="yellow" className="border-t-[3px] border-black">
          <Reveal className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">{page.cta.title}</h2>
              <p className="mt-4 max-w-xl text-lg text-black/75">{page.cta.text}</p>
            </div>
            <Link to={page.cta.to}>
              <Button size="lg" className="h-14 border-[3px] border-black bg-black px-8 font-display text-lg uppercase text-primary hover:bg-white hover:text-black">
                {page.cta.button} <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

const ProductLanding = () => (
  <AvailabilityProvider>
    <ProductLandingPage />
  </AvailabilityProvider>
);

export default ProductLanding;
