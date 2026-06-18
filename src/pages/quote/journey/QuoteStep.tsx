import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { CONTRACT_SUMMARY_PROMISE_TEXT } from "@/lib/legal/contractSummaryCopy";

export default function QuoteStep({
  quote, journey, continuing, declining, onContinue, onDeclineClick,
}: {
  quote: any;
  journey: { status: string; current_step: string } | null;
  continuing: boolean;
  declining: boolean;
  onContinue: () => void;
  onDeclineClick: () => void;
}) {
  const isBusiness = quote.customer_type === "business";
  const monthly = Number(quote.monthly_gross).toFixed(2);
  const monthlyNet = Number(quote.monthly_net).toFixed(2);
  const expired = quote.expires_at && new Date(quote.expires_at) < new Date();
  const declined = journey?.status === "declined";
  const advanced = journey && journey.current_step !== "quote" && !declined;
  const eligible = ["approved", "sent", "viewed", "pending", "draft"].includes(quote.status) && !expired && !declined && !advanced;

  const addons: any[] = Array.isArray(quote.selected_addons) ? quote.selected_addons : [];
  const hasDigitalVoice = addons.some((a: any) => {
    const s = JSON.stringify(a ?? "").toLowerCase();
    return s.includes("digital voice") || s.includes("digital_voice") || s.includes("voip");
  });

  return (
    <>
      <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        OCCTA · Quote {quote.quote_number}
      </p>
      <h1 className="font-display uppercase text-3xl md:text-4xl mb-1">{quote.plan_name}</h1>
      {(quote.customer_name || quote.service_address || quote.service_postcode) && (
        <p className="text-sm text-muted-foreground mb-4">
          {quote.customer_name && <>Prepared for <strong className="text-foreground">{quote.customer_name}</strong></>}
          {(quote.service_address || quote.service_postcode) && (
            <> · Service address <span className="text-foreground font-medium">{quote.service_address || quote.service_postcode}</span></>
          )}
        </p>
      )}

      <div className="border-4 border-foreground p-6 mb-6 bg-background">
        <p className="font-display uppercase text-xs text-muted-foreground mb-2">Monthly price</p>
        {isBusiness ? (
          <div className="flex items-baseline flex-wrap gap-2">
            <span className="font-display text-5xl md:text-6xl text-foreground leading-none">£{monthlyNet}</span>
            <span className="text-base text-foreground/80 font-semibold">/month ex VAT</span>
            <span className="block w-full text-sm text-muted-foreground mt-1">£{monthly} incl VAT</span>
          </div>
        ) : (
          <div className="flex items-baseline flex-wrap gap-2">
            <span className="font-display text-5xl md:text-6xl text-foreground leading-none">£{monthly}</span>
            <span className="text-base text-foreground/80 font-semibold">/month (incl. VAT)</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {quote.plan_type === "flex" ? "30-day rolling" : `${quote.contract_length_months}-month term`} · {quote.notice_period} notice
        </p>
      </div>

      {Number(quote.total_due_today_gross) > 0 && (
        <div className="border-4 border-foreground p-6 mb-6">
          <p className="font-display uppercase text-xs text-muted-foreground mb-2">One-off charges</p>
          <ul className="text-sm space-y-1">
            {Number(quote.setup_gross) > 0 && <li className="flex justify-between"><span>Setup</span><span>£{Number(quote.setup_gross).toFixed(2)}</span></li>}
            {Number(quote.router_gross) > 0 && <li className="flex justify-between"><span>Router</span><span>£{Number(quote.router_gross).toFixed(2)}</span></li>}
            {Number(quote.delivery_gross) > 0 && <li className="flex justify-between"><span>Delivery</span><span>£{Number(quote.delivery_gross).toFixed(2)}</span></li>}
            {Number(quote.installation_gross) > 0 && <li className="flex justify-between"><span>Installation</span><span>£{Number(quote.installation_gross).toFixed(2)}</span></li>}
            <li className="flex justify-between border-t-2 border-foreground pt-2 mt-2 font-display uppercase">
              <span>Quoted setup total</span><span>£{Number(quote.total_due_today_gross).toFixed(2)}</span>
            </li>
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">
            Setup charges are confirmed on your Contract Summary. They are not collected at this stage.
          </p>
        </div>
      )}

      {(quote.estimated_download_speed || quote.estimated_upload_speed) && (
        <p className="text-sm text-muted-foreground mb-4">
          Estimated speeds: {quote.estimated_download_speed ?? "—"} Mbps down / {quote.estimated_upload_speed ?? "—"} Mbps up. {quote.speed_notes ?? ""}
        </p>
      )}

      {hasDigitalVoice && (
        <div className="border-2 border-warning bg-warning/10 p-3 mb-4 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span><strong>Digital Voice included.</strong> Digital Voice (VoIP) needs power and broadband to work. In a power cut you may not be able to call emergency services (999/112). We recommend keeping a charged mobile as backup. Vulnerable users may request a battery backup unit free of charge.</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-6">{CONTRACT_SUMMARY_PROMISE_TEXT}</p>

      {declined ? (
        <div className="border-4 border-destructive bg-destructive/5 p-6 flex gap-3 items-start">
          <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-display uppercase mb-1">Quote declined</p>
            <p className="text-sm">We've recorded that you don't want to proceed. No charges have been taken. If you change your mind, contact <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a>.</p>
          </div>
        </div>
      ) : advanced ? (
        <div className="border-4 border-primary bg-primary/5 p-6 flex gap-3 items-start">
          <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-display uppercase mb-1">You're on the next step</p>
            <p className="text-sm">You've already continued past the quote. The journey will pick up where you left off as soon as the agreement step is enabled.</p>
          </div>
        </div>
      ) : eligible ? (
        <div className="border-4 border-foreground bg-background p-6 space-y-3">
          <p className="text-sm">Happy with this quote? Continue to your Contract Summary.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onContinue} disabled={continuing || declining} variant="hero" size="lg" className="font-display uppercase">
              {continuing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue with this quote
            </Button>
            <Button onClick={onDeclineClick} disabled={continuing || declining} variant="outline" size="lg" className="font-display uppercase">
              Decline quote
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {expired ? "This quote has expired. Please contact us for a refresh." : "OCCTA is finalising your quote. You'll receive a secure link by email when it's ready."}
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-8">
        {quote.expires_at ? <>Quote expires {new Date(quote.expires_at).toLocaleDateString("en-GB")}.</> : null}
        {" "}Need help? <Link to="/support" className="underline">Contact support</Link>.
      </p>
    </>
  );
}
