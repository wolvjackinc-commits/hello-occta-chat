import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const html=(message:string,form:string,status=200)=>new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OCCTA email preferences</title></head><body style="background:#faf9f5;color:#151515;font:16px Arial,sans-serif;max-width:580px;margin:50px auto;padding:24px"><h1>OCCTA</h1><h2>Email preferences</h2><p>${message}</p>${form}<p style="font-size:12px">This setting applies only to marketing emails. Service, contract and billing messages are unaffected.</p></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
serve(async req=>{
 const q=new URL(req.url).searchParams;
 const token=q.get("token")||"";
 if(!/^[a-f0-9-]{36}$/i.test(token))return html("This link is invalid or expired.","",400);
 if(req.method==="GET"){
  // GET never unsubscribes: email security scanners frequently follow links.
  const action=new URL(req.url).pathname+"?token="+encodeURIComponent(token);
  return html("To stop OCCTA marketing emails, confirm below.",`<form method="POST" action="${action}"><button type="submit" style="background:#181818;color:white;padding:12px 20px;border:0;cursor:pointer">Unsubscribe from marketing</button></form>`);
 }
 if(req.method!=="POST")return html("Method not supported.","",405);
 try{
  const {data:r,error}=await db.from("campaign_recipients").select("id,campaign_id,user_id,email").eq("unsubscribe_token",token).maybeSingle();
  if(error||!r)return html("This link is invalid or expired.","",400);
  const email=String(r.email).trim().toLowerCase();
  const {error:err}=await db.from("marketing_suppressions").upsert({email,reason:"unsubscribe",source:"recipient_one_click"},{onConflict:"email"});
  if(err)throw err;
  await db.from("marketing_contacts").update({consent_status:"unsubscribed",updated_at:new Date().toISOString()}).eq("email",email);
  // Respect a customer's explicit unsubscribe in their marketing preference too.
  if(r.user_id)await db.from("profiles").update({marketing_email_consent:false,consent_updated_at:new Date().toISOString()}).eq("id",r.user_id);
  await db.from("campaign_events").insert({campaign_id:r.campaign_id,recipient_id:r.id,event_type:"unsubscribed"});
  return html("Your email address has been removed from OCCTA marketing campaigns.","");
 }catch(e){console.error("campaign unsubscribe",e);return html("We couldn't save your preference just now. Please contact support@occta.co.uk.","",500);}
});
