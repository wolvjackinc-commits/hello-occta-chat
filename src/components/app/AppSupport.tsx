import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  ChevronRight,
  FileText,
  HelpCircle,
  Wifi,
  Smartphone,
  CreditCard,
  Settings,
  Plus,
  Bot,
  LayoutDashboard,
  Ticket,
  Shield,
  Clock,
  AlertTriangle,
  Lock,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";

type TicketType = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
};

const faqItems = [
  { icon: CreditCard, label: "Billing & Payments", description: "Invoices, refunds, payment methods" },
  { icon: Wifi, label: "Broadband Help", description: "Speed, setup, troubleshooting" },
  { icon: Smartphone, label: "SIM & Mobile", description: "Activation, data, roaming" },
  { icon: AlertTriangle, label: "Faults & Outages", description: "Report issues, check status" },
  { icon: Lock, label: "Account & Security", description: "Password, settings, privacy" },
  { icon: ShoppingCart, label: "Orders & Activation", description: "Track orders, activation" },
];

const AppSupport = () => {
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data } = await supabase
          .from("support_tickets")
          .select("id, subject, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3);
        
        if (data) setTickets(data);
      }
      setIsLoading(false);
    };
    
    fetchData();
  }, []);

  const statusColors: Record<string, string> = {
    open: "bg-warning/20 text-warning",
    in_progress: "bg-accent/20 text-accent",
    resolved: "bg-success/20 text-success",
    closed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header Area - AI First */}
      <div className="bg-primary px-4 pt-4 pb-8 rounded-b-3xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background rounded-2xl p-4"
        >
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-bold text-lg mb-1">Instant Help — 24/7</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Solve issues in seconds with our AI assistant
            </p>
            <Button className="w-full rounded-xl bg-primary hover:bg-primary/90">
              <MessageCircle className="w-4 h-4 mr-2" />
              Start AI Chat
            </Button>
          </div>
        </motion.div>
      </div>

      <div className="px-4 -mt-4">
        {/* Self-Service Dashboard Promotion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-background rounded-2xl p-4 shadow-sm mb-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">Manage Everything</h3>
              <p className="text-xs text-muted-foreground">From your account dashboard</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            View bills, download invoices, check service status, and update your details — all without waiting.
          </p>
          <Link to="/dashboard">
            <Button variant="outline" className="w-full rounded-xl">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
        </motion.div>

        {/* FAQ Topics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-background rounded-2xl shadow-sm mb-4 overflow-hidden"
        >
          <h3 className="font-semibold p-4 pb-2">Help Topics</h3>
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            Find answers instantly — no waiting required
          </p>
          {faqItems.map((item, index) => (
            <button
              key={item.label}
              className={`flex items-center gap-4 p-4 w-full text-left ${index !== faqItems.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </motion.div>

        {/* Active Tickets */}
        {user && tickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-accent" />
                <h3 className="font-semibold">Your Tickets</h3>
              </div>
              <Link to="/dashboard" className="text-sm text-accent font-medium">View All</Link>
            </div>
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ticket.subject}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[ticket.status] || statusColors.closed}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
            <Button className="w-full mt-4 rounded-xl" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Tip: Try our AI assistant first for faster help
            </p>
          </motion.div>
        )}

        {/* Create Ticket for logged in users without tickets */}
        {user && tickets.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <Ticket className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No Support Tickets</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Most issues can be resolved instantly with our AI assistant or FAQs above.
              </p>
              <Button variant="outline" className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </div>
          </motion.div>
        )}

        {/* Telephone Support - De-emphasised */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-muted/30 rounded-2xl p-4 mb-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Phone className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-muted-foreground">Telephone Support</h3>
              <p className="text-xs text-muted-foreground">For unresolved issues only</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            For faster resolution, please use our AI assistant, FAQs, or support ticket system first.
          </p>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{CONTACT_PHONE_DISPLAY}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Mon-Fri 9-6</span>
            </div>
          </div>
        </motion.div>

        {/* Trust Statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-primary/5 rounded-xl p-3 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary">Trusted & Secure</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Self-service support ensures faster resolution, full audit trails, and data protection.
          </p>
        </motion.div>

        {/* Padding for bottom nav */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default AppSupport;
