import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * What the customer actually signed for, read from their Contract Summary,
 * so staff can check an incoming order (router? which services? any one-time
 * fee? price?) without opening the PDF.
 */

type Json = Record<string, any> | null | undefined;

export type ContractSnapshotInput = {
  cs_number?: string | null;
  status?: string | null;
  accepted_at?: string | null;
  plan_name?: string | null;
  plan_term?: string | null;
  minimum_term_months?: number | null;
  monthly_price_incl_vat?: number | string | null;
  router_option?: Json;
  router_charge?: number | string | null;
  setup_option?: Json;
  setup_charge?: number | string | null;
  installation_charge?: number | string | null;
  delivery_charge?: number | string | null;
  one_off_charges?: unknown;
  selected_addons?: unknown;
  digital_voice?: Json;
  likely_service_date?: string | null;
};

export type ContractSnapshotSummary = {
  plan: string | null;
  term: string | null;
  monthly: number | null;
  router: { wanted: boolean; text: string } | null;
  oneOffs: Array<{ label: string; amount: number }>;
  oneOffTotal: number;
  addons: string[];
  startDate: string | null;
};

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
};

export const gbp = (n: number) => `£${n.toFixed(2)}`;

/** Map the view's `cs_*` columns onto the snapshot input. */
export function snapshotFromViewRow(row: Record<string, any>): ContractSnapshotInput | null {
  if (!row?.cs_id && !row?.cs_plan_name) return null;
  return {
    cs_number: row.cs_number,
    status: row.cs_status,
    accepted_at: row.cs_accepted_at,
    plan_name: row.cs_plan_name,
    plan_term: row.cs_plan_term,
    minimum_term_months: row.cs_minimum_term_months,
    monthly_price_incl_vat: row.cs_monthly_price_incl_vat,
    router_option: row.cs_router_option,
    router_charge: row.cs_router_charge,
    setup_option: row.cs_setup_option,
    setup_charge: row.cs_setup_charge,
    installation_charge: row.cs_installation_charge,
    delivery_charge: row.cs_delivery_charge,
    one_off_charges: row.cs_one_off_charges,
    selected_addons: row.cs_selected_addons,
    digital_voice: row.cs_digital_voice,
    likely_service_date: row.cs_likely_service_date,
  };
}

/** Map a raw `contract_summaries` row onto the snapshot input. */
export function snapshotFromContractRow(cs: Record<string, any> | null | undefined): ContractSnapshotInput | null {
  if (!cs) return null;
  return {
    ...cs,
    one_off_charges: cs.one_off_charges_snapshot ?? cs.one_off_charges_json,
    digital_voice: cs.digital_voice_addon_snapshot,
  } as ContractSnapshotInput;
}

export function summariseContract(cs: ContractSnapshotInput): ContractSnapshotSummary {
  // Router
  let router: ContractSnapshotSummary["router"] = null;
  const r = cs.router_option ?? null;
  if (r && (r.label || r.option)) {
    const own = r.option === "own" || r.option === "byo" || r.payment_type === "none";
    if (own) {
      router = { wanted: false, text: "No router — customer uses their own" };
    } else {
      const label = String(r.label ?? "Router");
      const monthly = num(r.monthly);
      const oneOff = num(r.one_off) || (r.payment_type === "one_off" ? num(cs.router_charge) : 0);
      const price = r.payment_type === "monthly" && monthly > 0
        ? ` — ${gbp(monthly)}/mo`
        : r.payment_type === "one_off" && oneOff > 0
          ? ` — ${gbp(oneOff)} one-off`
          : monthly > 0 ? ` — ${gbp(monthly)}/mo` : " — included";
      router = { wanted: true, text: `Router: ${label}${price}` };
    }
  }

  // One-time charges. The snapshot list (when present) is the signed source of
  // truth and already includes setup, so don't add setup on top of it.
  const oneOffs: Array<{ label: string; amount: number }> = [];
  const list = Array.isArray(cs.one_off_charges) ? (cs.one_off_charges as any[]) : [];
  if (list.length) {
    for (const c of list) {
      const amount = num(c?.amount ?? c?.amount_incl_vat ?? c?.oneOff);
      if (amount > 0) oneOffs.push({ label: String(c?.label ?? "One-off charge"), amount });
    }
  } else {
    const setup = num(cs.setup_charge) || num(cs.setup_option?.oneOff);
    if (setup > 0) oneOffs.push({ label: String(cs.setup_option?.label ?? "Setup / activation"), amount: setup });
    const install = num(cs.installation_charge);
    if (install > 0) oneOffs.push({ label: "Installation", amount: install });
    const delivery = num(cs.delivery_charge);
    if (delivery > 0) oneOffs.push({ label: "Delivery", amount: delivery });
    if (r?.payment_type === "one_off") {
      const ro = num(r.one_off) || num(cs.router_charge);
      if (ro > 0) oneOffs.push({ label: "Router (one-off)", amount: ro });
    }
  }
  const oneOffTotal = oneOffs.reduce((s, c) => s + c.amount, 0);

  // Add-ons
  const addons: string[] = [];
  const raw = Array.isArray(cs.selected_addons) ? (cs.selected_addons as any[]) : [];
  for (const a of raw) {
    if (typeof a === "string") addons.push(a.replace(/_/g, " "));
    else if (a && (a.label || a.id)) {
      const m = num(a.monthly);
      addons.push(`${a.label ?? String(a.id).replace(/_/g, " ")}${m > 0 ? ` (${gbp(m)}/mo)` : ""}`);
    }
  }
  if (cs.digital_voice?.selected === true && !raw.some((a: any) => a?.id === "digital_voice" || a === "digital_voice")) {
    addons.push("Digital Voice");
  }

  const months = cs.minimum_term_months ?? null;
  const term = months ? `${months}-month minimum` : cs.plan_term ? String(cs.plan_term).replace(/_/g, " ") : null;
  const monthly = cs.monthly_price_incl_vat == null ? null : num(cs.monthly_price_incl_vat);

  return {
    plan: cs.plan_name ?? null,
    term,
    monthly,
    router,
    oneOffs,
    oneOffTotal,
    addons,
    startDate: cs.likely_service_date ?? null,
  };
}

