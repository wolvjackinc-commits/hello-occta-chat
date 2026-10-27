import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow, TicketSlab } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import { SupportChatArt } from "@/components/brand/illustrations";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import AppSupport from "@/components/app/AppSupport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { TicketDetailDialog } from "@/components/dashboard/TicketDetailDialog";
import { useAppMode } from "@/hooks/useAppMode";
import { SEO, StructuredData, createFAQSchema, createBreadcrumbSchema } from "@/components/seo";
import { companyConfig } from "@/lib/companyConfig";
import KbSearchBar from "@/components/kb/KbSearchBar";
import { helpArticles, helpCategories, type HelpCategory } from "@/data/helpArticles";
import {
  Search,
  Wifi,
  Smartphone,
  PhoneCall,
  FileText,
  CreditCard,
  Settings,
  MessageSquare,
  Phone,
  Mail,
  Plus,
  Clock,
  CheckCircle,
  Loader2,
  Send,
  XCircle,
  Bot,
  LayoutDashboard,
  Ticket,
  Shield,
  Zap,
  Rocket,
  AlertTriangle,
  Receipt,
  Truck,
  Lock,
  HeartHandshake,
  Scale,
  Activity,
  MapPin,
  Package,
  Repeat,
  KeyRound,
  Landmark,
  ShieldAlert,
  Hourglass,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { faqCategories, faqs } from "@/data/faqs";

type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed" | "waiting_customer" | "waiting_occta";
  priority: "low" | "medium" | "normal" | "high" | "urgent";
  category: string | null;
  created_at: string;
};

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(100, "Subject too long"),
  description: z.string().min(20, "Please describe your issue in more detail").max(2000, "Description too long"),
  category: z.string().min(1, "Please select a category"),
});

const ticketCategories = [
  { icon: Wifi, label: "Broadband", value: "broadband" },
  { icon: Smartphone, label: "Mobile", value: "mobile" },
  { icon: PhoneCall, label: "Home Phone", value: "landline" },
  { icon: FileText, label: "Billing", value: "billing" },
  { icon: CreditCard, label: "Payments", value: "payments" },
  { icon: Settings, label: "Account", value: "account" },
];

const statusConfig: Record<SupportTicket["status"], { icon: LucideIcon; color: string; textColor: string; label: string }> = {
  open: { icon: Clock, color: "bg-warning", textColor: "text-warning", label: "Open" },
  in_progress: { icon: Loader2, color: "bg-accent", textColor: "text-accent", label: "In Progress" },
  waiting_customer: { icon: Hourglass, color: "bg-warning", textColor: "text-warning", label: "Awaiting your reply" },
  waiting_occta: { icon: Clock, color: "bg-accent", textColor: "text-accent", label: "With our team" },
  resolved: { icon: CheckCircle, color: "bg-primary", textColor: "text-primary", label: "Resolved" },
  closed: { icon: XCircle, color: "bg-muted", textColor: "text-muted-foreground", label: "Closed" },
};
const statusFallback = statusConfig.open;

const categoryMeta: Record<HelpCategory, { icon: LucideIcon; blurb: string }> = {
  "Getting Started": { icon: Rocket, blurb: "Go-live, equipment, engineers and your Contract Summary." },
  "Broadband & Wi-Fi": { icon: Wifi, blurb: "Router lights, Wi-Fi coverage, speeds and gaming." },
  "Faults & Outages": { icon: AlertTriangle, blurb: "No internet, dropouts, outages and reporting a fault." },
  "Mobile & SIM": { icon: Smartphone, blurb: "Activation, eSIM, keeping your number, data and roaming." },
  "Digital Voice": { icon: PhoneCall, blurb: "Home phone setup, telecare, numbers and nuisance calls." },
  "Billing & Payments": { icon: Receipt, blurb: "Invoices, Direct Debit, bank transfer and refunds." },
  "Moving & Switching": { icon: Truck, blurb: "Moving home, switching in or out and cooling-off." },
  "Account & Security": { icon: Lock, blurb: "Sign-in, your details, scams and your data." },
  "Extra Help & Accessibility": { icon: HeartHandshake, blurb: "Extra support, accessible formats and trusted contacts." },
  "Complaints & Your Rights": { icon: Scale, blurb: "How to complain, ADR and your rights as a customer." },
};

