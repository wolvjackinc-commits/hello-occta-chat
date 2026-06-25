import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Router,
  Cable,
  Wifi,
  AlertTriangle,
  LifeBuoy,
  Printer,
  Search,
  ShieldCheck,
  CheckCircle2,
  Copy,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO, StructuredData, createBreadcrumbSchema } from "@/components/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const SUPPORT_PHONE = "0800 260 6626";
const SUPPORT_EMAIL = "support@occta.co.uk";

interface RouterRow {
  brand: string;
  admin: string;
  settings: string;
  notes: string;
}

const ROUTERS: RouterRow[] = [
  { brand: "BT Smart Hub / BT Hub", admin: "192.168.1.254 or bthomehub.home", settings: "Advanced Settings → Broadband / Internet", notes: "Some ISP-supplied routers are locked and may not accept another provider's PPPoE details." },
  { brand: "EE Smart Hub", admin: "192.168.1.254", settings: "Advanced Settings → Broadband / Internet", notes: "Admin password is usually printed on the router." },
  { brand: "Plusnet Hub One / Hub Two", admin: "192.168.1.254", settings: "Advanced Settings → Broadband / Internet", notes: "May need the old ISP profile removed/reset." },
  { brand: "Sky Router", admin: "192.168.0.1", settings: "Internet / WAN", notes: "Some Sky routers do not support standard PPPoE with another ISP — a third-party router may be required." },
  { brand: "TalkTalk WiFi Hub", admin: "192.168.1.1", settings: "Internet / Broadband / WAN", notes: "Admin details are usually on the router label." },
  { brand: "Vodafone Router", admin: "192.168.1.1", settings: "Internet / WAN", notes: "Admin details are on the label or set during first login." },
  { brand: "Virgin Media Hub", admin: "192.168.0.1 (modem mode: 192.168.100.1)", settings: "Router settings", notes: "Virgin Hubs are cable routers and usually won't work directly as an Openreach PPPoE router." },
  { brand: "TP-Link", admin: "tplinkwifi.net or 192.168.0.1 / 192.168.1.1", settings: "Advanced → Network → Internet", notes: "Select PPPoE and enter your OCCTA username/password." },
  { brand: "Netgear", admin: "routerlogin.net or 192.168.1.1", settings: "Internet Setup", notes: "\"Does your internet connection require a login?\" → Yes, then choose PPPoE." },
  { brand: "ASUS", admin: "router.asus.com or 192.168.50.1", settings: "WAN → Internet Connection", notes: "WAN connection type should be PPPoE." },
  { brand: "DrayTek Vigor", admin: "192.168.1.1", settings: "WAN → Internet Access", notes: "Often used by business customers; pick PPPoE for the correct WAN interface." },
  { brand: "Zyxel", admin: "192.168.1.1", settings: "Broadband / WAN", notes: "Some models require the setup wizard." },
  { brand: "D-Link", admin: "192.168.0.1 or dlinkrouter.local", settings: "Internet / WAN", notes: "Choose PPPoE and save settings." },
  { brand: "Linksys", admin: "192.168.1.1 or Linksys app / Smart WiFi", settings: "Internet Settings", notes: "Newer mesh systems may need the Linksys app." },
  { brand: "FRITZ!Box", admin: "fritz.box or 192.168.178.1", settings: "Internet → Account Information", notes: "For FTTP, select internet connection via external modem/ONT." },
];

