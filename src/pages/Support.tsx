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
  XCircle
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

const faqs = [
  { question: "How do I check my broadband speed?", answer: "Use a wired device and run a speed test. WiFi can reduce speeds, so compare results over ethernet before troubleshooting." },
  { question: "My WiFi is slow. What should I try first?", answer: "Restart your router, move it into the open, and switch to the 5GHz band for faster speeds at short range." },
  { question: "What’s the difference between 2.4GHz and 5GHz WiFi?", answer: "2.4GHz reaches farther but is slower and busier. 5GHz is faster but has a shorter range." },
  { question: "How do I reboot or reset my router?", answer: "Unplug the power for 30 seconds to reboot. For a factory reset, hold the reset pin for 10–15 seconds." },
  { question: "Why does my connection drop at night?", answer: "Try changing WiFi channels and checking for local interference. If it persists, contact us with times and frequency." },
  { question: "How do I set up a new broadband connection?", answer: "Once your kit arrives, plug the router into the master socket and power it on. Follow the quick-start card to finish setup." },
  { question: "Do you support self-install and engineer visits?", answer: "Most lines are self-install. If an engineer is required, we’ll confirm the appointment details during checkout." },
  { question: "Can I move my broadband to a new address?", answer: "Yes—tell us your move date at least 2 weeks ahead so we can schedule the transfer or install." },
  { question: "How do I keep my phone number when switching?", answer: "For mobiles, text PAC to 65075 and share the code with us. For landlines, just confirm the number to port." },
  { question: "How long does number porting take?", answer: "Mobile ports typically complete within 1 working day. Landline ports can take longer depending on your provider." },
  { question: "Can I use my own router?", answer: "Yes, if it supports your connection type. You may need to enter our PPPoE settings in the router admin panel." },
  { question: "How do I change my WiFi name and password?", answer: "Log into your router admin page and update SSID and WiFi password. Restart devices to reconnect." },
  { question: "What should I do if there’s an outage?", answer: "Check our status page or app for updates. If there’s no reported outage, reboot your equipment and contact us." },
  { question: "What is fair usage?", answer: "Fair usage ensures everyone gets a stable service. Extremely heavy usage may be managed during peak times." },
  { question: "What happens if I go over my data limit?", answer: "If your plan includes a cap, speeds may be reduced until your next billing date. No unexpected overage fees." },
  { question: "How do I see my data usage?", answer: "Open your dashboard or app to view usage, plan details, and billing dates." },
  { question: "Do you offer unlimited data plans?", answer: "Yes—check plan details in the shop or your account to see unlimited options." },
  { question: "How do I activate my SIM?", answer: "Insert the SIM, restart your phone, and follow the activation instructions sent by SMS or email." },
  { question: "My SIM isn’t working—what now?", answer: "Confirm it’s seated correctly, reboot your phone, and check APN settings. If it still fails, contact support." },
  { question: "Do you support eSIM?", answer: "If your device supports eSIM, we can provide a QR code for activation. Check eligibility in your account." },
  { question: "How do I set up APN settings?", answer: "In your phone’s mobile network settings, create a new APN using the details in your account setup guide." },
  { question: "Can I use my plan abroad?", answer: "Roaming is available on selected plans. Enable roaming in your device settings and check country rates." },
  { question: "How do I enable international calling?", answer: "Turn on international calling in your account settings. You may need a credit check or a deposit on new accounts." },
  { question: "How do I pay my bill?", answer: "Pay by card in your account or set up Direct Debit for automatic payments each month." },
  { question: "Can I change my billing date?", answer: "Yes—contact support and we’ll align your billing date with your preferred schedule." },
  { question: "I was charged twice—what should I do?", answer: "Check pending card authorizations first. If the charge has posted twice, contact us with the transaction details." },
  { question: "How do refunds work?", answer: "Approved refunds are returned to your original payment method within 3–5 working days." },
  { question: "Where can I download invoices?", answer: "Invoices are available in your dashboard under Billing. You can download PDFs for any paid month." },
  { question: "How do I update my payment method?", answer: "Go to Billing in your account and choose “Update payment method” to replace a card or Direct Debit." },
  { question: "How do I update my personal details?", answer: "Visit Account Settings to change your email, password, address, and contact preferences." },
  { question: "I forgot my password—how do I reset it?", answer: "Use the “Forgot password” link on the sign-in page and follow the email instructions." },
  { question: "How do I cancel my service?", answer: "Submit a cancellation request in your dashboard or call us. Most plans require 30 days’ notice." },
  { question: "Is there a cooling-off period?", answer: "New services typically include a cooling-off period. Check your plan terms in the order confirmation." },
  { question: "Can I pause my service temporarily?", answer: "Pausing isn’t available on all plans. Contact support to see what options apply to your account." },
  { question: "How do I report a vulnerability or security issue?", answer: "Email our security team with details and we’ll investigate promptly." },
  { question: "Do you provide parental controls?", answer: "Yes—enable parental controls in the router or app to manage content categories and device schedules." },
  { question: "How do I block nuisance calls?", answer: "Use your handset’s block list or enable call screening features in your account if available." },
  { question: "Why is my latency high while gaming?", answer: "Use a wired connection, close background downloads, and choose a nearby game server to reduce ping." },
  { question: "Can I add multiple lines to one account?", answer: "Yes—multi-line discounts may be available. Add lines from your account dashboard." },
  { question: "How do I contact support quickly?", answer: "Start with the FAQ search, then use live chat or call us if you need a hand." },
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
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  
  const [formData, setFormData] = useState({ subject: "", description: "", category: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      toast({ title: "Something went wrong", description: "Please try again or call us.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaqs = faqs.filter(
    (faq) => faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        title="Support & Help Centre"
        description="Get help with your OCCTA services. Search FAQs, submit support tickets, or call us on 0800 260 6627. We're here to help."
        canonical="/support"
      />
      <StructuredData customSchema={faqSchema} type="localBusiness" />
      {/* Hero - Compact */}
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left - Search & FAQs */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-5xl sm:text-6xl font-display uppercase leading-[0.9] mb-4 text-foreground">
                HOW CAN WE
                <br />
                <span className="text-gradient">HELP?</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                Stuck on something? Search below or call us on <a href="tel:08002606627" className="text-primary font-semibold">0800 260 6627</a>
              </p>
              
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

              {/* FAQs - Compact */}
              <Accordion type="single" collapsible className="space-y-2">
                {filteredFaqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-4 border-foreground bg-card px-4">
                    <AccordionTrigger className="font-display text-sm hover:no-underline py-3">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground pb-3">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {/* Contact Options */}
              <div className="flex flex-wrap gap-3 mt-6">
                <a href="tel:08002606627" className="flex items-center gap-2 px-4 py-2 border-4 border-foreground bg-primary text-primary-foreground font-display text-sm">
                  <Phone className="w-4 h-4" /> Call Us
                </a>
                <a href="mailto:hello@occtatele.com" className="flex items-center gap-2 px-4 py-2 border-4 border-foreground bg-background font-display text-sm">
                  <Mail className="w-4 h-4" /> Email
                </a>
              </div>

              {/* Embedded AI Chat */}
              <div className="mt-6">
                <h3 className="font-display text-lg uppercase mb-3">💬 Ask Our AI Assistant</h3>
                <AIChatBot embedded className="h-[400px]" />
              </div>
            </motion.div>

            {/* Right - Tickets */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {user ? (
                <div className="bg-secondary/50 border-4 border-foreground p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl uppercase">Your Tickets</h2>
                    <Button size="sm" variant={showTicketForm ? "outline" : "hero"} onClick={() => setShowTicketForm(!showTicketForm)}>
                      <Plus className="w-4 h-4" /> {showTicketForm ? "Cancel" : "New"}
                    </Button>
                  </div>

                  {showTicketForm && (
                    <div className="bg-card border-4 border-foreground p-4 mb-4 space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => { setFormData({ ...formData, category: cat.value }); if (errors.category) setErrors({ ...errors, category: "" }); }}
                            className={`p-3 border-2 text-center transition-colors ${formData.category === cat.value ? "border-primary bg-primary/10" : "border-foreground/30 hover:bg-secondary"}`}
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
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit</>}
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
                            className="bg-card border-2 border-foreground p-3 cursor-pointer hover:bg-accent/10 transition-colors"
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
                      <p className="text-sm text-muted-foreground">No tickets yet</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-secondary/50 border-4 border-foreground p-6 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-display text-xl mb-2">NEED HELP?</h3>
                  <p className="text-muted-foreground mb-4">Sign in to create support tickets and track your requests.</p>
                  <Link to="/auth">
                    <Button variant="hero">Sign In</Button>
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
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
