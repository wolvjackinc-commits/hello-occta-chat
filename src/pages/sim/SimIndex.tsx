import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";
import { loadSimCatalogue, formatGbp, type SimPlanPublic, type SimSettingsPublic } from "@/lib/sim/catalogue";
import { Check, Signal, Smartphone, ArrowRight } from "lucide-react";

const SimIndex = () => {
  const [plans, setPlans] = useState<SimPlanPublic[]>([]);
  const [settings, setSettings] = useState<SimSettingsPublic | null>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <Layout>
      <SEO
        title="SIM Only Plans — OCCTA"
        description="Simple SIM-only plans from OCCTA. eSIM or physical SIM, keep your number with a PAC, or start fresh. Clear terms, honest pricing."
        canonical="/sim"
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
          <h2 className="text-display-md mb-6">Choose a plan</h2>

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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="card-brutal bg-card p-5 flex flex-col">
                  <h3 className="font-display text-2xl mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-display text-4xl">{formatGbp(plan.monthly_price_minor)}</span>
                    <span className="text-foreground/70 text-sm font-medium">/mo</span>
                    {plan.vat_mode === "included" && <span className="text-xs text-muted-foreground ml-1">(incl. VAT)</span>}
                  </div>
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
                    {plan.first_payment_minor > 0 && (
                      <li className="text-xs text-muted-foreground">
                        First payment {formatGbp(plan.first_payment_minor)} taken at checkout.
                      </li>
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
          )}
        </div>
      </section>
    </Layout>
  );
};

export default SimIndex;