import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import Layout from "@/components/layout/Layout";
import AppLayout from "@/components/app/AppLayout";
import ServicePageSkeleton from "@/components/loading/ServicePageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/useAppMode";
import { businessPlans, businessServices } from "@/lib/businessData";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import { CheckCircle, Loader2 } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";

const adminEmail = "hello@occta.co.uk";

const checkoutSchema = z.object({
  businessName: z.string().min(2, "Business name is required").max(120, "Business name too long"),
  contactName: z.string().min(2, "Contact name is required").max(80, "Contact name too long"),
  email: z.string().email("Enter a valid email address").max(120, "Email too long"),
  phone: z.string().min(7, "Enter a valid phone number").max(30, "Phone number too long"),
  postcode: z.string().min(5, "Enter a valid postcode").max(10, "Postcode too long"),
  addressLine1: z.string().min(3, "Enter your address").max(120, "Address too long"),
  addressLine2: z.string().max(120, "Address too long").optional(),
  city: z.string().min(2, "Enter your city").max(60, "City name too long"),
  teamSize: z.string().min(1, "Select a team size"),
  notes: z.string().max(1000, "Notes too long").optional(),
});

const teamSizes = ["1-5", "6-15", "16-50", "51-100", "100+"];

const BusinessCheckout = () => {
  const [searchParams] = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(searchParams.get("plan") || "");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { isAppMode } = useAppMode();

  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    postcode: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    teamSize: "",
    notes: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const LayoutComponent = isAppMode ? AppLayout : Layout;

  const selectedPlan = useMemo(
    () => businessPlans.find((plan) => plan.id === selectedPlanId) || null,
    [selectedPlanId]
  );

  const selectedServiceDetails = useMemo(
    () => businessServices.filter((service) => selectedServices.includes(service.id)),
    [selectedServices]
  );

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleToggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const validateForm = () => {
    const result = checkoutSchema.safeParse(formData);
    if (!result.success || !selectedPlanId) {
      const newErrors: Record<string, string> = {};
      if (!selectedPlanId) newErrors.plan = "Please select a plan";
      if (!result.success) {
        result.error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
      }
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedPlan) return;

    setIsSubmitting(true);
    const orderNumber = `BIZ-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const selectedAddonDetails = selectedServiceDetails.map((service) => ({
      id: service.id,
      name: service.title,
      price: service.price,
    }));

    const notesParts = [
      `Business: ${formData.businessName}`,
      `Team size: ${formData.teamSize}`,
      formData.notes?.trim() ? `Notes: ${formData.notes.trim()}` : "",
    ].filter(Boolean);

    try {
      const { error } = await supabase.from("guest_orders").insert({
        order_number: orderNumber,
        email: formData.email.trim(),
        full_name: formData.contactName.trim(),
        phone: formData.phone.trim(),
        address_line1: formData.addressLine1.trim(),
        address_line2: formData.addressLine2?.trim() || null,
        city: formData.city.trim(),
        postcode: formData.postcode.trim(),
        additional_notes: notesParts.join(" | "),
        gdpr_consent: true,
        marketing_consent: false,
        plan_name: selectedPlan.name,
        plan_price: selectedPlan.priceValue,
        service_type: "business",
        selected_addons: selectedAddonDetails as unknown as Json,
        status: "pending",
      });

      if (error) throw error;

      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: adminEmail,
            subject: `New Business Plan Checkout: ${selectedPlan.name}`,
            html: `
              <h2>New Business Plan Checkout</h2>
              <p><strong>Order:</strong> ${orderNumber}</p>
              <p><strong>Business:</strong> ${formData.businessName}</p>
              <p><strong>Contact:</strong> ${formData.contactName}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Phone:</strong> ${formData.phone}</p>
              <p><strong>Address:</strong> ${formData.addressLine1}, ${formData.city}, ${formData.postcode}</p>
              <p><strong>Plan:</strong> ${selectedPlan.name} (${selectedPlan.price}/mo)</p>
              <p><strong>Add-ons:</strong> ${selectedServiceDetails.map((service) => service.title).join(", ") || "None"}</p>
              <p><strong>Notes:</strong> ${formData.notes || "None"}</p>
            `,
          },
        });
      } catch (emailError) {
        logError("BusinessCheckout.sendEmail", emailError);
      }

      toast({
        title: "Plan request sent!",
        description: "Our business team will review and contact you within 1 working day.",
      });

      setFormData({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        postcode: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        teamSize: "",
        notes: "",
      });
      setSelectedServices([]);
    } catch (error) {
      logError("BusinessCheckout.handleSubmit", error);
      toast({
        title: "Something went wrong",
        description: `Please try again or call us on ${CONTACT_PHONE_DISPLAY}.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <LayoutComponent>
        <ServicePageSkeleton />
      </LayoutComponent>
    );
  }

  return (
    <LayoutComponent>
      <section className="min-h-[calc(100vh-80px)] flex items-center py-12 grid-pattern">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <h1 className="text-5xl sm:text-6xl font-display uppercase leading-[0.9]">
                BUSINESS CHECKOUT
              </h1>
              <p className="text-lg text-muted-foreground">
                Build your plan, confirm your details, and send it to our business team.
                We’ll follow up with contract options and installation availability.
              </p>
              <Link to="/business-offers" className="text-primary font-semibold">
                ← Back to plan builder
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="card-brutal bg-card p-5">
                <h3 className="font-display text-lg uppercase mb-3">You’ll confirm</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✅ Business contact and installation address.</li>
                  <li>✅ Preferred plan and add-on services.</li>
                  <li>✅ Any notes for multi-site or compliance needs.</li>
                </ul>
              </div>
              <div className="card-brutal bg-card p-5">
                <h3 className="font-display text-lg uppercase mb-3">After submit</h3>
                <p className="text-sm text-muted-foreground">
                  We’ll confirm availability and send your final quote. Install dates are
                  scheduled once you approve the proposal.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4 grid lg:grid-cols-[1.4fr_1fr] gap-8">
          <div className="card-brutal bg-card p-6">
            <h2 className="text-display-sm mb-6">Plan & Details</h2>
            <div className="grid gap-5">
              <div>
                <Label className="font-display uppercase text-sm">Plan selection</Label>
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  {businessPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`border-4 p-4 text-left transition-all ${
                        selectedPlanId === plan.id
                          ? "border-primary bg-primary/10"
                          : "border-foreground/20 hover:border-foreground"
                      }`}
                    >
                      <p className="font-display uppercase text-sm">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">Up to {plan.speed}</p>
                      <p className="font-display text-xl mt-2">{plan.price}/mo</p>
                    </button>
                  ))}
                </div>
                {errors.plan && <p className="text-sm text-destructive mt-2">{errors.plan}</p>}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName" className="font-display uppercase text-sm">
                    Business name
                  </Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(event) => handleChange("businessName", event.target.value)}
                    placeholder="OCCTA Ltd"
                  />
                  {errors.businessName && <p className="text-sm text-destructive">{errors.businessName}</p>}
                </div>
                <div>
                  <Label htmlFor="contactName" className="font-display uppercase text-sm">
                    Contact name
                  </Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(event) => handleChange("contactName", event.target.value)}
                    placeholder="Alex Patel"
                  />
                  {errors.contactName && <p className="text-sm text-destructive">{errors.contactName}</p>}
                </div>
                <div>
                  <Label htmlFor="email" className="font-display uppercase text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleChange("email", event.target.value)}
                    placeholder="alex@company.co.uk"
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor="phone" className="font-display uppercase text-sm">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) => handleChange("phone", event.target.value)}
                    placeholder="020 1234 5678"
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>
                <div>
                  <Label htmlFor="postcode" className="font-display uppercase text-sm">
                    Postcode
                  </Label>
                  <Input
                    id="postcode"
                    value={formData.postcode}
                    onChange={(event) => handleChange("postcode", event.target.value)}
                    placeholder="HD3 3WU"
                  />
                  {errors.postcode && <p className="text-sm text-destructive">{errors.postcode}</p>}
                </div>
                <div>
                  <Label htmlFor="city" className="font-display uppercase text-sm">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(event) => handleChange("city", event.target.value)}
                    placeholder="City/Town"
                  />
                  {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="addressLine1" className="font-display uppercase text-sm">
                    Address line 1
                  </Label>
                  <Input
                    id="addressLine1"
                    value={formData.addressLine1}
                    onChange={(event) => handleChange("addressLine1", event.target.value)}
                    placeholder="22 Pavilion View"
                  />
                  {errors.addressLine1 && <p className="text-sm text-destructive">{errors.addressLine1}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="addressLine2" className="font-display uppercase text-sm">
                    Address line 2
                  </Label>
                  <Input
                    id="addressLine2"
                    value={formData.addressLine2}
                    onChange={(event) => handleChange("addressLine2", event.target.value)}
                    placeholder="Unit 4, Business Park"
                  />
                  {errors.addressLine2 && <p className="text-sm text-destructive">{errors.addressLine2}</p>}
                </div>
                <div>
                  <Label htmlFor="teamSize" className="font-display uppercase text-sm">
                    Team size
                  </Label>
                  <select
                    id="teamSize"
                    value={formData.teamSize}
                    onChange={(event) => handleChange("teamSize", event.target.value)}
                    className="w-full border-2 border-foreground bg-background px-3 py-2 font-medium"
                  >
                    <option value="">Select team size</option>
                    {teamSizes.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  {errors.teamSize && <p className="text-sm text-destructive">{errors.teamSize}</p>}
                </div>
              </div>

              <div>
                <Label className="font-display uppercase text-sm">Add-ons & Services</Label>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {businessServices.map((service) => (
                    <label
                      key={service.id}
                      className="flex gap-3 items-start border-2 border-foreground/20 p-3"
                    >
                      <Checkbox
                        checked={selectedServices.includes(service.id)}
                        onCheckedChange={() => handleToggleService(service.id)}
                      />
                      <div>
                        <p className="font-display text-sm uppercase">{service.title}</p>
                        <p className="text-xs text-muted-foreground">{service.price}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="font-display uppercase text-sm">
                  Anything else we should know?
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(event) => handleChange("notes", event.target.value)}
                  placeholder="Install window, compliance requirements, multi-site details..."
                />
                {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
              </div>

              <Button
                size="lg"
                variant="hero"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Plan Request"}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-brutal bg-card p-6">
              <h3 className="font-display text-lg mb-4">Summary</h3>
              {selectedPlan ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-display">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly plan</span>
                    <span className="font-display">{selectedPlan.price}/mo</span>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-2">Add-ons</p>
                    <ul className="space-y-2">
                      {selectedServiceDetails.length === 0 && (
                        <li className="text-muted-foreground">No add-ons selected yet.</li>
                      )}
                      {selectedServiceDetails.map((service) => (
                        <li key={service.id} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-primary" />
                          <span>{service.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add-on pricing billed per seat or site as noted; totals confirmed on quote.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a plan to see your summary.</p>
              )}
            </div>

            <div className="card-brutal bg-card p-6">
              <h3 className="font-display text-lg mb-4">What happens next</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>✅ We review your request within 1 working day.</li>
                <li>✅ A business specialist confirms availability and SLA options.</li>
                <li>✅ You receive a final quote and installation timeline.</li>
                <li>✅ Once approved, we schedule install and provide go-live support.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </LayoutComponent>
  );
};

export default BusinessCheckout;
