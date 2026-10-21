import { useState, useEffect } from "react";
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
import { SEO, StructuredData, createFAQSchema } from "@/components/seo";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
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
  Zap
} from "lucide-react";
import { faqCategories, faqs } from "@/data/faqs";

type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'waiting_customer' | 'waiting_occta';
  priority: 'low' | 'medium' | 'normal' | 'high' | 'urgent';
  category: string | null;
  created_at: string;
};

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(100, "Subject too long"),
  description: z.string().min(20, "Please describe your issue in more detail").max(2000, "Description too long"),
  category: z.string().min(1, "Please select a category"),
});

const categories = [
  { icon: Wifi, label: "Broadband", value: "broadband" },
  { icon: Smartphone, label: "Mobile", value: "mobile" },
  { icon: PhoneCall, label: "Home Phone", value: "landline" },
  { icon: FileText, label: "Billing", value: "billing" },
  { icon: CreditCard, label: "Payments", value: "payments" },
  { icon: Settings, label: "Account", value: "account" },
];

const topSupportFaqQuestions = [
  "How do I check my broadband speed?",
  "My Wi-Fi is slow — what should I try first?",
  "How long does installation take?",
  "How do I contact support / raise a ticket?",
];

const statusConfig = {
  open: { icon: Clock, color: "bg-warning", textColor: "text-warning", label: "Open" },
  in_progress: { icon: Loader2, color: "bg-accent", textColor: "text-accent", label: "In Progress" },
  resolved: { icon: CheckCircle, color: "bg-primary", textColor: "text-primary", label: "Resolved" },
  closed: { icon: XCircle, color: "bg-muted", textColor: "text-muted-foreground", label: "Closed" },
};

