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
  }, [planIds, navigate]);

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
      const { data: insertedOrder, error } = await supabase.from('guest_orders').insert({
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
      }).select('id').single();
      
      if (error) throw error;
      
      // Create installation booking if slot was selected
      if (selectedInstallationSlot && insertedOrder) {
        try {
          await supabase.from('installation_bookings').insert({
            slot_id: selectedInstallationSlot.id,
            order_id: insertedOrder.id,
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
            id: insertedOrder?.id,
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
      
      sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));
      
      // Clear autosaved form data on successful submission
      clearSavedData();
      
      navigate('/thank-you');
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

  // Calculate totals
  const bundleCalc = calculateBundleDiscount(selectedPlans);
  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const addon = availableAddons.find(a => a.id === id);
    return sum + (addon?.price || 0);
  }, 0);
  const monthlyTotal = bundleCalc.discountedTotal + addonsTotal;

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 pb-28 lg:pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Back Link */}
          <Link
            to="/broadband"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-display uppercase tracking-wider text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to plans
          </Link>

          <h1 className="text-display-md mb-8">COMPLETE YOUR ORDER</h1>

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
                className="card-brutal bg-card p-6"
              >
                <h2 className="text-display-sm mb-6 flex items-center gap-3">
                  <User className="w-6 h-6" />
                  YOUR DETAILS
                </h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-display uppercase tracking-wider text-sm">First Name *</Label>
                    <Input
                      value={customerData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      placeholder="John"
                      className="mt-1 border-4 border-foreground"
                    />
                    {errors.firstName && <p className="text-destructive text-sm mt-1">{errors.firstName}</p>}
                  </div>
                  
                  <div>
                    <Label className="font-display uppercase tracking-wider text-sm">Last Name *</Label>
                    <Input
                      value={customerData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      placeholder="Smith"
                      className="mt-1 border-4 border-foreground"
                    />
                    {errors.lastName && <p className="text-destructive text-sm mt-1">{errors.lastName}</p>}
                  </div>
                  
                  <div>
                    <Label className="font-display uppercase tracking-wider text-sm">Email Address *</Label>
                    <Input
                      type="email"
                      value={customerData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="john@example.com"
                      className="mt-1 border-4 border-foreground"
                    />
                    {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
                  </div>
                  
                  <div>
                    <Label className="font-display uppercase tracking-wider text-sm">Phone Number *</Label>
                    <Input
                      type="tel"
                      value={customerData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="07700 900123"
                      className="mt-1 border-4 border-foreground"
                    />
                    {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <Label className="font-display uppercase tracking-wider text-sm">Address Line 1 *</Label>
                    <Input
                      value={customerData.addressLine1}
                      onChange={(e) => handleInputChange("addressLine1", e.target.value)}
                      placeholder="123 High Street"
                      className="mt-1 border-4 border-foreground"
                    />
                    {errors.addressLine1 && <p className="text-destructive text-sm mt-1">{errors.addressLine1}</p>}
                  </div>
                  
                  <div>
                    <Label className="font-display uppercase tracking-wider text-sm">Address Line 2</Label>
                    <Input
                      value={customerData.addressLine2}
                      onChange={(e) => handleInputChange("addressLine2", e.target.value)}
                      placeholder="Flat 4"
                      className="mt-1 border-4 border-foreground"
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-display uppercase tracking-wider text-sm">City *</Label>
                      <Input
                        value={customerData.city}
                        onChange={(e) => handleInputChange("city", e.target.value)}
                        placeholder="City/Town"
                        className="mt-1 border-4 border-foreground"
                      />
                      {errors.city && <p className="text-destructive text-sm mt-1">{errors.city}</p>}
                    </div>
                    
                    <div>
                      <Label className="font-display uppercase tracking-wider text-sm">Postcode *</Label>
                      <Input
                        value={customerData.postcode}
                        onChange={(e) => handleInputChange("postcode", e.target.value.toUpperCase())}
                        placeholder="HD1 2QD"
                        className="mt-1 border-4 border-foreground"
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
                className="card-brutal bg-card p-6"
              >
                <h2 className="text-display-sm mb-6 flex items-center gap-3">
                  <ArrowRight className="w-6 h-6" />
                  SWITCHING DETAILS
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label className="font-display uppercase tracking-wider text-sm">Current Provider *</Label>
                    <Select
                      value={customerData.currentProvider}
                      onValueChange={(value) => handleInputChange("currentProvider", value)}
                    >
                      <SelectTrigger className="mt-1 border-4 border-foreground">
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
                    <Label className="font-display uppercase tracking-wider text-sm">Are you currently in a contract? *</Label>
                    <Select
                      value={customerData.inContract}
                      onValueChange={(value) => handleInputChange("inContract", value)}
                    >
                      <SelectTrigger className="mt-1 border-4 border-foreground">
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
                    <Label className="font-display uppercase tracking-wider text-sm">Preferred Switch Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full mt-1 justify-start text-left border-4 border-foreground font-normal",
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
                      <PopoverContent className="w-auto p-0 border-4 border-foreground" align="start">
                        <Calendar
                          mode="single"
                          selected={customerData.preferredSwitchDate}
                          onSelect={(date) => handleInputChange("preferredSwitchDate", date)}
                          disabled={(date) => date < addDays(new Date(), 7)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-muted-foreground text-sm mt-1">We need at least 7 days to arrange your switch</p>
                  </div>
                </div>
              </motion.div>

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

              {/* GDPR & Consent */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card-brutal bg-card p-6"
              >
                <h2 className="text-display-sm mb-6 flex items-center gap-3">
                  <Shield className="w-6 h-6" />
                  CONSENT & PERMISSIONS
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 border-4 border-foreground bg-secondary">
                    <Checkbox
                      id="gdpr"
                      checked={gdprConsent}
                      onCheckedChange={(checked) => setGdprConsent(checked as boolean)}
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor="gdpr" className="font-display uppercase tracking-wider text-sm cursor-pointer">
                        GDPR Data Processing Agreement *
                      </Label>
                      <p className="text-muted-foreground text-sm mt-1">
                        I consent to the processing of my personal data in accordance with the General Data Protection Regulation (GDPR). 
                        My data will be used to provide the requested services, manage my account, and communicate about my order. 
                        I understand I can withdraw consent at any time.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 border-4 border-foreground">
                    <Checkbox
                      id="terms"
                      checked={termsConsent}
                      onCheckedChange={(checked) => setTermsConsent(checked as boolean)}
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor="terms" className="font-display uppercase tracking-wider text-sm cursor-pointer">
                        Terms & Conditions *
                      </Label>
                      <p className="text-muted-foreground text-sm mt-1">
                        I have read and agree to the Terms of Service, Privacy Policy, and understand this is a 24-month minimum term contract.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 border-4 border-foreground">
                    <Checkbox
                      id="marketing"
                      checked={marketingConsent}
                      onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor="marketing" className="font-display uppercase tracking-wider text-sm cursor-pointer">
                        Marketing Communications (Optional)
                      </Label>
                      <p className="text-muted-foreground text-sm mt-1">
                        I would like to receive updates about exclusive offers, new products, and services via email and SMS.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Submit Button */}
              <Button
                variant="hero"
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
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

              {/* Switching Timeline - Below Submit Button */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card-brutal bg-primary/5 p-6 border-primary"
              >
                <h2 className="text-display-sm mb-6 flex items-center gap-3">
                  <Clock className="w-6 h-6" />
                  WHAT HAPPENS NEXT
                </h2>
                
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-8 bottom-8 w-1 bg-primary/30" />
                  
                  <div className="space-y-6">
                    {[
                      { day: "Day 1", title: "Order Received", desc: "We receive your order and begin processing. You'll get a confirmation email with your order details.", icon: "📩" },
                      { day: "Day 2", title: "Provider Notified", desc: "We contact your current provider to initiate the switch. They'll send you a leaving confirmation.", icon: "📞" },
                      { day: "Day 3-5", title: "Switch Arranged", desc: "We coordinate with Openreach to schedule your installation or line activation date.", icon: "📅" },
                      { day: "Day 7", title: "Equipment Arrives", desc: "Your new router and any equipment will arrive at your address via tracked delivery.", icon: "📦" },
                      { day: "Day 10-12", title: "Engineer Visit", desc: "If required, an engineer will visit to complete the setup. Most installations don't need this.", icon: "🔧" },
                      { day: "Day 14", title: "You're Live!", desc: "Your new service goes live! Your old provider will stop charging from this date.", icon: "🎉" },
                    ].map((step, idx) => (
                      <div key={idx} className="relative flex gap-4 pl-2">
                        <div className="w-10 h-10 bg-primary border-4 border-foreground flex items-center justify-center text-lg z-10">
                          {step.icon}
                        </div>
                        <div className="flex-grow pb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-display text-primary uppercase tracking-wider text-sm">{step.day}</span>
                            <span className="font-display uppercase tracking-wider">{step.title}</span>
                          </div>
                          <p className="text-muted-foreground text-sm">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Sidebar - Order Summary & Add-ons */}
            <div className="space-y-6">
              {/* Selected Plans */}
              <div className="card-brutal bg-card p-6 sticky top-4">
                <h3 className="font-display text-lg mb-4 uppercase tracking-wider">Your Order</h3>
                
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
                              "w-full text-left p-3 border-4 transition-all",
                              isSelected 
                                ? "border-primary bg-primary/10" 
                                : "border-foreground/30 hover:border-foreground"
                            )}
                            whileTap={{ scale: 0.98 }}
                          >
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

                {/* Totals */}
                <div className="border-t-4 border-foreground pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Plans subtotal</span>
                    <span>£{bundleCalc.originalTotal.toFixed(2)}</span>
                  </div>
                  {bundleCalc.discountPercentage > 0 && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>Bundle discount ({bundleCalc.discountPercentage}%)</span>
                      <span>-£{bundleCalc.savings.toFixed(2)}</span>
                    </div>
                  )}
                  {addonsTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Add-ons</span>
                      <span>+£{addonsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-display text-xl pt-2 border-t-2 border-foreground/20">
                    <span>Monthly Total</span>
                    <span>£{monthlyTotal.toFixed(2)}</span>
                  </div>
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
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="text-left">
            <p className="font-display uppercase tracking-wider text-xs text-muted-foreground">Order Summary</p>
            <p className="font-display text-lg">£{monthlyTotal.toFixed(2)}/mo</p>
          </div>
          <span className="font-display uppercase text-sm text-primary">
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
                  {addonsTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Add-ons</span>
                      <span className="font-display">+£{addonsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {bundleCalc.discountPercentage > 0 && (
                    <div className="flex items-center justify-between text-sm text-primary">
                      <span>Bundle discount ({bundleCalc.discountPercentage}%)</span>
                      <span className="font-display">-£{bundleCalc.savings.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t-2 border-foreground/20 pt-3 flex items-center justify-between">
                  <span className="font-display uppercase tracking-wider text-sm">Monthly Total</span>
                  <span className="font-display text-lg">£{monthlyTotal.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default PreCheckout;
