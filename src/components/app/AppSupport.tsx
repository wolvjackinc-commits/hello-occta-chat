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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
};

const faqItems = [
  { icon: Wifi, label: "Broadband Setup", description: "Installation & troubleshooting" },
  { icon: Smartphone, label: "SIM Activation", description: "Activate your new SIM" },
  { icon: CreditCard, label: "Billing Help", description: "Payment & invoices" },
  { icon: Settings, label: "Account Settings", description: "Manage your account" },
];

const contactMethods = [
  { icon: Phone, label: "Call Us", value: "0800 123 4567", color: "bg-success/10 text-success" },
  { icon: Mail, label: "Email", value: "support@occta.uk", color: "bg-accent/10 text-accent" },
  { icon: MessageCircle, label: "Live Chat", value: "Start chat", color: "bg-primary/10 text-primary" },
];

const AppSupport = () => {
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
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
    <div className="min-h-screen bg-muted/30">
      {/* Header Area */}
      <div className="bg-accent px-4 pt-4 pb-8 rounded-b-3xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background rounded-2xl p-4"
        >
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-8 h-8 text-accent" />
            </div>
            <h2 className="font-bold text-lg mb-1">How can we help?</h2>
            <p className="text-sm text-muted-foreground">We're here 24/7 for you</p>
          </div>
        </motion.div>
      </div>

      <div className="px-4 -mt-4">
        {/* Contact Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-background rounded-2xl p-4 shadow-sm mb-4"
        >
          <h3 className="font-semibold mb-4">Contact Us</h3>
          <div className="grid grid-cols-3 gap-3">
            {contactMethods.map((method) => (
              <button
                key={method.label}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30"
              >
                <div className={`w-12 h-12 rounded-xl ${method.color} flex items-center justify-center`}>
                  <method.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{method.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Active Tickets */}
        {user && tickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Your Tickets</h3>
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
            <Button className="w-full mt-4 rounded-xl bg-accent hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </motion.div>
        )}

        {/* Create Ticket for logged in users without tickets */}
        {user && tickets.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No Support Tickets</h3>
              <p className="text-sm text-muted-foreground mb-4">Need help? Create a ticket</p>
              <Button className="rounded-xl bg-accent hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </div>
          </motion.div>
        )}

        {/* FAQ Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-background rounded-2xl shadow-sm mb-4 overflow-hidden"
        >
          <h3 className="font-semibold p-4 pb-2">Help Topics</h3>
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

        {/* Padding for bottom nav */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default AppSupport;
