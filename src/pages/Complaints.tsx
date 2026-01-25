import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
        "You can take your complaint to our approved Alternative Dispute Resolution (ADR) scheme after 8 weeks or after receiving a deadlock letter.",
      icon: Scale,
    },
  ];

  return (
    <Layout>
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 hero-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm font-semibold tracking-[0.3em] text-muted-foreground mb-3">
                COMPLAINTS
              </p>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                WE'LL LISTEN.
                <br />
                <span className="text-gradient">WE'LL FIX IT.</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-xl">
                We're a small team, so when something's wrong we want to know about it fast. Here's how to log a complaint and what to expect next.
              </p>
              <div className="flex flex-wrap gap-3">
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
            </motion.div>

            <motion.div
              className="grid gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  className="p-6 bg-secondary rounded-xl border-4 border-foreground"
                  whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                >
                  <step.icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-display text-xl mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
                  <Link to={step.action.to}>
                    <Button size="sm" variant="outline">
                      {step.action.label}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <motion.h2
            className="text-display-md text-center mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            WAYS TO GET IN TOUCH
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {contactMethods.map((method, index) => (
              <motion.div
                key={method.label}
                className="bg-card rounded-xl p-6 border-4 border-foreground flex flex-col"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4, boxShadow: "6px 6px 0px 0px hsl(var(--foreground))" }}
              >
                <method.icon className="w-8 h-8 text-primary mb-3" />
                <p className="font-display text-lg mb-2">{method.label}</p>
                <p className="text-sm text-muted-foreground mb-4 flex-1">{method.detail}</p>
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
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
            <motion.div
              className="bg-card rounded-2xl border-4 border-foreground p-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="font-display text-2xl mb-4">What to include</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {needToKnow.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
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
            </motion.div>

            <motion.div
              className="bg-secondary/60 rounded-2xl border-4 border-foreground p-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
            >
              <h3 className="font-display text-2xl mb-4">Timescales & escalation</h3>
              <div className="space-y-5">
                {escalationSteps.map((step) => (
                  <div key={step.title} className="flex gap-3">
                    <step.icon className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <p className="font-semibold text-foreground">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="https://www.ofcom.org.uk/complaints" target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    Ofcom advice
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
                <Link to="/terms">
                  <Button size="sm" variant="ghost">
                    View our terms
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Complaints;
