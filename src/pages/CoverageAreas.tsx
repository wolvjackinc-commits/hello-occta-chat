import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Search, Wifi, Smartphone, PhoneCall, Router } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, JsonLd, createBreadcrumbSchema } from "@/components/seo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { locations } from "@/data/locations";
import LeadCaptureWidget from "@/components/marketing/LeadCaptureWidget";

const productTiles = [
  { to: "/broadband", icon: Wifi, label: "Home broadband", copy: "Fibre from £34.99/mo. Flex 30 or Price Lock 24." },
  { to: "/sim", icon: Smartphone, label: "SIM plans", copy: "5G data on the UK's biggest network. Rolling monthly." },
  { to: "/landline", icon: PhoneCall, label: "Digital home phone", copy: "Keep your number. Works over fibre." },
  { to: "/help/own-router-setup", icon: Router, label: "Router & Wi-Fi", copy: "Free router included or bring your own." },
];

export default function CoverageAreas() {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const filtered = locations.filter(
      (l) => !q || l.city.toLowerCase().includes(q.toLowerCase()) || l.region.toLowerCase().includes(q.toLowerCase()),
    );
    const map = new Map<string, typeof locations>();
    filtered.forEach((l) => {
      const arr = map.get(l.region) ?? [];
      arr.push(l);
      map.set(l.region, arr);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [q]);

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Coverage areas", url: "/coverage-areas" },
  ]);

  return (
    <Layout>
      <SEO
        title="Broadband coverage areas — every UK region we serve"
        description="Find OCCTA fibre broadband, 5G SIM and digital home phone in your area. 50+ UK cities and towns, checked by postcode. Full fibre up to 900Mbps where available."
        canonical="/coverage-areas"
        keywords="broadband near me, uk broadband coverage, fibre broadband areas, occta coverage, broadband by city"
      />
      <JsonLd data={breadcrumb} />

      <section className="py-12 md:py-16 border-b-4 border-foreground bg-secondary">
        <div className="container mx-auto px-4 max-w-5xl">
          <span className="inline-block text-xs font-display uppercase tracking-[0.18em] text-primary mb-3">Coverage</span>
          <h1 className="font-display uppercase text-4xl md:text-6xl leading-[0.9] mb-4">Broadband in your area.</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-6">
            50+ UK cities and towns — fibre broadband, 5G SIM and digital home phone, checked by postcode.
            Not on the list? Enter your postcode below and we'll check for you.
          </p>

          <form
            className="flex flex-col sm:flex-row gap-2 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = `/build-plan?postcode=${encodeURIComponent(q)}`;
            }}
          >
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Enter a city, region or postcode"
                className="pl-9 h-12"
                aria-label="Search coverage"
              />
            </div>
            <Button type="submit" size="lg" className="font-display uppercase">
              <Search className="mr-2 h-4 w-4" /> Check availability
            </Button>
          </form>
        </div>
      </section>

      <section className="py-10">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="font-display uppercase text-xl mb-4">What's available with OCCTA</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {productTiles.map((t) => (
              <Link key={t.to} to={t.to} className="border-4 border-foreground p-4 bg-card hover:bg-secondary/40 transition-colors group">
                <t.icon className="h-6 w-6 text-primary mb-2" />
                <div className="font-display uppercase text-sm mb-1 group-hover:text-primary">{t.label}</div>
                <p className="text-sm text-muted-foreground">{t.copy}</p>
              </Link>
            ))}
          </div>

          {groups.length === 0 ? (
            <div className="border-4 border-foreground p-6 text-center">
              <p className="text-sm text-muted-foreground">No cities match "{q}". Try a postcode check instead.</p>
            </div>
          ) : (
            groups.map(([region, items]) => (
              <div key={region} className="mb-8">
                <h3 className="font-display uppercase text-sm text-muted-foreground mb-3">{region}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((l) => (
                    <Link
                      key={l.slug}
                      to={`/broadband-${l.slug}`}
                      className="border-2 border-foreground p-4 hover:bg-secondary/40 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display uppercase text-base group-hover:text-primary">{l.city}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Broadband · SIM · Voice</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="py-12 bg-secondary border-t-4 border-foreground">
        <div className="container mx-auto px-4 max-w-3xl">
          <LeadCaptureWidget
            source="coverage-areas"
            title="Postcode not listed? We'll check for you."
            description="Tell us your postcode and what you need — we'll come back with what's available at your address, usually within one working day."
          />
        </div>
      </section>
    </Layout>
  );
}