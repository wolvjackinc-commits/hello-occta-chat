import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AccountDeletion } from "@/components/dashboard/AccountDeletion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Wallet,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
  Calendar,
  Shield,
  Building2,
} from "lucide-react";

type BillingSettings = {
  id: string;
  user_id: string;
  auto_pay_enabled: boolean;
  preferred_payment_method: string;
  late_fee_grace_days: number;
};

type DDMandate = {
  id: string;
  status: string;
  mandate_reference: string | null;
  bank_last4: string | null;
  account_holder: string | null;
};

export default function BillingSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [mandate, setMandate] = useState<DDMandate | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await fetchData(session.user.id);
  };

  const fetchData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch billing settings
      const { data: settingsData } = await supabase
        .from("billing_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData);
      } else {
        // Create default settings
        const { data: newSettings, error } = await supabase
          .from("billing_settings")
          .insert({ user_id: userId })
          .select()
          .single();
        
        if (!error && newSettings) {
          setSettings(newSettings);
        }
      }

      // Fetch direct debit mandate if exists
      const { data: mandateData } = await supabase
        .from("dd_mandates")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (mandateData) {
        setMandate(mandateData);
      }
    } catch (err) {
      console.error("Error fetching billing data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("billing_settings")
        .update({
          auto_pay_enabled: settings.auto_pay_enabled,
          preferred_payment_method: settings.preferred_payment_method,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your billing preferences have been updated.",
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  if (loading) {
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

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-display-md flex items-center gap-3">
              <Settings className="w-8 h-8" />
              BILLING SETTINGS
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your payment methods and billing preferences
            </p>
          </motion.div>

          {/* Payment Methods */}
          <motion.div
            variants={itemVariants}
            className="card-brutal bg-card p-6 mb-6"
          >
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              PAYMENT METHODS
            </h2>

            {/* Direct Debit */}
            <div className="border-4 border-foreground p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg">Direct Debit</h3>
                    {mandate ? (
                      <p className="text-sm text-muted-foreground">
                        •••• {mandate.bank_last4 || "****"} • {mandate.account_holder}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No active mandate
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mandate ? (
                    <Badge className="bg-primary border-2 border-foreground">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-2 border-foreground"
                      onClick={() => {
                        toast({
                          title: "Direct Debit Setup",
                          description: "Please contact support to set up Direct Debit.",
                        });
                      }}
                    >
                      Set Up
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Card Payment */}
            <div className="border-4 border-foreground p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg">Card Payment</h3>
                    <p className="text-sm text-muted-foreground">
                      Pay invoices with debit or credit card
                    </p>
                  </div>
                </div>
                <Badge className="bg-secondary border-2 border-foreground">
                  <Wallet className="w-3 h-3 mr-1" />
                  Manual
                </Badge>
              </div>
            </div>
          </motion.div>

          {/* Auto-Pay Settings */}
          <motion.div
            variants={itemVariants}
            className="card-brutal bg-card p-6 mb-6"
          >
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              AUTO-PAY
            </h2>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border-2 border-foreground bg-secondary/30">
                <div className="flex-1">
                  <Label htmlFor="auto-pay" className="font-display text-base">
                    Enable Auto-Pay
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically pay invoices on the due date
                  </p>
                </div>
                <Switch
                  id="auto-pay"
                  checked={settings?.auto_pay_enabled || false}
                  onCheckedChange={(checked) => {
                    if (!mandate && checked) {
                      toast({
                        title: "Direct Debit Required",
                        description: "Please set up Direct Debit to enable auto-pay.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setSettings((prev) =>
                      prev ? { ...prev, auto_pay_enabled: checked } : prev
                    );
                  }}
                  disabled={!mandate}
                />
              </div>

              {settings?.auto_pay_enabled && (
                <div className="p-4 bg-primary/10 border-2 border-primary">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-display text-sm">AUTO-PAY ENABLED</p>
                      <p className="text-sm text-muted-foreground">
                        Your invoices will be automatically paid via Direct Debit on
                        the due date.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="font-display text-sm mb-2 block">
                  Preferred Payment Method
                </Label>
                <Select
                  value={settings?.preferred_payment_method || "card"}
                  onValueChange={(value) =>
                    setSettings((prev) =>
                      prev ? { ...prev, preferred_payment_method: value } : prev
                    )
                  }
                >
                  <SelectTrigger className="border-4 border-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card Payment</SelectItem>
                    <SelectItem value="direct_debit" disabled={!mandate}>
                      Direct Debit {!mandate && "(Not Set Up)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {/* Late Payment Info */}
          <motion.div
            variants={itemVariants}
            className="card-brutal bg-warning/10 border-warning p-6 mb-6"
          >
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              LATE PAYMENT POLICY
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Grace Period:</strong> 7 days after due date
              </p>
              <p>
                <strong>Late Fee:</strong> £5.00 applied after grace period
              </p>
              <p>
                <strong>Service Suspension:</strong> Accounts may be suspended
                after 30 days overdue
              </p>
            </div>
            <div className="mt-4 p-3 bg-background border-2 border-foreground">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Enable auto-pay to avoid late fees and ensure uninterrupted
                service.
              </p>
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{
                y: -4,
                x: -4,
                boxShadow: "8px 8px 0px 0px hsl(var(--foreground))",
              }}
            >
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full"
                variant="hero"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                Save Settings
              </Button>
            </motion.div>
          </motion.div>

          {/* Account Deletion */}
          <motion.div variants={itemVariants}>
            {user?.email && <AccountDeletion userEmail={user.email} />}
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
}
