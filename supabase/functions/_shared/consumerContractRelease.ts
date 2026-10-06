/**
 * The version label alone is not permission to issue a consumer contract.
 * The current pipeline cannot freeze/render the required line-speed matrix,
 * likely service date and applicable voice tariff. Keep new issuance paused
 * until those inputs and the approved production package are integrated and
 * verified end to end. Do not add a request-body or environment bypass.
 * Historical accepted documents must be returned before this gate is called.
 */
export const CONSUMER_CONTRACT_VERSION = "2026.10.1";

export function consumerContractReleaseBlock(customerType: unknown) {
  // Classification comes from the stored quote/contract, never the request.
  // Unknown classifications fail closed too. Business contracts are separate.
  if (customerType === "business") return null;
  return {
    error: "consumer_contract_issuance_paused",
    contract_terms_version: CONSUMER_CONTRACT_VERSION,
    message: "Your contract needs a review before it can be issued or accepted. Please contact OCCTA support. Your order has not been accepted.",
    blockers: [
      "verified_fixed_broadband_speed_matrix",
      "likely_service_date_in_immutable_documents",
      "applicable_voice_tariff_and_separate_consents",
      "approved_production_package_verification",
    ],
  };
}
