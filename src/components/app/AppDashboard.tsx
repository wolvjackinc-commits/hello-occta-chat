import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  LogOut,
  Loader2,
  Package,
  ChevronRight,
  Settings,
  HelpCircle,
  FileText,
  User as UserIcon,
  Bell,
  Shield,
  CreditCard,
  CheckCircle2,
  Clock,
  Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: string;
  service_type: 'broadband' | 'sim' | 'landline';
  plan_name: string;
  plan_price: number;
  status: 'pending' | 'confirmed' | 'active' | 'cancelled';
  created_at: string;
  postcode: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

const serviceIcons = {
  broadband: Wifi,
  sim: Smartphone,
  landline: PhoneCall,
};

const statusConfig = {
  pending: { color: "bg-warning/20 text-warning", icon: Clock, label: "Pending" },
  confirmed: { color: "bg-accent/20 text-accent", icon: CheckCircle2, label: "Confirmed" },
  active: { color: "bg-success/20 text-success", icon: CheckCircle2, label: "Active" },
  cancelled: { color: "bg-destructive/20 text-destructive", icon: Clock, label: "Cancelled" },
};

const AppDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate("/auth");
      } else {
        setTimeout(() => fetchUserData(session.user.id), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
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
    try {
      const [profileResult, ordersResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      if (profileResult.data) setProfile(profileResult.data);
      if (ordersResult.data) setOrders(ordersResult.data);
    } catch (error) {
      logError("AppDashboard.fetchUserData", error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      toast({ title: "Signed out", description: "See you soon!" });
      navigate("/");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return null;

  const userName = profile?.full_name || user.email?.split("@")[0] || "User";
  const userInitials = userName.slice(0, 2).toUpperCase();
  const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'confirmed');
  const totalMonthly = activeOrders.reduce((sum, o) => sum + o.plan_price, 0);

  const menuItems = [
    { icon: Package, label: "All Orders", description: "View order history", link: "/dashboard", badge: orders.length },
    { icon: HelpCircle, label: "Support", description: "Get help & contact us", link: "/support" },
    { icon: FileText, label: "Documents", description: "Bills & statements", link: "/dashboard" },
    { icon: Bell, label: "Notifications", description: "Manage alerts", link: "/dashboard" },
    { icon: Shield, label: "Privacy", description: "Security settings", link: "/dashboard" },
    { icon: Settings, label: "Settings", description: "App preferences", link: "/dashboard" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-accent px-4 pt-4 pb-8 rounded-b-3xl">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background rounded-2xl p-4"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-xl font-bold text-accent-foreground">
              {userInitials}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">{userName}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {profile?.phone && (
                <p className="text-sm text-muted-foreground">{profile.phone}</p>
              )}
            </div>
            <button className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          {activeOrders.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{activeOrders.length} Active Service{activeOrders.length !== 1 ? 's' : ''}</span>
                <span className="font-bold text-lg">£{totalMonthly.toFixed(2)}/mo</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <div className="px-4 -mt-4">
        {/* Active Services */}
        {activeOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Active Services</h3>
              <Link to="/dashboard" className="text-sm text-accent font-medium">View All</Link>
            </div>
            <div className="space-y-3">
              {activeOrders.slice(0, 2).map((order) => {
                const Icon = serviceIcons[order.service_type];
                const status = statusConfig[order.status];
                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
                  >
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{order.plan_name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground capitalize">{order.service_type}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">£{order.plan_price}</p>
                      <p className="text-xs text-muted-foreground">/month</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 mb-4"
        >
          <Link to="/broadband" className="bg-background rounded-2xl p-4 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <Wifi className="w-6 h-6 text-accent" />
            </div>
            <span className="text-xs font-medium">Add Broadband</span>
          </Link>
          <Link to="/sim-plans" className="bg-background rounded-2xl p-4 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-medium">Add SIM</span>
          </Link>
          <Link to="/support" className="bg-background rounded-2xl p-4 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-2">
              <HelpCircle className="w-6 h-6 text-success" />
            </div>
            <span className="text-xs font-medium">Get Help</span>
          </Link>
        </motion.div>

        {/* Menu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-background rounded-2xl shadow-sm mb-4 overflow-hidden"
        >
          {menuItems.map((item, index) => (
            <Link
              key={item.label}
              to={item.link}
              className={`flex items-center gap-4 p-4 ${index !== menuItems.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 bg-accent text-accent-foreground text-xs rounded-full font-medium">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          ))}
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default AppDashboard;
