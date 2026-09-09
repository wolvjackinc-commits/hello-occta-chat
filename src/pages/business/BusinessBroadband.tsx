import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { businessBroadband } from "@/lib/business/catalogue";
import VatExPrice from "@/components/business/VatExPrice";
import BusinessTrustBar from "@/components/business/BusinessTrustBar";
import LeadForm from "@/components/business/LeadForm";
import { ArrowRight, CheckCircle2, ShieldCheck, Workflow } from "lucide-react";

const BusinessBroadbandPage = () => (
  <Layout>
    <SEO
      title="Business Broadband UK — SoGEA, Full Fibre, Gigabit & Leased Lines"
      description="Business broadband from £34.99/mo ex VAT (£41.99 inc VAT). Address-led quoting for SoGEA, full fibre up to 1Gb and dedicated connectivity, with final network, setup and care terms confirmed before order."
      canonical="/business/broadband"
      keywords="business broadband UK, business fibre broadband, sogea business, gigabit business broadband, leased line UK, static IP broadband"
    />

    <section className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14 lg:py-20 grid lg:grid-cols-5 gap-8 items-center">
        <div className="lg:col-span-3">
          <div className="inline-flex items-center gap-2 border-4 border-foreground bg-primary text-primary-foreground px-3 py-1 font-display uppercase tracking-wider text-sm mb-5">
            <ShieldCheck className="w-4 h-4" /> Business pricing protected by supplier-cost checks
          </div>
          <h1 className="font-display text-5xl lg:text-7xl leading-[0.95] mb-5">Business broadband without a loss-leading surprise.</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mb-7">
            Choose the capacity you need, check the service address and let OCCTA match the safest available network route. We show both ex-VAT and inc-VAT pricing and confirm setup, router, care level and any cease or migration charges before you accept a contract.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/business/quote?service=broadband"><Button variant="hero" size="lg">Check address & build quote <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            <Link to="/business/contact-sales"><Button variant="outline" size="lg">Complex or multi-site?</Button></Link>
          </div>
        </div>
        <div className="lg:col-span-2 border-4 border-foreground bg-secondary p-6 shadow-brutal">
          <div className="font-display text-2xl mb-2">Business Switch Pack</div>
          <p className="text-sm text-muted-foreground mb-4">Designed to remove avoidable upfront friction without hiding network costs.</p>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> £0 standard network connection where the selected supplier/term genuinely waives it.</li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> No automatic substitution to a different plan, network price or term.</li>
            <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> Router, static IP, enhanced care and continuity are optional and itemised.</li>
          </ul>
        </div>
      </div>
    </section>

    <BusinessTrustBar />

    <section className="container mx-auto px-4 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display text-4xl">Choose a capacity band</h2>
          <p className="text-muted-foreground mt-2 max-w-3xl">These are OCCTA marketing anchors, not a promise that every carrier is available at every address. The quote engine and final contract use the current supplier catalogue.</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {businessBroadband.map((p) => (
          <div key={p.id} className="border-4 border-foreground bg-background p-6 shadow-brutal flex flex-col">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">{p.speed}</div>
            <h3 className="font-display text-2xl mb-1">{p.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{p.summary}</p>
            {p.priceExVat != null ? (
              <>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">From</div>
                <VatExPrice amount={p.priceExVat} unit={p.unit} size="lg" />
              </>
            ) : (
              <div className="border-2 border-foreground bg-secondary px-4 py-3">
                <div className="font-display text-2xl">Site-specific quote</div>
                <div className="text-xs text-muted-foreground mt-1">{p.quoteReason}</div>
              </div>
            )}
            <ul className="mt-5 space-y-2 text-sm flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {f}</li>
              ))}
            </ul>
            <Link to={`/business/quote?service=broadband&tier=${encodeURIComponent(p.id)}`} className="mt-6">
              <Button variant="hero" className="w-full">{p.pricingMode === "quote" ? "Request site quote" : "Check availability & quote"}</Button>
            </Link>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
        <strong>Pricing note:</strong> monthly figures above are base broadband prices ex VAT with the inc-VAT equivalent shown alongside. Exact speeds, network, minimum term, activation/installation, router, optional care and other charges depend on the service address and selected route. Network cease or migration-away charges and early termination charges can apply and are shown in the Contract Summary before acceptance.
      </p>
    </section>

    <section className="border-y-4 border-foreground bg-secondary">
      <div className="container mx-auto px-4 py-14">
        <div className="flex items-center gap-3 mb-8">
          <Workflow className="w-8 h-8 text-primary" />
          <h2 className="font-display text-4xl">How a business order moves</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["01", "Address check", "Select the exact service address and the capacity you want."],
            ["02", "Commercial qualification", "OCCTA checks available speed, current supplier economics and any non-standard requirements."],
            ["03", "Quote & contract", "You receive a clear VAT breakdown, service terms, setup and care information before acceptance."],
            ["04", "Provisioning", "Only an accepted, payment-ready order moves to supplier provisioning; manual supplier steps are tracked rather than falsely marked complete."],
          ].map(([n, t, d]) => (
            <div key={n} className="border-4 border-foreground bg-background p-5 shadow-brutal">
              <div className="font-mono text-xs text-muted-foreground">{n}</div>
              <h3 className="font-display text-xl mt-1 mb-2">{t}</h3>
              <p className="text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-t-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-14 max-w-2xl">
        <div className="border-4 border-foreground bg-background p-6 shadow-brutal">
          <LeadForm interest="broadband" source="business_broadband_fallback" heading="Need a specialist instead?" />
        </div>
      </div>
    </section>
  </Layout>
);

export default BusinessBroadbandPage;