function safeDate(d: string | null | undefined, fmt: string) {
  if (!d) return null;
  try { return format(new Date(d), fmt); } catch { return d; }
}

/** One-glance line for the customers list. */
export function ContractSnapshotInline({ cs, className }: { cs: ContractSnapshotInput; className?: string }) {
  const s = summariseContract(cs);
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}>
      {s.plan && <span className="font-medium">{s.plan}</span>}
      {s.monthly != null && <Badge variant="outline" className="border-foreground/40">{gbp(s.monthly)}/mo</Badge>}
      {s.router && (
        <Badge variant="outline" className={cn("border-foreground/40", s.router.wanted && "border-primary text-primary")}>
          {s.router.wanted ? s.router.text : "No router"}
        </Badge>
      )}
      <Badge variant="outline" className={cn("border-foreground/40", s.oneOffTotal > 0 && "border-warning text-warning")}>
        {s.oneOffTotal > 0 ? `One-time fee ${gbp(s.oneOffTotal)}` : "No one-time fee"}
      </Badge>
      {s.addons.length > 0 && (
        <Badge variant="outline" className="border-foreground/40">+ {s.addons.join(", ")}</Badge>
      )}
    </div>
  );
}

/** Full card for the customer page. */
export function ContractSnapshotCard({ cs, title = "What the customer ordered" }: { cs: ContractSnapshotInput; title?: string }) {
  const s = summariseContract(cs);
  const rows: Array<[string, React.ReactNode]> = [
    ["Plan", s.plan ?? "—"],
    ["Contract", s.term ?? "—"],
    ["Monthly price (incl. VAT)", s.monthly != null ? gbp(s.monthly) : "—"],
    ["Router", s.router ? (s.router.wanted ? s.router.text.replace(/^Router: /, "Yes — ") : "No — customer uses their own") : "—"],
    [
      "One-time fees",
      s.oneOffs.length
        ? s.oneOffs.map((c) => `${c.label} ${gbp(c.amount)}`).join(" · ") + (s.oneOffs.length > 1 ? ` (total ${gbp(s.oneOffTotal)})` : "")
        : "None",
    ],
    ["Add-ons / extra services", s.addons.length ? s.addons.join(", ") : "None"],
    ["Likely service date", safeDate(s.startDate, "dd MMM yyyy") ?? "—"],
  ];
  return (
    <div className="border-2 border-foreground p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-display text-lg">{title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {cs.cs_number && <span className="font-mono">{cs.cs_number}</span>}
          {cs.status && <Badge variant="outline" className="border-2 border-foreground capitalize">{cs.status}</Badge>}
          {cs.accepted_at && <span>signed {safeDate(cs.accepted_at, "dd MMM yyyy HH:mm")}</span>}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
