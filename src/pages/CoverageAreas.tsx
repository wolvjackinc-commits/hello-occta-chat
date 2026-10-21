import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Search, Wifi, Smartphone, PhoneCall, Router, CheckCircle2, Sparkles } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, JsonLd, createBreadcrumbSchema } from "@/components/seo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { locations } from "@/data/locations";
import { slugForPostcode, extractPostcodeArea } from "@/data/postcodeAreas";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";
import { MotionConfig, motion } from "framer-motion";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { AddressPinArt } from "@/components/brand/illustrations";

const productTiles = [
  { to: "/broadband", icon: Wifi, label: "Home broadband", copy: "Fibre from £34.99/mo. Flex 30 or Price Lock 24." },
  { to: "/sim", icon: Smartphone, label: "SIM plans", copy: "5G SIM plans on O2, Vodafone or EE networks. Rolling monthly." },
  { to: "/landline", icon: PhoneCall, label: "Digital home phone", copy: "Keep your number. Works over fibre." },
  { to: "/help/own-router-setup", icon: Router, label: "Router & Wi-Fi", copy: "Buy ours one-off or monthly, or bring your own." },
];

export default function CoverageAreas() {
  const [q, setQ] = useState("");

  const postcodeMatch = useMemo(() => {
    const area = extractPostcodeArea(q);
    if (!area) return null;
    const slug = slugForPostcode(q);
    const location = slug ? locations.find((l) => l.slug === slug) : null;
    return { area, slug, location };
  }, [q]);

  const { ranked, groups } = useMemo(() => {
    const query = q.trim().toLowerCase();
    const matchedSlug = postcodeMatch?.slug ?? null;

    // Rank: postcode-matched city first, then text matches, then everything else.
    const scored = locations
      .map((l) => {
        let score = 0;
        if (matchedSlug && l.slug === matchedSlug) score += 100;
        if (query && (l.city.toLowerCase().includes(query) || l.region.toLowerCase().includes(query))) score += 40;
        if (query && l.city.toLowerCase().startsWith(query)) score += 10;
        return { location: l, score };
      })
      .filter((r) => !query || r.score > 0 || postcodeMatch)
      .sort((a, b) => b.score - a.score || a.location.city.localeCompare(b.location.city));

    const ranked = scored.slice(0, 12).map((r) => r.location);

    const map = new Map<string, typeof locations>();
    scored.forEach(({ location: l }) => {
      const arr = map.get(l.region) ?? [];
      arr.push(l);
      map.set(l.region, arr);
    });
    const groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { ranked, groups };
  }, [q, postcodeMatch]);

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Coverage areas", url: "/coverage-areas" },
  ]);

  return (
    <Layout>
      <SEO
        title="Broadband coverage areas — every UK region we serve"
        description="Find OCCTA broadband, SIM and Digital Voice by postcode across 50 UK cities. The checker confirms the address-specific service before you accept."
        canonical="/coverage-areas"
        keywords="broadband near me, uk broadband coverage, fibre broadband areas, occta coverage, broadband by city"
      />
      <JsonLd data={breadcrumb} />

      <MotionConfig reducedMotion="user">
      <PosterStage ghost="UK">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Coverage areas" }]} />
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-20">
          <div>
            <HeroKicker>Coverage</HeroKicker>
            <HeroTitle>
              Broadband in
              {" "}<span className="block text-primary">your area.</span>
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              50+ UK cities and towns — fibre broadband, 5G SIM and digital home phone, checked by postcode.
              Not on the list? Enter your postcode below and we'll check for you.
            </p>
            <form
              className="mt-8 flex max-w-[640px] flex-col border-[3px] border-white bg-white/[0.04] transition-colors focus-within:border-primary sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `/order`;
              }}
            >
              <div className="relative flex-1">
                <MapPin className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Enter a city, region or postcode"
                  className="h-16 border-0 bg-transparent pl-14 text-lg text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                  aria-label="Search coverage"
                />
              </div>
              <Button type="submit" size="lg" className="h-16 border-0 border-t-[3px] border-white px-7 font-display text-lg uppercase shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-white hover:shadow-none sm:border-l-[3px] sm:border-t-0">
                <Search className="mr-2 h-4 w-4" /> Check availability
              </Button>
            </form>
          </div>
          <div className="hidden border-[3px] border-white bg-white p-3 lg:block">
            <AddressPinArt />
          </div>
        </div>

        {postcodeMatch && (
          <TicketSlab className="mt-10 mr-3 mb-3 max-w-4xl">
            <div className="border-[3px] border-white bg-[hsl(0_0%_8%)] p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Best match for {postcodeMatch.area}
              </div>
              {postcodeMatch.location ? (
                <>
                  <h2 className="font-display text-4xl uppercase leading-none text-white">{postcodeMatch.location.city}</h2>
                  <p className="mt-2 mb-5 text-sm text-white/65">{postcodeMatch.location.region} · Fibre, 5G SIM and Digital Home Phone available at most addresses.</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { to: `/broadband-${postcodeMatch.location.slug}`, icon: Wifi, label: "Broadband here" },
                      { to: "/sim", icon: Smartphone, label: "SIM plans" },
                      { to: "/routers", icon: Router, label: "Router options" },
                      { to: "/landline", icon: PhoneCall, label: "Digital voice" },
                    ].map((t) => (
                      <Link key={t.to} to={t.to} className="flex items-center gap-2 border-2 border-white/25 p-3 text-white transition-colors hover:border-primary hover:text-primary">
                        <t.icon className="h-4 w-4 text-primary" />
                        <span className="font-display text-base uppercase leading-none">{t.label}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-white/55">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Availability confirmed in-flow — final speeds shown at your exact address.
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm text-white/75">We don't have a dedicated page for the <strong className="text-white">{postcodeMatch.area}</strong> area yet, but coverage is likely — Openreach fibre reaches most UK postcodes.</p>
                  <Button asChild size="sm" variant="hero" className="font-display uppercase">
                    <Link to={`/order`}>Run a full check</Link>
                  </Button>
                </>
              )}
            </div>
          </TicketSlab>
        )}
      </PosterStage>

      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="Services" />
          <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">
            {q ? `Top matches${postcodeMatch ? ` for ${postcodeMatch.area}` : ""}` : "What's available with OCCTA"}
          </h2>
        </Reveal>
        <Reveal stagger className="mt-8 mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {productTiles.map((t) => (
            <motion.div key={t.to} variants={revealItem}>
              <Link to={t.to} className="group flex h-full flex-col border-[3px] border-foreground bg-card p-5 transition-shadow duration-300 hover:shadow-[8px_8px_0_0_hsl(var(--foreground))]">
                <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black"><t.icon className="h-5 w-5" /></span>
                <div className="mt-4 font-display text-2xl uppercase leading-none">{t.label}</div>
                <p className="mt-2 text-sm text-muted-foreground">{t.copy}</p>
              </Link>
            </motion.div>
          ))}
        </Reveal>

        {q && ranked.length > 0 && (
          <div className="mb-14">
            <h3 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/60">Ranked by relevance</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ranked.map((l, idx) => (
                <Link
                  key={l.slug}
                  to={`/broadband-${l.slug}`}
                  className={`group flex items-center justify-between border-[3px] p-4 transition-colors hover:bg-black hover:text-primary ${idx === 0 && postcodeMatch?.slug === l.slug ? "border-black bg-primary text-black" : "border-foreground bg-card"}`}
                >
                  <div>
                    <div className="font-display text-xl uppercase leading-none">{l.city}</div>
                    <div className="mt-1 text-xs opacity-70">{l.region}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="border-[3px] border-dashed border-foreground/40 bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No cities match "{q}". Try a postcode check instead.</p>
          </div>
        ) : (
          <div className="columns-1 gap-10 sm:columns-2 lg:columns-3">
            {groups.map(([region, items]) => (
              <div key={region} className="mb-10 break-inside-avoid">
                <h3 className="border-b-[3px] border-foreground pb-2 font-display text-2xl uppercase leading-none">{region}</h3>
                <ul>
                  {items.map((l) => (
                    <li key={l.slug} className="border-b-2 border-foreground/10">
                      <Link to={`/broadband-${l.slug}`} className="group flex items-center justify-between py-2.5">
                        <span>
                          <span className="block font-display text-lg uppercase leading-none group-hover:underline group-hover:decoration-primary group-hover:decoration-[3px] group-hover:underline-offset-4">{l.city}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">Broadband · SIM · Voice</span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </BrandSection>

      <BrandSection tone="yellow" className="border-t-[3px] border-black">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal>
            <SectionEyebrow index="02" label="Not listed?" tone="yellow" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">We'll check for you</h2>
          </Reveal>
          <div className="border-[3px] border-black bg-white text-black">
            <LeadCaptureWidget
              source="coverage-areas"
              title="Postcode not listed? We'll check for you."
              description="Tell us your postcode and what you need — we'll come back with what's available at your address, usually within one working day."
            />
          </div>
        </div>
      </BrandSection>
      </MotionConfig>
    </Layout>
  );
}