import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getPlanById, Plan } from "@/lib/plans";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Loader2, 
  Wifi, 
  Smartphone, 
  PhoneCall,
  MapPin,
  CreditCard,
  CheckCircle
} from "lucide-react";

const addressSchema = z.object({
  postcode: z.string().min(5, "Enter a valid postcode").max(10, "Postcode too long"),
  addressLine1: z.string().min(3, "Enter your address").max(100, "Address too long"),
  addressLine2: z.string().max(100, "Address too long").optional(),
  city: z.string().min(2, "Enter your city").max(50, "City name too long"),
});

type AddressData = z.infer<typeof addressSchema>;

const serviceIcons = {
  broadband: Wifi,
  sim: Smartphone,
  landline: PhoneCall,
};

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const planId = searchParams.get("plan");
  const [plan, setPlan] = useState<Plan | null>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [orderComplete, setOrderComplete] = useState(false);
  
  const [addressData, setAddressData] = useState<AddressData>({
    postcode: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (planId) {
      const foundPlan = getPlanById(planId);
      if (foundPlan) {
        setPlan(foundPlan);
      } else {
        navigate("/broadband");
      }
    } else {
      navigate("/broadband");
    }
  }, [planId, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate(`/auth?mode=signup&redirect=/checkout?plan=${planId}`);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate(`/auth?mode=signup&redirect=/checkout?plan=${planId}`);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, planId]);

  const validateAddress = () => {
    const result = addressSchema.safeParse(addressData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleAddressChange = (field: keyof AddressData, value: string) => {
    setAddressData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleNextStep = () => {
    if (step === 1 && validateAddress()) {
      setStep(2);
    }
  };

  const handleSubmitOrder = async () => {
    if (!user || !plan) return;

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        service_type: plan.serviceType,
        plan_name: plan.name,
        plan_price: plan.priceNum,
        postcode: addressData.postcode.trim(),
        address_line1: addressData.addressLine1.trim(),
        address_line2: addressData.addressLine2?.trim() || null,
        city: addressData.city.trim(),
        notes: notes.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      setOrderComplete(true);
      toast({
        title: "Order placed!",
        description: "We'll be in touch shortly to confirm your installation date.",
      });
    } catch (error) {
      console.error("Order error:", error);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 0800 260 6627.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !plan) {
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

  if (orderComplete) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto text-center px-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-24 h-24 bg-primary border-4 border-foreground flex items-center justify-center mx-auto mb-8"
            >
              <CheckCircle className="w-12 h-12 text-primary-foreground" />
            </motion.div>
            
            <h1 className="text-display-md mb-4">ORDER PLACED!</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Brilliant! We've got your order for <strong>{plan.name}</strong>. 
              One of our team will call you within 24 hours to arrange installation.
            </p>
            
            <div className="card-brutal bg-card p-6 mb-8 text-left">
              <h3 className="font-display text-lg mb-4">ORDER SUMMARY</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-display">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly cost</span>
                  <span className="font-display">£{plan.price}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Installation</span>
                  <span className="font-display text-primary">FREE</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard">
                <Button variant="hero">Go to Dashboard</Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="border-4 border-foreground">
                  Back to Home
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const Icon = serviceIcons[plan.serviceType];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link
            to={`/${plan.serviceType === 'sim' ? 'sim-plans' : plan.serviceType}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-display uppercase tracking-wider text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to plans
          </Link>

          {/* Progress Steps */}
          <div className="flex items-center gap-4 mb-12">
            {[
              { num: 1, label: "Address" },
              { num: 2, label: "Review" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center gap-4">
                <motion.div
                  className={`w-12 h-12 border-4 border-foreground flex items-center justify-center font-display text-xl ${
                    step >= s.num ? "bg-primary text-primary-foreground" : "bg-background"
                  }`}
                  animate={{ scale: step === s.num ? 1.1 : 1 }}
                >
                  {step > s.num ? <Check className="w-6 h-6" /> : s.num}
                </motion.div>
                <span className={`font-display uppercase tracking-wider ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < 1 && <div className="w-16 h-1 bg-foreground/20" />}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="card-brutal bg-card p-8"
              >
                {step === 1 && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <MapPin className="w-6 h-6" />
                      <h2 className="text-display-sm">YOUR ADDRESS</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="postcode" className="font-display uppercase tracking-wider">
                          Postcode *
                        </Label>
                        <Input
                          id="postcode"
                          value={addressData.postcode}
                          onChange={(e) => handleAddressChange("postcode", e.target.value.toUpperCase())}
                          placeholder="HD1 2QD"
                          className="mt-1 border-4 border-foreground"
                        />
                        {errors.postcode && (
                          <p className="text-destructive text-sm mt-1">{errors.postcode}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="addressLine1" className="font-display uppercase tracking-wider">
                          Address Line 1 *
                        </Label>
                        <Input
                          id="addressLine1"
                          value={addressData.addressLine1}
                          onChange={(e) => handleAddressChange("addressLine1", e.target.value)}
                          placeholder="123 High Street"
                          className="mt-1 border-4 border-foreground"
                        />
                        {errors.addressLine1 && (
                          <p className="text-destructive text-sm mt-1">{errors.addressLine1}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="addressLine2" className="font-display uppercase tracking-wider">
                          Address Line 2
                        </Label>
                        <Input
                          id="addressLine2"
                          value={addressData.addressLine2}
                          onChange={(e) => handleAddressChange("addressLine2", e.target.value)}
                          placeholder="Flat 4"
                          className="mt-1 border-4 border-foreground"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="city" className="font-display uppercase tracking-wider">
                          City *
                        </Label>
                        <Input
                          id="city"
                          value={addressData.city}
                          onChange={(e) => handleAddressChange("city", e.target.value)}
                          placeholder="Huddersfield"
                          className="mt-1 border-4 border-foreground"
                        />
                        {errors.city && (
                          <p className="text-destructive text-sm mt-1">{errors.city}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="notes" className="font-display uppercase tracking-wider">
                          Installation Notes (optional)
                        </Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="E.g., best time to call, access instructions..."
                          className="mt-1 border-4 border-foreground"
                          rows={3}
                        />
                      </div>
                    </div>

                    <Button
                      variant="hero"
                      className="w-full mt-8"
                      onClick={handleNextStep}
                    >
                      Continue to Review
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <CreditCard className="w-6 h-6" />
                      <h2 className="text-display-sm">REVIEW ORDER</h2>
                    </div>

                    <div className="space-y-6">
                      {/* Address Summary */}
                      <div className="p-4 border-4 border-foreground bg-secondary">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-display uppercase tracking-wider text-sm">Delivery Address</span>
                          <button
                            onClick={() => setStep(1)}
                            className="text-primary font-display uppercase tracking-wider text-sm hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                        <p className="text-muted-foreground">
                          {addressData.addressLine1}
                          {addressData.addressLine2 && <>, {addressData.addressLine2}</>}
                          <br />
                          {addressData.city}, {addressData.postcode}
                        </p>
                      </div>

                      {/* Plan Summary */}
                      <div className="p-4 border-4 border-foreground">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary border-4 border-foreground flex items-center justify-center">
                            <Icon className="w-6 h-6 text-primary-foreground" />
                          </div>
                          <div className="flex-grow">
                            <h3 className="font-display text-xl">{plan.name}</h3>
                            <p className="text-muted-foreground capitalize">{plan.serviceType}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-display text-2xl">£{plan.price}</div>
                            <div className="text-muted-foreground text-sm">/month</div>
                          </div>
                        </div>
                      </div>

                      {/* Price Breakdown */}
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b-2 border-foreground/10">
                          <span>Monthly subscription</span>
                          <span className="font-display">£{plan.price}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-foreground/10">
                          <span>Installation fee</span>
                          <span className="font-display text-primary line-through decoration-2">£60.00</span>
                        </div>
                        <div className="flex justify-between py-2 border-b-2 border-foreground/10">
                          <span className="text-primary font-display">FREE installation promo</span>
                          <span className="font-display text-primary">-£60.00</span>
                        </div>
                        <div className="flex justify-between py-4 text-xl">
                          <span className="font-display">DUE TODAY</span>
                          <span className="font-display">£0.00</span>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        By placing this order, you agree to our{" "}
                        <Link to="/terms" className="underline">Terms of Service</Link>
                        {" "}and{" "}
                        <Link to="/privacy-policy" className="underline">Privacy Policy</Link>.
                        Your first bill of £{plan.price} will be due after installation.
                      </p>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <Button
                        variant="outline"
                        className="border-4 border-foreground"
                        onClick={() => setStep(1)}
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                      </Button>
                      <Button
                        variant="hero"
                        className="flex-grow"
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            Place Order
                            <Check className="w-5 h-5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="card-brutal bg-foreground text-background p-6 sticky top-24">
                <h3 className="font-display text-lg mb-4">YOUR PLAN</h3>
                
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-background/20">
                  <div className="w-14 h-14 bg-primary flex items-center justify-center">
                    <Icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="font-display text-xl">{plan.name}</div>
                    <div className="text-background/60 capitalize">{plan.serviceType}</div>
                  </div>
                </div>
                
                <ul className="space-y-2 mb-6">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-background/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="pt-6 border-t border-background/20">
                  <div className="flex justify-between items-baseline">
                    <span className="font-display uppercase tracking-wider text-sm">Monthly</span>
                    <div>
                      <span className="font-display text-3xl">£{plan.price}</span>
                      <span className="text-background/60">/mo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
