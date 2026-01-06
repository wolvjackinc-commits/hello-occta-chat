import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  FileText, 
  Settings, 
  HelpCircle, 
  Plus,
  LogOut,
  Loader2,
  Package,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: string;
  service_type: 'broadband' | 'sim' | 'landline';
  plan_name: string;
  plan_price: number;
  status: 'pending' | 'confirmed' | 'active' | 'cancelled';
  created_at: string;
};

type GuestOrder = {
  id: string;
  order_number: string;
  service_type: string;
  plan_name: string;
  plan_price: number;
  full_name: string;
  email: string;
  created_at: string;
  user_id: string | null;
};

type SupportTicket = {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const serviceIcons = {
  broadband: Wifi,
  sim: Smartphone,
  landline: PhoneCall,
};

const statusConfig = {
  pending: { color: "bg-warning", textColor: "text-warning", label: "Pending" },
  confirmed: { color: "bg-accent", textColor: "text-accent", label: "Confirmed" },
  active: { color: "bg-primary", textColor: "text-primary", label: "Active" },
  cancelled: { color: "bg-destructive", textColor: "text-destructive", label: "Cancelled" },
};

const ticketStatusConfig = {
  open: { icon: Clock, color: "bg-warning", label: "Open" },
  in_progress: { icon: Loader2, color: "bg-accent", label: "In Progress" },
  resolved: { icon: CheckCircle, color: "bg-primary", label: "Resolved" },
  closed: { icon: XCircle, color: "bg-muted", label: "Closed" },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate("/auth");
      } else {
        // Defer data fetching to avoid deadlock
        setTimeout(() => {
          fetchUserData(session.user.id);
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserData = async (userId: string) => {
    setIsDataLoading(true);
    
    try {
      // Fetch all data in parallel
      const [profileResult, ordersResult, guestOrdersResult, ticketsResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("guest_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("support_tickets").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data);
      }
      
      if (ordersResult.data) {
        setOrders(ordersResult.data);
      }

      if (guestOrdersResult.data) {
        setGuestOrders(guestOrdersResult.data);
      }
      
      if (ticketsResult.data) {
        setTickets(ticketsResult.data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "See you soon!",
      });
      navigate("/");
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="p-4 border-4 border-foreground bg-background">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  const userFullName = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer";
  const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'confirmed');
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const allOrders = [...orders, ...guestOrders.map(g => ({ ...g, status: 'pending' as const, service_type: g.service_type as 'broadband' | 'sim' | 'landline' }))];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
    },
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Welcome Header */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-display-md">
                Alright, {userFullName}! 👋
              </h1>
              <p className="text-muted-foreground mt-1 font-display uppercase tracking-wider">
                Here's what's happening with your services
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/broadband">
                <motion.div whileHover={{ y: -4, x: -4, boxShadow: "8px 8px 0px 0px hsl(var(--foreground))" }}>
                  <Button variant="hero">
                    <Plus className="w-4 h-4" />
                    Add Service
                  </Button>
                </motion.div>
              </Link>
              <Button variant="outline" onClick={handleSignOut} className="border-4 border-foreground">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            {[
              { label: "Active Services", value: activeOrders.length, color: "bg-primary" },
              { label: "Total Orders", value: allOrders.length, color: "bg-accent" },
              { label: "Open Tickets", value: openTickets.length, color: "bg-warning" },
              { label: "All Tickets", value: tickets.length, color: "bg-secondary" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                className={`p-4 border-4 border-foreground ${stat.color}`}
                whileHover={{ y: -4, x: -4, boxShadow: "8px 8px 0px 0px hsl(var(--foreground))" }}
              >
                <div className="font-display text-display-sm">{stat.value}</div>
                <div className="font-display text-sm uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Orders Section */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <div className="card-brutal bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-display-sm">YOUR ORDERS</h2>
                  <Link to="/broadband">
                    <Button variant="outline" size="sm" className="border-4 border-foreground">
                      <Plus className="w-4 h-4" />
                      New Order
                    </Button>
                  </Link>
                </div>

                {isDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : allOrders.length > 0 ? (
                  <div className="space-y-4">
                    {orders.map((order, index) => {
                      const Icon = serviceIcons[order.service_type];
                      const status = statusConfig[order.status];
                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-4 border-4 border-foreground bg-background hover:bg-secondary transition-colors"
                          whileHover={{ x: -4, boxShadow: "8px 0px 0px 0px hsl(var(--foreground))" }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center">
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-display text-lg uppercase">{order.plan_name}</h4>
                              <p className="text-sm text-muted-foreground capitalize">{order.service_type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 ${status.color} border-2 border-foreground`}>
                              <span className="font-display text-sm uppercase">{status.label}</span>
                            </div>
                            <p className="text-lg font-display mt-1">£{order.plan_price}/mo</p>
                          </div>
                        </motion.div>
                      );
                    })}
                    {guestOrders.map((order, index) => {
                      const Icon = serviceIcons[order.service_type as keyof typeof serviceIcons] || Package;
                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (orders.length + index) * 0.1 }}
                          className="flex items-center justify-between p-4 border-4 border-foreground bg-background hover:bg-secondary transition-colors"
                          whileHover={{ x: -4, boxShadow: "8px 0px 0px 0px hsl(var(--foreground))" }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center">
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-display text-lg uppercase">{order.plan_name}</h4>
                              <p className="text-sm text-muted-foreground capitalize">{order.service_type}</p>
                              <p className="text-xs text-muted-foreground">Order #{order.order_number}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-warning border-2 border-foreground">
                              <span className="font-display text-sm uppercase">Processing</span>
                            </div>
                            <p className="text-lg font-display mt-1">£{order.plan_price}/mo</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 border-4 border-dashed border-foreground/30">
                    <div className="w-16 h-16 bg-foreground text-background flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8" />
                    </div>
                    <h3 className="font-display text-xl mb-2">NO ORDERS YET</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't ordered any services. Let's change that!
                    </p>
                    <Link to="/broadband">
                      <Button variant="hero">Browse Services</Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={itemVariants} className="space-y-6">
              {/* Support Tickets */}
              <div className="card-brutal bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg">SUPPORT TICKETS</h3>
                  <Link to="/support">
                    <Button variant="ghost" size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>

                {isDataLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : tickets.length > 0 ? (
                  <div className="space-y-3">
                    {tickets.slice(0, 3).map((ticket) => {
                      const ticketStatus = ticketStatusConfig[ticket.status];
                      return (
                        <motion.div
                          key={ticket.id}
                          className="p-3 border-4 border-foreground bg-background"
                          whileHover={{ x: -2, boxShadow: "4px 0px 0px 0px hsl(var(--foreground))" }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 ${ticketStatus.color} flex items-center justify-center flex-shrink-0`}>
                              <ticketStatus.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-grow min-w-0">
                              <p className="font-display text-sm truncate">{ticket.subject}</p>
                              <p className="text-xs text-muted-foreground uppercase">{ticketStatus.label}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    <Link to="/support" className="block">
                      <Button variant="outline" className="w-full border-4 border-foreground">
                        View All Tickets
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No tickets yet</p>
                    <Link to="/support">
                      <Button variant="outline" size="sm" className="mt-3 border-4 border-foreground">
                        Get Support
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Quick Help */}
              <div className="card-brutal bg-foreground text-background p-6">
                <h3 className="font-display text-lg mb-4">NEED HELP?</h3>
                <div className="space-y-3">
                  <Link to="/support">
                    <Button variant="outline" className="w-full justify-start bg-transparent border-background text-background hover:bg-background hover:text-foreground">
                      <HelpCircle className="w-4 h-4" />
                      Raise a Ticket
                    </Button>
                  </Link>
                  <a href="tel:08002606627">
                    <Button variant="ghost" className="w-full justify-start text-background/70 hover:text-background hover:bg-background/10">
                      📞 Call 0800 260 6627
                    </Button>
                  </a>
                </div>
              </div>

              {/* Promo Card */}
              <motion.div
                className="p-6 border-4 border-primary bg-primary/10"
                whileHover={{ rotate: 1 }}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-display text-sm mb-1">UPGRADE AVAILABLE!</h4>
                    <p className="text-sm text-muted-foreground">
                      Double your speed for £5/mo more. Worth it? We think so.
                    </p>
                    <Button variant="link" className="px-0 h-auto mt-2 text-primary font-display">
                      Learn more →
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Dashboard;
