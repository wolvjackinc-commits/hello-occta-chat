import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, Bot, LayoutDashboard, Ticket, Shield, Lock, CheckCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { companyConfig } from "@/lib/companyConfig";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session?.user);
    });
    supabase.auth.getSession().then(({ data }) => setIsSignedIn(!!data.session?.user));
    return () => subscription.unsubscribe();
  }, []);

  const accountPath = isSignedIn ? "/dashboard" : "/auth?claim=1&next=/dashboard";

  const footerLinks = {
    services: [
      { name: "Broadband", path: "/broadband" },
      { name: "Fixed-Price Broadband", path: "/fixed-price-broadband" },
      { name: "SIM Plans", path: "/sim-plans" },
      { name: "Digital Voice (Home Phone)", path: "/landline" },
      { name: "Business", path: "/business" },
    ],
    business: [
      { name: "Business Overview", path: "/business" },
      { name: "Business Broadband", path: "/business/broadband" },
      { name: "Hosted VoIP & SIP", path: "/business/voice" },
      { name: "Business SIMs", path: "/business/sim" },
      { name: "Bundles", path: "/business/bundles" },
      { name: "Get a Quote", path: "/business/quote" },
      { name: "Business Billing", path: "/business/billing" },
      { name: "Business Support", path: "/business/support" },
      { name: "Talk to Sales", path: "/business/contact-sales" },
    ],
    support: [
      { name: "Help & Support Hub", path: "/support" },
      { name: "AI Assistant", path: "/support#ai-help" },
      { name: isSignedIn ? "My OCCTA (Dashboard)" : "My OCCTA (Customer Login)", path: accountPath },
      { name: "Network Status", path: "/status" },
      { name: "Contact Us", path: "/support#contact" },
    ],
    legal: [
      { name: "Privacy Policy", path: "/privacy" },
      { name: "Terms of Service", path: "/terms" },
      { name: "Cookie Policy", path: "/cookies" },
      { name: "Complaints", path: "/complaints" },
    ],
    compliance: [
      { name: "Code of Practice", path: "/legal/code-of-practice" },
      { name: "Complaints Code", path: "/legal/complaints-code" },
      { name: "Vulnerable Customers", path: "/legal/vulnerable-customers" },
      { name: "Price Transparency", path: "/legal/price-transparency" },
      { name: "Switching Policy", path: "/legal/switching-policy" },
      { name: "Acceptable Use", path: "/legal/acceptable-use" },
      { name: "Network Management", path: "/legal/network-management" },
      { name: "Accessibility", path: "/legal/accessibility" },
      { name: "Modern Slavery", path: "/legal/modern-slavery" },
      { name: "Digital Voice & Emergency Calls", path: "/guides/digital-voice-uk" },
    ],
    guides: [
      { name: "Flex 30 Broadband", path: "/guides/no-contract-broadband-uk" },
      { name: "Digital Voice UK", path: "/guides/digital-voice-uk" },
      { name: "Cheap SIM Deals", path: "/guides/cheap-sim-only-deals" },
      { name: "All Guides", path: "/guides" },
      { name: "Help Centre", path: "/help" },
      { name: "Blog", path: "/blog" },
    ],
    learn: [
      { name: "Learn Hub", path: "/learn" },
      { name: "What is FTTP?", path: "/learn/what-is-fttp" },
      { name: "How much speed do I need?", path: "/learn/broadband-speed-guide" },
      { name: "How to switch broadband", path: "/learn/how-to-switch-broadband" },
      { name: "Mid-contract price rises", path: "/learn/mid-contract-price-rises" },
      { name: "Direct Debit explained", path: "/learn/direct-debit-explained" },
      { name: "Digital Voice explained", path: "/learn/digital-voice-explained" },
    ],
  };

  const columns: { title: string; links: { name: string; path: string }[] }[] = [
    { title: "Services", links: footerLinks.services },
    { title: "Business", links: footerLinks.business },
    { title: "Support", links: footerLinks.support },
    { title: "Guides", links: footerLinks.guides },
    { title: "Learn", links: footerLinks.learn },
    { title: "Legal", links: footerLinks.legal },
  ];

  const trust = [
    { icon: Shield, text: "UK communications provider · Ofcom General Conditions apply" },
    { icon: Lock, text: "Secure payment routes" },
    { icon: CheckCircle, text: "Charges shown before acceptance" },
    { icon: Users, text: "UK customer support team" },
  ];

  return (
    <footer className="relative overflow-hidden bg-[hsl(0_0%_5%)] text-white">
      {/* Self-Service Support Banner */}
      <div className="border-y-[3px] border-black bg-primary text-black">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between md:px-12">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center bg-black text-primary"><Bot className="h-5 w-5" /></span>
            <span className="font-display text-2xl uppercase leading-none">Need help?</span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link to="/support" className="inline-flex items-center gap-1.5 border-2 border-black px-3 py-2 transition-colors hover:bg-black hover:text-primary">
              <Bot className="h-4 w-4" />
              Get instant help with our AI assistant
            </Link>
            <Link to="/dashboard" aria-label="Manage your OCCTA account" className="inline-flex items-center gap-1.5 border-2 border-black px-3 py-2 transition-colors hover:bg-black hover:text-primary">
              <LayoutDashboard className="h-4 w-4" />
              Manage your account
            </Link>
            <Link to="/support#tickets" className="inline-flex items-center gap-1.5 border-2 border-black px-3 py-2 transition-colors hover:bg-black hover:text-primary">
              <Ticket className="h-4 w-4" />
              Raise a ticket
            </Link>
          </div>
        </div>
      </div>

      {/* Trust Bar */}
      <ul className="mx-auto grid w-full max-w-[1440px] grid-cols-1 border-b border-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {trust.map(({ icon: Icon, text }, i) => (
          <li key={text} className={`flex items-center gap-3 px-4 py-4 text-xs text-white/75 sm:px-6 md:px-12 lg:px-6 ${i > 0 ? "lg:border-l lg:border-white/10" : ""}`}>
            <Icon className="h-4 w-4 flex-shrink-0 text-primary" /> {text}
          </li>
        ))}
      </ul>

      {/* Main Footer */}
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 md:px-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center border-[3px] border-white bg-primary shadow-[5px_5px_0_0_hsl(var(--primary)/0.35)]">
                <span className="font-display text-3xl text-black">O</span>
              </div>
              <div>
                <span className="font-display text-4xl leading-none">OCCTA</span>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Limited</p>
              </div>
            </Link>
            <p className="mt-6 max-w-xs font-display text-3xl uppercase leading-[0.95] text-white">
              Simple telecom. <span className="text-primary">Clear terms.</span>
            </p>

            {/* Contact Info - De-emphasised phone */}
            <div className="mt-8 space-y-3 border-t border-white/10 pt-6">
              <Link to="/support" className="group flex items-center gap-3 text-white/85 transition-colors hover:text-primary">
                <span className="inline-flex h-8 w-8 items-center justify-center bg-primary text-black"><Bot className="h-4 w-4" /></span>
                <span className="font-display text-lg uppercase leading-none">Get Instant Help</span>
              </Link>
              <a href={`mailto:${companyConfig.email.general}`} className="flex items-center gap-3 text-white/80 transition-colors hover:text-primary">
                <span className="inline-flex h-8 w-8 items-center justify-center border border-white/25"><Mail className="h-4 w-4" /></span>
                <span>{companyConfig.email.general}</span>
              </a>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <span className="inline-flex h-8 w-8 items-center justify-center border border-white/15"><Phone className="h-4 w-4" /></span>
                <span>{companyConfig.phone.display} (escalation only)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 xl:grid-cols-6">
            {columns.map((col, i) => (
              <nav key={col.title} aria-label={col.title}>
                <h4 className="flex items-center gap-2 border-b-[3px] border-primary pb-2 font-display text-xl uppercase leading-none">
                  <span className="font-sans text-[10px] font-bold tracking-[0.2em] text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.name}>
                      <Link to={link.path} className="text-sm text-white/70 transition-colors hover:text-primary">
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Compliance row */}
        <div className="mt-14 border-t border-white/10 pt-8">
          <h4 className="mb-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Compliance &amp; Policies
          </h4>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {footerLinks.compliance.map((link) => (
              <li key={link.name}>
                <Link to={link.path} className="text-white/60 transition-colors hover:text-primary">
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Oversized wordmark */}
      <div aria-hidden className="pointer-events-none select-none overflow-hidden border-t border-white/10">
        <p className="footer-wordmark mx-auto w-full max-w-[1440px] px-4 pt-6 font-display leading-[0.75] sm:px-6 md:px-12">OCCTA</p>
      </div>

      {/* Bottom Bar */}
      <div className="border-t-[3px] border-primary bg-black">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 md:px-12">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <p className="text-sm text-white/65">
              © {currentYear} {companyConfig.name}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/65">
              <span>Company No. {companyConfig.companyNumber}</span>
              <span aria-hidden className="text-primary">/</span>
              <span>VAT No. {companyConfig.vatNumber}</span>
              <span aria-hidden className="text-primary">/</span>
              <span>UK Registered</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-white/60">
            Registered address: {companyConfig.address.full}.
          </div>
          <div className="mt-4 flex items-start gap-2 text-xs text-white/60">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <p>
              {companyConfig.compliance} Self-service support is designed to help resolve issues quickly and protect your data.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
