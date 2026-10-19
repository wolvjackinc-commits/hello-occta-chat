import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const gif=new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
const response=()=>new Response(gif,{headers:{"Content-Type":"image/gif","Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});
serve(async req=>{
 const id=new URL(req.url).searchParams.get("id")||"";
 if(!/^[a-f0-9-]{36}$/i.test(id))return response();
 try{
  const {data:r}=await db.from("campaign_recipients").select("id,campaign_id,status,opened_at,open_count").eq("id",id).maybeSingle();
  if(!r||!["sent","delivered","opened","clicked"].includes(r.status))return response();
  const now=new Date().toISOString();
  await db.from("campaign_recipients").update({opened_at:r.opened_at||now,open_count:(r.open_count||0)+1,status:r.status==="sent"||r.status==="delivered"?"opened":r.status}).eq("id",id);
  if(!r.opened_at){
   await db.from("campaign_events").insert({campaign_id:r.campaign_id,recipient_id:r.id,event_type:"opened"});
   const {data:c}=await db.from("campaigns").select("opened_count").eq("id",r.campaign_id).single();
   if(c)await db.from("campaigns").update({opened_count:(c.opened_count||0)+1}).eq("id",r.campaign_id);
  }
 }catch(e){console.error("campaign open tracking",e);}
 return response();
});
