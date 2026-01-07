import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
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

const statusColors = {
  pending: "bg-warning",
  confirmed: "bg-accent",
  active: "bg-primary",
  cancelled: "bg-destructive",
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
        supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
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
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const userName = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'confirmed');

  const menuItems = [
    { icon: Package, label: "My Orders", link: "/dashboard", badge: orders.length },
    { icon: HelpCircle, label: "Support", link: "/support" },
    { icon: FileText, label: "Documents", link: "/dashboard" },
    { icon: Settings, label: "Settings", link: "/dashboard" },
  ];

  return (
    <motion.div
      className="px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-card border-4 border-foreground mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary border-2 border-foreground flex items-center justify-center">
            <UserIcon className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg uppercase">{userName}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </motion.div>

      {/* Active Services */}
      {activeOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Active Services
          </h3>
          <div className="space-y-2">
            {activeOrders.map((order) => {
              const Icon = serviceIcons[order.service_type];
              return (
                <div
                  key={order.id}
                  className="flex items-center gap-3 p-3 bg-secondary border-2 border-foreground"
                >
                  <div className={`w-10 h-10 ${statusColors[order.status]} border-2 border-foreground flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-sm uppercase">{order.plan_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{order.service_type}</p>
                  </div>
                  <p className="font-display text-sm">£{order.plan_price}/mo</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Menu */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Menu
        </h3>
        <div className="bg-card border-4 border-foreground divide-y-2 divide-foreground">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              to={item.link}
              className="flex items-center gap-3 p-4 active:bg-secondary transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1 font-display text-sm uppercase">{item.label}</span>
              {item.badge && (
                <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-display">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Sign Out */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          variant="outline"
          className="w-full border-4 border-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default AppDashboard;
