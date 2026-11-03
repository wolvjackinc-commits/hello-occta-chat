import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, X } from "lucide-react";
import {
  CARE_DD, CARE_FREQUENCIES, CARE_NOT_INCLUDED, CARE_PLANS, carePriceMinor, pounds, type CareFrequency,
} from "../../../supabase/functions/_shared/careTerms.ts";
import { providerGuaranteeText } from "../../../supabase/functions/_shared/directDebitGuarantee.ts";

export const CARE_NAV = [
  { to: "/care", label: "OCCTA Care" },
  { to: "/care/how-it-works", label: "How it works" },
  { to: "/care/faq", label: "Questions" },
  { to: "/care/key-facts", label: "Key facts" },
  { to: "/legal/occta-care-terms", label: "Terms" },
];

export function CareSubnav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="OCCTA Care pages" className="border-b-[3px] border-foreground bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6 md:px-12">
        {CARE_NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            aria-current={pathname === n.to ? "page" : undefined}
            className={`whitespace-nowrap px-3 py-3 font-display text-xs uppercase tracking-wide ${pathname === n.to ? "bg-primary text-black" : "hover:bg-secondary"}`}
          >
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function priceSuffix(f: CareFrequency) {
  return f === "monthly" ? "/month" : f === "quarterly" ? "every 3 months" : "/year";
}

export function CarePlanCards({ ctaTo, ctaLabel = "Join", compact = false, salesOpen = true }: { ctaTo?: (plan: string, freq: CareFrequency) => string; ctaLabel?: string; compact?: boolean; salesOpen?: boolean }) {
  const [freq, setFreq] = useState<CareFrequency>("monthly");
  return (
    <div>
      <div role="radiogroup" aria-label="How often you pay" className="mb-6 inline-flex flex-wrap border-[3px] border-foreground">
        {CARE_FREQUENCIES.map((f) => (
          <button
            key={f.code}
            type="button"
            role="radio"
            aria-checked={freq === f.code}
            onClick={() => setFreq(f.code)}
            className={`px-4 py-2 font-display text-xs uppercase ${freq === f.code ? "bg-foreground text-background" : "bg-background hover:bg-secondary"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {CARE_PLANS.map((p, i) => {
          const price = carePriceMinor(p.code, freq) ?? 0;
          return (
            <article key={p.code} className={`relative border-[3px] border-foreground bg-card p-6 ${i === 1 ? "shadow-[8px_8px_0_0_hsl(var(--primary))]" : ""}`}>
              {i === 1 && <p className="absolute -top-3 right-4 bg-primary px-2 py-0.5 font-display text-[10px] uppercase text-black">More help, faster</p>}
              <h3 className="font-display text-2xl uppercase">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-4 font-display text-4xl">
                {pounds(price)} <span className="text-base font-sans text-muted-foreground">{priceSuffix(freq)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                VAT included.{freq !== "monthly" && ` Works out at ${pounds(Math.round(price / (freq === "annual" ? 12 : 3)))} a month.`} Its own Direct Debit, separate from your broadband.
              </p>
              {!compact && (
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden /> <span>{f}</span></li>
                  ))}
                </ul>
              )}
              {ctaTo && salesOpen && (
                <Link
                  to={ctaTo(p.code, freq)}
                  className="mt-6 inline-block border-[3px] border-foreground bg-foreground px-5 py-3 font-display text-sm uppercase text-background hover:bg-primary hover:text-black"
                  data-testid={`care-join-${p.code}`}
                >
                  {ctaLabel} {p.name}
                </Link>
              )}
            </article>
          );
        })}
      </div>
      {!salesOpen && (
        <p className="mt-4 border-2 border-foreground px-4 py-2 text-sm">OCCTA Care isn't taking new members right now. Please check back soon.</p>
      )}
    </div>
  );
}

export function CareNotIncluded({ className = "" }: { className?: string }) {
  return (
    <div className={`border-[3px] border-foreground bg-background p-5 ${className}`} data-testid="care-not-included">
      <p className="font-display uppercase">Not included, so you know exactly what you're getting</p>
      <ul className="mt-3 space-y-2 text-sm">
        {CARE_NOT_INCLUDED.map((l) => (
          <li key={l} className="flex gap-2"><X className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden /> <span>{l}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function CareDDGuarantee({ dd }: { dd?: { name: string; sun: string } }) {
  const text = providerGuaranteeText({
    legal_collection_name: dd?.name ?? CARE_DD.collectionName,
    service_user_number: dd?.sun ?? CARE_DD.serviceUserNumber,
    advance_notice_working_days: CARE_DD.noticeWorkingDays,
  });
  return (
    <div className="border-[3px] border-foreground bg-background p-4 text-xs leading-relaxed" data-testid="care-dd-guarantee">
      <p className="mb-2 font-display text-sm uppercase">The Direct Debit Guarantee</p>
      {text.split(/\n\n+/).map((p) => <p key={p.slice(0, 24)} className="mb-2">{p}</p>)}
    </div>
  );
}
