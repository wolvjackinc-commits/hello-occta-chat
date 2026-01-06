import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  Download, 
  Plus,
  LogOut,
  Loader2,
  Package,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  const userFullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer";

  const quickActions = [
    { icon: Package, label: "My Services", description: "View and manage your active services", href: "/dashboard/services" },
    { icon: FileText, label: "Invoices", description: "Download bills and payment history", href: "/dashboard/invoices" },
    { icon: HelpCircle, label: "Get Support", description: "Raise a ticket or check status", href: "/dashboard/support" },
    { icon: Settings, label: "Account Settings", description: "Update your details and preferences", href: "/dashboard/settings" },
  ];

  const activeServices = [
    { 
      type: "Broadband", 
      icon: Wifi, 
      plan: "Ultrafast 500", 
      status: "Active",
      nextBill: "£29.99 on 1st Feb" 
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">
              Alright, {userFullName}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your services
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/dashboard/services/new">
              <Button variant="hero">
                <Plus className="w-4 h-4" />
                Add Service
              </Button>
            </Link>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.href}>
              <Card className="h-full hover:shadow-soft transition-all duration-300 hover:border-primary/30 cursor-pointer group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <action.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-1">{action.label}</h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Active Services */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Your Active Services</CardTitle>
                <CardDescription>
                  Everything you've got running with us
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeServices.length > 0 ? (
                  <div className="space-y-4">
                    {activeServices.map((service, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                            <service.icon className="w-6 h-6 text-accent" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{service.type}</h4>
                            <p className="text-sm text-muted-foreground">{service.plan}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            {service.status}
                          </span>
                          <p className="text-sm text-muted-foreground mt-1">{service.nextBill}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-display font-bold text-lg mb-2">No services yet</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't signed up for any services. Let's change that!
                    </p>
                    <Link to="/broadband">
                      <Button variant="hero">Browse Services</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity / Quick Help */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Latest Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">January 2025</p>
                    <p className="text-2xl font-display font-bold text-primary">£29.99</p>
                    <p className="text-sm text-muted-foreground">Paid on 1st Jan</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/dashboard/support">
                  <Button variant="outline" className="w-full justify-start">
                    <HelpCircle className="w-4 h-4" />
                    Raise a Support Ticket
                  </Button>
                </Link>
                <a href="tel:08002606627">
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                    📞 Call 0800 260 6627
                  </Button>
                </a>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Upgrade Available!</h4>
                    <p className="text-sm text-muted-foreground">
                      You're eligible for our new Ultrafast 900 plan. Same price, double the speed!
                    </p>
                    <Button variant="link" className="px-0 h-auto mt-2 text-primary">
                      Learn more →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
