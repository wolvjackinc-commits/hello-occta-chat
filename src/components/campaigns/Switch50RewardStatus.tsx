export type CashRewardStatus = { status: string; eligibility_due_at?: string | null; issued_at?: string | null };
export function rewardPresentation(r?: CashRewardStatus | null) {
  switch(r?.status){
    case "issued": return {label:"Paid",body:"Your Switch Cash has been paid by OCCTA."};
    case "payout_queued": return {label:"Payment queued",body:"Your reward is queued for a bank transfer. We will confirm once payment is recorded."};
    case "eligible": return {label:"Ready for payment",body:"Your reward has passed the service and billing checks."};
    case "blocked": return {label:"Needs review",body:"Your reward is not currently payable. Contact OCCTA if you believe this is incorrect."};
    case "reversed": return {label:"Cash recovered",body:"OCCTA has recorded recovery of this reward. Contact us for details."};
    case "expired": return {label:"Expired",body:"This reward is no longer eligible for payment."};
    default: return {label:"Eligibility in progress",body:"We check that your service is live, your first broadband bill is paid and your account remains eligible at 30 days after activation."};
  }
}
export function Switch50RewardStatus({amount,reward}:{amount:number;reward?:CashRewardStatus|null}){
  const display=rewardPresentation(reward);
  return <section className="border-4 border-foreground bg-primary/10 p-5 space-y-2" aria-label="SWITCH50 reward">
    <h2 className="font-display text-xl uppercase">SWITCH50 · £{Number(amount).toFixed(2)} Switch Cash</h2>
    <p className="font-semibold">{display.label}</p><p className="text-sm">{display.body}</p>
    {reward?.eligibility_due_at && <p className="text-sm">Eligibility check from {new Date(reward.eligibility_due_at).toLocaleDateString("en-GB",{timeZone:"Europe/London"})}. This is not a guaranteed payment date.</p>}
    <p className="text-xs text-muted-foreground">No separate claim form. This cash reward does not reduce your broadband price or first bill. Track updates in My OCCTA → Rewards.</p>
  </section>;
}
