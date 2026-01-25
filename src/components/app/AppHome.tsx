import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  ArrowRight, 
  Package, 
  HelpCircle, 
  FileText,
  Bell,
  CreditCard,
  Share2,
  CheckCircle2,
  ChevronRight,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PullToRefresh from "./PullToRefresh";
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

const quickActions = [
  { icon: Wifi, label: "Broadband", link: "/broadband", color: "bg-accent text-accent-foreground" },
  { icon: Smartphone, label: "SIM Plans", link: "/sim-plans", color: "bg-primary text-primary-foreground" },
  { icon: PhoneCall, label: "Landline", link: "/landline", color: "bg-warning text-warning-foreground" },
  { icon: Package, label: "My Orders", link: "/dashboard", color: "bg-success text-success-foreground" },
];

const AppHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeService, setActiveService] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const fetchUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      
      const [profileRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1),
      ]);
      
      if (profileRes.data) setProfile(profileRes.data);
      if (ordersRes.data && ordersRes.data.length > 0) setActiveService(ordersRes.data[0]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchUserData();
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, [fetchUserData]);

  const handleRefresh = async () => {
    await fetchUserData();
    toast({ title: "Refreshed", description: "Data updated" });
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      new Notification("OCCTA", { body: "Notifications enabled!", icon: "/pwa-192x192.png" });
    }
  };

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Guest";
  const userInitials = userName.slice(0, 2).toUpperCase();

  const serviceIcons: Record<string, any> = {
    broadband: Wifi,
    sim: Smartphone,
    landline: PhoneCall,
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-muted/30">
        {/* Header Card */}
        <div className="bg-accent px-4 pt-4 pb-8 rounded-b-3xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-sm font-bold text-accent">
                {userInitials}
              </div>
              <div>
                <p className="text-accent-foreground/70 text-xs">Welcome back</p>
                <p className="text-accent-foreground font-semibold">{userName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleEnableNotifications}
                className="w-10 h-10 rounded-full bg-accent-foreground/10 flex items-center justify-center relative"
              >
                <Bell className="w-5 h-5 text-accent-foreground" />
                {!notificationsEnabled && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Promo Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-background rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">No Contract Broadband!</p>
              <p className="text-sm text-muted-foreground">Cancel anytime, no hidden fees</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </div>

        <div className="px-4 -mt-4">
          {/* Active Service Card */}
          {activeService && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-background rounded-2xl p-4 shadow-sm mb-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground capitalize">{activeService.service_type}</span>
                  <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded-full font-medium">Active</span>
                </div>
                <button className="flex items-center gap-1 text-accent text-sm font-medium">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const Icon = serviceIcons[activeService.service_type] || Wifi;
                  return (
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-bold text-lg">{activeService.plan_name}</h3>
                  <p className="text-sm text-muted-foreground">{activeService.postcode}</p>
                </div>
              </div>

              <div className="bg-secondary rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/70">Monthly Bill</span>
                  <span className="font-bold text-lg">£{activeService.plan_price}/mo</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Service is active and running</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <Link to="/dashboard">
                  <Button variant="outline" className="w-full rounded-xl h-11">
                    View Details
                  </Button>
                </Link>
                <Link to="/support">
                  <Button className="w-full rounded-xl h-11 bg-accent hover:bg-accent/90">
                    Get Support
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* No Active Service */}
          {!activeService && !isLoading && user && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background rounded-2xl p-4 shadow-sm mb-4"
            >
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No Active Services</h3>
                <p className="text-sm text-muted-foreground mb-4">Get started with our amazing plans</p>
                <Link to="/broadband">
                  <Button className="rounded-xl bg-accent hover:bg-accent/90">
                    Browse Plans
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Guest Banner */}
          {!user && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background rounded-2xl p-4 shadow-sm mb-4"
            >
              <div className="text-center py-4">
                <h3 className="font-semibold mb-1">Sign In to Your Account</h3>
                <p className="text-sm text-muted-foreground mb-4">View your services and manage your account</p>
                <Link to="/auth">
                  <Button className="rounded-xl bg-accent hover:bg-accent/90">
                    Sign In
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-background rounded-2xl p-4 shadow-sm mb-4"
          >
            <h3 className="font-semibold mb-4">Our Services</h3>
            <div className="grid grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.link}
                  className="flex flex-col items-center gap-2"
                >
                  <div className={`w-14 h-14 rounded-2xl ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs text-center font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-background rounded-2xl shadow-sm mb-4 overflow-hidden"
          >
            <Link to="/support" className="flex items-center gap-4 p-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Help & Support</p>
                <p className="text-sm text-muted-foreground">Get help with your services</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Link to="/dashboard" className="flex items-center gap-4 p-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">View Bills</p>
                <p className="text-sm text-muted-foreground">Check your billing history</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
            <Link to="/about" className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="font-medium">About OCCTA</p>
                <p className="text-sm text-muted-foreground">Learn more about us</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </motion.div>

          {/* Padding for bottom nav */}
          <div className="h-4" />
        </div>
      </div>
    </PullToRefresh>
  );
};

export default AppHome;
