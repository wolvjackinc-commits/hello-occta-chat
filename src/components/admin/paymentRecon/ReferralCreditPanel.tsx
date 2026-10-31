import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pounds, referralAdmin, type AdminOverview } from "@/lib/referral/admin";

/**
 * Refer-a-friend credit on the Payment reconciliation page. Credit is a
 * negative invoice line, never money received, so it is shown here as its own
 * liability and never mixed into the bank/AccessPay matching below.
 */
export function ReferralCreditPanel() {
  const [o, setO] = useState<AdminOverview | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    referralAdmin.overview().then((v) => { if (live) setO(v); }).catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, []);
  if (missing) return null;
  if (!o) return null;
  const issues = o.last_recon?.issues ?? 0;
  return (
    <section className={`mb-4 border-2 p-3 text-sm ${issues > 0 ? "border-destructive" : "border-foreground"}`} data-testid="referral-credit-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display uppercase">Refer-a-friend bill credit</h2>
        <Link to="/admin/referrals" className="text-xs underline">Open Refer a friend</Link>
      </div>
      <p className="mt-1">
        Outstanding credit liability <strong>{pounds(o.liability_minor)}</strong> · awaiting approval {o.awaiting_admin} · review/hold {o.needs_review}
        {" · "}last credit reconciliation {o.last_recon ? `${new Date(o.last_recon.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}: ${issues} issue(s)` : "not run yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Credit appears on invoices as a negative line and reduces what the Direct Debit or bank transfer collects. It is not a payment and is never matched against bank or AccessPay rows.
      </p>
    </section>
  );
}
