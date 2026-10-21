import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { companyConfig } from "@/lib/companyConfig";
import { SEO } from "@/components/seo";

const Complaints = () => {
  const steps = [
    {
      title: "Tell us what went wrong",
      description:
        "Use our quick online form or give us a ring. We log every complaint and assign it to a dedicated advisor.",
      action: { label: "Start online", to: "/support" },
      icon: MessageSquare,
    },
    {
      title: "We investigate fast",
      description:
        "We aim to resolve complaints within 5 working days. Complex cases get a clear timeline and regular updates.",
      action: { label: "Check service status", to: "/status" },
      icon: Clock,
    },
    {
      title: "We make it right",
      description:
        "If we made a mistake, we'll fix it and explain what happened. Where appropriate, we'll put things right with a credit or goodwill gesture.",
      action: { label: "View your account", to: "/dashboard" },
      icon: ShieldCheck,
    },
  ];

  const contactMethods = [
    {
      icon: Phone,
      label: "Call us",
      detail: `${companyConfig.phone.display} (${companyConfig.supportHours.phone})`,
      actionLabel: "Call now",
      href: companyConfig.phone.href,
    },
    {
      icon: Mail,
      label: "Email",
      detail: companyConfig.email.complaints,
      actionLabel: "Send email",
      href: `mailto:${companyConfig.email.complaints}`,
    },
    {
      icon: FileText,
      label: "Online form",
      detail: "Log a complaint in your support area",
      actionLabel: "Open form",
      href: "/support",
      isInternal: true,
    },
    {
      icon: MapPin,
      label: "Write to us",
      detail: `OCCTA Complaints Team, ${companyConfig.address.street}, ${companyConfig.address.postcode}`,
      actionLabel: "Copy address",
      href: companyConfig.address.mapsUrl,
      isExternal: true,
    },
  ];

  const needToKnow = [
    "Your account number or the email used to sign up.",
    "A short summary of the issue and when it started.",
    "What you'd like us to do to put things right.",
    "Any screenshots, bills, or dates that help us investigate.",
  ];

  const escalationSteps = [
    {
      title: "We'll keep you updated",
      description:
        "If we can't resolve your complaint within 5 working days, we'll let you know why and set a new target date.",
      icon: CheckCircle2,
    },
    {
      title: "Deadlock letter",
      description:
        "If we've exhausted our process and you're still unhappy, we'll issue a deadlock letter so you can go to ADR.",
      icon: FileText,
    },
    {
      title: "Independent ADR",
      description:
        "If we cannot resolve your complaint within 6 weeks, or we issue a deadlock letter earlier, you may refer the matter to our approved Alternative Dispute Resolution (ADR) scheme.",
      icon: Scale,
    },
  ];

  return (
    <Layout>
      <SEO
        title="OCCTA complaints process and ADR"
        description="How to log a complaint with OCCTA, what happens next, and when you can go to the approved alternative dispute resolution scheme."
        canonical="/complaints"
      />
      <MotionConfig reducedMotion="user">
      <PosterStage>
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Complaints" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:gap-20">
          <div>
            <HeroKicker>Complaints</HeroKicker>
            <HeroTitle>
              We'll listen.
              {" "}<span className="block text-primary">We'll fix it.</span>
            </HeroTitle>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              We're a small team, so when something's wrong we want to know about it fast. Here's how to log a complaint and what to expect next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/support">
                <Button size="lg" variant="hero">
                  Start a complaint
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href={companyConfig.phone.href}>
                <Button size="lg" variant="outline">
                  <Phone className="w-5 h-5" />
                  {companyConfig.phone.display}
                </Button>
              </a>
            </div>
          </div>

          <ol className="border-t border-white/20">
            {steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[3.5rem_1fr] gap-4 border-b border-white/20 py-6 sm:grid-cols-[4.5rem_1fr]">
                <span className="font-display text-5xl leading-[0.8] text-primary">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="flex items-center gap-2 font-display text-2xl uppercase leading-none text-white">
                    <step.icon className="h-5 w-5 text-primary" />
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/65">{step.description}</p>
                  <Link to={step.action.to} className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-primary">
                    <span className="underline decoration-white/30 underline-offset-4 group-hover:decoration-primary">{step.action.label}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </PosterStage>

      <BrandSection tone="paper">
        <Reveal>
          <SectionEyebrow index="01" label="Contact" />
          <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Ways to get in touch</h2>
        </Reveal>
        <Reveal stagger className="mt-10 grid gap-[3px] border-[3px] border-foreground bg-foreground md:grid-cols-2 lg:grid-cols-4">
          {contactMethods.map((method) => (
            <motion.div key={method.label} variants={revealItem} className="flex flex-col bg-card p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black"><method.icon className="h-5 w-5" /></span>
              <p className="mt-4 font-display text-2xl uppercase leading-none">{method.label}</p>
              <p className="mt-2 mb-5 flex-1 text-sm text-muted-foreground">{method.detail}</p>
              {method.isInternal ? (
                <Link to={method.href}>
                  <Button size="sm" variant="outline">
                    {method.actionLabel}
                  </Button>
                </Link>
              ) : (
                <a
                  href={method.href}
                  target={method.isExternal ? "_blank" : undefined}
                  rel={method.isExternal ? "noreferrer" : undefined}
                >
                  <Button size="sm" variant="outline">
                    {method.actionLabel}
                  </Button>
                </a>
              )}
            </motion.div>
          ))}
        </Reveal>
      </BrandSection>

      <BrandSection tone="dark">
        <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal className="border-[3px] border-white bg-white p-8 text-black">
            <SectionEyebrow index="02" label="Checklist" />
            <h3 className="mt-5 font-display text-4xl uppercase leading-none">What to include</h3>
            <ul className="mt-6 space-y-3 text-base text-black/75">
              {needToKnow.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center bg-black text-primary" aria-hidden><CheckCircle2 className="h-3.5 w-3.5" /></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/track-order">
                <Button size="sm" variant="outline">
                  Track an existing ticket
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/support">
                <Button size="sm" variant="hero">
                  Submit complaint
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </Reveal>

          <Reveal className="border-[3px] border-white/25 p-8">
            <SectionEyebrow index="03" label="If it goes further" tone="dark" />
            <h3 className="mt-5 font-display text-4xl uppercase leading-none text-white">Timescales & escalation</h3>
            <ol className="relative mt-8 space-y-6 border-l-[3px] border-primary pl-6">
              {escalationSteps.map((step) => (
                <li key={step.title} className="relative">
                  <span className="absolute -left-[2.05rem] top-0 inline-flex h-7 w-7 items-center justify-center bg-primary text-black"><step.icon className="h-4 w-4" /></span>
                  <p className="font-display text-xl uppercase leading-none text-white">{step.title}</p>
                  <p className="mt-1.5 text-sm text-white/65">{step.description}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="https://www.ofcom.org.uk/complaints" target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  Ofcom advice
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <Link to="/terms">
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10">
                  View our terms
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

export default Complaints;
