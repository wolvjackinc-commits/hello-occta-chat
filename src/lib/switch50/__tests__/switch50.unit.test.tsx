import { describe,it,expect,vi,beforeEach } from "vitest";
import { render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderSwitch50Message,messageStillRelevant,isSwitch50WorkerAuthorized } from "../../../../supabase/functions/_shared/switch50Messages";
import { resolveOfferPromotion } from "../../../../supabase/functions/_shared/offerCampaign";
import { rewardPresentation,Switch50RewardStatus } from "@/components/campaigns/Switch50RewardStatus";
import { Switch50PayoutPanel } from "@/components/campaigns/Switch50PayoutPanel";
import { trackSwitch50Purchase } from "@/lib/switch50Analytics";

const { invoke }=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke}}}));
const reward={id:"11111111-1111-4111-8111-111111111111",order_id:"22222222-2222-4222-8222-222222222222",customer_id:"test",status:"eligible",version:2,reward_amount:50,eligibility_due_at:null,payout_reference:null,manual_hold:false};
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();sessionStorage.clear();window.gtag=vi.fn();});

describe("SWITCH50 communications",()=>{
  it.each(["order_reward_recorded","service_activated","reward_pending","reward_eligible","reward_payout_queued","reward_issued","reward_blocked","reward_reversed","reward_expired"])("renders %s without changing the broadband price",template=>{
    const result=renderSwitch50Message(template,{amount:50,currency:"GBP",order_id:"<script>bad</script>",delay_days:30});
    expect(result.text).toContain("does not reduce your monthly price or first bill");
    expect(result.html).not.toContain("<script>bad</script>");expect(result.subject).toContain("SWITCH50");
  });
  it("never sends outdated eligibility/paid messages",()=>{
    expect(messageStillRelevant("reward_eligible","blocked")).toBe(false);
    expect(messageStillRelevant("reward_issued","reversed")).toBe(false);
    expect(messageStillRelevant("reward_payout_queued","payout_queued")).toBe(true);
  });
  it("rejects blank/unconfigured worker secrets and forged ordinary bearer headers",()=>{
    expect(isSwitch50WorkerAuthorized(null,undefined)).toBe(false);
    expect(isSwitch50WorkerAuthorized("Bearer anything","a".repeat(32))).toBe(false);
    expect(isSwitch50WorkerAuthorized("a".repeat(32),"a".repeat(32))).toBe(true);
  });
});
describe("offer expiry and product eligibility",()=>{
  const campaign={code:"SWITCH50",active:true,starts_at:"2026-09-06T00:00:00+01:00",ends_at:"2026-10-31T23:59:59Z",
    customer_type:"residential",speed_bucket:"essential",plan_term:"price_lock_24",reward_amount:50};
  const service=(value:unknown,error:unknown=null)=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:value,error})})})})});
  it.each(["flex_30","other"])("rejects term %s",async term=>{
    vi.spyOn(Date,"now").mockReturnValue(Date.parse("2026-09-10T00:00:00Z"));
    expect((await resolveOfferPromotion(service(campaign),"SWITCH50",{plan_term:term}))?.eligible).toBe(false);
    vi.restoreAllMocks();
  });
  it("rejects a paused campaign and the instant after expiry",async()=>{
    vi.spyOn(Date,"now").mockReturnValue(Date.parse("2026-09-10T00:00:00Z"));
    expect((await resolveOfferPromotion(service({...campaign,active:false}),"SWITCH50"))?.eligible).toBe(false);
    vi.spyOn(Date,"now").mockReturnValue(Date.parse("2026-11-01T00:00:00Z"));
    expect((await resolveOfferPromotion(service(campaign),"SWITCH50"))?.eligible).toBe(false);vi.restoreAllMocks();
  });
  it("does not silently drop an offer on a database outage",async()=>{
    await expect(resolveOfferPromotion(service(null,{message:"offline"}),"SWITCH50")).rejects.toThrow("campaign_unavailable");
  });
});
describe("customer status and consent",()=>{
  it("shows eligibility date without promising a payment date",()=>{
    render(<Switch50RewardStatus amount={50} reward={{status:"pending",eligibility_due_at:"2026-10-10T00:00:00Z"}}/>);
    expect(screen.getByText(/not a guaranteed payment date/)).toBeInTheDocument();
    expect(rewardPresentation({status:"blocked"}).label).toBe("Needs review");
  });
  it("suppresses test/denied conversions and deduplicates completed orders",()=>{
    const order={test_session:false,order_number:"OC-TEST-123",monthly_incl_vat:34.99,promotion:{code:"SWITCH50",eligible:true}};
    trackSwitch50Purchase(order);expect(window.gtag).not.toHaveBeenCalled();
    localStorage.setItem("occta.cookie-consent.v1","granted");
    trackSwitch50Purchase({...order,test_session:true});expect(window.gtag).not.toHaveBeenCalled();
    trackSwitch50Purchase(order);trackSwitch50Purchase(order);expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith("event","purchase",expect.objectContaining({transaction_id:"OC-TEST-123",value:34.99}));
  });
});
describe("finance screen",()=>{
  it("requires a real reference and submits the displayed version with an idempotency key",async()=>{
    invoke.mockResolvedValue({data:{ok:true,rewards:[{...reward,status:"payout_queued"}],total:1,can_admin:true},error:null});
    render(<Switch50PayoutPanel/>);
    const user=userEvent.setup();await user.click(await screen.findByRole("button",{name:"Record transfer"}));
    expect(screen.getByRole("button",{name:"Confirm"})).toBeDisabled();
    await user.type(screen.getByLabelText("Bank reference"),"BANK-123");
    await user.click(screen.getByRole("button",{name:"Confirm"}));
    await waitFor(()=>expect(invoke).toHaveBeenCalledWith("switch50-admin",expect.objectContaining({body:expect.objectContaining({action:"mark_issued",expected_version:2,payout_reference:"BANK-123",request_id:expect.any(String)})})));
  });
  it("shows errors instead of pretending the ledger is empty",async()=>{
    invoke.mockResolvedValue({data:{ok:false,error:"status_unavailable"},error:null});render(<Switch50PayoutPanel/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("status_unavailable");
  });
});
