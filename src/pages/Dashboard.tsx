import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import AppDashboard from "@/components/app/AppDashboard";
import { Button } from "@/components/ui/button";
import { TicketDetailDialog } from "@/components/dashboard/TicketDetailDialog";
import { IdentityVerification } from "@/components/dashboard/IdentityVerification";
import { OrderTracking } from "@/components/dashboard/OrderTracking";
import { PaymentHistory } from "@/components/dashboard/PaymentHistory";
import { useAppMode } from "@/hooks/useAppMode";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/dashboard/tabs/OverviewTab";
import { ServicesTab } from "@/components/dashboard/tabs/ServicesTab";
import { OrdersTimelineTab } from "@/components/dashboard/tabs/OrdersTimelineTab";
import { QuotesTab } from "@/components/dashboard/tabs/QuotesTab";
import { ContractSummariesTab } from "@/components/dashboard/tabs/ContractSummariesTab";
import { InvoicesTab } from "@/components/dashboard/tabs/InvoicesTab";
import { SupportTab } from "@/components/dashboard/tabs/SupportTab";
import { ChatHistoryTab } from "@/components/dashboard/tabs/ChatHistoryTab";
import { ComplaintsTab } from "@/components/dashboard/tabs/ComplaintsTab";
import { RewardsTab } from "@/components/dashboard/tabs/RewardsTab";
import { DocumentsTab } from "@/components/dashboard/tabs/DocumentsTab";
import { AccountSettingsTab } from "@/components/dashboard/tabs/AccountSettingsTab";
import { VulnerableSupportTab } from "@/components/dashboard/tabs/VulnerableSupportTab";
import { logClientEvent } from "@/lib/activityLog";
import { useEffect as useEffectAlias } from "react";
import { 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  FileText, 
  HelpCircle, 
  Plus,
  LogOut,
  Loader2,
  Package,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Download,
  File,
  Receipt,
  Shield,
  CreditCard,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: string;
  service_type: 'broadband' | 'sim' | 'landline';
  plan_name: string;
  plan_price: number;
  status: 'pending' | 'confirmed' | 'active' | 'cancelled';
  created_at: string;
  installation_date?: string | null;
  admin_notes?: string | null;
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
  status?: string;
  admin_notes?: string | null;
};

type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_number: string | null;
  date_of_birth: string | null;
};

type UserFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  description: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string | null;
  issue_date: string;
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
  const { isAppMode } = useAppMode();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [userFiles, setUserFiles] = useState<UserFile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | GuestOrder | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);

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
      const [profileResult, ordersResult, guestOrdersResult, ticketsResult, filesResult, invoicesResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("guest_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("support_tickets").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
        supabase.from("user_files").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number, total, status, due_date, issue_date").eq("user_id", userId).in("status", ["draft", "sent", "overdue"]).order("due_date", { ascending: true }),
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

      if (filesResult.data) {
        setUserFiles(filesResult.data);
      }

      if (invoicesResult.data) {
        setInvoices(invoicesResult.data);
      }
    } catch (error) {
      logError("Dashboard.fetchUserData", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("user-files")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      logError("Dashboard.handleDownloadFile", error);
      toast({
        title: "Download failed",
        description: "Could not download the file. Please try again.",
        variant: "destructive",
      });
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

  const LayoutComponent = isAppMode ? AppLayout : Layout;

  if (isLoading) {
    return (
      <LayoutComponent>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="p-4 border-4 border-foreground bg-background">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </div>
      </LayoutComponent>
    );
  }

  if (!user) {
    return null;
  }

  // App mode: show compact app UI
  if (isAppMode) {
    return (
      <AppLayout>
        <AppDashboard />
      </AppLayout>
    );
  }

  const userFullName = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer";
  const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'confirmed');
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const allOrders = [...orders, ...guestOrders.map(g => ({ ...g, status: 'pending' as const, service_type: g.service_type as 'broadband' | 'sim' | 'landline' }))];
  
  // Filter invoice files from user files (for document download section)
  const invoiceFiles = userFiles.filter(f => 
    f.file_type.includes('pdf') || 
    f.file_name.toLowerCase().includes('invoice') ||
    f.description?.toLowerCase().includes('invoice')
  );
  
  // Outstanding invoices needing payment
  const outstandingInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled');
  
  // Group invoice files by month
  const groupedInvoiceFiles = invoiceFiles.reduce((acc, file) => {
    const monthKey = format(new Date(file.created_at), "MMMM yyyy");
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(file);
    return acc;
  }, {} as Record<string, UserFile[]>);

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

          {/* Account Info Card */}
          <motion.div
            variants={itemVariants}
            className="mb-8 p-6 border-4 border-foreground bg-card"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center border-4 border-foreground">
                  <UserIcon className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-display uppercase tracking-wider">Account Number</p>
                  <p className="text-display-sm font-mono">{profile?.account_number || 'Loading...'}</p>
                </div>
              </div>
              {profile?.date_of_birth && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-display uppercase tracking-wider">Date of Birth</p>
                  <p className="font-display">{format(new Date(profile.date_of_birth), 'dd MMMM yyyy')}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                {isIdentityVerified ? (
                  <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-4 py-2 border-2 border-primary/30">
                    <Shield className="w-4 h-4" />
                    Identity Verified
                  </div>
                ) : (
                  <IdentityVerification
                    accountNumber={profile?.account_number || null}
                    dateOfBirth={profile?.date_of_birth || null}
                    onVerified={() => setIsIdentityVerified(true)}
                    actionLabel="sensitive account actions"
                  >
                    <Button variant="outline" size="sm" className="border-2 border-foreground">
                      <Shield className="w-4 h-4 mr-2" />
                      Verify Identity
                    </Button>
                  </IdentityVerification>
                )}
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground bg-secondary/50 px-4 py-2 border-2 border-foreground/20">
              <p className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Use your account number + DOB for identity verification
              </p>
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

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full overflow-x-auto flex-wrap justify-start gap-1 h-auto bg-transparent border-b-4 border-foreground rounded-none p-0 mb-6">
              {[
                ["overview", "Overview"],
                ["services", "My Services"],
                ["orders", "My Orders"],
                ["quotes", "Quotes"],
                ["cs", "Contract Summaries"],
                ["invoices", "Invoices & Payments"],
                ["support", "Support"],
                ["chat", "Chat History"],
                ["complaints", "Complaints"],
                ["rewards", "Rewards & Referrals"],
                ["documents", "Documents"],
                ["account", "Account Settings"],
                ["vuln", "Vulnerable Support"],
              ].map(([v, l]) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="rounded-none border-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-display uppercase text-xs px-3 py-2"
                >
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab
                activeServices={activeOrders.length}
                pendingQuotes={0}
                latestOrderStatus={orders[0]?.status ?? guestOrders[0]?.status ?? null}
                unpaidInvoices={outstandingInvoices.length}
                unpaidTotal={outstandingInvoices.reduce((s, i) => s + Number(i.total), 0)}
                openTickets={openTickets.length}
              />
            </TabsContent>

            <TabsContent value="services"><ServicesTab userId={user.id} /></TabsContent>
            <TabsContent value="orders"><OrdersTimelineTab userId={user.id} userEmail={user.email ?? null} /></TabsContent>
            <TabsContent value="quotes"><QuotesTab userId={user.id} /></TabsContent>
            <TabsContent value="cs"><ContractSummariesTab userId={user.id} /></TabsContent>
            <TabsContent value="invoices"><InvoicesTab userId={user.id} /></TabsContent>
            <TabsContent value="support"><SupportTab tickets={tickets} /></TabsContent>
            <TabsContent value="chat"><ChatHistoryTab userId={user.id} /></TabsContent>
            <TabsContent value="complaints"><ComplaintsTab /></TabsContent>
            <TabsContent value="rewards"><RewardsTab /></TabsContent>
            <TabsContent value="documents"><DocumentsTab userId={user.id} /></TabsContent>
            <TabsContent value="account"><AccountSettingsTab profile={profile as any} /></TabsContent>
            <TabsContent value="vuln"><VulnerableSupportTab userId={user.id} /></TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <TicketDetailDialog
        ticket={selectedTicket}
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
      />
    </Layout>
  );
};

export default Dashboard;
