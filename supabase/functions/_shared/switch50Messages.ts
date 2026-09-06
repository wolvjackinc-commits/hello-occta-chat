import { renderBrandedEmail, escapeEmailHtml } from "./brandedEmailShell.ts";
type Payload = { amount: number; currency: string; order_id: string; due_at?: string | null; delay_days?: number; recipient_email?: string };
export function renderSwitch50Message(template: string, payload: Payload) {
  const amount = "£"+Number(payload.amount).toFixed(2);
  const messages: Record<string,{subject:string;body:string}> = {
    order_reward_recorded: {subject:"Your SWITCH50 reward is recorded",body:"Your "+amount+" Switch Cash offer is recorded against your order. No separate claim form is needed."},
    service_activated: {subject:"Your SWITCH50 eligibility period has started",body:"Your service activation is recorded. We will check your "+amount+" Switch Cash eligibility "+Number(payload.delay_days??30)+" days after activation once your first broadband invoice is paid and your account remains eligible."},
    reward_pending: {subject:"An update on your SWITCH50 reward",body:"Your "+amount+" Switch Cash is awaiting the service, first-bill payment or 30-day checks. You can see its current status in My OCCTA."},
    reward_eligible: {subject:"Your SWITCH50 reward is ready for payment",body:"Your "+amount+" Switch Cash has passed the service and billing checks. Our finance team will arrange the transfer, subject to the account remaining eligible."},
    reward_payout_queued: {subject:"Your SWITCH50 payment is queued",body:"Your "+amount+" Switch Cash is queued for a bank transfer. We will confirm once payment has been recorded."},
    reward_issued: {subject:"Your SWITCH50 cash payment is recorded",body:"OCCTA has recorded the bank transfer of your "+amount+" Switch Cash. Your bank may take time to display it. Contact us if you need help locating the payment."},
    reward_blocked: {subject:"Your SWITCH50 reward needs review",body:"Your "+amount+" Switch Cash is not currently payable. Check My OCCTA or contact us if you believe this is incorrect."},
    reward_reversed: {subject:"Your SWITCH50 cash recovery is recorded",body:"OCCTA has recorded recovery of your "+amount+" Switch Cash. Contact us if you need the details of this adjustment."},
    reward_expired: {subject:"Your SWITCH50 reward status has changed",body:"Your Switch Cash reward is marked as expired. Contact OCCTA if you believe this is incorrect."},
  };
  const copy=messages[template];
  if(!copy || !Number.isFinite(Number(payload.amount)) || Number(payload.amount)<=0 || payload.currency!=="GBP") throw new Error("invalid_message_payload");
  const footer="The reward is separate from your broadband bill and does not reduce your monthly price or first bill. No separate claim form is required. View your current reward status in My OCCTA → Rewards.";
  return {subject:copy.subject,text:copy.body+"\n\n"+footer+"\nhttps://www.occta.co.uk/dashboard\nHelp: hello@occta.co.uk",
    html:renderBrandedEmail({preheader:copy.subject,eyebrow:"SWITCH50",reference:payload.order_id,greeting:"Hello,",
      intro:"<p>"+escapeEmailHtml(copy.body)+"</p>",sections:[{heading:"Your reward",html:"<p>"+escapeEmailHtml(footer)+"</p>"}],
      cta:{label:"Open My OCCTA",url:"https://www.occta.co.uk/dashboard"}})};
}
export function messageStillRelevant(template:string,status:string){
  if(template==="order_reward_recorded") return true;
  if(template==="service_activated") return ["pending","eligible","payout_queued","issued"].includes(status);
  return template==="reward_"+status;
}
export function isSwitch50WorkerAuthorized(header: string | null, expected: string | undefined) {
  return !!expected && expected.length>=32 && header===expected;
}
