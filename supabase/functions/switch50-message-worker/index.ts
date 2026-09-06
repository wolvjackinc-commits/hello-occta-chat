import { getServiceClient, jsonResponse } from "../_shared/quoteHelpers.ts";
import { renderSwitch50Message, messageStillRelevant, isSwitch50WorkerAuthorized } from "../_shared/switch50Messages.ts";

Deno.serve(async(req)=>{
  if(req.method!=="POST") return jsonResponse({error:"method_not_allowed"},405);
  if(!isSwitch50WorkerAuthorized(req.headers.get("x-cron-secret"),Deno.env.get("SWITCH50_WORKER_SECRET")))
    return jsonResponse({error:"unauthorized"},401);
  // Disabled until explicitly configured after staging verification.
  if(Deno.env.get("SWITCH50_EMAILS_ENABLED")!=="true") return jsonResponse({ok:true,disabled:true});
  const apiKey=Deno.env.get("RESEND_API_KEY");
  if(!apiKey) return jsonResponse({error:"email_provider_not_configured"},503);
  const svc=getServiceClient();
  // Five bounded provider calls fit comfortably inside the worker runtime and lease.
  const {data:messages,error}=await svc.rpc("switch50_claim_messages",{p_limit:5});
  if(error) return jsonResponse({error:"claim_failed"},503);
  let sent=0,failed=0,suppressed=0;
  for(const m of messages??[]){
    let providerId:string|null=null,errorCode:string|null=null;
    try{
      const {data:reward,error:readError}=await svc.from("promotion_rewards").select("status").eq("id",m.reward_id).single();
      if(readError) throw new Error("reward_read_failed");
      if(!messageStillRelevant(m.template,reward.status)){errorCode="superseded";suppressed++;}
      else {
        const email=String(m.payload.recipient_email??"");
        if(!email.includes("@")) throw new Error("recipient_unavailable");
        const content=renderSwitch50Message(m.template,m.payload);
        const response=await fetch("https://api.resend.com/emails",{
          method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json","Idempotency-Key":"switch50/"+m.id},
          body:JSON.stringify({from:"OCCTA <hello@occta.co.uk>",to:[email],reply_to:"hello@occta.co.uk",...content}),
          signal:AbortSignal.timeout(15000)
        });
        const payload=await response.json().catch(()=>null);
        if(!response.ok||!payload?.id) throw new Error("provider_http_"+response.status);
        providerId=String(payload.id);sent++;
      }
    }catch(e){errorCode=e instanceof Error?e.message:"delivery_failed";failed++;}
    const finish=await svc.rpc("switch50_finish_message",{p_id:m.id,p_lease:m.lease_token,p_provider_id:providerId,p_error:errorCode});
    if(finish.error||!finish.data) return jsonResponse({error:"delivery_record_unconfirmed",sent,failed,suppressed},503);
  }
  return jsonResponse({ok:true,sent,failed,suppressed});
});
