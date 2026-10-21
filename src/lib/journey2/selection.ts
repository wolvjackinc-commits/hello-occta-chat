import type { AddonId, Catalogue, Journey2Session, PlanTerm, PriceSnapshot, RouterOption, RouterPayType, SpeedBucket } from "./client";

/* The customer's current, not-yet-saved choices on the plan, router and extras
   screens. The summary prices them straight from the catalogue the steps are
   already showing, so it updates the moment something is picked. The saved,
   server-resolved price snapshot stays the source of truth and replaces this as
   soon as Continue is saved. */

export type OrderSelection = {
  speed_bucket?: SpeedBucket | null;
  plan_term?: PlanTerm | null;
  router?: { option: RouterOption; payment_type: RouterPayType } | null;
  addons?: AddonId[];
};

export type SelectionTotals = { planLabel: string; monthly: number; oneOff: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

const BUCKET_LABELS: Record<SpeedBucket, string> = {
  essential: "Essential Fibre",
  superfast: "Superfast Fibre",
  ultrafast: "Ultrafast Fibre",
  gigabit: "Gigabit Fibre",
};

/** A customer-facing plan name, never the internal bucket id. */
export function planLabel(snapshot: PriceSnapshot | null | undefined, catalogue: Catalogue | null, bucket?: SpeedBucket | null): string {
  const id = bucket ?? snapshot?.speed_bucket ?? null;
  if (snapshot?.plan_label) return snapshot.plan_label;
  const fromCatalogue = id ? catalogue?.plans.find((p) => p.speed_bucket === id)?.label : undefined;
  return fromCatalogue ?? (id ? BUCKET_LABELS[id] ?? id : "");
}

/** Totals for the current selection, or null when the catalogue can't price it exactly. */
export function selectionTotals(
  catalogue: Catalogue | null,
  session: Journey2Session,
  selection: OrderSelection | null,
): SelectionTotals | null {
  if (!catalogue) return null;
  const bucket = selection?.speed_bucket ?? session.speed_bucket;
  const term = selection?.plan_term ?? session.plan_term;
  const plan = catalogue.plans.find((p) => p.speed_bucket === bucket);
  const priced = plan && term ? plan.terms[term] : undefined;
  if (!plan || !priced) return null;

  const savedRouter = session.router_option
    ? { option: session.router_option.router_option, payment_type: session.router_option.router_payment_type }
    : null;
  const routerChoice = selection?.router !== undefined ? selection.router : savedRouter;
  const router = routerChoice
    ? catalogue.routers.find((r) => r.option === routerChoice.option && r.payment_type === routerChoice.payment_type)
    : undefined;
  const addons = selection?.addons ?? session.selected_addons ?? [];
  const addonsMonthly = addons.reduce((sum, id) => sum + (catalogue.extras.find((e) => e.id === id)?.monthly ?? 0), 0);

  return {
    planLabel: plan.label,
    monthly: round2(priced.monthly_incl_vat + (router?.monthly ?? 0) + addonsMonthly),
    oneOff: round2((router?.one_off ?? 0) + (catalogue.setup?.one_off ?? 0)),
  };
}

/** True when the live selection would change what the saved summary shows. */
export function selectionDiffers(totals: SelectionTotals | null, snapshot: PriceSnapshot | null | undefined, oneOffSaved: number): boolean {
  if (!totals) return false;
  if (!snapshot) return true;
  return Math.abs(totals.monthly - snapshot.monthly_total_incl_vat) > 0.004 || Math.abs(totals.oneOff - oneOffSaved) > 0.004;
}
