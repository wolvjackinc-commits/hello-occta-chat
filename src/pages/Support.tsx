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
import { 
  Search, 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  FileText, 
  CreditCard, 
  Settings, 
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  Plus,
  Clock,
  CheckCircle,
  Loader2,
  ArrowRight,
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
  { icon: Wifi, label: "Broadband", value: "broadband", description: "Speed issues, connection problems, router help" },
  { icon: Smartphone, label: "Mobile", value: "mobile", description: "SIM activation, data usage, coverage" },
  { icon: PhoneCall, label: "Landline", value: "landline", description: "Call quality, features, voicemail" },
  { icon: FileText, label: "Billing", value: "billing", description: "Invoices, payments, account balance" },
  { icon: CreditCard, label: "Payments", value: "payments", description: "Payment methods, direct debit, refunds" },
  { icon: Settings, label: "Account", value: "account", description: "Password, details, preferences" },
];

const faqs = [
  {
    question: "How do I check my broadband speed?",
    answer: "Pop over to speedtest.net or use our app. If you're getting less than half your plan speed over WiFi, try testing with an ethernet cable. Still slow? Give us a bell on 0800 260 6627 and we'll sort it.",
  },
  {
    question: "Can I keep my phone number when switching?",
    answer: "Absolutely! For mobile, text 'PAC' to 65075 to get your porting code. For landlines, just let us know your current number and we'll handle the rest. Takes about 10 working days.",
  },
  {
    question: "What happens if I go over my data limit?",
    answer: "We don't charge for going over – we're not monsters. You'll just slow down to 1Mbps until your next billing date. Or you can buy a data boost in the app for £5.",
  },
  {
    question: "How do I cancel my service?",
    answer: "We hope you won't! But if you need to, just log in to your dashboard or call us. 30 days notice required. No exit fees on our rolling contracts because, again, not monsters.",
  },
  {
    question: "My internet keeps dropping. What should I do?",
    answer: "First, try the classic: turn the router off, count to 30, turn it back on. Still dodgy? Check if other devices have the same issue. If it's just one device, the problem's probably with that. If it's everything, call us and we'll run diagnostics.",
  },
  {
    question: "How do I set up my WiFi router?",
    answer: "We send it pre-configured! Just plug the grey cable into the master socket, wait for the lights to go green (about 5 minutes), and connect using the WiFi details on the sticker. Easy peasy.",
  },
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
  
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    category: "",
  });
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
      if (session?.user) {
        fetchTickets(session.user.id);
      }
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
      toast({
        title: "Sign in required",
        description: "Please sign in to submit a support ticket.",
        variant: "destructive",
      });
      return;
    }

    const result = ticketSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
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

      toast({
        title: "Ticket submitted!",
        description: "We'll get back to you within 24 hours.",
      });

      setFormData({ subject: "", description: "", category: "" });
      setShowTicketForm(false);
      fetchTickets(user.id);
    } catch (error) {
      logError("Support.handleSubmitTicket", error);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 0800 260 6627.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 grid-pattern">
        <div className="container mx-auto px-4">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-display-lg mb-4">
              HOW CAN WE
              <br />
              <span className="text-gradient">HELP?</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Stuck on something? We've got answers. And if we don't, we've got real humans who do.
            </p>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg border-4 border-foreground"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* User Tickets Section */}
      {user && (
        <section className="py-12 bg-secondary stripes">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-display-sm">YOUR TICKETS</h2>
                <motion.div whileHover={{ y: -4, x: -4, boxShadow: "8px 8px 0px 0px hsl(var(--foreground))" }}>
                  <Button
                    variant="hero"
                    onClick={() => setShowTicketForm(!showTicketForm)}
                  >
                    <Plus className="w-4 h-4" />
                    {showTicketForm ? "Cancel" : "New Ticket"}
                  </Button>
                </motion.div>
              </div>

              {/* Ticket Creation Form */}
              {showTicketForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card-brutal bg-card p-8 mb-8"
                >
                  <h3 className="font-display text-xl mb-6">CREATE NEW TICKET</h3>
                  
                  <div className="space-y-6">
                    {/* Category Selection */}
                    <div>
                      <Label className="font-display uppercase tracking-wider mb-3 block">
                        Category *
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map((cat) => (
                          <motion.button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, category: cat.value });
                              if (errors.category) setErrors({ ...errors, category: "" });
                            }}
                            className={`p-4 border-4 text-left transition-colors ${
                              formData.category === cat.value
                                ? "border-primary bg-primary/10"
                                : "border-foreground bg-background hover:bg-secondary"
                            }`}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <cat.icon className="w-5 h-5 mb-2" />
                            <span className="font-display text-sm">{cat.label}</span>
                          </motion.button>
                        ))}
                      </div>
                      {errors.category && (
                        <p className="text-destructive text-sm mt-2">{errors.category}</p>
                      )}
                    </div>

                    {/* Subject */}
                    <div>
                      <Label htmlFor="subject" className="font-display uppercase tracking-wider">
                        Subject *
                      </Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => {
                          setFormData({ ...formData, subject: e.target.value });
                          if (errors.subject) setErrors({ ...errors, subject: "" });
                        }}
                        placeholder="Brief description of your issue"
                        className="mt-1 border-4 border-foreground"
                      />
                      {errors.subject && (
                        <p className="text-destructive text-sm mt-1">{errors.subject}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <Label htmlFor="description" className="font-display uppercase tracking-wider">
                        Description *
                      </Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => {
                          setFormData({ ...formData, description: e.target.value });
                          if (errors.description) setErrors({ ...errors, description: "" });
                        }}
                        placeholder="Please provide as much detail as possible..."
                        className="mt-1 border-4 border-foreground min-h-[150px]"
                      />
                      {errors.description && (
                        <p className="text-destructive text-sm mt-1">{errors.description}</p>
                      )}
                    </div>

                    <Button
                      variant="hero"
                      className="w-full"
                      onClick={handleSubmitTicket}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Submit Ticket
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Existing Tickets */}
              {isLoadingTickets ? (
                <div className="flex items-center justify-center py-12">
                  <div className="p-4 border-4 border-foreground bg-background">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                </div>
              ) : tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket, index) => {
                    const status = statusConfig[ticket.status];
                    return (
                      <motion.div
                        key={ticket.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="card-brutal bg-card p-6"
                        whileHover={{ x: -4, boxShadow: "8px 0px 0px 0px hsl(var(--foreground))" }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-grow">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-8 h-8 ${status.color} flex items-center justify-center`}>
                                <status.icon className="w-4 h-4" />
                              </div>
                              <span className={`font-display text-sm uppercase ${status.textColor}`}>
                                {status.label}
                              </span>
                              {ticket.category && (
                                <span className="text-xs text-muted-foreground uppercase border-2 border-foreground/20 px-2 py-0.5">
                                  {ticket.category}
                                </span>
                              )}
                            </div>
                            <h4 className="font-display text-lg mb-1">{ticket.subject}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {ticket.description}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-muted-foreground">
                              {formatDate(ticket.created_at)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 border-4 border-dashed border-foreground/30 bg-card">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-display text-xl mb-2">NO TICKETS YET</h3>
                  <p className="text-muted-foreground mb-4">
                    Haven't had any issues? That's the way we like it!
                  </p>
                  <Button variant="outline" className="border-4 border-foreground" onClick={() => setShowTicketForm(true)}>
                    <Plus className="w-4 h-4" />
                    Create Your First Ticket
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Sign In Prompt for Non-Users */}
      {!user && (
        <section className="py-12 bg-secondary stripes">
          <div className="container mx-auto px-4">
            <motion.div
              className="max-w-2xl mx-auto card-brutal bg-card p-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <MessageSquare className="w-12 h-12 mx-auto mb-4" />
              <h2 className="font-display text-2xl mb-2">NEED TO RAISE A TICKET?</h2>
              <p className="text-muted-foreground mb-6">
                Sign in to submit and track your support requests.
              </p>
              <Link to="/auth">
                <Button variant="hero">
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-display-sm text-center mb-8">
            BROWSE BY CATEGORY
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {categories.map((category) => (
              <motion.div
                key={category.label}
                className="p-6 border-4 border-foreground bg-card flex items-start gap-4 cursor-pointer"
                whileHover={{ y: -4, x: -4, boxShadow: "8px 8px 0px 0px hsl(var(--foreground))" }}
                onClick={() => {
                  if (user) {
                    setFormData({ ...formData, category: category.value });
                    setShowTicketForm(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              >
                <div className="w-12 h-12 bg-primary flex items-center justify-center flex-shrink-0">
                  <category.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display text-lg">{category.label}</h3>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-display-sm text-center mb-8">
              FREQUENTLY ASKED QUESTIONS
            </h2>
            
            {filteredFaqs.length > 0 ? (
              <div className="space-y-4">
                {filteredFaqs.map((faq, index) => (
                  <Accordion key={index} type="single" collapsible>
                    <AccordionItem
                      value={`item-${index}`}
                      className="border-4 border-foreground bg-card px-6"
                    >
                      <AccordionTrigger className="text-left font-display hover:no-underline py-4">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-4">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-4 border-dashed border-foreground/30">
                <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No results found for "{searchQuery}". Try a different search or contact us directly.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-16 bg-foreground text-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-display-sm text-center mb-4">
              STILL STUCK?
            </h2>
            <p className="text-center text-background/70 mb-12">
              Our support team is based in Yorkshire and actually understands broadband.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <motion.div
                className="p-6 border-4 border-background/20 text-center"
                whileHover={{ y: -4, boxShadow: "0 8px 0 0 hsl(var(--primary))" }}
              >
                <div className="w-14 h-14 bg-primary flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl mb-2">CALL US</h3>
                <p className="text-sm text-background/70 mb-4">
                  Mon-Fri 8am-8pm, Sat 9am-5pm
                </p>
                <a href="tel:08002606627">
                  <Button variant="hero" className="w-full border-background">
                    0800 260 6627
                  </Button>
                </a>
              </motion.div>

              <motion.div
                className="p-6 border-4 border-background/20 text-center"
                whileHover={{ y: -4, boxShadow: "0 8px 0 0 hsl(var(--accent))" }}
              >
                <div className="w-14 h-14 bg-accent flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl mb-2">LIVE CHAT</h3>
                <p className="text-sm text-background/70 mb-4">
                  Quick questions? Chat with us now.
                </p>
                <Button variant="outline" className="w-full border-background text-background hover:bg-background hover:text-foreground">
                  Start Chat
                </Button>
              </motion.div>

              <motion.div
                className="p-6 border-4 border-background/20 text-center"
                whileHover={{ y: -4, boxShadow: "0 8px 0 0 hsl(var(--warning))" }}
              >
                <div className="w-14 h-14 bg-warning flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl mb-2">EMAIL US</h3>
                <p className="text-sm text-background/70 mb-4">
                  We reply within 24 hours. Promise.
                </p>
                <a href="mailto:support@occtatele.com">
                  <Button variant="outline" className="w-full border-background text-background hover:bg-background hover:text-foreground">
                    support@occtatele.com
                  </Button>
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Support;