const FAQS: { q: string; a: string }[] = [
  { q: "My router will not connect. What should I check?", a: "Check the ONT/modem is powered on. Confirm the Ethernet cable runs from the ONT/modem to the router's WAN/Internet port. Make sure connection type is PPPoE. Re-enter your OCCTA username and password carefully — no extra spaces. Restart the ONT/modem and the router, then wait 5–10 minutes. If it still won't connect, contact OCCTA support." },
  { q: "Where do I find my router admin password?", a: "It's usually on the sticker on the back or bottom of your router. This is different from your OCCTA PPPoE password." },
  { q: "What is PPPoE?", a: "PPPoE (Point-to-Point Protocol over Ethernet) is the login method your router uses to authenticate with OCCTA broadband. The username and password we send you tells our network that the connection belongs to you." },
  { q: "Can I use any router?", a: "Most routers that support PPPoE will work. Some ISP-supplied routers are locked to that ISP and may not accept another provider's credentials. If your router doesn't support PPPoE, you'll need a compatible third-party router." },
  { q: "Do I need a VLAN ID?", a: "Most customers should leave VLAN blank. If your router requires VLAN tagging for an Openreach-based connection, use VLAN ID 101." },
  { q: "What should DNS be set to?", a: "Leave DNS on automatic unless you specifically want to use a custom DNS provider." },
  { q: "What is MTU and what value should I use?", a: "If your router asks for MTU, use 1492 for PPPoE." },
];

