/**
 * Consumer Contract v2026.10.1 release gate.
 *
 * Release state is authoritative in platform_settings and defaults fail-closed.
 * The request body can never enable issuance. Business contracts remain on their
 * separate path. Historic accepted documents are returned before this gate.
 */
export const CONSUMER_CONTRACT_VERSION = "2026.10.1";

export function consumerContractReleaseBlock(customerType: unknown, releaseEnabled = false) {
  if (customerType === "business") return null;
  if (releaseEnabled === true) return null;
  return {
    error: "consumer_contract_issuance_paused",
    contract_terms_version: CONSUMER_CONTRACT_VERSION,
    message: "Your contract needs a review before it can be issued or accepted. Please contact OCCTA support. Your order has not been accepted.",
    blockers: [
      "production_release_switch_disabled",
      "verified_fixed_broadband_speed_matrix",
      "likely_service_date_in_immutable_documents",
      "exact_document_hashes_and_verified_otp",
    ],
  };
}

export async function consumerContractReleaseBlockForDb(
  supabase: any,
  customerType: unknown,
) {
  if (customerType === "business") return null;
  const { data, error } = await supabase
    .from("platform_settings")
    .select("consumer_contract_release_enabled, consumer_contract_release_version")
    .eq("singleton", true)
    .maybeSingle();

  const enabled =
    !error &&
    data?.consumer_contract_release_enabled === true &&
    data?.consumer_contract_release_version === CONSUMER_CONTRACT_VERSION;

  return consumerContractReleaseBlock(customerType, enabled);
}