const Support = () => {
  const { isAppMode } = useAppMode();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
      setTickets(data || []);
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
      supabase.functions.invoke('admin-notify', {
        body: {
          type: 'new_ticket',
          data: {
            id: insertedTicket?.id,
            user_id: user.id,
            subject: formData.subject.trim(),
            description: formData.description.trim(),
            category: formData.category,
            priority: "normal",
            customer_name: profile?.full_name || user.email,
            customer_email: profile?.email || user.email,
            customer_phone: profile?.phone || 'Not provided',
            account_number: profile?.account_number || 'N/A',
            created_at: new Date().toISOString(),
            ip_address: 'Captured server-side',
            user_agent: navigator.userAgent,
          }
        }
      }).catch(err => logError('Support.handleSubmitTicket.adminNotify', err));

      toast({ title: "Ticket submitted!", description: "We'll get back to you within 24 hours." });
      setFormData({ subject: "", description: "", category: "" });
      setShowTicketForm(false);
      fetchTickets(user.id);
    } catch (error) {
      logError("Support.handleSubmitTicket", error);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const supportFaqs = faqs.filter((faq) => topSupportFaqQuestions.includes(faq.question));
  const filteredFaqs = supportFaqs.filter((faq) => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  // App mode: show compact app UI
  if (isAppMode) {
    return (
      <AppLayout>
        <AppSupport />
      </AppLayout>
    );
  }

  // Generate FAQ schema for top FAQs shown on this page
  const faqSchema = createFAQSchema(supportFaqs.slice(0, 6).map((faq) => ({ question: faq.question, answer: faq.answer })));

  return (
    <Layout>
      <SEO 
        title="Help & Support - OCCTA Customer Service"
        description="OCCTA Support Hub – UK-based help for broadband, SIM and home phone. AI chat, FAQs and a ticket system, with UK-based help when you need it."
        canonical="/support"
        keywords="OCCTA support, broadband help, SIM support UK, customer service telecom, internet support, home phone help"
      />
      <StructuredData customSchema={faqSchema} />
      
      <MotionConfig reducedMotion="user">
      {/* Hero - Help Yourself First Philosophy */}
      <PosterStage ghost="HELP">
        <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Support" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px] xl:gap-20">
          <div>
            <HeroKicker>UK-based support</HeroKicker>
            <HeroTitle>
              Help &amp;
              {" "}<span className="block text-primary">support hub</span>
            </HeroTitle>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Most issues can be resolved instantly through your account, FAQs, or our AI assistant.
              {" "}<span className="font-medium text-white">Get answers in seconds — no waiting required.</span>
            </p>
            <nav aria-label="Support options" className="mt-8 flex flex-wrap gap-2">
              {[
                { href: "#account", label: "Your account" },
                { href: "#faqs", label: "FAQs" },
                { href: "#tickets", label: "Tickets" },
                { href: "#phone", label: "Phone" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="border-[3px] border-white/30 px-4 py-2 font-display text-lg uppercase leading-none text-white transition-colors hover:border-primary hover:text-primary"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Section A: AI HELP ASSISTANT - Top Priority */}
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
                <p className="mt-5 text-sm text-white/65">Self-service help is available online; advisor availability is shown on our contact channels</p>
                <Button
                  variant="hero"
                  size="lg"
                  className="mt-5 w-full"
                  onClick={() => {
                    // Trigger the floating chat widget to open
                    window.dispatchEvent(new CustomEvent('open-ai-chat'));
                  }}
                >
                  Start chat
                </Button>
              </div>
            </div>
          </TicketSlab>
        </div>
      </PosterStage>

      {/* Section B: SELF-SERVICE DASHBOARD PROMOTION */}
      <BrandSection id="account" tone="paper" className="scroll-mt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal>
            <SectionEyebrow index="01" label="Full control at your fingertips" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Manage Everything From Your Account</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-foreground/70">
              Your account dashboard gives you full control. Most issues can be resolved without waiting or contacting support.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {user ? (
                <Link to="/dashboard">
                  <Button variant="hero" size="lg">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button variant="hero" size="lg">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Sign In to Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </Reveal>

          <Reveal stagger as="ul" className="grid grid-cols-2 gap-[3px] border-[3px] border-foreground bg-foreground sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: FileText, label: "View bills & payment history" },
              { icon: CreditCard, label: "Download invoices" },
              { icon: Wifi, label: "Check service status" },
              { icon: Ticket, label: "Raise support tickets" },
              { icon: Clock, label: "Track open issues" },
              { icon: Settings, label: "Update personal details" },
              { icon: Zap, label: "Change or upgrade services" },
              { icon: Shield, label: "Manage security settings" },
            ].map((item, i) => (
              <motion.li key={i} variants={revealItem} className="flex flex-col gap-3 bg-card p-4">
                <span className="inline-flex h-9 w-9 items-center justify-center bg-primary text-black">
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold leading-snug">{item.label}</span>
              </motion.li>
            ))}
          </Reveal>
        </div>
      </BrandSection>

      {/* Section C: SMART FAQ SECTION */}
      <BrandSection id="faqs" tone="light" className="scroll-mt-20">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionEyebrow index="02" label="Browse the most requested answers below." />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Frequently Asked Questions</h2>
          </div>
          <Link to="/faq" className="group inline-flex items-center gap-1.5 font-display text-lg uppercase">
            View all FAQs <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
          {/* Category Pills */}
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
            {/* FAQs */}
            <Accordion type="single" collapsible className="border-t-[3px] border-foreground">
              {filteredFaqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-b-[3px] border-foreground">
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
                <p className="text-muted-foreground">No matching FAQs found. Try our AI assistant above for help.</p>
              </div>
            )}
          </div>
        </div>
      </BrandSection>

      {/* Section D: SUPPORT TICKET SYSTEM */}
      <BrandSection id="tickets" tone="dark" className="scroll-mt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal>
            <SectionEyebrow index="03" label="When you need personalised assistance" tone="dark" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Support Tickets</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              If your issue cannot be resolved instantly through our AI assistant or FAQs, raise a support ticket and our team will assist you.
            </p>
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
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
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
                      <Label className="font-display text-xs uppercase">Subject</Label>
                      <Input value={formData.subject} onChange={(e) => { setFormData({ ...formData, subject: e.target.value }); if (errors.subject) setErrors({ ...errors, subject: "" }); }} className="border-2 border-foreground" />
                      {errors.subject && <p className="text-destructive text-xs">{errors.subject}</p>}
                    </div>

                    <div>
                      <Label className="font-display text-xs uppercase">Description</Label>
                      <Textarea value={formData.description} onChange={(e) => { setFormData({ ...formData, description: e.target.value }); if (errors.description) setErrors({ ...errors, description: "" }); }} className="border-2 border-foreground min-h-[80px]" />
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
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {tickets.map((ticket) => {
                      const status = statusConfig[ticket.status];
                      return (
                        <div
                          key={ticket.id}
                          className="bg-background border-2 border-white/20 p-3 cursor-pointer hover:border-primary transition-colors"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-6 h-6 ${status.color} flex items-center justify-center`}>
                              <status.icon className="w-3 h-3" />
                            </div>
                            <span className={`font-display text-xs uppercase ${status.textColor}`}>{status.label}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{formatDate(ticket.created_at)}</span>
                          </div>
                          <h4 className="font-display text-sm">{ticket.subject}</h4>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-white/25">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No tickets yet. Most issues can be resolved instantly with our AI assistant above.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="font-display text-3xl uppercase mb-2">Need Personalised Help?</h3>
                <p className="text-white/65 mb-5">Sign in to create support tickets and track your requests.</p>
                <Link to="/auth">
                  <Button variant="hero">Sign In</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </BrandSection>

      {/* Section E: TELEPHONE CONTACT - Last Resort */}
      <BrandSection id="phone" tone="paper" className="scroll-mt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <Reveal>
            <SectionEyebrow index="04" label="For unresolved or complex issues only" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl lg:text-6xl">Telephone Support</h2>
          </Reveal>
          <Reveal>
            <p className="border-l-[3px] border-primary pl-4 text-base leading-relaxed text-foreground/75">
              <strong className="text-foreground">Please note:</strong> Telephone support is intended for unresolved or complex issues only.
              For faster resolution, please use our AI assistant, FAQs, or support ticket system first.
            </p>
            <dl className="mt-8 border-t-[3px] border-foreground">
              <div className="flex items-center gap-4 border-b-2 border-foreground/15 py-4">
                <dt><Phone className="w-5 h-5" aria-label="Phone" /></dt>
                <dd className="font-display text-2xl leading-none">{CONTACT_PHONE_DISPLAY}</dd>
              </div>
              <div className="flex items-center gap-4 border-b-2 border-foreground/15 py-4">
                <dt><Clock className="w-5 h-5" aria-label="Opening hours" /></dt>
                <dd className="text-base">Mon–Fri, 8am–6pm</dd>
              </div>
              <div className="flex items-center gap-4 py-4">
                <dt><Mail className="w-5 h-5" aria-label="Email" /></dt>
                <dd className="text-base">hello@occta.co.uk</dd>
              </div>
            </dl>

            {/* Trust & Compliance Statement */}
            <div className="mt-8 border-[3px] border-foreground bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4" />
                <span className="font-display text-lg uppercase leading-none">Trusted & Compliant</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This support model is designed to help resolve issues quickly, keep a full audit trail and deliver consistent service quality while protecting customer data.
                OCCTA complies with UK telecom regulations and GDPR requirements.
              </p>
            </div>
          </Reveal>
        </div>
      </BrandSection>
      </MotionConfig>

      {/* Ticket Detail Dialog */}
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
