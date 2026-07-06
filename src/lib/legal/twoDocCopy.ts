// Phase B/C — mirror of supabase/functions/_shared/twoDocLegalText.ts for
// customer-facing screens. Keep in sync.

export const TWO_DOC_TEMPLATE_VERSION = "2026-07-01";

export const CONTRACT_SUMMARY_TITLE = "OCCTA Contract Summary";
export const CONTRACT_INFORMATION_PACK_TITLE =
  "OCCTA Contract Information & Customer Agreement Pack";

export const DV_DEPENDENCY_POINTS: readonly string[] = [
  "Depends on your broadband connection being live.",
  "Depends on mains power to your router and any DECT / handset base.",
  "Will not work during a mains power cut unless suitable battery backup is in place.",
  "Will not work during a broadband outage.",
  "Requires an OCCTA-supplied or approved router/ATA configured for Digital Voice.",
  "999 / 112 emergency calls will not work if power, broadband or the router is unavailable.",
  "Personal telecare alarms, medical alert pendants and lift/lifeline devices connected to your line may stop working without a compatible backup solution.",
  "If you have poor or no mobile coverage at the property, you should not rely on Digital Voice for emergency calls without a backup.",
];

export const DV_ACKNOWLEDGEMENT_CHECKBOX =
  "I understand that Digital Voice / Home Phone depends on broadband and mains power and may not work during a power cut or broadband outage unless suitable backup is in place.";

export const DV_VULNERABILITY_QUESTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "relies_on_emergency", label: "Do you rely on this line for 999 / 112 emergency calls?" },
  { id: "uses_telecare", label: "Is a telecare alarm, medical alert pendant or lifeline device connected to this line?" },
  { id: "uses_medical_equipment", label: "Is any medical equipment connected to this line?" },
  { id: "accessibility_needs", label: "Do you have accessibility needs that make a working phone line essential?" },
  { id: "poor_mobile_coverage", label: "Is mobile coverage at the property poor or non-existent?" },
];

export const CHECKBOX_TEXTS = {
  received_read:
    "I confirm that I have received, reviewed and had the opportunity to download both my Contract Summary and my Contract Information & Customer Agreement Pack.",
  details_correct:
    "I confirm that my personal details and service address shown are correct.",
  understand_charges:
    "I understand the monthly charges, one-off charges, contract type per component, notice periods, cancellation rules and ETFs where they apply.",
  consent:
    "I expressly consent to enter into the agreement with OCCTA LIMITED on the terms shown in both documents.",
} as const;