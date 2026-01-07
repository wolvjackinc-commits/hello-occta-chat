import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { TicketDetailDialog } from "@/components/dashboard/TicketDetailDialog";
import AIChatBot from "@/components/chat/AIChatBot";
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
  { question: "How do I check my broadband speed?", answer: "Pop over to speedtest.net or use our app. If you're getting less than half your plan speed over WiFi, try testing with an ethernet cable." },
  { question: "Can I keep my phone number when switching?", answer: "Absolutely! For mobile, text 'PAC' to 65075. For landlines, let us know your number and we'll handle the rest." },
  { question: "What happens if I go over my data limit?", answer: "We don't charge for going over – we're not monsters. You'll just slow down to 1Mbps until your next billing date." },
  { question: "How do I cancel my service?", answer: "Log in to your dashboard or call us. 30 days notice required. No exit fees on rolling contracts." },
];

const statusConfig = {
  open: { icon: Clock, color: "bg-warning", textColor: "text-warning", label: "Open" },
  in_progress: { icon: Loader2, color: "bg-accent", textColor: "text-accent", label: "In Progress" },
  resolved: { icon: CheckCircle, color: "bg-primary", textColor: "text-primary", label: "Resolved" },
  closed: { icon: XCircle, color: "bg-muted", textColor: "text-muted-foreground", label: "Closed" },
};

const Support = () => {
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

  return (
    <Layout>
      {/* Hero - Compact */}
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left - Search & FAQs */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-5xl sm:text-6xl font-display uppercase leading-[0.9] mb-4">
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
