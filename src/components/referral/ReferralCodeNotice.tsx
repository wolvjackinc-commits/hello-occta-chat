import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { checkReferralCode, normaliseReferralCode, type ReferralCodeCheck } from "@/lib/referral";
import { REFERRAL_TERMS_PATH } from "@/lib/referral/terms";

/**
 * Shown under the order form's reference-code box when the code is a live
 * refer-a-friend code, so the friend sees the conditions before they accept.
 * Nothing is shown while the scheme is switched off (the check returns false).
 */
export default function ReferralCodeNotice({ code, business }: { code: string; business?: boolean }) {
  const [info, setInfo] = useState<ReferralCodeCheck | null>(null);

  useEffect(() => {
    const c = normaliseReferralCode(code);
    if (!c) { setInfo(null); return; }
    let live = true;
    const t = window.setTimeout(() => {
      void checkReferralCode(c).then((r) => { if (live) setInfo(r.referral ? r : null); });
    }, 350);
    return () => { live = false; window.clearTimeout(t); };
  }, [code]);

  if (!info?.referral || !info.friend_reward) return null;
  const amount = business
    ? `£${info.friend_reward.business.friend} (before VAT)`
    : `£${info.friend_reward.residential.friend}`;
  const days = info.qualify_days ?? 60;
  const bills = info.invoices_required ?? 2;

  return (
    <div className="mt-2 border-2 border-foreground bg-secondary p-3 text-xs leading-relaxed" role="status" data-testid="referral-code-notice">
      <p className="font-display uppercase text-[11px]">Refer-a-friend code</p>
      <p className="mt-1">
        If your service has been live for {days} days and you've paid your first {bills} bills in full and on time,
        you'll get {amount} bill credit, and so will the friend who referred you. Bill credit only, never cash. Your
        account must stay up to date the whole time. It can't be combined with another offer on this order.
      </p>
      <p className="mt-1">
        <Link to={REFERRAL_TERMS_PATH} target="_blank" rel="noopener" className="underline">
          Refer-a-friend terms
        </Link>{" "}
        (version {info.terms_version}).
      </p>
    </div>
  );
}
