import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
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
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
  { icon: PhoneCall, label: "Landline", value: "landline" },
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: insertedTicket, error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: "medium",
        status: "open",
      }).select('id').single();

      if (error) throw error;

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
            priority: "medium",
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
  const faqSchema = createFAQSchema(supportFaqs.map((faq) => ({ question: faq.question, answer: faq.answer })));

  return (
    <Layout>
      <SEO 
        title="Help & Support - 24/7 Customer Service"
        description="OCCTA Support Hub – UK-based help for broadband, SIM and landline. AI chat, FAQs, ticket system. Fast resolution guaranteed."
        canonical="/support"
        keywords="OCCTA support, broadband help, SIM support UK, customer service telecom, internet support, landline help"
      />
      <StructuredData customSchema={faqSchema} type="localBusiness" />
      
      {/* Hero - Help Yourself First Philosophy */}
      <section className="py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <h1 className="text-5xl sm:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
              HELP &
              <br />
              <span className="text-gradient">SUPPORT HUB</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Most issues can be resolved instantly through your account, FAQs, or our AI assistant.
              <br />
              <span className="text-foreground font-medium">Get answers in seconds — no waiting required.</span>
            </p>
          </motion.div>

          {/* Section A: AI HELP ASSISTANT - Top Priority */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-4xl mx-auto mb-12"
          >
            <div className="bg-card border-4 border-foreground p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-foreground flex items-center justify-center">
                    <Bot className="w-6 h-6 text-background" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl uppercase">Instant Help (IRA)</h2>
                    <p className="text-sm text-muted-foreground">Solve issues in seconds — 24/7</p>
                  </div>
                </div>
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => {
                    // Trigger the floating chat widget to open
                    window.dispatchEvent(new CustomEvent('open-ai-chat'));
                  }}
                >
                  Start chat
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Section B: SELF-SERVICE DASHBOARD PROMOTION */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-4xl mx-auto mb-12"
          >
            <div className="bg-secondary/50 border-4 border-foreground p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-accent flex items-center justify-center">
                  <LayoutDashboard className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <h2 className="font-display text-2xl uppercase">Manage Everything From Your Account</h2>
                  <p className="text-sm text-muted-foreground">Full control at your fingertips</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-6">
                Your account dashboard gives you full control. Most issues can be resolved without waiting or contacting support.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
                  <div key={i} className="flex items-center gap-2 p-3 bg-background border-2 border-foreground/20">
                    <item.icon className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-3">
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
            </div>
          </motion.div>

          {/* Section C: SMART FAQ SECTION */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-4xl mx-auto mb-12"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-2xl uppercase mb-2">Frequently Asked Questions</h2>
              <p className="text-muted-foreground">Browse the most requested answers below.</p>
              <Link to="/faq" className="text-sm font-semibold text-primary hover:underline">
                View all FAQs
              </Link>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 border-2 text-sm md:text-base leading-tight transition-colors whitespace-normal ${
                  !selectedCategory ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 hover:bg-secondary"
                }`}
              >
                All Topics
              </button>
              {faqCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 border-2 text-sm md:text-base leading-tight transition-colors flex items-center gap-2 whitespace-normal ${
                    selectedCategory === cat.id ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 hover:bg-secondary"
                  }`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.title}
                </button>
              ))}
            </div>
            
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 border-4 border-foreground"
              />
            </div>

            {/* FAQs */}
            <Accordion type="single" collapsible className="space-y-2">
              {filteredFaqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-4 border-foreground bg-card px-4">
                  <AccordionTrigger className="text-left whitespace-normal font-semibold text-base md:text-lg leading-relaxed tracking-normal py-4 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm md:text-base leading-relaxed text-muted-foreground pb-3 max-w-prose">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            {filteredFaqs.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-foreground/30">
                <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No matching FAQs found. Try our AI assistant above for help.</p>
              </div>
            )}
          </motion.div>

          {/* Section D: SUPPORT TICKET SYSTEM */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-4xl mx-auto mb-12"
          >
            <div className="bg-card border-4 border-foreground p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-foreground flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-background" />
                </div>
                <div>
                  <h2 className="font-display text-2xl uppercase">Support Tickets</h2>
                  <p className="text-sm text-muted-foreground">When you need personalised assistance</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-6">
                If your issue cannot be resolved instantly through our AI assistant or FAQs, raise a support ticket and our team will assist you.
              </p>

              {user ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg uppercase">Your Tickets</h3>
                    <Button size="sm" variant={showTicketForm ? "outline" : "hero"} onClick={() => setShowTicketForm(!showTicketForm)}>
                      <Plus className="w-4 h-4" /> {showTicketForm ? "Cancel" : "New Ticket"}
                    </Button>
                  </div>

                  {showTicketForm && (
                    <div className="bg-secondary border-4 border-foreground p-4 mb-4 space-y-4">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => { setFormData({ ...formData, category: cat.value }); if (errors.category) setErrors({ ...errors, category: "" }); }}
                            className={`p-3 border-2 text-center transition-colors ${formData.category === cat.value ? "border-primary bg-primary/10" : "border-foreground/30 hover:bg-background"}`}
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
                            className="bg-background border-2 border-foreground p-3 cursor-pointer hover:bg-accent/10 transition-colors"
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
                    <div className="text-center py-8 border-2 border-dashed border-foreground/30">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No tickets yet. Most issues can be resolved instantly with our AI assistant above.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-foreground/30">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-display text-xl mb-2">Need Personalised Help?</h3>
                  <p className="text-muted-foreground mb-4">Sign in to create support tickets and track your requests.</p>
                  <Link to="/auth">
                    <Button variant="hero">Sign In</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>

          {/* Section E: TELEPHONE CONTACT - Last Resort */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="max-w-4xl mx-auto mb-12"
          >
            <div className="bg-muted/30 border-2 border-foreground/30 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-muted flex items-center justify-center">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="font-display text-lg uppercase text-muted-foreground">Telephone Support</h2>
                  <p className="text-xs text-muted-foreground">For unresolved or complex issues only</p>
                </div>
              </div>
              
              <div className="bg-background/50 border border-foreground/20 p-4 mb-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Please note:</strong> Telephone support is intended for unresolved or complex issues only. 
                  For faster resolution, please use our AI assistant, FAQs, or support ticket system first.
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span className="font-display">{CONTACT_PHONE_DISPLAY}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Mon-Fri 9am-6pm, Sat 10am-4pm</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>hello@occta.co.uk</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Trust & Compliance Statement */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-primary/5 border-2 border-primary/30 p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-display text-sm uppercase text-primary">Trusted & Compliant</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This support model ensures faster resolution, full audit trails, and consistent service quality while protecting customer data. 
                OCCTA complies with UK telecom regulations and GDPR requirements.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

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
