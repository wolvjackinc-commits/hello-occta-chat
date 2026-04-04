import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { logError } from "@/lib/logger";
import Layout from "@/components/layout/Layout";
import CheckoutSkeleton from "@/components/loading/CheckoutSkeleton";
import { useFormAutosave } from "@/hooks/useFormAutosave";
import { InstallationSlotPicker } from "@/components/scheduling/InstallationSlotPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { getPlanById, Plan, calculateBundleDiscount } from "@/lib/plans";
import { getAddonsByService, Addon, ukProviders } from "@/lib/addons";
import { getFromPrices, buildOrderSummary, getSOGEANote, VAT_RATE } from "@/lib/pricing/engine";
import { installScenarios, careLevels, catalogueProducts } from "@/lib/pricing/catalogue";
import type { CatalogueProduct } from "@/lib/pricing/types";
import { format, addDays } from "date-fns";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Plus,
  Minus,
  Wifi, 
  Smartphone, 
  PhoneCall,
  CalendarIcon,
  Shield,
  Clock,
  AlertCircle,
  Info,
  Globe,
  Router,
  Server,
  ShieldCheck,
  UserCheck,
  CreditCard,
  Zap,
  Plane,
  Ban,
  PhoneForwarded,
  Voicemail,
  User,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallationSlot {
  id: string;
  slot_date: string;
  slot_time: string;
  capacity: number;
  booked_count: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  router: Router,
  server: Server,
  shield: Shield,
  'shield-check': ShieldCheck,
  'user-check': UserCheck,
  smartphone: Smartphone,
  'credit-card': CreditCard,
  globe: Globe,
  'globe-2': Globe,
  plane: Plane,
  zap: Zap,
  ban: Ban,
  'phone-forwarded': PhoneForwarded,
  voicemail: Voicemail,
  user: User,
};

const customerSchema = z.object({
  firstName: z.string().trim().min(2, "Enter your first name").max(50, "Name too long"),
  lastName: z.string().trim().min(2, "Enter your last name").max(50, "Name too long"),
  email: z.string().trim().email("Enter a valid email address").max(100, "Email too long"),
  phone: z.string().trim().min(10, "Enter a valid phone number").max(15, "Phone number too long"),
  addressLine1: z.string().trim().min(3, "Enter your address").max(100, "Address too long"),
  addressLine2: z.string().max(100, "Address too long").optional(),
  city: z.string().trim().min(2, "Enter your city").max(50, "City too long"),
  postcode: z.string().trim().min(5, "Enter a valid postcode").max(10, "Postcode too long"),
  currentProvider: z.string().min(1, "Select your current provider"),
  inContract: z.string().min(1, "Please select an option"),
  preferredSwitchDate: z.date().optional(),
});

type CustomerData = z.infer<typeof customerSchema>;

const serviceIcons = {
  broadband: Wifi,
  sim: Smartphone,
  landline: PhoneCall,
};

const PreCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const planIds = searchParams.get("plans")?.split(",") || [];
  const [selectedPlans, setSelectedPlans] = useState<Plan[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  
  const [customerData, setCustomerData] = useState<CustomerData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    currentProvider: "",
    inContract: "",
    preferredSwitchDate: undefined,
  });
  
  const [gdprConsent, setGdprConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [selectedInstallationSlot, setSelectedInstallationSlot] = useState<InstallationSlot | null>(null);
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);
  const [userHasActiveBroadband, setUserHasActiveBroadband] = useState(false);
  const [installScenarioId, setInstallScenarioId] = useState<string | null>(null);
  const [careLevelId, setCareLevelId] = useState('standard');
  const [orderConsent, setOrderConsent] = useState(false);

  // Check if logged-in user already has active broadband service
  useEffect(() => {
    const checkExistingBroadband = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('services')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('service_type', 'broadband')
        .eq('status', 'active')
        .limit(1);
      if (data && data.length > 0) {
        setUserHasActiveBroadband(true);
      }
    };
    checkExistingBroadband();
  }, []);

  // Autosave form data
  const formDataToSave = useMemo(() => ({
    customerData,
    selectedAddons,
    additionalNotes,
    marketingConsent,
  }), [customerData, selectedAddons, additionalNotes, marketingConsent]);

  const { loadSavedData, clearSavedData, hasSavedData } = useFormAutosave({
    key: `checkout-form-${planIds.join(",")}`,
    data: formDataToSave,
  });

  // Check for saved form data on mount
  useEffect(() => {
    if (hasSavedData()) {
      setShowRestorePrompt(true);
    }
  }, [hasSavedData]);

  const handleRestoreData = () => {
    const saved = loadSavedData();
    if (saved) {
      const { data } = saved;
      if (data.customerData) {
        // Restore customer data, but handle preferredSwitchDate specially
        const restoredData = { ...data.customerData };
        if (restoredData.preferredSwitchDate) {
          restoredData.preferredSwitchDate = new Date(restoredData.preferredSwitchDate);
        }
        setCustomerData(restoredData);
      }
      if (data.selectedAddons) setSelectedAddons(data.selectedAddons);
      if (data.additionalNotes) setAdditionalNotes(data.additionalNotes);
      if (data.marketingConsent !== undefined) setMarketingConsent(data.marketingConsent);
    }
    setShowRestorePrompt(false);
  };

  const handleDiscardSavedData = () => {
    clearSavedData();
    setShowRestorePrompt(false);
  };

  useEffect(() => {
    if (planIds.length === 0) {
      navigate("/broadband");
      return;
    }
    
    const plans = planIds.map(id => getPlanById(id)).filter(Boolean) as Plan[];
    if (plans.length === 0) {
      navigate("/broadband");
      return;
    }
    
    setSelectedPlans(plans);
    
    // Get unique service types and fetch addons
    const serviceTypes = [...new Set(plans.map(p => p.serviceType))];
    const allAddons = serviceTypes.flatMap(type => getAddonsByService(type));
    setAvailableAddons(allAddons);

    // Pre-select addons from URL query param
    const addonParam = searchParams.get("addons");
    if (addonParam) {
      const addonIds = addonParam.split(",").filter(Boolean);
      setSelectedAddons(addonIds);
    }
  }, [planIds, navigate, searchParams]);

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(prev => 
      prev.includes(addonId) 
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  };

  const handleInputChange = (field: keyof CustomerData, value: string | Date | undefined) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const result = customerSchema.safeParse(customerData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);

      // Make validation failure obvious even if the user is scrolled away from the first invalid field.
      toast({
        title: "Check your details",
        description: "Please complete the highlighted fields before submitting.",
        variant: "destructive",
      });

      // Scroll to top so the user immediately sees errors.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    
    if (!gdprConsent) {
      toast({
        title: "Consent Required",
        description: "Please accept the GDPR data processing agreement.",
        variant: "destructive",
      });
      return false;
    }
    
    if (!termsConsent) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions.",
        variant: "destructive",
      });
      return false;
    }

    // Require install scenario for SOGEA broadband
    if (resolvedProduct && resolvedProduct.technology === 'SOGEA' && !installScenarioId) {
      toast({
        title: "Installation type required",
        description: "Please select an installation type for your broadband.",
        variant: "destructive",
      });
      return false;
    }

    // Require order consent
    if (!orderConsent) {
      toast({
        title: "Order consent required",
        description: "Please confirm the order terms before submitting.",
        variant: "destructive",
      });
      return false;
    }
    
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    // Generate order number
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    try {
      // Check rate limit (5 orders per hour per email)
      const { data: allowed, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
        _identifier: customerData.email.toLowerCase(),
        _action: 'order_create',
        _max_requests: 5,
        _window_minutes: 60
      });
      
      if (rateLimitError) {
        logError('PreCheckout.rateLimit', rateLimitError);
      }
      
      if (allowed === false) {
        toast({
          title: "Too many requests",
          description: "Please wait before submitting another order.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Calculate total price
      const bundleCalc = calculateBundleDiscount(selectedPlans);
      const addonsTotal = selectedAddons.reduce((sum, id) => {
        const addon = availableAddons.find(a => a.id === id);
        return sum + (addon?.price || 0);
      }, 0);
      const totalPrice = bundleCalc.discountedTotal + addonsTotal;
      
      // Get addon details for storage
      const selectedAddonDetails = selectedAddons.map(id => {
        const addon = availableAddons.find(a => a.id === id);
        return addon ? { id: addon.id, name: addon.name, price: addon.price } : null;
      }).filter(Boolean);
      
      // Save to database
      // IMPORTANT: guest_orders is intentionally not readable by anonymous users.
      // Using `.select()` after insert triggers a RETURNING read which will fail RLS.
      const { error } = await supabase.from('guest_orders').insert({
        order_number: orderNumber,
        email: customerData.email,
        full_name: `${customerData.firstName} ${customerData.lastName}`,
        phone: customerData.phone,
        address_line1: customerData.addressLine1,
        address_line2: customerData.addressLine2 || null,
        city: customerData.city,
        postcode: customerData.postcode,
        current_provider: customerData.currentProvider,
        in_contract: customerData.inContract !== 'no' && customerData.inContract !== 'new-connection',
        contract_end_date: null,
        preferred_switch_date: selectedInstallationSlot 
          ? selectedInstallationSlot.slot_date 
          : (customerData.preferredSwitchDate ? format(customerData.preferredSwitchDate, 'yyyy-MM-dd') : null),
        additional_notes: additionalNotes || null,
        gdpr_consent: gdprConsent,
        marketing_consent: marketingConsent,
        plan_name: selectedPlans.map(p => p.name).join(' + '),
        plan_price: totalPrice,
        service_type: selectedPlans.map(p => p.serviceType).join(','),
        selected_addons: selectedAddonDetails as unknown as Json,
      });
      
      if (error) throw error;

      // Fetch the new order id using a security-definer function that returns a safe subset
      // (avoids granting broad SELECT on guest_orders to anon).
      let insertedOrderId: string | null = null;
      try {
        const { data: lookedUp, error: lookupError } = await supabase.rpc('lookup_guest_order', {
          _order_number: orderNumber,
          _email: customerData.email,
        });
        if (lookupError) throw lookupError;
        insertedOrderId = lookedUp?.[0]?.id ?? null;
      } catch (lookupError) {
        logError('PreCheckout.handleSubmit.lookupGuestOrder', lookupError);
      }
      
      // Create installation booking if slot was selected
      if (selectedInstallationSlot && insertedOrderId) {
        try {
          await supabase.from('installation_bookings').insert({
            slot_id: selectedInstallationSlot.id,
            order_id: insertedOrderId,
            order_type: 'guest_order',
            customer_name: `${customerData.firstName} ${customerData.lastName}`,
            customer_email: customerData.email,
            customer_phone: customerData.phone,
            notes: additionalNotes || null,
          });
        } catch (bookingError) {
          logError('PreCheckout.handleSubmit.createBooking', bookingError);
          // Don't fail the order if booking creation fails
        }
      }
      
      // Send confirmation email (with orderNumber for guest verification)
      try {
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'order_confirmation',
            to: customerData.email,
            orderNumber: orderNumber,
            data: {
              full_name: `${customerData.firstName} ${customerData.lastName}`,
              order_number: orderNumber,
              service_type: selectedPlans.map(p => p.serviceType).join(', '),
              plan_name: selectedPlans.map(p => p.name).join(' + '),
              plan_price: totalPrice.toFixed(2),
              address_line1: customerData.addressLine1,
              city: customerData.city,
              postcode: customerData.postcode,
              email: customerData.email,
            }
          }
        });

        if (emailError) throw emailError;
      } catch (emailError) {
        logError('PreCheckout.handleSubmit.sendEmail', emailError);
        // Don't block the order if email fails
      }
      
      // Notify admins about new order (fire and forget)
      supabase.functions.invoke('admin-notify', {
        body: {
          type: 'new_guest_order',
          data: {
            id: insertedOrderId,
            order_number: orderNumber,
            customer_name: `${customerData.firstName} ${customerData.lastName}`,
            customer_email: customerData.email,
            phone: customerData.phone,
            date_of_birth: null, // Guest orders don't collect DOB
            plan_name: selectedPlans.map(p => p.name).join(' + '),
            plan_price: totalPrice,
            service_type: selectedPlans.map(p => p.serviceType).join(', '),
            address_line1: customerData.addressLine1,
            address_line2: customerData.addressLine2 || null,
            city: customerData.city,
            postcode: customerData.postcode,
            current_provider: customerData.currentProvider,
            in_contract: customerData.inContract !== 'no' && customerData.inContract !== 'new-connection',
            contract_end_date: null,
            preferred_switch_date: selectedInstallationSlot 
              ? selectedInstallationSlot.slot_date 
              : (customerData.preferredSwitchDate ? format(customerData.preferredSwitchDate, 'yyyy-MM-dd') : null),
            selected_addons: selectedAddonDetails,
            additional_notes: additionalNotes || null,
            gdpr_consent: gdprConsent,
            marketing_consent: marketingConsent,
            account_number: null, // Assigned later when order is activated
            created_at: new Date().toISOString(),
            ip_address: 'Captured server-side', // Note: Real IP requires server-side capture
            user_agent: navigator.userAgent,
          }
        }
      }).catch(err => logError('PreCheckout.handleSubmit.adminNotify', err));
      
      // Store order data for thank you page
      const orderData = {
        orderNumber,
        customerData,
        selectedPlans,
        selectedAddons,
        marketingConsent,
        timestamp: new Date().toISOString(),
      };

      // sessionStorage can be blocked/cleared (private mode, strict settings). Thank you page has a fallback,
      // but we still try to store for the richer experience.
      try {
        sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));
      } catch (storageErr) {
        logError('PreCheckout.handleSubmit.sessionStorage', storageErr);
      }
      
      // Clear autosaved form data on successful submission
      clearSavedData();
      
      // Navigate with in-memory state so Thank You can render instantly even if sessionStorage is blocked.
      // In some browsers/environments we've seen the SPA transition get "stuck" (order is created + emails fire,
      // but the route doesn't update until a manual refresh). To make this bulletproof, we add a tiny fallback:
      // if the URL doesn't change shortly after navigate, do a hard redirect to /thank-you.
      navigate('/thank-you', { replace: true, state: { orderData } });

      // Fallback hard redirect (keeps UX reliable; ThankYou can still read sessionStorage if location.state is lost).
      window.setTimeout(() => {
        try {
          if (window.location.pathname.startsWith('/pre-checkout')) {
            window.location.assign('/thank-you');
          }
        } catch (redirectErr) {
          logError('PreCheckout.handleSubmit.fallbackRedirect', redirectErr);
        }
      }, 300);
    } catch (error) {
      logError('PreCheckout.handleSubmit', error);
      toast({
        title: "Error submitting order",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Resolve catalogue product for broadband plan ──
  const broadbandPlan = selectedPlans.find(p => p.serviceType === 'broadband');
  const resolvedProduct: CatalogueProduct | undefined = broadbandPlan?.catalogueProductId
    ? catalogueProducts.find(p => p.id === broadbandPlan.catalogueProductId)
    : undefined;

  // Determine applicable install scenarios
  const applicableScenarios = resolvedProduct
    ? installScenarios.filter(s => resolvedProduct.installTypeSupported.includes(s.id.replace('sogea-', '').replace('fttp-', '')))
    : [];

  // Auto-select FTTP standard if applicable
  React.useEffect(() => {
    if (resolvedProduct?.technology === 'FTTP' && resolvedProduct.freeInstallEligible) {
      setInstallScenarioId('fttp-standard');
    } else if (!resolvedProduct || resolvedProduct.technology !== 'SOGEA') {
      setInstallScenarioId(null);
    }
  }, [resolvedProduct?.id]);

  // Calculate totals
  const bundleCalc = calculateBundleDiscount(selectedPlans);
  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const addon = availableAddons.find(a => a.id === id);
    return sum + (addon?.price || 0);
  }, 0);

  // Calculate setup charge
  const setupCharge = installScenarioId
    ? (installScenarios.find(s => s.id === installScenarioId)?.retailCharge ?? 0)
    : 0;

  // Care level uplift
  const careUplift = careLevels.find(c => c.id === careLevelId)?.monthlyUplift ?? 0;

  // One-off addon charges (addons marked oneTime have their price as one-off)
  const addonsOneOff = selectedAddons.reduce((sum, id) => {
    const addon = availableAddons.find(a => a.id === id);
    return sum + (addon?.oneTime ? addon.price : 0);
  }, 0);

  const monthlySubtotalExVat = bundleCalc.discountedTotal + addonsTotal + careUplift;
  const monthlyVat = Math.round(monthlySubtotalExVat * VAT_RATE * 100) / 100;
  const monthlyTotal = Math.round((monthlySubtotalExVat + monthlyVat) * 100) / 100;

  const oneOffSubtotalExVat = setupCharge + addonsOneOff;
  const oneOffVat = Math.round(oneOffSubtotalExVat * VAT_RATE * 100) / 100;
  const totalDueToday = Math.round((oneOffSubtotalExVat + oneOffVat) * 100) / 100;

  // Group addons by service type
  const addonsByService = selectedPlans.reduce((acc, plan) => {
    const serviceAddons = availableAddons.filter(a => a.serviceType === plan.serviceType);
    if (serviceAddons.length > 0 && !acc[plan.serviceType]) {
      acc[plan.serviceType] = serviceAddons;
    }
    return acc;
  }, {} as Record<string, Addon[]>);

  if (selectedPlans.length === 0) {
    return <CheckoutSkeleton />;
  }

  // Check if landline is selected without broadband
  // Allow if broadband is in basket OR user already has active broadband on their account
  const hasLandline = selectedPlans.some(p => p.serviceType === 'landline');
  const hasBroadband = selectedPlans.some(p => p.serviceType === 'broadband');
  const landlineWithoutBroadband = hasLandline && !hasBroadband && !userHasActiveBroadband;

  // Check if only broadband is selected (for upsell prompt)
  const onlyBroadband = selectedPlans.length === 1 && hasBroadband && !hasLandline;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 pb-28 lg:pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Broadband requirement blocker for Digital Home Phone */}
          {landlineWithoutBroadband && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 border-4 border-destructive bg-destructive/10"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-display uppercase text-destructive">Broadband Required</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Digital Home Phone requires an OCCTA broadband plan. Please add broadband to continue.
                  </p>
                  <Link to="/broadband">
                    <Button variant="outline" size="sm" className="border-2 border-foreground">
                      View Broadband Plans
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* Digital Home Phone upsell when only broadband selected */}
          {onlyBroadband && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 border-4 border-warning/50 bg-warning/5"
            >
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-display uppercase text-foreground">Add a Home Phone?</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Add Digital Home Phone for just £{getFromPrices().landline}/mo. Crystal clear calls through your broadband.
                  </p>
                  <Link to="/landline">
                    <Button variant="ghost" size="sm" className="text-primary font-display">
                      Learn more →
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* Back Link */}
          <Link
            to="/broadband"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-display uppercase tracking-wider text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to plans
          </Link>

          <h1 className="text-display-md mb-2">COMPLETE YOUR ORDER</h1>
          <p className="text-muted-foreground mb-8">Fill in your details below and we'll get you connected.</p>

          {/* Restore Saved Form Prompt */}
          <AnimatePresence>
            {showRestorePrompt && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 border-4 border-accent bg-accent/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-display uppercase text-accent">Saved Progress Found</h4>
                    <p className="text-sm text-muted-foreground">
                      We saved your form from earlier. Would you like to continue where you left off?
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDiscardSavedData}
                    className="border-2 border-foreground flex-1 sm:flex-none"
                  >
                    Start Fresh
                  </Button>
                  <Button
                    variant="hero"
                    size="sm"
                    onClick={handleRestoreData}
                    className="flex-1 sm:flex-none"
                  >
                    Restore
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form - Left Side */}
            <div className="lg:col-span-2 space-y-8">
              {/* Customer Information */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-2 border-foreground/20 bg-card p-6 sm:p-8"
              >
                <h2 className="font-display text-lg uppercase tracking-wider mb-1 flex items-center gap-2">
                  <User className="w-5 h-5 text-muted-foreground" />
                  Your Details
                </h2>
                <p className="text-muted-foreground text-sm mb-6">We'll use this to set up your account.</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">First name <span className="text-destructive">*</span></Label>
                    <Input
                      value={customerData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      placeholder="John"
                      className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                    />
                    {errors.firstName && <p className="text-destructive text-sm mt-1">{errors.firstName}</p>}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Last name <span className="text-destructive">*</span></Label>
                    <Input
                      value={customerData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      placeholder="Smith"
                      className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                    />
                    {errors.lastName && <p className="text-destructive text-sm mt-1">{errors.lastName}</p>}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Email address <span className="text-destructive">*</span></Label>
                    <Input
                      type="email"
                      value={customerData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="john@example.com"
                      className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                    />
                    {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Phone number <span className="text-destructive">*</span></Label>
                    <Input
                      type="tel"
                      value={customerData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="07700 900123"
                      className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                    />
                    {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Address line 1 <span className="text-destructive">*</span></Label>
                    <Input
                      value={customerData.addressLine1}
                      onChange={(e) => handleInputChange("addressLine1", e.target.value)}
                      placeholder="123 High Street"
                      className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                    />
                    {errors.addressLine1 && <p className="text-destructive text-sm mt-1">{errors.addressLine1}</p>}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Address line 2</Label>
                    <Input
                      value={customerData.addressLine2}
                      onChange={(e) => handleInputChange("addressLine2", e.target.value)}
                      placeholder="Flat 4"
                      className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">City <span className="text-destructive">*</span></Label>
                      <Input
                        value={customerData.city}
                        onChange={(e) => handleInputChange("city", e.target.value)}
                        placeholder="City/Town"
                        className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                      />
                      {errors.city && <p className="text-destructive text-sm mt-1">{errors.city}</p>}
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Postcode <span className="text-destructive">*</span></Label>
                      <Input
                        value={customerData.postcode}
                        onChange={(e) => handleInputChange("postcode", e.target.value.toUpperCase())}
                        placeholder="HD1 2QD"
                        className="mt-1 border-2 border-foreground/30 focus:border-foreground"
                      />
                      {errors.postcode && <p className="text-destructive text-sm mt-1">{errors.postcode}</p>}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Switching Information */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="border-2 border-foreground/20 bg-card p-6 sm:p-8"
              >
                <h2 className="font-display text-lg uppercase tracking-wider mb-1 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  Switching Details
                </h2>
                <p className="text-muted-foreground text-sm mb-6">Tell us about your current setup so we can manage the switch.</p>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Current provider <span className="text-destructive">*</span></Label>
                    <Select
                      value={customerData.currentProvider}
                      onValueChange={(value) => handleInputChange("currentProvider", value)}
                    >
                      <SelectTrigger className="mt-1 border-2 border-foreground/30">
                        <SelectValue placeholder="Select your current provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {ukProviders.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {provider}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.currentProvider && <p className="text-destructive text-sm mt-1">{errors.currentProvider}</p>}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Are you currently in a contract? <span className="text-destructive">*</span></Label>
                    <Select
                      value={customerData.inContract}
                      onValueChange={(value) => handleInputChange("inContract", value)}
                    >
                      <SelectTrigger className="mt-1 border-2 border-foreground/30">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No, I'm out of contract</SelectItem>
                        <SelectItem value="yes-ending-soon">Yes, but it's ending soon</SelectItem>
                        <SelectItem value="yes-in-contract">Yes, I'm still in contract</SelectItem>
                        <SelectItem value="new-connection">This is a new connection</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.inContract && <p className="text-destructive text-sm mt-1">{errors.inContract}</p>}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Preferred switch date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full mt-1 justify-start text-left border-2 border-foreground/30 font-normal",
                            !customerData.preferredSwitchDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customerData.preferredSwitchDate ? (
                            format(customerData.preferredSwitchDate, "PPP")
                          ) : (
                            "Select a date"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 border-2 border-foreground/30" align="start">
                        <Calendar
                          mode="single"
                          selected={customerData.preferredSwitchDate}
                          onSelect={(date) => handleInputChange("preferredSwitchDate", date)}
                          disabled={(date) => date < addDays(new Date(), 7)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-muted-foreground text-xs mt-1">We need at least 7 days to arrange your switch</p>
                  </div>
                </div>
              </motion.div>

              {/* Installation Type — SOGEA broadband only */}
              {resolvedProduct && resolvedProduct.technology === 'SOGEA' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="border-2 border-foreground/20 bg-card p-6 sm:p-8"
                >
                  <h2 className="font-display text-lg uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Router className="w-5 h-5 text-muted-foreground" />
                    Installation Type
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">Charges depend on your current line status.</p>
                  <Select
                    value={installScenarioId ?? ''}
                    onValueChange={(value) => setInstallScenarioId(value)}
                  >
                    <SelectTrigger className="border-2 border-foreground/30">
                      <SelectValue placeholder="Select installation type" />
                    </SelectTrigger>
                    <SelectContent>
                      {installScenarios
                        .filter(s => s.id !== 'fttp-standard')
                        .map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label} — {s.retailCharge === 0 ? 'FREE' : `£${s.retailCharge.toFixed(2)}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}

              {/* Support Level — broadband only */}
              {broadbandPlan && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.13 }}
                  className="border-2 border-foreground/20 bg-card p-6 sm:p-8"
                >
                  <h2 className="font-display text-lg uppercase tracking-wider mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                    Support Level
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">Choose the level of support that suits you.</p>
                  <div className="space-y-2">
                    {careLevels.map(level => (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setCareLevelId(level.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 border-2 transition-all flex items-center justify-between rounded-sm",
                          careLevelId === level.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-foreground/15 hover:border-foreground/40"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            careLevelId === level.id ? "border-primary" : "border-foreground/30"
                          )}>
                            {careLevelId === level.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          <span className="font-display text-sm">{level.label}</span>
                        </div>
                        <span className={cn("text-sm", careLevelId === level.id ? "font-display text-primary" : "text-muted-foreground")}>
                          {level.monthlyUplift === 0 ? 'Included' : `+£${level.monthlyUplift.toFixed(2)}/mo`}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Installation Scheduling */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <InstallationSlotPicker
                  onSlotSelected={setSelectedInstallationSlot}
                  selectedSlot={selectedInstallationSlot}
                />
              </motion.div>

              {/* Before you place your order */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="border-2 border-foreground/20 bg-card p-6 sm:p-8"
              >
                <h2 className="font-display text-lg uppercase tracking-wider mb-4">
                  Before you place your order
                </h2>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-sm bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                    <Checkbox
                      id="gdpr"
                      checked={gdprConsent}
                      onCheckedChange={(checked) => setGdprConsent(checked as boolean)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">GDPR data processing <span className="text-destructive">*</span></span>
                      <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                        I consent to the processing of my personal data to provide the requested services, manage my account, and communicate about my order. I can withdraw consent at any time.
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 rounded-sm cursor-pointer hover:bg-secondary/30 transition-colors">
                    <Checkbox
                      id="terms"
                      checked={termsConsent}
                      onCheckedChange={(checked) => setTermsConsent(checked as boolean)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">Terms & conditions <span className="text-destructive">*</span></span>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        I agree to the{" "}
                        <Link to="/terms" className="underline text-foreground">Terms of Service</Link> and{" "}
                        <Link to="/privacy" className="underline text-foreground">Privacy Policy</Link>. No contracts — cancel anytime.
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 rounded-sm cursor-pointer hover:bg-secondary/30 transition-colors">
                    <Checkbox
                      id="marketing"
                      checked={marketingConsent}
                      onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">Marketing <span className="text-muted-foreground font-normal">(optional)</span></span>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Receive updates about offers, new products, and services via email and SMS.
                      </p>
                    </div>
                  </label>

                  <div className="border-t border-foreground/10 pt-3 mt-3">
                    <label className="flex items-start gap-3 p-3 rounded-sm bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors">
                      <Checkbox
                        id="orderConsent"
                        checked={orderConsent}
                        onCheckedChange={(checked) => setOrderConsent(checked as boolean)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">I confirm the following <span className="text-destructive">*</span></span>
                        <ul className="text-muted-foreground text-xs mt-1 space-y-0.5">
                          <li>• This service is 30-day rolling with no fixed contract</li>
                          <li>• Setup charges may apply depending on my line status</li>
                          <li>• I accept all charges shown in the order summary</li>
                          <li>• Service is subject to availability at my address</li>
                        </ul>
                      </div>
                    </label>
                  </div>
                </div>
              </motion.div>

              {/* Submit Button */}
              <Button
                variant="hero"
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || landlineWithoutBroadband || !orderConsent}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Submit Order
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-3 text-muted-foreground text-xs">
                <div className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>256-bit encrypted</span>
                </div>
                <span className="text-foreground/20">·</span>
                <div className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Ofcom regulated</span>
                </div>
              </div>

              {/* What happens next */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="border-2 border-foreground/10 bg-card p-6 sm:p-8"
              >
                <h2 className="font-display text-lg uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  What Happens Next
                </h2>
                
                <div className="space-y-4">
                  {[
                    { day: "Day 1", title: "Order received", desc: "Confirmation email sent with your order details." },
                    { day: "Day 2", title: "Provider notified", desc: "We initiate the switch with your current provider." },
                    { day: "Day 3–5", title: "Switch arranged", desc: "Installation or line activation date scheduled." },
                    { day: "Day 7", title: "Equipment arrives", desc: "Router and equipment delivered via tracked delivery." },
                    { day: "Day 10–14", title: "You're live", desc: "Service goes live. Your old provider stops charging." },
                  ].map((step, idx) => (
                    <div key={idx} className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-16">
                        <span className="text-xs font-display uppercase tracking-wider text-primary">{step.day}</span>
                      </div>
                      <div className="flex-grow border-l-2 border-foreground/10 pl-4 pb-1">
                        <span className="font-display text-sm uppercase tracking-wider">{step.title}</span>
                        <p className="text-muted-foreground text-xs mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right Sidebar - Order Summary & Add-ons */}
            <div className="space-y-6">
              {/* Selected Plans */}
              <div className="border-2 border-foreground/20 bg-card p-5 sticky top-4">
                <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-4">Order Summary</h3>
                
                <div className="space-y-4 mb-6">
                  {selectedPlans.map((plan) => {
                    const Icon = serviceIcons[plan.serviceType];
                    return (
                      <div key={plan.id} className="flex items-center gap-3 p-3 border-4 border-foreground bg-secondary">
                        <div className="w-10 h-10 bg-primary border-2 border-foreground flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div className="flex-grow">
                          <div className="font-display">{plan.name}</div>
                          <div className="text-muted-foreground text-sm capitalize">{plan.serviceType}</div>
                        </div>
                        <div className="font-display">£{plan.price}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Add-ons Section */}
                {Object.entries(addonsByService).map(([serviceType, addons]) => (
                  <div key={serviceType} className="mb-6">
                    <h4 className="font-display text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {serviceType} Add-ons
                    </h4>
                    <div className="space-y-2">
                      {addons.map((addon) => {
                        const isSelected = selectedAddons.includes(addon.id);
                        const IconComponent = iconMap[addon.icon] || Shield;
                        return (
                          <motion.button
                            key={addon.id}
                            onClick={() => toggleAddon(addon.id)}
                            className={cn(
                              "w-full text-left p-3 border-4 transition-all relative",
                              isSelected 
                                ? "border-primary bg-primary/10" 
                                : "border-foreground/30 hover:border-foreground"
                            )}
                            whileTap={{ scale: 0.98 }}
                          >
                            {/* Show "Popular" tag on first addon */}
                            {addons.indexOf(addon) === 0 && (
                              <span className="absolute -top-2.5 right-3 bg-primary text-primary-foreground text-[10px] font-display uppercase tracking-wider px-2 py-0.5">
                                Popular
                              </span>
                            )}
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-8 h-8 border-2 flex items-center justify-center flex-shrink-0",
                                isSelected ? "bg-primary border-primary" : "border-foreground/50"
                              )}>
                                {isSelected ? (
                                  <Check className="w-4 h-4 text-primary-foreground" />
                                ) : (
                                  <IconComponent className="w-4 h-4" />
                                )}
                              </div>
                              <div className="flex-grow min-w-0">
                                <div className="font-display text-sm">{addon.name}</div>
                                <div className="text-muted-foreground text-xs">{addon.description}</div>
                              </div>
                              <div className="font-display text-sm whitespace-nowrap">
                                {addon.price === 0 ? "FREE" : `+£${addon.price.toFixed(2)}`}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Itemised Breakdown */}
                <div className="border-t-4 border-foreground pt-4 space-y-2">
                  <p className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">Monthly charges</p>
                  {selectedPlans.map(plan => (
                    <div key={plan.id} className="flex justify-between text-sm">
                      <span>{plan.name}</span>
                      <span>£{plan.price}</span>
                    </div>
                  ))}
                  {careUplift > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Care level uplift</span>
                      <span>+£{careUplift.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedAddons.filter(id => {
                    const a = availableAddons.find(x => x.id === id);
                    return a && !a.oneTime;
                  }).map(id => {
                    const a = availableAddons.find(x => x.id === id)!;
                    return (
                      <div key={id} className="flex justify-between text-sm">
                        <span>{a.name}</span>
                        <span>+£{a.price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {bundleCalc.savings > 0 && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>Bundle discount</span>
                      <span>-£{bundleCalc.savings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t border-foreground/10">
                    <span>Subtotal (ex VAT)</span>
                    <span>£{monthlySubtotalExVat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>VAT (20%)</span>
                    <span>£{monthlyVat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-display text-lg pt-2 border-t-2 border-foreground/20">
                    <span>ONGOING MONTHLY</span>
                    <span>£{monthlyTotal.toFixed(2)}/mo <span className="text-xs font-normal text-muted-foreground">(incl. VAT)</span></span>
                  </div>

                  {/* One-off charges */}
                  <p className="font-display text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-2">One-off charges</p>
                  <div className="flex justify-between text-sm">
                    <span>
                      Setup/install
                      {installScenarioId && (
                        <span className="text-muted-foreground text-xs ml-1">
                          ({installScenarios.find(s => s.id === installScenarioId)?.label})
                        </span>
                      )}
                    </span>
                    <span>{setupCharge === 0 ? 'FREE' : `£${setupCharge.toFixed(2)}`}</span>
                  </div>
                  {selectedAddons.filter(id => {
                    const a = availableAddons.find(x => x.id === id);
                    return a?.oneTime;
                  }).map(id => {
                    const a = availableAddons.find(x => x.id === id)!;
                    return (
                      <div key={id} className="flex justify-between text-sm">
                        <span>{a.name}</span>
                        <span>£{a.price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {oneOffSubtotalExVat > 0 && (
                    <>
                      <div className="flex justify-between text-sm pt-2 border-t border-foreground/10">
                        <span>Subtotal (ex VAT)</span>
                        <span>£{oneOffSubtotalExVat.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>VAT (20%)</span>
                        <span>£{oneOffVat.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-display text-xl pt-2 border-t-2 border-foreground/20">
                    <span>TOTAL DUE TODAY</span>
                    <span>£{totalDueToday.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">(incl. VAT)</span></span>
                  </div>

                  <p className="text-muted-foreground text-xs mt-3">
                    30-day rolling — no contracts
                  </p>
                  {resolvedProduct?.technology === 'SOGEA' && (
                    <p className="text-muted-foreground text-xs mt-1 italic">
                      {getSOGEANote()}
                    </p>
                  )}
                </div>

                {/* Cooling Off Notice */}
                <div className="mt-6 p-4 bg-secondary border-4 border-foreground">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-display text-sm uppercase tracking-wider">14-Day Cooling Off Period</div>
                        <p className="text-muted-foreground text-sm mt-1">
                          You have the right to cancel your order within 14 days of signing up, without giving any reason. 
                        Contact us on {CONTACT_PHONE_DISPLAY} to cancel.
                        </p>
                    </div>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="mt-4 flex items-center justify-center gap-4 text-muted-foreground text-xs">
                  <div className="flex items-center gap-1">
                    <Shield className="w-4 h-4" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>Ofcom Regulated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Order Summary */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t-4 border-foreground bg-background">
        <button
          type="button"
          onClick={() => setIsMobileSummaryOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-4"
        >
          <div className="text-left">
            <p className="font-display uppercase tracking-wider text-xs text-muted-foreground">
              {selectedPlans.map(p => p.name).join(' + ')}
            </p>
            <p className="font-display text-lg">£{monthlyTotal.toFixed(2)}/mo</p>
            {totalDueToday > 0 && (
              <p className="text-xs text-muted-foreground">+ £{totalDueToday.toFixed(2)} today</p>
            )}
          </div>
          <span className="font-display uppercase text-sm text-primary px-3 py-1 border-2 border-primary">
            {isMobileSummaryOpen ? "Hide" : "View"}
          </span>
        </button>
        <AnimatePresence>
          {isMobileSummaryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t-4 border-foreground bg-card"
            >
              <div className="px-4 pb-4 pt-2 space-y-3">
                <div className="space-y-2">
                  {selectedPlans.map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-display">{plan.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{plan.serviceType}</p>
                      </div>
                      <span className="font-display">£{plan.price}</span>
                    </div>
                  ))}
                  {careUplift > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Care level uplift</span>
                      <span className="font-display">+£{careUplift.toFixed(2)}</span>
                    </div>
                  )}
                  {addonsTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Add-ons (monthly)</span>
                      <span className="font-display">+£{addonsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {bundleCalc.savings > 0 && (
                    <div className="flex items-center justify-between text-sm text-primary">
                      <span>Bundle discount</span>
                      <span className="font-display">-£{bundleCalc.savings.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t-2 border-foreground/20 pt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display uppercase tracking-wider text-sm">Ongoing Monthly</span>
                    <span className="font-display text-lg">£{monthlyTotal.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">incl. VAT (£{monthlyVat.toFixed(2)})</p>
                </div>
                {totalDueToday > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-display uppercase tracking-wider text-sm">Due Today</span>
                      <span className="font-display text-lg">£{totalDueToday.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">incl. VAT (£{oneOffVat.toFixed(2)})</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default PreCheckout;
