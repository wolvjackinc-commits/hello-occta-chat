/**
 * Customer-facing contract label for a service row. Service rows carry a mix
 * of current (Flex 30, Price Lock 24), legacy (Contract Saver) and business
 * contract names, in either plan_name or the free-text contract_type.
 */
export function contractLabel(s: { plan_name?: string | null; contract_type?: string | null; minimum_term_months?: number | null }): string {
  const text = `${s.contract_type ?? ""} ${s.plan_name ?? ""}`.toLowerCase();
  if (text.includes("price lock")) return "Price Lock 24";
  if (text.includes("saver")) return "Contract Saver";
  if (text.includes("flex") || text.includes("rolling")) return "Flex 30";
  const fixed = text.match(/fixed\s*(\d{1,2})/);
  if (fixed) return `Fixed ${fixed[1]} months`;
  const months = s.minimum_term_months ?? 0;
  if (months > 1 && months !== 30) return `${months}-month term`;
  return "See your Contract Summary";
}
