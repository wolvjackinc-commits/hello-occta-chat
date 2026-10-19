import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type", "Access-Control-Allow-Methods":"POST,OPTIONS" };
const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), { status, headers:{...cors,"Content-Type":"application/json"} });
const normal = (v: unknown) => String(v ?? "").trim().toLowerCase();
const validEmail = (v: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) && v.length<=320;
const safe = (v: unknown, max=400) => String(v ?? "").trim().slice(0,max);
const db = createClient(URL,KEY,{auth:{persistSession:false}});
async function admin(req: Request) {
 const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"");
 if(!jwt) throw new Error("AUTH_REQUIRED");
 const {data:{user},error}=await db.auth.getUser(jwt);
 if(error || !user) throw new Error("AUTH_REQUIRED");
 const {data:role,error:roleError}=await db.from("user_roles").select("id").eq("user_id",user.id).eq("role","admin").maybeSingle();
 if(roleError || !role) throw new Error("ADMIN_REQUIRED");
 return user.id;
}
async function audit(id:string,type:string,metadata:Record<string,unknown>={}) {
 const {error}=await db.from("campaign_events").insert({campaign_id:id,event_type:type,metadata});
 if(error) throw error;
}
async function paged(table:string,select:string,configure:(q:any)=>any) {
 const rows:any[]=[];
 for(let offset=0;offset<50000;offset+=500) {
  const {data,error}=await configure(db.from(table).select(select)).range(offset,offset+499);
  if(error) throw error;
  rows.push(...(data||[]));
  if(!data || data.length<500) break;
 }
 if(rows.length>=50000) throw new Error("AUDIENCE_TOO_LARGE");
 return rows;
}
async function run(req:Request) {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"METHOD_NOT_ALLOWED"},405);
 try {
  const actor=await admin(req);
  const input=await req.json();
  const action=safe(input.action,40);
  if(action==="import_contacts") {
   if(input.confirm!=="CONSENT VERIFIED") throw new Error("CONSENT_ATTESTATION_REQUIRED");
   const evidence=safe(input.consent_evidence,1000),source=safe(input.consent_source,200);
   if(evidence.length<10 || source.length<3) throw new Error("EVIDENCE_AND_SOURCE_REQUIRED");
   if(!Array.isArray(input.contacts)||input.contacts.length<1||input.contacts.length>200) throw new Error("IMPORT_BATCH_LIMIT_200");
   const contacts:any[]=[];const seen=new Set<string>();
   for(const row of input.contacts) {
    const email=normal(row.email);
    if(!validEmail(email)) throw new Error("INVALID_EMAIL_IN_BATCH");
    if(seen.has(email)) continue;
    seen.add(email);
    const at=new Date(row.consent_at || input.consent_at || "").toISOString();
    if(Date.parse(at)>Date.now()+60000) throw new Error("FUTURE_CONSENT_DATE");
    const tags=Array.isArray(row.tags)?row.tags.map((t:unknown)=>safe(t,40)).filter(Boolean).slice(0,15):[];
    contacts.push({email,full_name:safe(row.full_name,200)||null,company:safe(row.company,200)||null,tags,
      consent_basis:"explicit_opt_in",consent_evidence:evidence,consent_source:source,consent_at:at,created_by:actor});
   }
   // Never restore an unsubscribed/previously imported address to subscribed on import.
   const {data,error}=await db.from("marketing_contacts").upsert(contacts,{onConflict:"email",ignoreDuplicates:true}).select("id");
   if(error) throw error;
   return reply({imported:data?.length||0,duplicates_or_existing:contacts.length-(data?.length||0)});
  }
  if(action==="create") {
   const name=safe(input.name,160),templateId=safe(input.template_id,80);
   if(name.length<3 || !/^[0-9a-f-]{36}$/i.test(templateId)) throw new Error("INVALID_CAMPAIGN");
   const audience=safe(input.audience,30);
   if(!["customers","contacts","combined","selected"].includes(audience)) throw new Error("INVALID_AUDIENCE");
   const {data:tpl,error:tplErr}=await db.from("email_templates").select("id,subject,html_body,text_body,is_active").eq("id",templateId).single();
   if(tplErr || !tpl?.is_active || !tpl.subject?.trim() || !tpl.html_body?.trim()) throw new Error("ACTIVE_TEMPLATE_REQUIRED");
   const contacts = audience==="contacts"||audience==="combined"
     ? await paged("marketing_contacts","id,email,full_name,tags",q=>q.eq("consent_status","subscribed")) : [];
   const ids=Array.isArray(input.user_ids)?[...new Set(input.user_ids.map((i:unknown)=>safe(i,80)))].slice(0,500):[];
   if(audience==="selected" && ids.length===0) throw new Error("SELECT_RECIPIENTS");
   const profiles = audience==="customers"||audience==="combined"||audience==="selected"
     ? await paged("profiles","id,email,full_name,account_number",q=> {
         let x=q.eq("marketing_email_consent",true).is("archived_at",null).not("email","is",null);
         return audience==="selected"?x.in("id",ids):x;
       }) : [];
   const tag=safe(input.tag,40).toLowerCase();
   const suppressionRows=await paged("marketing_suppressions","email",q=>q.order("email"));
   const blocked=new Set(suppressionRows.map((r:any)=>normal(r.email)));
   const unique=new Map<string,any>();
   for(const c of contacts) {
    const email=normal(c.email);
    if(tag && !((c.tags||[]) as string[]).some(t=>normal(t)===tag)) continue;
    if(validEmail(email)&&!blocked.has(email)) unique.set(email,{email,full_name:c.full_name,contact_id:c.id,status:"queued"});
   }
   for(const p of profiles) {
    const email=normal(p.email);
    if(validEmail(email)&&!blocked.has(email)) unique.set(email,{email,full_name:p.full_name,account_number:p.account_number,user_id:p.id,status:"queued"});
   }
   const recipients=[...unique.values()];
   if(!recipients.length) throw new Error("NO_ELIGIBLE_CONSENTED_RECIPIENTS");
   if(recipients.length>20000) throw new Error("AUDIENCE_LIMIT_20000");
   const {data:c,error:cErr}=await db.from("campaigns").insert({
    campaign_name:name,template_id:templateId,status:"draft",created_by:actor,
    audience_type:audience,subject_snapshot:tpl.subject,html_snapshot:tpl.html_body,
    text_snapshot:tpl.text_body,track_opens:input.track_opens===true,
    total_recipients:recipients.length,recipient_filter:{audience,tag,selected_count:ids.length}
   }).select("id").single();
   if(cErr || !c) throw cErr||new Error("CAMPAIGN_CREATE_FAILED");
   try{
    for(let i=0;i<recipients.length;i+=200){
     const {error}=await db.from("campaign_recipients").insert(recipients.slice(i,i+200).map(r=>({...r,campaign_id:c.id})));
     if(error) throw error;
    }
    await audit(c.id,"draft_created",{actor,audience,recipients:recipients.length});
   }catch(e){
    await db.from("campaigns").delete().eq("id",c.id);throw e;
   }
   return reply({id:c.id,total_recipients:recipients.length,status:"draft"});
  }
  if(["approve","start","pause","resume"].includes(action)){
   const id=safe(input.campaign_id,80);
   if(!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_CAMPAIGN_ID");
   const {data:c,error}=await db.from("campaigns").select("id,status,approved_at,total_recipients,html_snapshot,subject_snapshot").eq("id",id).single();
   if(error||!c) throw new Error("CAMPAIGN_NOT_FOUND");
   if(action==="approve") {
    if(input.confirm!=="APPROVE"||c.status!=="draft"||c.approved_at||!c.total_recipients||!c.subject_snapshot||!c.html_snapshot)throw new Error("DRAFT_REVIEW_AND_CONFIRMATION_REQUIRED");
    const {data:updated,error:e}=await db.from("campaigns").update({status:"approved",approved_by:actor,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("status","draft").is("approved_at",null).select("id").maybeSingle();
    if(e||!updated) throw e||new Error("CAMPAIGN_STATUS_CHANGED");
    await audit(id,"approved",{actor});return reply({status:"approved"});
   }
   if(action==="start") {
    if(input.confirm!=="START"||c.status!=="approved"||!c.approved_at)throw new Error("APPROVAL_REQUIRED");
    const scheduled=input.scheduled_at?new Date(input.scheduled_at):null;
    if(scheduled && !Number.isFinite(scheduled.getTime())) throw new Error("INVALID_SCHEDULE");
    const future=scheduled && scheduled.getTime()>Date.now()+60000;
    const status=future?"scheduled":"ready";
    const {error:e}=await db.from("campaigns").update({status,scheduled_at:future?scheduled!.toISOString():null,updated_at:new Date().toISOString()}).eq("id",id).eq("status","approved");
    if(e) throw e;
    await audit(id,status==="scheduled"?"scheduled":"started",{actor,at:future?scheduled!.toISOString():null});
    return reply({status});
   }
   if(action==="pause"){
    if(!["ready","scheduled","sending"].includes(c.status))throw new Error("CANNOT_PAUSE_CAMPAIGN");
    const {error:e}=await db.from("campaigns").update({status:"paused",paused_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).in("status",["ready","scheduled","sending"]);
    if(e)throw e;await audit(id,"paused",{actor});return reply({status:"paused"});
   }
   if(!c.approved_at||c.status!=="paused")throw new Error("CANNOT_RESUME");
   const {error:e}=await db.from("campaigns").update({status:"ready",paused_at:null,scheduled_at:null,updated_at:new Date().toISOString()}).eq("id",id).eq("status","paused");
   if(e)throw e;await audit(id,"resumed",{actor});return reply({status:"ready"});
  }
  if(action==="suppress"){
   const email=normal(input.email);
   if(!validEmail(email))throw new Error("INVALID_EMAIL");
   const {error:e}=await db.from("marketing_suppressions").upsert({email,reason:"manual",source:"admin_campaign_manager"},{onConflict:"email"});
   if(e)throw e;
   await db.from("marketing_contacts").update({consent_status:"unsubscribed",updated_at:new Date().toISOString()}).eq("email",email);
   return reply({suppressed:true});
  }
  return reply({error:"UNKNOWN_ACTION"},400);
 } catch(e){
  const message=e instanceof Error?e.message:String(e);
  const status=message==="AUTH_REQUIRED"?401:message==="ADMIN_REQUIRED"?403:400;
  console.error("campaign-manager:",message);
  return reply({error:message},status);
 }
}
serve(run);
