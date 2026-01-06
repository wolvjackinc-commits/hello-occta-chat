import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  User,
  Gift,
  Shield,
  Bell,
  Clock,
  Star,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Home,
} from "lucide-react";

const passwordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface OrderData {
  orderNumber: string;
  customerData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    currentProvider: string;
    inContract: string;
  };
  selectedPlans: Array<{
    id: string;
    name: string;
    price: string;
    serviceType: string;
  }>;
  selectedAddons: string[];
  marketingConsent: boolean;
  timestamp: string;
}

const ThankYou = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingOrder');
    if (stored) {
      try {
        setOrderData(JSON.parse(stored));
      } catch {
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [navigate]);

  const handleCreateAccount = async () => {
    const result = passwordSchema.safeParse({ password, confirmPassword });
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

    if (!orderData) return;

    setIsCreating(true);
    setErrors({});

    try {
      const { data, error } = await supabase.auth.signUp({
        email: orderData.customerData.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: `${orderData.customerData.firstName} ${orderData.customerData.lastName}`,
          },
        },
      });

      if (error) throw error;

      // Update profile with additional info
      if (data.user) {
        await supabase.from('profiles').update({
          full_name: `${orderData.customerData.firstName} ${orderData.customerData.lastName}`,
          phone: orderData.customerData.phone,
          address_line1: orderData.customerData.addressLine1,
          address_line2: orderData.customerData.addressLine2 || null,
          city: orderData.customerData.city,
          postcode: orderData.customerData.postcode,
        }).eq('id', data.user.id);
      }

      setAccountCreated(true);
      sessionStorage.removeItem('pendingOrder');
      
      toast({
        title: "Account created!",
        description: "Check your email to verify your account.",
      });
    } catch (error: any) {
      console.error("Account creation error:", error);
      
      if (error.message?.includes('already registered')) {
        toast({
          title: "Email already registered",
          description: "Try logging in instead, or use a different email.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Couldn't create account",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!orderData) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  const benefits = [
    { icon: Clock, title: "Track Your Order", desc: "Real-time updates on installation progress" },
    { icon: Bell, title: "Bill Notifications", desc: "Get alerted before payments are due" },
    { icon: Shield, title: "Easy Support", desc: "Raise tickets and chat with our team" },
    { icon: Gift, title: "Exclusive Offers", desc: "Members-only deals and early access" },
    { icon: Star, title: "Manage Add-ons", desc: "Upgrade or change services anytime" },
  ];

  return (
    <Layout>
      <div className="min-h-[60vh] py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            {/* Success Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-24 h-24 bg-primary border-4 border-foreground flex items-center justify-center mx-auto mb-8"
              >
                <CheckCircle className="w-12 h-12 text-primary-foreground" />
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-display-lg mb-4"
              >
                THANK YOU, {orderData.customerData.firstName.toUpperCase()}!
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl text-muted-foreground mb-6"
              >
                Your order has been received and is being processed.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="inline-block"
              >
                <div className="card-brutal bg-secondary px-8 py-4 inline-block">
                  <div className="text-muted-foreground text-sm uppercase tracking-wider mb-1">Order Number</div>
                  <div className="font-display text-2xl">{orderData.orderNumber}</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Order Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="card-brutal bg-card p-6 mb-8"
            >
              <h2 className="font-display text-lg mb-4 uppercase tracking-wider">Order Summary</h2>
              <div className="space-y-3">
                {orderData.selectedPlans.map((plan) => (
                  <div key={plan.id} className="flex justify-between items-center py-2 border-b border-foreground/10 last:border-0">
                    <div>
                      <div className="font-display">{plan.name}</div>
                      <div className="text-muted-foreground text-sm capitalize">{plan.serviceType}</div>
                    </div>
                    <div className="font-display">£{plan.price}/mo</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-foreground text-muted-foreground text-sm">
                <p>📧 A confirmation email has been sent to <strong>{orderData.customerData.email}</strong></p>
                <p className="mt-2">📞 We'll call you within 24 hours to confirm your installation date.</p>
              </div>
            </motion.div>

            {/* Account Creation Section */}
            {!accountCreated && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="card-brutal bg-primary/5 p-6 border-primary"
              >
                {!showAccountForm ? (
                  <>
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-12 h-12 bg-primary border-4 border-foreground flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="font-display text-xl mb-2">CREATE YOUR ACCOUNT</h2>
                        <p className="text-muted-foreground">
                          Manage your services, track orders, and access exclusive benefits.
                        </p>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div className="grid sm:grid-cols-2 gap-4 mb-6">
                      {benefits.map((benefit, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + idx * 0.1 }}
                          className="flex items-start gap-3 p-3 bg-background border-2 border-foreground/20"
                        >
                          <benefit.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-display text-sm">{benefit.title}</div>
                            <div className="text-muted-foreground text-xs">{benefit.desc}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        variant="hero"
                        className="flex-1"
                        onClick={() => setShowAccountForm(true)}
                      >
                        Yes, Create My Account
                        <ArrowRight className="w-5 h-5" />
                      </Button>
                      <Link to="/" className="flex-1">
                        <Button variant="outline" className="w-full border-4 border-foreground">
                          <Home className="w-5 h-5 mr-2" />
                          Maybe Later
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-xl mb-6">SET YOUR PASSWORD</h2>
                    
                    <div className="space-y-4 mb-6">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="font-display uppercase tracking-wider text-sm">Name</Label>
                          <Input
                            value={`${orderData.customerData.firstName} ${orderData.customerData.lastName}`}
                            disabled
                            className="mt-1 border-4 border-foreground/30 bg-secondary"
                          />
                        </div>
                        <div>
                          <Label className="font-display uppercase tracking-wider text-sm">Email</Label>
                          <Input
                            value={orderData.customerData.email}
                            disabled
                            className="mt-1 border-4 border-foreground/30 bg-secondary"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="font-display uppercase tracking-wider text-sm">Create Password</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 8 chars, 1 uppercase, 1 number"
                            className="border-4 border-foreground pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
                      </div>

                      <div>
                        <Label className="font-display uppercase tracking-wider text-sm">Confirm Password</Label>
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          className="mt-1 border-4 border-foreground"
                        />
                        {errors.confirmPassword && <p className="text-destructive text-sm mt-1">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        variant="hero"
                        className="flex-1"
                        onClick={handleCreateAccount}
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : (
                          <>
                            Create Account
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-4 border-foreground"
                        onClick={() => setShowAccountForm(false)}
                      >
                        Back
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Account Created Success */}
            {accountCreated && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card-brutal bg-primary/10 p-6 border-primary text-center"
              >
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="font-display text-xl mb-2">ACCOUNT CREATED!</h2>
                <p className="text-muted-foreground mb-6">
                  Check your email to verify your account, then log in to access your dashboard.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/auth">
                    <Button variant="hero">
                      Go to Login
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/">
                    <Button variant="outline" className="border-4 border-foreground">
                      <Home className="w-5 h-5 mr-2" />
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ThankYou;
