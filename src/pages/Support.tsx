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
import AIChatBot from "@/components/chat/AIChatBot";
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
  Zap,
  AlertCircle,
  Lock,
  ShoppingCart,
  AlertTriangle
} from "lucide-react";

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

// FAQ categories for structured navigation
const faqCategories = [
  { 
    id: "billing",
    icon: CreditCard, 
    title: "Billing & Payments", 
    description: "Invoices, payment methods, refunds"
  },
  { 
    id: "services",
    icon: Wifi, 
    title: "Landline / Mobile / Broadband", 
    description: "Service setup, speeds, coverage"
  },
  { 
    id: "faults",
    icon: AlertTriangle, 
    title: "Faults & Troubleshooting", 
    description: "Connection issues, outages"
  },
  { 
    id: "account",
    icon: Lock, 
    title: "Account & Security", 
    description: "Login, passwords, settings"
  },
  { 
    id: "orders",
    icon: ShoppingCart, 
    title: "Orders & Activation", 
    description: "New orders, activation status"
  },
  { 
    id: "complaints",
    icon: AlertCircle, 
    title: "Complaints & Escalations", 
    description: "Formal complaints process"
  },
];

const faqs = [
  { question: "How do I check my broadband speed?", answer: "Use a wired device and run a speed test. WiFi can reduce speeds, so compare results over ethernet before troubleshooting. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "My WiFi is slow. What should I try first?", answer: "Restart your router, move it into the open, and switch to the 5GHz band for faster speeds at short range. Still need help? Our AI assistant or support ticket system can assist you further.", category: "faults" },
  { question: "What's the difference between 2.4GHz and 5GHz WiFi?", answer: "2.4GHz reaches farther but is slower and busier. 5GHz is faster but has a shorter range. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "How do I reboot or reset my router?", answer: "Unplug the power for 30 seconds to reboot. For a factory reset, hold the reset pin for 10–15 seconds. Still need help? Our AI assistant or support ticket system can assist you further.", category: "faults" },
  { question: "Why does my connection drop at night?", answer: "Try changing WiFi channels and checking for local interference. If it persists, contact us with times and frequency. Still need help? Our AI assistant or support ticket system can assist you further.", category: "faults" },
  { question: "How do I set up a new broadband connection?", answer: "Once your kit arrives, plug the router into the master socket and power it on. Follow the quick-start card to finish setup. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "Do you support self-install and engineer visits?", answer: "Most lines are self-install. If an engineer is required, we'll confirm the appointment details during checkout. Still need help? Our AI assistant or support ticket system can assist you further.", category: "orders" },
  { question: "Can I move my broadband to a new address?", answer: "Yes—tell us your move date at least 2 weeks ahead so we can schedule the transfer or install. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "How do I keep my phone number when switching?", answer: "For mobiles, text PAC to 65075 and share the code with us. For landlines, just confirm the number to port. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "How long does number porting take?", answer: "Mobile ports typically complete within 1 working day. Landline ports can take longer depending on your provider. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "Can I use my own router?", answer: "Yes, if it supports your connection type. You may need to enter our PPPoE settings in the router admin panel. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "How do I change my WiFi name and password?", answer: "Log into your router admin page and update SSID and WiFi password. Restart devices to reconnect. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "What should I do if there's an outage?", answer: "Check our status page or app for updates. If there's no reported outage, reboot your equipment and contact us. Still need help? Our AI assistant or support ticket system can assist you further.", category: "faults" },
  { question: "What is fair usage?", answer: "Fair usage ensures everyone gets a stable service. Extremely heavy usage may be managed during peak times. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "What happens if I go over my data limit?", answer: "If your plan includes a cap, speeds may be reduced until your next billing date. No unexpected overage fees. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "How do I see my data usage?", answer: "Open your dashboard or app to view usage, plan details, and billing dates. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "Do you offer unlimited data plans?", answer: "Yes—check plan details in the shop or your account to see unlimited options. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "How do I activate my SIM?", answer: "Insert the SIM, restart your phone, and follow the activation instructions sent by SMS or email. Still need help? Our AI assistant or support ticket system can assist you further.", category: "orders" },
  { question: "My SIM isn't working—what now?", answer: "Confirm it's seated correctly, reboot your phone, and check APN settings. If it still fails, contact support. Still need help? Our AI assistant or support ticket system can assist you further.", category: "faults" },
  { question: "Do you support eSIM?", answer: "If your device supports eSIM, we can provide a QR code for activation. Check eligibility in your account. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "How do I set up APN settings?", answer: "In your phone's mobile network settings, create a new APN using the details in your account setup guide. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "Can I use my plan abroad?", answer: "Roaming is available on selected plans. Enable roaming in your device settings and check country rates. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "How do I enable international calling?", answer: "Turn on international calling in your account settings. You may need a credit check or a deposit on new accounts. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "How do I pay my bill?", answer: "Pay by card in your account or set up Direct Debit for automatic payments each month. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "Can I change my billing date?", answer: "Yes—contact support and we'll align your billing date with your preferred schedule. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "I was charged twice—what should I do?", answer: "Check pending card authorizations first. If the charge has posted twice, contact us with the transaction details. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "How do refunds work?", answer: "Approved refunds are returned to your original payment method within 3–5 working days. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "Where can I download invoices?", answer: "Invoices are available in your dashboard under Billing. You can download PDFs for any paid month. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "How do I update my payment method?", answer: "Go to Billing in your account and choose 'Update payment method' to replace a card or Direct Debit. Still need help? Our AI assistant or support ticket system can assist you further.", category: "billing" },
  { question: "How do I update my personal details?", answer: "Visit Account Settings to change your email, password, address, and contact preferences. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "I forgot my password—how do I reset it?", answer: "Use the 'Forgot password' link on the sign-in page and follow the email instructions. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "How do I cancel my service?", answer: "Submit a cancellation request in your dashboard or call us. Most plans require 30 days' notice. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "Is there a cooling-off period?", answer: "New services typically include a cooling-off period. Check your plan terms in the order confirmation. Still need help? Our AI assistant or support ticket system can assist you further.", category: "orders" },
  { question: "Can I pause my service temporarily?", answer: "Pausing isn't available on all plans. Contact support to see what options apply to your account. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "How do I report a vulnerability or security issue?", answer: "Email our security team with details and we'll investigate promptly. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "Do you provide parental controls?", answer: "Yes—enable parental controls in the router or app to manage content categories and device schedules. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "How do I block nuisance calls?", answer: "Use your handset's block list or enable call screening features in your account if available. Still need help? Our AI assistant or support ticket system can assist you further.", category: "services" },
  { question: "Why is my latency high while gaming?", answer: "Use a wired connection, close background downloads, and choose a nearby game server to reduce ping. Still need help? Our AI assistant or support ticket system can assist you further.", category: "faults" },
  { question: "Can I add multiple lines to one account?", answer: "Yes—multi-line discounts may be available. Add lines from your account dashboard. Still need help? Our AI assistant or support ticket system can assist you further.", category: "account" },
  { question: "How do I make a formal complaint?", answer: "Visit our Complaints page to submit a formal complaint. We follow Ofcom guidelines and aim to resolve issues within 8 weeks. Still need help? Our AI assistant or support ticket system can assist you further.", category: "complaints" },
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
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: "medium",
        status: "open",
      });

      if (error) throw error;

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

  const filteredFaqs = faqs.filter((faq) => {
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

  // Generate FAQ schema for top 10 FAQs
  const topFaqs = faqs.slice(0, 10).map(f => ({ question: f.question, answer: f.answer }));
  const faqSchema = createFAQSchema(topFaqs);

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
            <div className="bg-primary/5 border-4 border-primary p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary flex items-center justify-center">
                  <Bot className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-display text-2xl uppercase text-primary">Instant Help</h2>
                  <p className="text-sm text-muted-foreground">Solve Issues in Seconds — 24/7</p>
                </div>
                <div className="ml-auto">
                  <span className="px-3 py-1 bg-primary text-primary-foreground font-display text-xs uppercase">Fastest</span>
                </div>
              </div>
              <p className="text-muted-foreground mb-6">
                Our AI assistant can instantly help you with billing, services, outages, plan changes, and account queries — available around the clock.
              </p>
              <AIChatBot embedded className="h-[400px]" />
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
            <div className="mb-6">
              <h2 className="font-display text-2xl uppercase mb-2">Frequently Asked Questions</h2>
              <p className="text-muted-foreground">Browse by category or search for answers</p>
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
              {filteredFaqs.slice(0, 15).map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-4 border-foreground bg-card px-4">
                  <AccordionTrigger className="text-left whitespace-normal font-semibold text-base md:text-lg leading-snug tracking-normal py-4 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm md:text-base leading-relaxed text-muted-foreground pb-3">
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
