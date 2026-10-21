import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import BundleBuilder from "@/components/bundle/BundleBuilder";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ArrowRight, AlertTriangle, Wifi, Router, Phone, Zap } from "lucide-react";
import { landlinePlans } from "@/lib/plans";
import { EmergencyCallNote } from "@/components/legal/EmergencyCallNote";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createServiceSchema, createOfferSchema, createBreadcrumbSchema, createFAQSchema } from "@/components/seo";
import { getFromPrices } from "@/lib/pricing/engine";
import { BrandSection, HeroKicker, HeroTitle, NumberedLinkList, PosterStage, Reveal, SectionEyebrow, SectionTitle } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { RouterArt, VoiceArt } from "@/components/brand/illustrations";

const Landline = () => {
  const [isReady, setIsReady] = useState(false);
  const [selectedCallPlans, setSelectedCallPlans] = useState<string[]>([]);
  const [showBroadbandDialog, setShowBroadbandDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const { isAppMode } = useAppMode();
  const LayoutComponent = isAppMode ? AppLayout : Layout;
  const plan = landlinePlans[0];

  const callPlans = [
    { id: "addon-unlimited-uk-calls", name: "Unlimited UK Calls", price: "+£3/mo", priceNum: 3, description: "Unlimited calls to UK landlines & mobiles" },
    { id: "addon-intl-calls-pack", name: "International Calls", price: "+£5/mo", priceNum: 5, description: "300 mins to 50+ countries" },
  ];

  const toggleCallPlan = (id: string) => {
    setSelectedCallPlans(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalPrice = plan.priceNum + callPlans.filter(cp => selectedCallPlans.includes(cp.id)).reduce((s, cp) => s + cp.priceNum, 0);

  if (!isReady) {
    return (
      <LayoutComponent>
        <ServicePageSkeleton />
      </LayoutComponent>
    );
  }

  const landlineServiceSchema = createServiceSchema({
    name: 'OCCTA Digital Home Phone',
    description: `Digital home phone service that works through your OCCTA broadband. Crystal clear HD calls from £${getFromPrices().landline}/month.`,
    url: '/landline',
    price: getFromPrices().landline,
  });

  const planOfferSchema = createOfferSchema({
    name: 'OCCTA Digital Voice Line',
    description: 'Digital home phone with HD calls, caller display, free voicemail. Requires OCCTA broadband.',
    price: getFromPrices().landline,
    url: "/landline",
    sku: plan.id,
    category: 'Digital Home Phone',
  });

  const combinedSchemas = {
    '@context': 'https://schema.org',
    '@graph': [
      landlineServiceSchema,
      planOfferSchema,
      createBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Digital Home Phone', url: '/landline' },
      ]),
      createFAQSchema([
        { question: 'Do I need OCCTA broadband for Digital Home Phone?', answer: 'Yes. Digital Voice runs over your broadband connection, so an active OCCTA broadband line is required.' },
        { question: 'Can I keep my current phone number?', answer: 'Usually yes. We start the number port during onboarding once your broadband is live.' },
        { question: 'What happens during a power cut?', answer: 'Because Digital Voice runs over broadband, the phone will not work during a power or internet outage. Plan back-up options if anyone in your home relies on the line for healthcare or telecare.' },
      ]),
    ],
  };

  const equipment = [
    {
      icon: Wifi,
      title: "OCCTA Broadband",
      description: "An active OCCTA broadband connection is required for Digital Home Phone.",
    },
    {
      icon: Router,
      title: "OCCTA Router",
      description: "Use your own compatible router or get one from us with your broadband order — Digital Voice needs a router with a phone port.",
    },
    {
      icon: Phone,
      title: "Standard Home Phone",
      description: "Any standard home phone handset. Most existing phones work by plugging directly into the router.",
    },
  ];

  return (
    <LayoutComponent>
      <SEO
        title="Digital Home Phone UK - Add to Broadband"
        description={`Add Digital Home Phone from £${getFromPrices().landline}/mo to your OCCTA broadband. Crystal clear digital voice, keep your number. 30-day rolling options where eligible.`}
        canonical="/landline"
        keywords="digital home phone, digital voice UK, VoIP home phone, home phone broadband, affordable home phone UK, flexible monthly home phone"
        price={getFromPrices().landline}
      />
      <StructuredData customSchema={combinedSchemas} />

      {/* Broadband Required Dialog */}
      <Dialog open={showBroadbandDialog} onOpenChange={setShowBroadbandDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display uppercase flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              Broadband Required
            </DialogTitle>
            <DialogDescription className="text-base">
              Digital Home Phone works through your broadband connection and cannot be purchased separately. You'll need an OCCTA broadband plan first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowBroadbandDialog(false)}>
              Go Back
            </Button>
            <Button variant="hero" onClick={() => navigate("/broadband")}>
              View Broadband Plans
              <ArrowRight className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MotionConfig reducedMotion="user">
        {/* Hero */}
        <PosterStage>
          {/* Broadband requirement and emergency-call notices stay first */}
          <div className="mb-10 grid max-w-5xl gap-3 md:grid-cols-2">
            <Alert className="border-[3px] border-warning bg-warning/10 text-white">
              <Wifi className="h-5 w-5" />
              <AlertTitle className="font-display uppercase tracking-wide">Broadband Required</AlertTitle>
              <AlertDescription>
                OCCTA Digital Home Phone requires an active OCCTA broadband connection.{" "}
                <Link to="/broadband" className="font-bold underline hover:text-primary transition-colors">
                  View broadband plans →
                </Link>
              </AlertDescription>
            </Alert>
            <EmergencyCallNote className="text-white" />
          </div>

          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_460px] xl:gap-20">
            {/* Left - Content */}
            <div>
              <HeroKicker>Digital Voice / Home Phone — runs over broadband</HeroKicker>
              <HeroTitle>
                Digital Voice
                {" "}<span className="block text-primary">/ Home Phone</span>
              </HeroTitle>
              <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-white/70">
                Home Phone that runs over your OCCTA broadband. Crystal-clear calls through your
                broadband connection, keep your existing number, plug in your usual handset.
                <strong className="text-white"> An active OCCTA broadband line is required —
                this is an add-on, not a standalone landline.</strong>
                {" "}From £{getFromPrices().landline}/month where eligible.
              </p>

              {/* Benefits */}
              <ul className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: Phone, text: "HD Voice" },
                  { icon: Router, text: "Plug into Router" },
                  { icon: Zap, text: "Flexible Monthlys" },
                ].map((feature) => (
                  <li
                    key={feature.text}
                    className="flex items-center gap-1.5 border border-white/20 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/85"
                  >
                    <feature.icon className="w-3.5 h-3.5 text-primary" />
                    {feature.text}
                  </li>
                ))}
              </ul>

              <Button size="lg" variant="hero" className="mt-8" onClick={() => setShowBroadbandDialog(true)}>
                Get Digital Home Phone
                <ArrowRight className="w-5 h-5" />
              </Button>

              <div className="mt-10 hidden max-w-[320px] lg:block" aria-hidden>
                <div className="bg-primary p-4">
                  <VoiceArt className="h-auto w-full" />
                </div>
              </div>
            </div>

            {/* Right - Plan Card + Call Plan Selector */}
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Main Plan Card — a ticket on the yellow slab */}
              <div className="relative mr-3 mb-3">
                <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 bg-primary" />
                <div className="relative border-[3px] border-white bg-[hsl(0_0%_8%)]">
                  <div className="border-b-[3px] border-white bg-primary px-5 pt-5 pb-6 text-black sm:px-6">
                    <div className="flex items-center justify-between gap-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em]">
                      <span className="border-2 border-black px-1.5 py-0.5">Add-on</span>
                      <span>Requires broadband</span>
                    </div>
                    <h2 className="mt-4 font-display text-4xl uppercase leading-none">{plan.name}</h2>
                    <p className="mt-2 text-sm text-black/70">{plan.description}</p>
                    <div className="mt-4 flex items-end gap-1">
                      <span className="font-display text-7xl leading-[0.8]">£{totalPrice.toFixed(2)}</span>
                      <span className="pb-1 font-display text-xl">/month</span>
                    </div>
                    {selectedCallPlans.length > 0 && (
                      <p className="mt-3 text-xs font-medium text-black/70">
                        Base £{plan.price} + {callPlans.filter(cp => selectedCallPlans.includes(cp.id)).map(cp => cp.name).join(" + ")}
                      </p>
                    )}
                    {selectedCallPlans.length === 0 && (
                      <p className="mt-3 text-xs font-medium text-black/70">Pay-as-you-go calls (8p/min UK)</p>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    <ul className="mb-6 space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-white/85">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button variant="hero" className="w-full" onClick={() => setShowBroadbandDialog(true)}>
                      Add to Broadband
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Call Plan Selector - Multi-select */}
              <div className="border-[3px] border-white/25 p-5 sm:p-6">
                <h3 className="font-display text-2xl uppercase leading-none text-white">Add call plans</h3>
                <p className="mt-2 mb-4 text-sm text-white/60">Select any combination or leave blank for pay-as-you-go (8p/min UK calls)</p>
                <div className="space-y-2">
                  {callPlans.map((cp) => (
                    <motion.div
                      key={cp.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedCallPlans.includes(cp.id)}
                      className={`w-full cursor-pointer border-[3px] p-4 text-left transition-colors ${
                        selectedCallPlans.includes(cp.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-white/15 hover:border-white/40 bg-white/[0.03]'
                      }`}
                      onClick={() => toggleCallPlan(cp.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleCallPlan(cp.id);
                        }
                      }}
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.12 }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedCallPlans.includes(cp.id)}
                            onCheckedChange={() => toggleCallPlan(cp.id)}
                            className="pointer-events-none"
                          />
                          <div>
                            <p className="font-display text-lg leading-tight text-white">{cp.name}</p>
                            <p className="text-sm text-white/60">{cp.description}</p>
                          </div>
                        </div>
                        <p className="flex-shrink-0 font-display text-lg text-primary">{cp.price}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </PosterStage>

        {/* Equipment Needed */}
        <BrandSection tone="paper" className="overflow-x-clip">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
            <div>
              <Reveal>
                <SectionEyebrow index="01" label="What you need" />
                <SectionTitle className="mt-5">Equipment needed</SectionTitle>
              </Reveal>
              <Reveal as="ol" stagger className="mt-10 border-t-[3px] border-foreground">
                {equipment.map((item, i) => (
                  <motion.li
                    key={item.title}
                    variants={revealItem}
                    className="grid grid-cols-[3.5rem_1fr] gap-4 border-b-[3px] border-foreground py-7 sm:grid-cols-[5.5rem_1fr]"
                  >
                    <span aria-hidden className="font-display text-5xl leading-[0.8] text-foreground/25 sm:text-7xl">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="flex items-center gap-2 font-display text-2xl uppercase leading-none sm:text-3xl">
                        <item.icon className="h-6 w-6 flex-shrink-0" aria-hidden />
                        {item.title}
                      </h3>
                      <p className="mt-2 max-w-[520px] text-base leading-relaxed text-foreground/70">{item.description}</p>
                    </div>
                  </motion.li>
                ))}
              </Reveal>
            </div>
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <div className="grid grid-cols-2 border-[3px] border-foreground bg-white lg:grid-cols-1">
                <div className="border-r-[3px] border-foreground p-4 sm:p-6 lg:border-r-0 lg:border-b-[3px]">
                  <RouterArt className="mx-auto h-auto w-full max-w-[300px]" />
                </div>
                <div className="flex items-center bg-primary p-4 sm:p-6">
                  <VoiceArt className="mx-auto h-auto w-full max-w-[300px]" />
                </div>
              </div>
            </Reveal>
          </div>
        </BrandSection>

        {/* Power Cut Legal Notice */}
        <BrandSection tone="dark" containerClassName="!py-12 md:!py-16">
          <Reveal className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start md:gap-12">
            <SectionEyebrow index="02" label="Please read" tone="dark" />
            <Alert className="border-[3px] border-white/25 bg-white/[0.03] text-white">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="font-display uppercase tracking-wide">Important: Power Cuts &amp; Emergency Calls</AlertTitle>
              <AlertDescription className="text-white/70">
                Digital Voice needs power and broadband to work. Emergency calls (999/112) may not work
                during a power cut or broadband outage. We recommend keeping a mobile phone for emergencies,
                and please tell us if anyone in the household relies on the phone in an emergency so we can
                discuss back-up options.
              </AlertDescription>
            </Alert>
          </Reveal>
        </BrandSection>

        {/* Optional Handset Upsell */}
        <BrandSection tone="yellow">
          <Reveal className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <SectionEyebrow index="03" label="Optional extra" tone="yellow" />
              <SectionTitle className="mt-5">Need a handset?</SectionTitle>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-black/75">
                Don't have a home phone? Add a cordless DECT handset to your order for just <span className="font-bold text-black">£29</span> (one-time purchase).
                Delivered to your door, ready to plug in.
              </p>
            </div>
            <div className="w-fit -rotate-3 border-[3px] border-black bg-white px-6 py-4 shadow-[8px_8px_0_0_#000]">
              <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-black/60">One-time</span>
              <span className="font-display text-6xl leading-none text-black">£29</span>
            </div>
          </Reveal>
        </BrandSection>

        {/* Bundle Builder */}
        {!isAppMode && <BundleBuilder currentService="landline" />}

        {/* Related Guides */}
        <BrandSection tone="light">
          <Reveal>
            <SectionEyebrow index="04" label="Keep reading" />
            <SectionTitle className="mt-5">Digital Voice guides</SectionTitle>
          </Reveal>
          <div className="mt-10">
            <NumberedLinkList
              items={[
                { title: "Digital Voice UK", desc: "How Digital Voice works and what you need to know.", path: "/guides/digital-voice-uk" },
                { title: "PSTN Switch-Off UK", desc: "The copper line shutdown and what it means for your landline.", path: "/guides/pstn-switch-off-uk" },
              ]}
            />
          </div>
        </BrandSection>
      </MotionConfig>
    </LayoutComponent>
  );
};

export default Landline;
