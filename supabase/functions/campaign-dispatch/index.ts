import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE=Deno.env.get("SUPABASE_URL")!;
const SRK=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND=Deno.env.get("RESEND_API_KEY")!;
const FROM=Deno.env.get("RESEND_FROM_EMAIL")||"OCCTA <hello@occta.co.uk>";
const WORKER_SECRET=Deno.env.get("CAMPAIGN_WORKER_SECRET")||"";
const TRACK_SECRET=Deno.env.get("CAMPAIGN_TRACK_SECRET")||"";
const db=createClient(BASE,SRK,{auth:{persistSession:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type,x-campaign-worker-secret","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(data:unknown,code=200)=>new Response(JSON.stringify(data),{status:code,headers:{...cors,"Content-Type":"application/json"}});
const enc=new TextEncoder();
const esc=(v:unknown)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function b64(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function signature(v:string){
 const key=await crypto.subtle.importKey("raw",enc.encode(TRACK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(v))));
}
async function signLinks(html:string,id:string){
 if(!TRACK_SECRET) return html;
 const pattern=/href=(["'])(https:\/\/[^"'<>\s]+)\1/gi;
 const found=[...html.matchAll(pattern)];
 const replacements=new Map<string,string>();
 for(const m of found){
  const raw=m[2].replace(/&amp;/g,"&");
  try {
   const u=new URL(raw);
   if(u.username||u.password || raw.length>1500)continue;
   const payload=id+"|"+raw;
   const sig=await signature(payload);
   const target=BASE+"/functions/v1/campaign-track?id="+encodeURIComponent(id)+"&target="+encodeURIComponent(raw)+"&sig="+encodeURIComponent(sig);
   replacements.set(m[0],"href="+m[1]+esc(target)+m[1]);
  }catch{continue;}
 }
 return html.replace(pattern,m=>replacements.get(m)||m);
}
const render=(str:string,vars:Record<string,string>,html=true)=>str.replace(/\{\{(\w+)\}\}/g,(full,key)=>vars[key]===undefined?full:html?esc(vars[key]):vars[key]);
async function auth(req:Request){
 const provided=req.headers.get("x-campaign-worker-secret")||"";
 if(WORKER_SECRET && provided.length>20 && provided===WORKER_SECRET) return true;
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return false;
 const {data:{user}}=await db.auth.getUser(jwt);
 if(!user)return false;
 const {data}=await db.from("user_roles").select("id").eq("user_id",user.id).eq("role","admin").maybeSingle();
 return !!data;
}
async function mark(id:string,status:string,fields:Record<string,unknown>={}){
 const {error}=await db.from("campaign_recipients").update({status,...fields}).eq("id",id).eq("status","processing");
 if(error)throw error;
}
async function processOne(r:any){
 const {data:c,error:cErr}=await db.from("campaigns").select("id,status,approved_at,subject_snapshot,html_snapshot,text_snapshot,track_opens,track_clicks").eq("id",r.campaign_id).single();
 if(cErr||!c||c.status!=="sending"||!c.approved_at){await mark(r.id,"queued");return "paused";}
 const email=String(r.email).trim().toLowerCase();
 const {data:blocked}=await db.from("marketing_suppressions").select("email").eq("email",email).maybeSingle();
 if(blocked){await mark(r.id,"suppressed",{error_message:"Address suppressed"});return "suppressed";}
 if(r.user_id){
  const {data:user}=await db.from("profiles").select("marketing_email_consent,archived_at").eq("id",r.user_id).maybeSingle();
  if(!user?.marketing_email_consent||user.archived_at){await mark(r.id,"suppressed",{error_message:"Customer consent withdrawn or archived"});return "suppressed";}
 }
 if(r.contact_id){
  const {data:contact}=await db.from("marketing_contacts").select("consent_status").eq("id",r.contact_id).maybeSingle();
  if(contact?.consent_status!=="subscribed"){await mark(r.id,"suppressed",{error_message:"Contact consent withdrawn"});return "suppressed";}
 }
 const unsubscribe=BASE+"/functions/v1/campaign-unsubscribe?token="+encodeURIComponent(r.unsubscribe_token);
 const fullName=String(r.full_name||"Customer");const parts=fullName.trim().split(/\s+/);
 const vars:Record<string,string>={first_name:parts[0]||"Customer",last_name:parts.slice(1).join(" "),full_name:fullName,email,account_number:String(r.account_number||""),company_name:"OCCTA Limited",support_email:"support@occta.co.uk",unsubscribe_url:unsubscribe};
 let html=render(String(c.html_snapshot||""),vars,true);
 if(c.track_clicks)html=await signLinks(html,r.id);
 html+=`<div style="border-top:1px solid #ddd;margin-top:32px;padding-top:16px;color:#555;font-size:12px">OCCTA Limited · <a href="https://www.occta.co.uk/privacy-policy">Privacy</a> · <a href="${esc(unsubscribe)}">Unsubscribe from marketing emails</a></div>`;
 if(c.track_opens)html+=`<img src="${BASE}/functions/v1/email-open-track?id=${encodeURIComponent(r.id)}" width="1" height="1" alt="" />`;
 const subject=render(String(c.subject_snapshot||""),vars,false).replace(/[\r\n]/g," ").slice(0,250);
 const text=render(String(c.text_snapshot||""),vars,false)+"\n\nOCCTA Limited | Unsubscribe: "+unsubscribe;
 try {
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{"Authorization":"Bearer "+RESEND,"Content-Type":"application/json","Idempotency-Key":"occta-campaign-"+r.id},
   body:JSON.stringify({from:FROM,to:[email],subject,html,text,headers:{"List-Unsubscribe":"<"+unsubscribe+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok || !data.id)throw new Error("Email provider rejected request: HTTP "+response.status+" "+JSON.stringify(data).slice(0,400));
  await mark(r.id,"sent",{provider_message_id:data.id,sent_at:new Date().toISOString()});
  await db.from("campaign_events").insert({campaign_id:r.campaign_id,recipient_id:r.id,event_type:"sent",metadata:{provider_message_id:data.id}});
  return "sent";
 }catch(e){
  await mark(r.id,"failed",{error_message:String(e).slice(0,450),failed_at:new Date().toISOString()});
  return "failed";
 }
}
async function refreshCounters(ids:string[]){
 for(const id of [...new Set(ids)]){
  const {data:rows,error}=await db.from("campaign_recipients").select("status,opened_at,delivered_at,bounced_at").eq("campaign_id",id);
  if(error||!rows)continue;
  const counts={sent_count:rows.filter(r=>["sent","delivered","opened","clicked"].includes(r.status)).length,
   delivered_count:rows.filter(r=>!!r.delivered_at).length,opened_count:rows.filter(r=>!!r.opened_at).length,
   bounced_count:rows.filter(r=>!!r.bounced_at).length,failed_count:rows.filter(r=>r.status==="failed").length};
  const pending=rows.some(r=>["queued","processing"].includes(r.status));
  const {data:c}=await db.from("campaigns").select("status").eq("id",id).single();
  await db.from("campaigns").update({...counts,...(!pending && c?.status==="sending"?{status:"completed",completed_at:new Date().toISOString()}:{}),updated_at:new Date().toISOString()}).eq("id",id);
 }
}
async function handler(req:Request){
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 if(!await auth(req))return json({error:"AUTH_REQUIRED"},403);
 if(!RESEND)return json({error:"MAIL_PROVIDER_NOT_CONFIGURED"},503);
 try {
  const {data:rows,error}=await db.rpc("claim_campaign_mail",{p_limit:30});
  if(error)throw error;
  const ids:string[]=[];const stats={sent:0,failed:0,suppressed:0,paused:0};
  for(const r of rows||[]){
   ids.push(r.campaign_id);
   const outcome=await processOne(r);
   stats[outcome as keyof typeof stats]++;
   await sleep(350);
  }
  if(ids.length)await refreshCounters(ids);
  return json({processed:(rows||[]).length,...stats,more_possible:(rows||[]).length===30});
 }catch(e){console.error("campaign-dispatch failure:",e);return json({error:String(e)},500);}
}
serve(handler);
