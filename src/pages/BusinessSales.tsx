import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Link } from "react-router-dom";
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
import { businessServices } from "@/lib/businessData";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import { Loader2 } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

const adminEmail = "hello@occta.co.uk";

const salesSchema = z.object({
  businessName: z.string().min(2, "Business name is required").max(120, "Business name too long"),
  contactName: z.string().min(2, "Contact name is required").max(80, "Contact name too long"),
  email: z.string().email("Enter a valid email address").max(120, "Email too long"),
  phone: z.string().min(7, "Enter a valid phone number").max(30, "Phone number too long"),
  postcode: z.string().min(5, "Enter a valid postcode").max(10, "Postcode too long"),
  city: z.string().min(2, "Enter your city").max(60, "City name too long"),
  addressLine1: z.string().min(3, "Enter your address").max(120, "Address too long"),
  addressLine2: z.string().max(120, "Address too long").optional(),
  goal: z.string().min(1, "Select what you're looking for"),
  message: z.string().min(10, "Please add more detail").max(1000, "Message too long"),
});

const goals = [
  "Compare business broadband plans",
  "Bundle internet + phones",
  "Upgrade existing service",
  "Multi-site connectivity",
  "Security & compliance support",
];

const BusinessSales = () => {
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    city: "",
    addressLine1: "",
    addressLine2: "",
    goal: "",
    message: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const LayoutComponent = isAppMode ? AppLayout : Layout;

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
    const result = salesSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    const orderNumber = `LEAD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const selectedAddonDetails = businessServices
      .filter((service) => selectedServices.includes(service.id))
      .map((service) => ({ id: service.id, name: service.title, price: service.price }));

    const notesParts = [
      `Business: ${formData.businessName}`,
      `Goal: ${formData.goal}`,
      `Message: ${formData.message}`,
    ];

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
        plan_name: "Business Sales Inquiry",
        plan_price: 0,
        service_type: "business-sales",
        selected_addons: selectedAddonDetails as unknown as Json,
        status: "pending",
      });

      if (error) throw error;

      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: adminEmail,
            subject: "New Business Sales Inquiry",
            html: `
              <h2>New Business Sales Inquiry</h2>
              <p><strong>Lead ID:</strong> ${orderNumber}</p>
              <p><strong>Business:</strong> ${formData.businessName}</p>
              <p><strong>Contact:</strong> ${formData.contactName}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Phone:</strong> ${formData.phone}</p>
              <p><strong>Location:</strong> ${formData.addressLine1}, ${formData.city}, ${formData.postcode}</p>
              <p><strong>Goal:</strong> ${formData.goal}</p>
              <p><strong>Interested services:</strong> ${selectedAddonDetails.map((item) => item.name).join(", ") || "None selected"}</p>
              <p><strong>Message:</strong> ${formData.message}</p>
            `,
          },
        });
      } catch (emailError) {
        logError("BusinessSales.sendEmail", emailError);
      }

      toast({
        title: "Request sent!",
        description: "An account executive will reach out within 1 working day.",
      });

      setFormData({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        postcode: "",
        city: "",
        addressLine1: "",
        addressLine2: "",
        goal: "",
        message: "",
      });
      setSelectedServices([]);
    } catch (error) {
      logError("BusinessSales.handleSubmit", error);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 0800 260 6627.",
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
                TALK TO SALES
              </h1>
              <p className="text-lg text-muted-foreground">
                Tell us what you’re looking for and we’ll build the right business bundle.
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
                <h3 className="font-display text-lg uppercase mb-3">What we’ll cover</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✅ Current provider review and switch timeline.</li>
                  <li>✅ Bundle recommendations for phones, WiFi, and security.</li>
                  <li>✅ SLA options for uptime and rapid fix targets.</li>
                </ul>
              </div>
              <div className="card-brutal bg-card p-5">
                <h3 className="font-display text-lg uppercase mb-3">Response time</h3>
                <p className="text-sm text-muted-foreground">
                  Business team responds within 1 working day with a tailored quote and next steps.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary stripes">
        <div className="container mx-auto px-4">
          <div className="card-brutal bg-card p-6 max-w-3xl mx-auto">
            <h2 className="text-display-sm mb-6">Sales request form</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessName" className="font-display uppercase text-sm">
                  Business name
                </Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(event) => handleChange("businessName", event.target.value)}
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
                />
                {errors.addressLine2 && <p className="text-sm text-destructive">{errors.addressLine2}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="goal" className="font-display uppercase text-sm">
                  What are you looking for?
                </Label>
                <select
                  id="goal"
                  value={formData.goal}
                  onChange={(event) => handleChange("goal", event.target.value)}
                  className="w-full border-2 border-foreground bg-background px-3 py-2 font-medium"
                >
                  <option value="">Select an option</option>
                  {goals.map((goal) => (
                    <option key={goal} value={goal}>
                      {goal}
                    </option>
                  ))}
                </select>
                {errors.goal && <p className="text-sm text-destructive">{errors.goal}</p>}
              </div>
            </div>

            <div className="mt-6">
              <Label className="font-display uppercase text-sm">Services you care about</Label>
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

            <div className="mt-6">
              <Label htmlFor="message" className="font-display uppercase text-sm">
                Tell us more
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(event) => handleChange("message", event.target.value)}
                placeholder="Sites, timeframes, current providers, or any must-haves..."
              />
              {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
            </div>

            <Button
              size="lg"
              variant="hero"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="mt-6 w-full"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Sales Request"}
            </Button>
          </div>
        </div>
      </section>
    </LayoutComponent>
  );
};

export default BusinessSales;
