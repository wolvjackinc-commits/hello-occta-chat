import { supabase } from "@/integrations/supabase/client";

export interface SimPlanPublic {
  id: string;
  slug: string;
  name: string;
  network_display_name: string | null;
  plan_type: "pay_monthly" | "payg";
  data_label: string;
  calls_label: string;
  texts_label: string;
  features: unknown;
  monthly_price_minor: number;
  first_payment_minor: number;
  setup_fee_minor: number;
  delivery_fee_minor: number;
  min_term_months: number;
  is_rolling: boolean;
  esim_available: boolean;
  physical_sim_available: boolean;
  vat_mode: "included" | "excluded";
  vat_rate: number;
  sort_order: number;
  terms_url: string | null;
}

export interface SimSettingsPublic {
  standalone_enabled: boolean;
  esim_enabled: boolean;
  physical_sim_enabled: boolean;
  direct_debit_enabled: boolean;
  pay_monthly_enabled: boolean;
  payg_enabled: boolean;
  dispatch_lead_time_days: number;
}

export async function loadSimCatalogue(): Promise<{
  settings: SimSettingsPublic | null;
  plans: SimPlanPublic[];
}> {
  const client = supabase as unknown as {
    from: (rel: string) => {
      select: (cols: string) => {
        maybeSingle: () => Promise<{ data: unknown }>;
        order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown }>;
      };
    };
  };
  const [settingsRes, plansRes] = await Promise.all([
    client.from("sim_settings_public").select("*").maybeSingle(),
    client.from("sim_plans_public").select("*").order("sort_order", { ascending: true }),
  ]);
  return {
    settings: (settingsRes.data as SimSettingsPublic | null) ?? null,
    plans: ((plansRes.data as SimPlanPublic[] | null) ?? []),
  };
}

export function formatGbp(minor: number) {
  const major = minor / 100;
  return major.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}