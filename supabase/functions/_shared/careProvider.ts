// Which DD bureau (AccessPay or FastPay) collects a Care Direct Debit, from dd_providers.
import { CARE_DD } from "./careTerms.ts";

export type CareProvider = { code: string; name: string; sun: string; portal: string };

// deno-lint-ignore no-explicit-any
export async function careProvider(svc: any, code?: string | null): Promise<CareProvider> {
  const { data } = await svc.from("dd_providers").select("provider_code, display_name, legal_collection_name, service_user_number")
    .eq("provider_code", code || CARE_DD.providerCode).maybeSingle();
  return data
    ? { code: data.provider_code, name: data.legal_collection_name, sun: data.service_user_number, portal: data.display_name }
    : { code: CARE_DD.providerCode, name: CARE_DD.collectionName, sun: CARE_DD.serviceUserNumber, portal: "AccessPay" };
}

export const CARE_PROVIDER_CODES = ["accesspay", "fastpay"];
