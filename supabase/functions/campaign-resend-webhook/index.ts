import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const secret=Deno.env.get("RESEND_WEBHOOK_SECRET")||"";
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
async function verify(req:Request,raw:string){
 const id=req.headers.get("svix-id")||"",stamp=req.headers.get("svix-timestamp")||"",sigs=req.headers.get("svix-signature")||"";
 if(!id||!stamp||!sigs||!secret.startsWith("whsec_")||Math.abs(Date.now()/1000-Number(stamp))>300)return false;
 try{
  const keyBytes=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("raw",keyBytes,{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  const body=new TextEncoder().encode(id+"."+stamp+"."+raw);
  for(const segment of sigs.split(" ")){
   if(!segment.startsWith("v1,"))continue;
   const bytes=Uint8Array.from(atob(segment.slice(3)),c=>c.charCodeAt(0));
   if(await crypto.subtle.verify("HMAC",key,bytes,body))return true;
  }
  return false;
 }catch{return false;}
}
serve(async req=>{
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 const raw=await req.text();
 if(!await verify(req,raw))return json({error:"INVALID_SIGNATURE"},401);
 try{
  const payload=JSON.parse(raw);
  const type=String(payload.type||"");
  const providerId=String(payload.data?.email_id||payload.data?.id||"");
  const eid=String(req.headers.get("svix-id")||"");
  if(!providerId||!["email.delivered","email.bounced","email.complained","email.sent","email.delivery_delayed"].includes(type))return json({ok:true,ignored:true});
  const {data:prior}=await db.from("campaign_events").select("id").eq("provider_event_id",eid).maybeSingle();
  if(prior)return json({ok:true,duplicate:true});
  const {data:r,error}=await db.from("campaign_recipients").select("id,campaign_id,email,status,opened_at").eq("provider_message_id",providerId).maybeSingle();
  if(error)throw error;
  if(!r)return json({ok:true,not_campaign_message:true});
  const now=new Date().toISOString();
  const update:Record<string,unknown>={};
  if(type==="email.delivered"){
   update.delivered_at=now;
   if(!["opened","clicked","bounced","complained"].includes(r.status))update.status="delivered";
  }else if(type==="email.bounced"){
   update.bounced_at=now;update.status="bounced";
  }else if(type==="email.complained"){
   update.complained_at=now;update.status="complained";
  }
  if(Object.keys(update).length){
   const {error:e}=await db.from("campaign_recipients").update(update).eq("id",r.id);
   if(e)throw e;
  }
  if(type==="email.bounced"||type==="email.complained"){
   const {error:e}=await db.from("marketing_suppressions").upsert({email:r.email.toLowerCase(),reason:type==="email.bounced"?"hard_bounce":"complaint",source:"resend_webhook"},{onConflict:"email"});
   if(e)throw e;
  }
  const {error:eventError}=await db.from("campaign_events").insert({campaign_id:r.campaign_id,recipient_id:r.id,provider_event_id:eid,event_type:type,metadata:{provider_message_id:providerId}});
  if(eventError?.code!=="23505"&&eventError)throw eventError;
  // Recompute all recipients atomically, including audiences beyond 1,000 rows.
  const {error:metricsError}=await db.rpc("refresh_campaign_metrics",{p_campaign_id:r.campaign_id});
  if(metricsError)throw metricsError;
  return json({ok:true});
 }catch(e){console.error("campaign webhook:",e);return json({error:"PROCESSING_FAILED"},500);}
});
