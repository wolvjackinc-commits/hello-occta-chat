import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { format, addMonths } from "date-fns";
import {
  Settings,
  Calendar,
  RefreshCw,
  Loader2,
  CheckCircle,
  Receipt,
} from "lucide-react";

type BillingSettings = {
  id: string;
  user_id: string;
  billing_mode: string;
  billing_day: number | null;
  vat_enabled_default: boolean;
  vat_rate_default: number;
  next_invoice_date: string | null;
  payment_terms_days: number;
  auto_pay_enabled: boolean;
  preferred_payment_method: string | null;
};

interface CustomerBillingSettingsProps {
  userId: string;
  accountNumber: string | null;
  onUpdate?: () => void;
}

export function CustomerBillingSettings({
  userId,
  accountNumber,
  onUpdate,
}: CustomerBillingSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [settings, setSettings] = useState<BillingSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [userId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("billing_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as unknown as BillingSettings);
      } else {
        // Create default settings
        const { data: newSettings, error: createError } = await supabase
          .from("billing_settings")
          .insert({
            user_id: userId,
            billing_mode: "anniversary",
            billing_day: null,
            vat_enabled_default: true,
            vat_rate_default: 20,
            payment_terms_days: 7,
          })
          .select()
          .single();

        if (!createError && newSettings) {
          setSettings(newSettings as unknown as BillingSettings);
        }
      }
    } catch (err) {
      console.error("Failed to fetch billing settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("billing_settings")
        .update({
          billing_mode: settings.billing_mode,
          billing_day: settings.billing_mode === "fixed_day" ? settings.billing_day : null,
          vat_enabled_default: settings.vat_enabled_default,
          vat_rate_default: settings.vat_rate_default,
          payment_terms_days: settings.payment_terms_days,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;

      await logAudit({
        action: "update",
        entity: "billing_settings",
        entityId: settings.id,
        metadata: {
          account_number: accountNumber,
          billing_mode: settings.billing_mode,
          vat_enabled: settings.vat_enabled_default,
        },
      });

      toast({ title: "Billing settings saved" });
      onUpdate?.();
    } catch (err: any) {
      toast({
        title: "Failed to save",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculateNextDate = async () => {
    if (!settings) return;
    setRecalculating(true);

    try {
      // Calculate based on billing mode
      let nextDate: Date;
      const today = new Date();

      if (settings.billing_mode === "fixed_day" && settings.billing_day) {
        // Fixed day: use billing_day of next month
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = Math.min(settings.billing_day, 28);

        nextDate = new Date(year, month, day);
        if (nextDate <= today) {
          nextDate = addMonths(nextDate, 1);
        }
      } else {
        // Anniversary: 1 month from today
        nextDate = addMonths(today, 1);
      }

      const nextDateStr = format(nextDate, "yyyy-MM-dd");

      const { error } = await supabase
        .from("billing_settings")
        .update({
          next_invoice_date: nextDateStr,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;

      setSettings((prev) =>
        prev ? { ...prev, next_invoice_date: nextDateStr } : prev
      );

      await logAudit({
        action: "update",
        entity: "billing_settings",
        entityId: settings.id,
        metadata: {
          account_number: accountNumber,
          recalculated_next_invoice_date: nextDateStr,
        },
      });

      toast({ title: "Next invoice date recalculated", description: format(nextDate, "dd MMM yyyy") });
      onUpdate?.();
    } catch (err: any) {
      toast({
        title: "Failed to recalculate",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-foreground p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading billing settings...
        </div>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card className="border-2 border-foreground p-4">
        <p className="text-muted-foreground">Unable to load billing settings.</p>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-foreground p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          BILLING SETTINGS
        </h3>
        {settings.next_invoice_date && (
          <Badge variant="outline" className="border-2 border-primary">
            <Calendar className="h-3 w-3 mr-1" />
            Next: {format(new Date(settings.next_invoice_date), "dd MMM yyyy")}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Billing Mode */}
        <div className="space-y-2">
          <Label className="font-display text-xs uppercase">Billing Mode</Label>
          <Select
            value={settings.billing_mode}
            onValueChange={(value) =>
              setSettings((prev) => (prev ? { ...prev, billing_mode: value } : prev))
            }
          >
            <SelectTrigger className="border-2 border-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anniversary">Anniversary (monthly from activation)</SelectItem>
              <SelectItem value="fixed_day">Fixed Day (same day each month)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Billing Day (only for fixed_day) */}
        {settings.billing_mode === "fixed_day" && (
          <div className="space-y-2">
            <Label className="font-display text-xs uppercase">Billing Day (1-28)</Label>
            <Select
              value={String(settings.billing_day || 1)}
              onValueChange={(value) =>
                setSettings((prev) =>
                  prev ? { ...prev, billing_day: parseInt(value, 10) } : prev
                )
              }
            >
              <SelectTrigger className="border-2 border-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                    {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Payment Terms */}
        <div className="space-y-2">
          <Label className="font-display text-xs uppercase">Payment Terms (days)</Label>
          <Select
            value={String(settings.payment_terms_days)}
            onValueChange={(value) =>
              setSettings((prev) =>
                prev ? { ...prev, payment_terms_days: parseInt(value, 10) } : prev
              )
            }
          >
            <SelectTrigger className="border-2 border-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* VAT Rate */}
        <div className="space-y-2">
          <Label className="font-display text-xs uppercase">Default VAT Rate (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={settings.vat_rate_default}
            onChange={(e) =>
              setSettings((prev) =>
                prev ? { ...prev, vat_rate_default: parseFloat(e.target.value) || 0 } : prev
              )
            }
            className="border-2 border-foreground"
          />
        </div>
      </div>

      {/* VAT Toggle */}
      <div className="flex items-center justify-between p-3 border-2 border-foreground bg-secondary/30">
        <div>
          <Label className="font-display text-sm">Default VAT Enabled</Label>
          <p className="text-xs text-muted-foreground">
            Apply VAT to new invoices by default
          </p>
        </div>
        <Switch
          checked={settings.vat_enabled_default}
          onCheckedChange={(checked) =>
            setSettings((prev) => (prev ? { ...prev, vat_enabled_default: checked } : prev))
          }
        />
      </div>

      {/* Next Invoice Date */}
      <div className="p-3 border-2 border-foreground bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="font-display text-sm">Next Invoice Date</span>
            </div>
            <p className="text-lg font-medium mt-1">
              {settings.next_invoice_date
                ? format(new Date(settings.next_invoice_date), "dd MMMM yyyy")
                : "Not scheduled"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateNextDate}
            disabled={recalculating}
            className="border-2 border-foreground"
          >
            {recalculating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Recalculate
          </Button>
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full border-2 border-foreground"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <CheckCircle className="h-4 w-4 mr-2" />
        )}
        Save Billing Settings
      </Button>
    </Card>
  );
}
