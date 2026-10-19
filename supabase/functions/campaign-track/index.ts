import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const secret=Deno.env.get("CAMPAIGN_TRACK_SECRET")||"";
const enc=new TextEncoder();
const toBase64Url=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");};
function fail(){return new Response("Invalid campaign link",{status:400,headers:{"Content-Type":"text/plain","Cache-Control":"no-store"}});}
serve(async req=>{
 if(req.method!=="GET" || !secret)return fail();
 try{
  const q=new URL(req.url).searchParams;
  const id=q.get("id")||"",target=q.get("target")||"",sig=q.get("sig")||"";
  if(!/^[a-f0-9-]{36}$/i.test(id)||!target.startsWith("https://")||target.length>1500)return fail();
  const url=new URL(target);
  if(url.username||url.password||url.protocol!=="https:")return fail();
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const expected=toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(id+"|"+target))));
  if(sig.length!==expected.length)return fail();
  let diff=0;for(let i=0;i<sig.length;i++)diff|=sig.charCodeAt(i)^expected.charCodeAt(i);
  if(diff!==0)return fail();
  const {data:r}=await db.from("campaign_recipients").select("id,campaign_id,clicked_at,click_count,status").eq("id",id).maybeSingle();
  if(!r)return fail();
  const now=new Date().toISOString();
  await db.from("campaign_recipients").update({clicked_at:r.clicked_at||now,click_count:(r.click_count||0)+1}).eq("id",id);
  await db.from("campaign_events").insert({campaign_id:r.campaign_id,recipient_id:r.id,event_type:"clicked",metadata:{host:url.hostname}});
  return new Response(null,{status:302,headers:{"Location":url.toString(),"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch{return fail();}
});
