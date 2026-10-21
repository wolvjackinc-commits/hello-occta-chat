import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, Mail, MessageSquare, Phone } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { companyConfig } from "@/lib/companyConfig";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { RouterArt } from "@/components/brand/illustrations";

/*
 * There is no public live status feed yet, so this page must not show
 * service states, incidents or maintenance windows. It routes customers
 * to the places that do have real, account-specific information.
 */

const openChat = () => window.dispatchEvent(new CustomEvent("open-ai-chat"));

const ServiceStatus = () => {
  const routes = [
    {
      icon: LayoutDashboard,
      title: "Check your account",
      body: "Your dashboard shows the services on your account, open tickets and their progress.",
      action: <Link to="/dashboard"><Button variant="hero" size="sm">Go to Dashboard <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>,
    },
    {
      icon: MessageSquare,
      title: "Ask Ollie",
      body: "Our assistant can walk you through router checks and raise a ticket with your conversation attached.",
      action: <Button variant="outline" size="sm" onClick={openChat}>Start chat</Button>,
    },
    {
      icon: Phone,
      title: "Call or email us",
      body: `${companyConfig.phone.display} (${companyConfig.supportHours.phone}) or ${companyConfig.email.support}.`,
      action: (
        <div className="flex flex-wrap gap-2">
          <a href={companyConfig.phone.href}><Button variant="outline" size="sm"><Phone className="mr-1 h-4 w-4" /> Call</Button></a>
          <a href={`mailto:${companyConfig.email.support}`}><Button variant="outline" size="sm"><Mail className="mr-1 h-4 w-4" /> Email</Button></a>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <SEO title="OCCTA service status" description="Live-style service status is not a public report. Check your account or contact OCCTA if a service is affected." canonical="/status" noIndex />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Service status" }]} />
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-20">
            <div>
              <HeroKicker>Service status</HeroKicker>
              <HeroTitle size="md">
                Something not working?
                {" "}<span className="block text-primary">Here's the fastest fix.</span>
              </HeroTitle>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
                We don't publish a live network status feed on this page yet. If a broadband, SIM or home phone
                service isn't working, use one of the routes below and we'll check your specific service.
              </p>
            </div>
            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-white p-8">
                <RouterArt className="mx-auto h-auto w-full max-w-[260px]" />
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        <BrandSection tone="paper">
          <Reveal>
            <SectionEyebrow index="01" label="Get help" />
            <h2 className="mt-5 font-display text-[2.75rem] uppercase leading-[0.9] sm:text-6xl">Three ways to get it sorted</h2>
          </Reveal>
          <Reveal stagger as="ol" className="mt-10 grid gap-[3px] border-[3px] border-foreground bg-foreground md:grid-cols-3">
            {routes.map((r, i) => (
              <motion.li key={r.title} variants={revealItem} className="flex flex-col bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black"><r.icon className="h-5 w-5" /></span>
                  <span className="font-display text-4xl leading-none text-foreground/20">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-5 font-display text-3xl uppercase leading-none">{r.title}</h3>
                <p className="mt-3 mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                {r.action}
              </motion.li>
            ))}
          </Reveal>
        </BrandSection>

        <BrandSection tone="dark" containerClassName="!py-12 md:!py-16">
          <Reveal className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
            <SectionEyebrow index="02" label="Before you call" tone="dark" />
            <p className="max-w-3xl text-base leading-relaxed text-white/75">
              Restarting your router (power off for 30 seconds, then on) fixes many short drop-outs. Our{" "}
              <Link to="/help" className="font-semibold text-white underline decoration-primary decoration-2 underline-offset-4">Help Centre</Link>{" "}
              has step-by-step guides for Wi-Fi, router lights and Digital Voice.
            </p>
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

export default ServiceStatus;
