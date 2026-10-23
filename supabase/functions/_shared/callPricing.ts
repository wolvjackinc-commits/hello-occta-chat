// Published OCCTA phone and call pricing, as Ollie quotes it.
// These figures must match src/lib/pricing/catalogue.ts (voiceProducts,
// addonCatalogue, portingOptions); src/lib/pricing/__tests__/ollie-call-pricing.unit.test.ts
// fails if they drift. Prices in GBP; residential include VAT, business exclude VAT.

export const OLLIE_CALL_PRICING = {
  home_phone: {
    description: "Digital Home Phone runs over OCCTA broadband (add-on or bundle). Keep your existing number; needs mains power.",
    plans: [
      { id: "home-phone-payg", name: "Digital Home Phone (pay as you go calls)", monthly_inc_vat: 4.95, minutes_included: null },
      { id: "home-phone-1000min", name: "Digital Home Phone 1000 minutes", monthly_inc_vat: 7.95, minutes_included: 1000 },
    ],
    add_ons: [
      { id: "addon-unlimited-uk-calls", name: "Unlimited UK Calls", monthly_inc_vat: 3, detail: "Unlimited calls to UK landlines and mobiles, 24/7" },
      { id: "addon-intl-calls-pack", name: "International Calls Pack", monthly_inc_vat: 5, detail: "300 minutes to 50+ countries including USA, India and Pakistan" },
      { id: "addon-home-handset", name: "Home Phone Handset", one_off_inc_vat: 29, detail: "Cordless DECT handset delivered to your door" },
    ],
  },
  business_voice: {
    prices_exclude_vat: true,
    plans: [
      { id: "biz-voip-payg", name: "Business VoIP (pay as you go calls)", monthly_ex_vat: 6.95, minutes_included: null },
      { id: "biz-voip-2000min", name: "Business VoIP 2000 minutes", monthly_ex_vat: 11.95, minutes_included: 2000 },
      { id: "sip-trunk-payg", name: "SIP Trunk (pay as you go calls)", monthly_ex_vat: 5.95, minutes_included: null },
      { id: "sip-trunk-2000min", name: "SIP Trunk 2000 minutes", monthly_ex_vat: 9.95, minutes_included: 2000 },
    ],
  },
  number_porting_business: [
    { id: "port-single", name: "Single number port", one_off_ex_vat: 15 },
    { id: "port-multi", name: "Multi-number port, per number", one_off_ex_vat: 12, cap_ex_vat: 72 },
  ],
  sim: "Each SIM plan's UK call and text allowance comes from get_sim_plans (calls/texts labels). Roaming and fair use are per plan.",
  per_minute_rates:
    "Pay-as-you-go per-minute rates (UK, international, premium-rate and service numbers) are set out in the customer's call tariff, supplied with their order before acceptance. They are not held in this chat. If a customer needs a specific per-minute rate, ask which destination or number type, then raise a ticket (category landline or mobile) so the team sends the exact rate, or recommend a bundle/add-on that covers it.",
} as const;