const OwnRouterSetup = () => {
  const [filter, setFilter] = useState("");

  const filteredRouters = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ROUTERS;
    return ROUTERS.filter(
      (r) =>
        r.brand.toLowerCase().includes(q) ||
        r.admin.toLowerCase().includes(q) ||
        r.settings.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q),
    );
  }, [filter]);

  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Help Centre", url: "/help" },
    { name: "Set Up Your Own Router", url: "/help/own-router-setup" },
  ]);

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to set up your own router with OCCTA broadband",
    description: "Step-by-step PPPoE setup for OCCTA customers using their own router.",
    step: [
      { "@type": "HowToStep", position: 1, name: "Connect the router", text: "Connect the router to the ONT (FTTP) or master socket (SoGEA/FTTC) using the correct cable into the WAN/Internet port." },
      { "@type": "HowToStep", position: 2, name: "Log in to the router", text: "Open a browser, enter the router admin address and log in using the admin password printed on the router label." },
      { "@type": "HowToStep", position: 3, name: "Choose PPPoE", text: "Open Internet/WAN settings and set connection type to PPPoE." },
      { "@type": "HowToStep", position: 4, name: "Enter OCCTA PPPoE credentials", text: "Enter your OCCTA PPPoE username and password exactly as shown in your welcome email." },
      { "@type": "HowToStep", position: 5, name: "Save and restart", text: "Set MTU 1492 if asked, leave VLAN blank (or 101 if required), save, restart the router and wait 5–10 minutes." },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const copyPlaceholder = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: "Placeholder copied. Replace it with the value from your welcome email." });
    } catch {
      toast({ title: "Couldn't copy", description: "Please copy the value manually.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <SEO
        title="How to Set Up Your Own Router with OCCTA Broadband"
        description="Step-by-step guide for OCCTA customers using their own router with PPPoE broadband login details."
        canonical="/help/own-router-setup"
        keywords="occta own router, pppoe setup, broadband router setup uk, occta pppoe username password, router admin login"
      />
      <StructuredData customOnly customSchema={[breadcrumb, howTo, faqSchema]} />

      <article className="container mx-auto px-4 py-10 max-w-4xl print:py-4 print:max-w-none">
        <Link
          to="/help"
          className="inline-flex items-center gap-1 text-sm font-display uppercase text-muted-foreground hover:text-foreground mb-6 print:hidden"
        >
          <ArrowLeft className="w-3 h-3" /> Help Centre
        </Link>

        {/* Header */}
        <header className="border-4 border-foreground p-6 mb-6 bg-card">
          <span className="text-xs font-display uppercase text-primary inline-flex items-center gap-1">
            <Router className="w-3 h-3" /> Self-help guide
          </span>
          <h1 className="font-display uppercase text-3xl md:text-4xl mt-2 leading-tight">
            Set Up Your Own Router with OCCTA Broadband
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Your OCCTA broadband service is now live. If you're using your own router, you'll need to enter your OCCTA PPPoE
            username and password in your router's internet/WAN settings. This guide walks you through it — no support call needed.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="border-2 border-foreground"
            >
              <Printer className="w-4 h-4 mr-1" /> Print this guide
            </Button>
            <Button asChild size="sm" className="border-2 border-foreground">
              <Link to="/support">
                <LifeBuoy className="w-4 h-4 mr-1" /> Still need help?
              </Link>
            </Button>
          </div>
        </header>

        {/* Security callout */}
        <section className="border-4 border-primary bg-primary/5 p-5 mb-6 flex gap-3">
          <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-display uppercase mb-1">Where to find your PPPoE details</p>
            <p className="text-muted-foreground">
              Your PPPoE username and password are in the welcome / go-live email we sent the day your service activated.
              For security, we never display real PPPoE credentials on public pages. Only use the details sent to you by OCCTA —
              never share them with anyone else.
            </p>
          </div>
        </section>

        {/* Before you start */}
        <section className="border-4 border-foreground p-6 mb-5 bg-background">
          <h2 className="font-display uppercase text-lg mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Before you start
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Your OCCTA PPPoE <strong>username</strong></li>
            <li>Your OCCTA PPPoE <strong>password</strong></li>
            <li>A router that supports <strong>PPPoE</strong></li>
            <li>Your ONT / modem / master socket connected and powered on</li>
            <li>A phone, laptop or computer connected to the router by WiFi or Ethernet</li>
          </ul>
        </section>

        {/* Physical connection */}
        <section className="border-4 border-foreground p-6 mb-5 bg-background">
          <h2 className="font-display uppercase text-lg mb-4 flex items-center gap-2">
            <Cable className="w-5 h-5 text-primary" /> Physical connection
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border-2 border-foreground p-4 bg-card">
              <h3 className="font-display uppercase text-sm mb-2">FTTP / Full Fibre</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Connect an Ethernet cable from the Openreach ONT/modem Ethernet port to the WAN / Internet port of your router.</li>
                <li>Make sure the ONT / modem has power.</li>
                <li>The router should be connected to the ONT <em>before</em> you enter PPPoE details.</li>
              </ul>
            </div>
            <div className="border-2 border-foreground p-4 bg-card">
              <h3 className="font-display uppercase text-sm mb-2">SoGEA / FTTC</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Connect the router / modem to the master phone socket using the DSL cable / filter if required.</li>
                <li>If you're using a separate modem, connect it to your router's WAN / Internet port.</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 border-2 border-destructive bg-destructive/5 p-3 flex gap-2 text-sm">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p>
              <strong>Do not</strong> connect the broadband cable into a LAN port. It must go into the WAN / Internet port —
              unless your router has a built-in DSL port for SoGEA / FTTC.
            </p>
          </div>
        </section>

        {/* PPPoE setup steps */}
        <section className="border-4 border-foreground p-6 mb-5 bg-background">
          <h2 className="font-display uppercase text-lg mb-3 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" /> Main PPPoE setup
          </h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Connect to the router's WiFi, or plug in by Ethernet cable.</li>
            <li>Open a browser.</li>
            <li>Enter the router admin address (see the table below for your brand).</li>
            <li>Log in using the router admin password — usually printed on the router label.</li>
            <li>Open <strong>Internet</strong>, <strong>WAN</strong>, <strong>Broadband</strong> or <strong>Advanced Internet Settings</strong>.</li>
            <li>Select connection type: <strong>PPPoE</strong>.</li>
            <li className="flex flex-wrap items-center gap-2">
              Enter OCCTA PPPoE username:
              <code className="px-2 py-0.5 border-2 border-foreground bg-secondary font-mono text-xs">{"{{pppoe_username}}"}</code>
              <button
                type="button"
                onClick={() => copyPlaceholder("{{pppoe_username}}")}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline print:hidden"
                aria-label="Copy username placeholder"
              >
                <Copy className="w-3 h-3" /> copy
              </button>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              Enter OCCTA PPPoE password:
              <code className="px-2 py-0.5 border-2 border-foreground bg-secondary font-mono text-xs">{"{{pppoe_password}}"}</code>
              <button
                type="button"
                onClick={() => copyPlaceholder("{{pppoe_password}}")}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline print:hidden"
                aria-label="Copy password placeholder"
              >
                <Copy className="w-3 h-3" /> copy
              </button>
            </li>
            <li>Set DNS to <strong>automatic</strong> unless you want a custom DNS.</li>
            <li>Set <strong>MTU</strong> to <strong>1492</strong> if the router asks.</li>
            <li>VLAN ID: leave blank unless instructed by OCCTA. If your router requires VLAN tagging for Openreach-based service, use <strong>VLAN ID 101</strong>.</li>
            <li>Save / apply settings.</li>
            <li>Restart the router.</li>
            <li>Wait <strong>5–10 minutes</strong> for the router to connect.</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Replace the placeholders above with the real values from your OCCTA welcome / go-live email.
          </p>
        </section>

        {/* Router brand table */}
        <section className="border-4 border-foreground p-6 mb-5 bg-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="font-display uppercase text-lg">Router brand quick reference</h2>
            <div className="relative w-full sm:w-64 print:hidden">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search e.g. BT, TP-Link…"
                className="pl-8 border-2 border-foreground"
                aria-label="Search router brands"
              />
            </div>
          </div>
          <div className="overflow-x-auto border-2 border-foreground">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr className="text-left font-display uppercase text-xs">
                  <th className="p-2 border-r-2 border-foreground">Router / Provider</th>
                  <th className="p-2 border-r-2 border-foreground">Admin address</th>
                  <th className="p-2 border-r-2 border-foreground">Where to find PPPoE</th>
                  <th className="p-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRouters.map((r) => (
                  <tr key={r.brand} className="border-t-2 border-foreground align-top">
                    <td className="p-2 border-r-2 border-foreground font-display text-xs">{r.brand}</td>
                    <td className="p-2 border-r-2 border-foreground font-mono text-xs break-all">{r.admin}</td>
                    <td className="p-2 border-r-2 border-foreground text-xs">{r.settings}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.notes}</td>
                  </tr>
                ))}
                {filteredRouters.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-sm text-muted-foreground">
                      No matches. Try another search term or contact OCCTA support.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Troubleshooting / FAQ */}
        <section className="border-4 border-foreground p-6 mb-5 bg-secondary">
          <h2 className="font-display uppercase text-lg mb-3">Troubleshooting & FAQs</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b-2 border-foreground/30 last:border-b-0">
                <AccordionTrigger className="font-display text-sm uppercase text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Support block */}
        <section className="border-4 border-foreground p-6 mb-5 bg-card">
          <h2 className="font-display uppercase text-lg mb-3 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" /> Need help?
          </h2>
          <p className="text-sm mb-3">
            If you're unable to connect your router, please contact OCCTA Support.
          </p>
          <dl className="text-sm space-y-1">
            <div className="flex gap-2"><dt className="font-display uppercase w-20">Company</dt><dd>OCCTA LIMITED</dd></div>
            <div className="flex gap-2"><dt className="font-display uppercase w-20">Website</dt><dd><a href="https://www.occta.co.uk" className="text-primary underline">www.occta.co.uk</a></dd></div>
            <div className="flex gap-2"><dt className="font-display uppercase w-20">Email</dt><dd><a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">{SUPPORT_EMAIL}</a></dd></div>
            <div className="flex gap-2"><dt className="font-display uppercase w-20">Phone</dt><dd><a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} className="text-primary underline">{SUPPORT_PHONE}</a></dd></div>
          </dl>
          <p className="text-xs text-muted-foreground mt-3">
            When contacting us, please include your account name, service address, router brand/model, and a screenshot or photo of your router's internet/WAN settings if possible.
          </p>
        </section>
      </article>
    </Layout>
  );
};

export default OwnRouterSetup;