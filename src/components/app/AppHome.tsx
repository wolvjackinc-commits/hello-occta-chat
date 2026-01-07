import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wifi, Smartphone, PhoneCall, ArrowRight, Package, HelpCircle, User, Bell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PullToRefresh from "./PullToRefresh";
import { useToast } from "@/hooks/use-toast";

const services = [
  {
    icon: Wifi,
    title: "Broadband",
    price: "From £22.99/mo",
    link: "/broadband",
    color: "bg-primary",
  },
  {
    icon: Smartphone,
    title: "SIM Plans",
    price: "From £7.99/mo",
    link: "/sim-plans",
    color: "bg-accent",
  },
  {
    icon: PhoneCall,
    title: "Landline",
    price: "From £7.99/mo",
    link: "/landline",
    color: "bg-warning",
  },
];

const quickActions = [
  { icon: Package, label: "My Orders", link: "/dashboard" },
  { icon: HelpCircle, label: "Get Help", link: "/support" },
  { icon: User, label: "Account", link: "/dashboard" },
];

const AppHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userName, setUserName] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      
      setUserName(profile?.full_name || user.email?.split("@")[0] || null);

      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      
      setOrderCount(count || 0);
    }
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    fetchUserData();
    
    // Check notification permission
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, [fetchUserData]);

  const handleRefresh = async () => {
    await fetchUserData();
    toast({
      title: "Refreshed",
      description: "Data updated successfully",
    });
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Not supported",
        description: "Push notifications are not supported on this device",
        variant: "destructive",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast({
        title: "Notifications enabled",
        description: "You'll receive updates about your orders",
      });
      
      // Show a test notification
      new Notification("OCCTA", {
        body: "Notifications are now enabled!",
        icon: "/pwa-192x192.png",
      });
    } else {
      toast({
        title: "Permission denied",
        description: "Please enable notifications in your device settings",
        variant: "destructive",
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <motion.div
        className="px-4 py-6"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Welcome Section */}
        <motion.div variants={itemVariants} className="mb-6">
          <h1 className="text-2xl font-display font-bold mb-1">
            {userName ? `Hello, ${userName}! 👋` : "Hello! 👋"}
          </h1>
          <p className="text-muted-foreground text-sm">
            What service are you looking for today?
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Pull down to refresh • Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </motion.div>

        {/* Notifications Banner */}
        {!notificationsEnabled && "Notification" in window && (
          <motion.div variants={itemVariants} className="mb-4">
            <button
              onClick={handleEnableNotifications}
              className="w-full flex items-center gap-3 p-3 bg-accent/20 border-2 border-accent text-left"
            >
              <Bell className="w-5 h-5 text-accent" />
              <div className="flex-1">
                <p className="font-display text-sm uppercase">Enable Notifications</p>
                <p className="text-xs text-muted-foreground">Get updates about your orders</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}

        {/* Active Orders Badge */}
        {orderCount > 0 && (
          <motion.div variants={itemVariants} className="mb-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 p-3 bg-primary/10 border-2 border-primary"
            >
              <Package className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-display text-sm uppercase">You have {orderCount} order{orderCount !== 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground">Tap to view details</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </motion.div>
        )}

        {/* Services Grid */}
        <motion.div variants={itemVariants} className="mb-6">
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Our Services
          </h2>
          <div className="space-y-3">
            {services.map((service) => (
              <motion.div
                key={service.title}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={service.link}
                  className="flex items-center gap-4 p-4 bg-card border-4 border-foreground active:bg-secondary transition-colors"
                >
                  <div className={`w-12 h-12 ${service.color} border-2 border-foreground flex items-center justify-center`}>
                    <service.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg uppercase">{service.title}</h3>
                    <p className="text-sm text-muted-foreground">{service.price}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="mb-6">
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <motion.div key={action.label} whileTap={{ scale: 0.95 }}>
                <Link
                  to={action.link}
                  className="flex flex-col items-center gap-2 p-4 bg-secondary border-4 border-foreground text-center"
                >
                  <action.icon className="w-6 h-6" />
                  <span className="text-xs font-display uppercase">{action.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Banner */}
        <motion.div variants={itemVariants}>
          <div className="p-4 bg-primary border-4 border-foreground">
            <h3 className="font-display text-lg uppercase mb-2">No Contracts</h3>
            <p className="text-sm mb-3">Cancel anytime. No hidden fees. Real UK support.</p>
            <Link to="/broadband">
              <Button variant="outline" size="sm" className="bg-background border-2 border-foreground">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </PullToRefresh>
  );
};

export default AppHome;