const categoryAnchor = (c: string) => c.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const popularTasks: { icon: LucideIcon; label: string; to: string }[] = [
  { icon: AlertTriangle, label: "Report a fault", to: "/help/report-a-fault" },
  { icon: Landmark, label: "Pay a bill by bank transfer", to: "/help/pay-by-bank-transfer" },
  { icon: Receipt, label: "Set up Direct Debit", to: "/help/direct-debit-setup-help" },
  { icon: Package, label: "Track my order", to: "/track-order" },
  { icon: Repeat, label: "Keep my mobile number", to: "/help/keep-your-mobile-number-pac" },
  { icon: Truck, label: "Moving home", to: "/help/move-home" },
  { icon: KeyRound, label: "Reset my password", to: "/help/sign-in-and-password" },
  { icon: Scale, label: "Make a complaint", to: "/complaints" },
];

const Support = () => {
  const { isAppMode } = useAppMode();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const [formData, setFormData] = useState({ subject: "", description: "", category: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchTickets(session.user.id), 0);
      } else {
        setTickets([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTickets(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTickets = async (userId: string) => {
    setIsLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data as SupportTicket[]) || []);
    } catch (error) {
      logError("Support.fetchTickets", error);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to submit a support ticket.", variant: "destructive" });
      return;
    }

    const result = ticketSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => { if (err.path[0]) newErrors[err.path[0] as string] = err.message; });
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const { data: profileData } = await supabase
        .from("customer_profile" as any)
        .select("*")
        .eq("id", user.id)
        .single();
      const profile = profileData as any;

      const { data: fnData, error } = await supabase.functions.invoke("submit-support-ticket", {
        body: {
          name: profile?.full_name || user.email,
          email: profile?.email || user.email,
          phone: profile?.phone || null,
          category: formData.category,
          priority: "normal",
          subject: formData.subject.trim(),
          message: formData.description.trim(),
        },
      });
      const payload = fnData as { ok?: boolean; ticket_id?: string; error?: string } | null;
      if (error || !payload?.ok) {
        throw new Error(payload?.error || error?.message || "submit_failed");
      }
      const insertedTicket = { id: payload.ticket_id };

      // Notify admins about new ticket (fire and forget)
      supabase.functions.invoke("admin-notify", {
        body: {
          type: "new_ticket",
          data: {
            id: insertedTicket?.id,
            user_id: user.id,
            subject: formData.subject.trim(),
            description: formData.description.trim(),
            category: formData.category,
            priority: "normal",
            customer_name: profile?.full_name || user.email,
            customer_email: profile?.email || user.email,
            customer_phone: profile?.phone || "Not provided",
            account_number: profile?.account_number || "N/A",
            created_at: new Date().toISOString(),
            ip_address: "Captured server-side",
            user_agent: navigator.userAgent,
          },
        },
      }).catch((err) => logError("Support.handleSubmitTicket.adminNotify", err));

      toast({ title: "Ticket submitted", description: "Your ticket is with our team. We'll update you on it here and by email." });
      setFormData({ subject: "", description: "", category: "" });
      setShowTicketForm(false);
      fetchTickets(user.id);
    } catch (error) {
      logError("Support.handleSubmitTicket", error);
      toast({ title: "Something went wrong", description: "Please try again, or email hello@occta.co.uk.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqs.filter((faq) => {
      const matchesSearch = !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
      const matchesCategory = !selectedCategory || faq.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);
  const faqLimit = 10;
  const visibleFaqs = showAllFaqs || searchQuery || selectedCategory ? filteredFaqs : filteredFaqs.slice(0, faqLimit);

  const topics = helpCategories
    .map((cat) => ({ cat, items: helpArticles.filter((a) => a.category === cat) }))
    .filter((t) => t.items.length > 0);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (isAppMode) {
    return (
      <AppLayout>
        <AppSupport />
      </AppLayout>
    );
  }

  const faqSchema = createFAQSchema(faqs.slice(0, 12).map((faq) => ({ question: faq.question, answer: faq.answer })));
  const breadcrumb = createBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Support", url: "/support" },
  ]);
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://www.occta.co.uk/#organization",
    name: companyConfig.name,
    url: companyConfig.website.url,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: companyConfig.phone.international,
        email: companyConfig.email.support,
        areaServed: "GB",
        availableLanguage: "en-GB",
        hoursAvailable: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "18:00" },
      },
    ],
  };

  const channels: { icon: LucideIcon; title: string; detail: string; meta: string; action?: { label: string; onClick?: () => void; href?: string; to?: string } }[] = [
    {
      icon: Bot,
      title: "Chat with Ollie",
      detail: "Instant answers on bills, setup, faults and your account. Ollie can hand you to our team when you need a person.",
      meta: "Online any time",
      action: { label: "Start chat", onClick: () => window.dispatchEvent(new CustomEvent("open-ai-chat")) },
    },
    {
      icon: Ticket,
      title: "Raise a ticket",
      detail: "Best for faults, billing queries and anything that needs investigating. Tracked from start to finish.",
      meta: "Sign in required",
      action: user ? { label: "New ticket", href: "#tickets" } : { label: "Sign in", to: "/auth" },
    },
    {
      icon: Phone,
      title: "Call us",
      detail: "Talk to our UK team. Have your account number ready.",
      meta: `${companyConfig.phone.display} · ${companyConfig.supportHours.weekday}`,
      action: { label: "Call now", href: companyConfig.phone.href },
    },
    {
      icon: Mail,
      title: "Email",
      detail: "Send details, screenshots or documents. Include your account number.",
      meta: companyConfig.email.support,
      action: { label: "Send email", href: `mailto:${companyConfig.email.support}` },
    },
  ];

  return (
    <Layout>
      <SEO
        title="Help & Support - OCCTA Customer Service"
        description="OCCTA Support Hub for broadband, SIM and home phone. Search 40+ help guides, report a fault, check service status, raise a ticket or talk to our UK team."
        canonical="/support"
        keywords="OCCTA support, broadband help, SIM support UK, customer service telecom, internet support, home phone help, report broadband fault"
      />
      <StructuredData customSchema={faqSchema} />
      <StructuredData customOnly customSchema={{ "@context": "https://schema.org", "@graph": [breadcrumb, contactSchema] }} />

      <MotionConfig reducedMotion="user">
        {/* Hero */}
        <PosterStage ghost="HELP">
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Support" }]} />
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px] xl:gap-20">
            <div>
              <HeroKicker>OCCTA Support</HeroKicker>
              <HeroTitle>
                How can we
                {" "}<span className="block text-primary">help?</span>
              </HeroTitle>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
                Search our help guides, fix common problems yourself, or talk to our UK team. Broadband, mobile, home phone and billing — all in one place.
              </p>
              <div className="mt-8 max-w-xl">
                <KbSearchBar size="lg" placeholder="Search e.g. ‘no internet’, ‘PAC code’, ‘bank details’…" />
              </div>
              <nav aria-label="Popular searches" className="mt-5 flex flex-wrap gap-2">
                {[
                  { to: "/help/no-internet-troubleshooting", label: "No internet" },
                  { to: "/help/slow-wifi-fix", label: "Slow Wi-Fi" },
                  { to: "/help/billing", label: "My bill" },
                  { to: "/help/activate-sim", label: "Activate SIM" },
                  { to: "/help/cancel-or-switch", label: "Leaving" },
                ].map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="border-2 border-white/30 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:border-primary hover:text-primary"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>

            <TicketSlab className="mr-3 mb-3">
              <div className="border-[3px] border-white bg-[hsl(0_0%_8%)]">
                <div className="flex items-center gap-3 border-b-[3px] border-white bg-primary px-5 py-4 text-black">
                  <span className="flex h-10 w-10 items-center justify-center bg-black">
                    <Bot className="h-5 w-5 text-primary" />
                  </span>
                  <h2 className="font-display text-2xl uppercase leading-none">Instant Help (Ollie)</h2>
                </div>
                <div className="p-5 sm:p-6">
                  <SupportChatArt />
                  <p className="mt-5 text-sm text-white/65">Ollie answers instantly, any time, and can pass you to our team during opening hours.</p>
                  <Button
                    variant="hero"
                    size="lg"
                    className="mt-5 w-full"
                    onClick={() => window.dispatchEvent(new CustomEvent("open-ai-chat"))}
                  >
                    Start chat
                  </Button>
                </div>
              </div>
            </TicketSlab>
          </div>
        </PosterStage>

        {/* Status strip */}
        <section className="border-y-[3px] border-foreground bg-primary text-black">
          <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 font-semibold">
              <Activity className="h-5 w-5 flex-shrink-0" aria-hidden />
              Something not working? Check for known issues and planned maintenance first.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/status" className="inline-flex items-center gap-1.5 border-[3px] border-black bg-black px-4 py-2 font-display text-base uppercase leading-none text-primary hover:bg-transparent hover:text-black">
                Service status <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/help/report-a-fault" className="inline-flex items-center gap-1.5 border-[3px] border-black px-4 py-2 font-display text-base uppercase leading-none hover:bg-black hover:text-primary">
                Report a fault
              </Link>
            </div>
          </div>
        </section>

        {/* 01 Popular tasks */}
        <BrandSection tone="light" id="popular" className="scroll-mt-20">
          <Reveal>
            <SectionEyebrow index="01" label="Quick links" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Popular tasks</h2>
          </Reveal>
          <Reveal stagger as="ul" className="mt-8 grid grid-cols-2 gap-[3px] border-[3px] border-foreground bg-foreground sm:grid-cols-4">
            {popularTasks.map((t) => (
              <motion.li key={t.to} variants={revealItem} className="bg-card">
                <Link to={t.to} className="group flex h-full flex-col gap-3 p-4 transition-colors hover:bg-primary hover:text-black sm:p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center bg-foreground text-background group-hover:bg-black group-hover:text-primary">
                    <t.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold leading-snug sm:text-base">{t.label}</span>
                </Link>
              </motion.li>
            ))}
          </Reveal>
        </BrandSection>

        {/* 02 Browse by topic */}
        <BrandSection tone="paper" id="topics" className="scroll-mt-20">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionEyebrow index="02" label={`${helpArticles.length} guides, written by our team`} />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Browse by topic</h2>
            </div>
            <Link to="/help" className="group inline-flex items-center gap-1.5 font-display text-lg uppercase">
              Open Help Centre <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {topics.map(({ cat, items }) => {
              const meta = categoryMeta[cat];
              return (
                <motion.div key={cat} variants={revealItem} className="flex flex-col border-[3px] border-foreground bg-card">
                  <Link to={`/help#${categoryAnchor(cat)}`} className="group border-b-[3px] border-foreground p-5 hover:bg-primary hover:text-black">
                    <meta.icon className="h-6 w-6" aria-hidden />
                    <h3 className="mt-3 font-display text-xl uppercase leading-tight">{cat}</h3>
                    <p className="mt-1.5 text-sm text-foreground/70 group-hover:text-black/75">{meta.blurb}</p>
                  </Link>
                  <ul className="flex-1 divide-y-2 divide-foreground/10">
                    {items.slice(0, 3).map((a) => (
                      <li key={a.slug}>
                        <Link to={`/help/${a.slug}`} className="block px-5 py-2.5 text-sm leading-snug hover:bg-secondary hover:underline">
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link to={`/help#${categoryAnchor(cat)}`} className="border-t-[3px] border-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] hover:bg-foreground hover:text-background">
                    All {items.length} articles →
                  </Link>
                </motion.div>
              );
            })}
          </Reveal>
        </BrandSection>

        {/* 03 Account */}
        <BrandSection id="account" tone="light" className="scroll-mt-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal>
              <SectionEyebrow index="03" label="Your account" />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Manage it yourself, any time</h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-foreground/70">
                Your online account puts bills, Direct Debit, tickets and your contract documents in one place — no waiting on hold.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={user ? "/dashboard" : "/auth"}>
                  <Button variant="hero" size="lg">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    {user ? "Go to your account" : "Sign in to your account"}
                  </Button>
                </Link>
                <Link to="/track-order">
                  <Button variant="outline" size="lg" className="border-[3px] border-foreground">
                    <Package className="w-4 h-4 mr-2" /> Track an order
                  </Button>
                </Link>
              </div>
            </Reveal>

            <Reveal stagger as="ul" className="grid grid-cols-2 gap-[3px] border-[3px] border-foreground bg-foreground sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: FileText, label: "View and download invoices" },
                { icon: Receipt, label: "Check Direct Debit status" },
                { icon: Ticket, label: "Raise and track tickets" },
                { icon: FileText, label: "Download your Contract Summary" },
                { icon: Settings, label: "Update your details" },
                { icon: Zap, label: "Change or add services" },
                { icon: Shield, label: "Manage security settings" },
                { icon: Clock, label: "See your order progress" },
              ].map((item, i) => (
                <motion.li key={i} variants={revealItem} className="flex flex-col gap-3 bg-card p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center bg-primary text-black">
                    <item.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold leading-snug">{item.label}</span>
                </motion.li>
              ))}
            </Reveal>
          </div>
        </BrandSection>

        {/* 04 FAQs */}
        <BrandSection id="faqs" tone="paper" className="scroll-mt-20">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionEyebrow index="04" label="Straight answers" />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Frequently Asked Questions</h2>
            </div>
            <Link to="/faq" className="group inline-flex items-center gap-1.5 font-display text-lg uppercase">
              View all FAQs <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>

          <div className="mt-10 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  aria-label="Search FAQs"
                  placeholder="Search FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 border-[3px] border-foreground"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  aria-pressed={!selectedCategory}
                  className={`flex w-full items-center gap-2 border-[3px] px-4 py-2.5 text-left text-sm font-semibold leading-tight transition-colors ${
                    !selectedCategory ? "border-foreground bg-foreground text-background" : "border-foreground/20 bg-card hover:border-foreground"
                  }`}
                >
                  All Topics
                </button>
                {faqCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    aria-pressed={selectedCategory === cat.id}
                    className={`flex w-full items-center gap-2 border-[3px] px-4 py-2.5 text-left text-sm font-semibold leading-tight transition-colors ${
                      selectedCategory === cat.id ? "border-foreground bg-foreground text-background" : "border-foreground/20 bg-card hover:border-foreground"
                    }`}
                  >
                    <cat.icon className="w-4 h-4 flex-shrink-0" />
                    {cat.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
                {visibleFaqs.map((faq) => (
                  <AccordionItem key={faq.question} value={faq.question} className="border-b-[3px] border-foreground">
                    <AccordionTrigger className="py-5 text-left whitespace-normal font-display text-xl uppercase leading-tight tracking-normal hover:no-underline sm:text-2xl">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-base leading-relaxed text-foreground/75 max-w-prose">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {filteredFaqs.length === 0 && (
                <div className="mt-6 border-[3px] border-dashed border-foreground/30 bg-card py-10 text-center">
                  <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No matching FAQs. Try the search at the top of the page, or ask Ollie.</p>
                </div>
              )}

              {!showAllFaqs && !searchQuery && !selectedCategory && filteredFaqs.length > faqLimit && (
                <Button variant="outline" className="mt-6 border-[3px] border-foreground" onClick={() => setShowAllFaqs(true)}>
                  Show all {filteredFaqs.length} questions
                </Button>
              )}
            </div>
          </div>
        </BrandSection>

        {/* 05 Tickets */}
        <BrandSection id="tickets" tone="dark" className="scroll-mt-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <Reveal>
              <SectionEyebrow index="05" label="Personal help, tracked" tone="dark" />
              <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Support Tickets</h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
                For faults, billing queries and anything that needs investigating. Every ticket gets a reference, a full history and updates by email.
              </p>
              <ul className="mt-6 space-y-2 text-white/75">
                {["Include your account number and service address", "Say when it started and what you've tried", "Add wired speed tests for speed issues", "Tell us if anyone relies on the line for health or safety"].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 bg-primary" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <div className="border-[3px] border-white/25 bg-white/[0.03] p-5 sm:p-6">
              {user ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-2xl uppercase">Your Tickets</h3>
                    <Button size="sm" variant={showTicketForm ? "outline" : "hero"} onClick={() => setShowTicketForm(!showTicketForm)}>
                      <Plus className="w-4 h-4" /> {showTicketForm ? "Cancel" : "New Ticket"}
                    </Button>
                  </div>

                  {showTicketForm && (
                    <div className="border-[3px] border-white/25 bg-background p-4 mb-4 space-y-4">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="group" aria-label="Ticket category">
                        {ticketCategories.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            aria-pressed={formData.category === cat.value}
                            onClick={() => { setFormData({ ...formData, category: cat.value }); if (errors.category) setErrors({ ...errors, category: "" }); }}
                            className={`p-3 border-2 text-center transition-colors ${formData.category === cat.value ? "border-primary bg-primary/10" : "border-white/20 hover:border-white/50"}`}
                          >
                            <cat.icon className="w-4 h-4 mx-auto mb-1" />
                            <span className="font-display text-xs">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.category && <p className="text-destructive text-xs">{errors.category}</p>}

                      <div>
                        <Label htmlFor="ticket-subject" className="font-display text-xs uppercase">Subject</Label>
                        <Input id="ticket-subject" value={formData.subject} onChange={(e) => { setFormData({ ...formData, subject: e.target.value }); if (errors.subject) setErrors({ ...errors, subject: "" }); }} className="border-2 border-foreground" />
                        {errors.subject && <p className="text-destructive text-xs">{errors.subject}</p>}
                      </div>

                      <div>
                        <Label htmlFor="ticket-description" className="font-display text-xs uppercase">Description</Label>
                        <Textarea id="ticket-description" value={formData.description} onChange={(e) => { setFormData({ ...formData, description: e.target.value }); if (errors.description) setErrors({ ...errors, description: "" }); }} className="border-2 border-foreground min-h-[100px]" />
                        {errors.description && <p className="text-destructive text-xs">{errors.description}</p>}
                      </div>

                      <Button className="w-full" variant="hero" size="sm" onClick={handleSubmitTicket} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit Ticket</>}
                      </Button>
                    </div>
                  )}

                  {isLoadingTickets ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : tickets.length > 0 ? (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto">
                      {tickets.map((ticket) => {
                        const status = statusConfig[ticket.status] ?? statusFallback;
                        return (
                          <button
                            type="button"
                            key={ticket.id}
                            className="block w-full text-left bg-background border-2 border-white/20 p-3 hover:border-primary transition-colors"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-6 h-6 ${status.color} flex items-center justify-center`}>
                                <status.icon className="w-3 h-3" />
                              </div>
                              <span className={`font-display text-xs uppercase ${status.textColor}`}>{status.label}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{formatDate(ticket.created_at)}</span>
                            </div>
                            <span className="font-display text-sm">{ticket.subject}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-white/25">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No tickets yet. Need help? Raise one above or ask Ollie.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <h3 className="font-display text-3xl uppercase mb-2">Need Personalised Help?</h3>
                  <p className="text-white/65 mb-5">Sign in to raise tickets and track every update.</p>
                  <Link to="/auth">
                    <Button variant="hero">Sign In</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </BrandSection>

        {/* 06 Contact */}
        <BrandSection id="contact" tone="light" className="scroll-mt-20">
          <Reveal>
            <SectionEyebrow index="06" label="Talk to a person" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Contact us</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/70">
              Our UK team is available {companyConfig.supportHours.weekday}, excluding bank holidays. Pick the channel that suits you.
            </p>
          </Reveal>

          <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((c) => (
              <motion.div key={c.title} variants={revealItem} className="flex flex-col border-[3px] border-foreground bg-card p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black">
                  <c.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-2xl uppercase leading-none">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">{c.detail}</p>
                <p className="mt-4 text-sm font-semibold break-words">{c.meta}</p>
                {c.action && (
                  c.action.to ? (
                    <Link to={c.action.to} className="mt-4 inline-flex items-center justify-center border-[3px] border-foreground px-4 py-2 font-display text-base uppercase hover:bg-foreground hover:text-background">
                      {c.action.label}
                    </Link>
                  ) : c.action.href ? (
                    <a href={c.action.href} className="mt-4 inline-flex items-center justify-center border-[3px] border-foreground px-4 py-2 font-display text-base uppercase hover:bg-foreground hover:text-background">
                      {c.action.label}
                    </a>
                  ) : (
                    <button type="button" onClick={c.action.onClick} className="mt-4 inline-flex items-center justify-center border-[3px] border-foreground px-4 py-2 font-display text-base uppercase hover:bg-foreground hover:text-background">
                      {c.action.label}
                    </button>
                  )
                )}
              </motion.div>
            ))}
          </Reveal>

          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex items-start gap-4 border-[3px] border-foreground bg-secondary p-5">
              <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden />
              <div className="text-sm leading-relaxed">
                <p className="font-display text-lg uppercase leading-none">Write to us</p>
                <p className="mt-2">{companyConfig.name}, {companyConfig.address.oneLine}, {companyConfig.address.country}</p>
                <p className="mt-1 text-foreground/65">Company number {companyConfig.companyNumber} · VAT {companyConfig.vatNumber}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 border-[3px] border-foreground bg-[hsl(0_0%_6%)] p-5 text-white">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden />
              <div className="text-sm leading-relaxed">
                <p className="font-display text-lg uppercase leading-none">Emergency? Call 999</p>
                <p className="mt-2 text-white/75">If your home phone or broadband is down, use a mobile for 999 or 112. Tell us if anyone relies on the line for telecare or safety and we'll prioritise them.</p>
              </div>
            </div>
          </div>

          <p className="mt-6 border-l-[3px] border-primary pl-4 text-sm leading-relaxed text-foreground/70">
            <strong className="text-foreground">Stay safe:</strong> OCCTA never takes card payments, never asks for passwords or one-time codes and our bank details never change.
            If a message says otherwise, it isn't us — <Link to="/help/scams-and-phishing" className="underline">here's how to report it</Link>.
          </p>
        </BrandSection>

        {/* 07 Extra help and rights */}
        <BrandSection id="rights" tone="dark" className="scroll-mt-20">
          <Reveal>
            <SectionEyebrow index="07" label="Fair, accessible, accountable" tone="dark" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Extra help & your rights</h2>
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: HeartHandshake, title: "Need extra support?", desc: "Priority handling, telecare resilience, payment arrangements and nominated contacts — free and confidential.", to: "/help/vulnerable-customer-support" },
              { icon: Settings, title: "Accessible formats", desc: "Large print, braille and audio bills, plus Relay UK.", to: "/help/accessible-formats" },
              { icon: Scale, title: "Make a complaint", desc: "Acknowledged within 2 working days, with free independent ADR after 6 weeks or deadlock.", to: "/help/how-to-complain" },
              { icon: Shield, title: "Your rights", desc: "Cooling-off, switching, speed remedies and our no-CPI price promise in plain English.", to: "/help/your-rights-ofcom" },
              { icon: Receipt, title: "Struggling to pay?", desc: "Talk to us early — we'll agree a sensible arrangement around what you can afford.", to: "/help/missed-payment-help" },
              { icon: Lock, title: "Your data", desc: "How we use your data, and how to request a copy or make a change.", to: "/help/data-and-privacy-requests" },
            ].map((c) => (
              <motion.div key={c.to} variants={revealItem}>
                <Link to={c.to} className="group flex h-full items-start gap-4 border-[3px] border-white/25 p-5 transition-colors hover:border-primary">
                  <c.icon className="mt-0.5 h-6 w-6 flex-shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block font-display text-xl uppercase leading-tight text-white group-hover:text-primary">{c.title}</span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-white/65">{c.desc}</span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </Reveal>
          <nav aria-label="Policies" className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            {[
              { to: "/legal/complaints-code", label: "Complaints Code" },
              { to: "/legal/code-of-practice", label: "Code of Practice" },
              { to: "/legal/vulnerable-customers", label: "Vulnerable Customers Policy" },
              { to: "/legal/accessibility", label: "Accessibility" },
              { to: "/legal/price-transparency", label: "Price Transparency" },
              { to: "/legal/switching-policy", label: "Switching Policy" },
              { to: "/legal/network-management", label: "Network Management" },
              { to: "/terms", label: "Terms" },
              { to: "/privacy", label: "Privacy" },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="underline-offset-4 hover:text-primary hover:underline">{l.label}</Link>
            ))}
          </nav>
        </BrandSection>
      </MotionConfig>

      {selectedTicket && (
        <TicketDetailDialog
          open={!!selectedTicket}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
          ticket={selectedTicket}
        />
      )}
    </Layout>
  );
};

export default Support;
