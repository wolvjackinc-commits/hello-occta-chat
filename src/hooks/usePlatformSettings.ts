import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ApiMode = "manual" | "live";
export type SimMode = "quote" | "instant";

export interface PlatformSettings {
  api_mode: ApiMode;
  sim_checkout_mode: SimMode;
  manual_mode_message: string;
  rewards_enabled: boolean;
  rewards_unlock_rule: "first_cleared_payment" | "second_cleared_payment" | "custom_rule";
  vat_number: string | null;
  vat_effective_date: string | null;
  vat_default_rate: number;
  residential_vat_display: "inclusive" | "exclusive";
  business_vat_display: "exclusive" | "dual";
  invoice_prefix: string;
  credit_note_prefix: string;
}

const DEFAULTS: PlatformSettings = {
  api_mode: "manual",
  sim_checkout_mode: "quote",
  manual_mode_message:
    "We'll check the best available OCCTA option for your address and confirm speed, price, installation and switching details before you pay.",
  rewards_enabled: false,
  rewards_unlock_rule: "first_cleared_payment",
  vat_number: null,
  vat_effective_date: null,
  vat_default_rate: 20,
  residential_vat_display: "inclusive",
  business_vat_display: "dual",
  invoice_prefix: "INV-",
  credit_note_prefix: "CN-",
};

function computeVatActive(s: PlatformSettings): boolean {
  if (!s.vat_number || s.vat_number.trim().length === 0) return false;
  if (!s.vat_effective_date) return false;
  return new Date(s.vat_effective_date).getTime() <= Date.now();
}

export function usePlatformSettings() {
  const query = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async (): Promise<PlatformSettings> => {
      const { data, error } = await (supabase as any)
        .from("platform_settings")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...(data ?? {}) } as PlatformSettings;
    },
    staleTime: 60_000,
  });

  const settings = query.data ?? DEFAULTS;
  return {
    settings,
    isLoading: query.isLoading,
    isManualMode: settings.api_mode === "manual",
    isLiveMode: settings.api_mode === "live",
    simIsQuoteLed: settings.sim_checkout_mode === "quote",
    vatActive: computeVatActive(settings),
    rewardsEnabled: settings.rewards_enabled,
  };
}
