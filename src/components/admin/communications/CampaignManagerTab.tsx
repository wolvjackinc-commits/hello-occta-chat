import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpRight, BarChart3, CheckCircle, Download, History, Mail, Play, Plus, ShieldCheck, Upload } from "lucide-react";
import { CampaignDetailDialog } from "./CampaignDetailDialog";
import { RecipientPicker } from "./RecipientPicker";\nimport { parseCampaignCsv, toCampaignCsv, CAMPAIGN_CSV_HEADERS, type CampaignImportRow } from "@/lib/campaigns/csv";

type Campaign = {
 id:string;campaign_name:string;template_id:string;status:string;created_at:string;created_by:string|null;
 total_recipients:number|null;sent_count:number|null;delivered_count:number|null;
 opened_count:number|null;bounced_count:number|null;failed_count:number|null;
 started_at:string|null;completed_at:string|null;scheduled_at:string|null;approved_at:string|null;
 email_templates?:{template_name:string}|null;
};
type Template={id:string;template_name:string;subject:string;html_body:string;category:string;is_active:boolean};
import { parseCampaignCsv, toCampaignCsv, CAMPAIGN_CSV_HEADERS, type CampaignImportRow } from "@/lib/campaigns/csv";
const columns=CAMPAIGN_CSV_HEADERS;
function downloadCsv(filename:string,headers:string[],rows:unknown[][]){
 const csv=toCampaignCsv(headers,rows);
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download=filename;link.click();
 URL.revokeObjectURL(url);
}
const label=(s:string)=>s.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const date=(s:string|null)=>s?new Date(s).toLocaleString("en-GB"):"—";

export function CampaignManagerTab(){
 const {toast}=useToast();
 const [tab,setTab]=useState("overview");
 const [selected,setSelected]=useState<Campaign|null>(null);
 const [selectedEvents,setSelectedEvents]=useState<Campaign|null>(null);
 const [search,setSearch]=useState("");
 const [confirm,setConfirm]=useState<{campaign:Campaign;action:"approve"|"start"|"pause"|"resume"}|null>(null);
 const [typed,setTyped]=useState("");
 const [schedule,setSchedule]=useState("");
 const [busy,setBusy]=useState(false);
 const [name,setName]=useState("");
 const [audience,setAudience]=useState("customers");
 const [tag,setTag]=useState("");
 const [templateId,setTemplateId]=useState("");
 const [userIds,setUserIds]=useState<string[]>([]);
 const [openTracking,setOpenTracking]=useState(false);
 const [clickTracking,setClickTracking]=useState(false);
 const [csv,setCsv]=useState<CampaignImportRow[]>([]);
 const [source,setSource]=useState("");
 const [evidence,setEvidence]=useState("");
 const [consentDate,setConsentDate]=useState("");
 const [attest,setAttest]=useState(false);
 const [manualSuppression,setManualSuppression]=useState("");
 const [assetsBusy,setAssetsBusy]=useState(false);
 const [lastArtworkUrl,setLastArtworkUrl]=useState("");

 const {data:campaigns=[],isLoading:loading,refetch}=useQuery({
  queryKey:["email-campaigns"],queryFn:async()=>{
   const {data,error}=await supabase.from("campaigns").select("*, email_templates(template_name)").order("created_at",{ascending:false}).limit(200);
   if(error)throw error;return data as Campaign[];
  }
 });
 const {data:templates=[]}=useQuery({queryKey:["email-templates-campaign"],queryFn:async()=>{
  const {data,error}=await supabase.from("email_templates").select("id,template_name,subject,html_body,category,is_active").eq("is_active",true).order("template_name");
  if(error)throw error;return data as Template[];
 }});
 const {data:contacts=[],refetch:reloadContacts}=useQuery({queryKey:["marketing-contacts"],queryFn:async()=>{
  const {data,error}=await (supabase as any).from("marketing_contacts").select("email,full_name,company,tags,consent_status,consent_at,consent_source").order("created_at",{ascending:false}).limit(100);
  if(error)throw error;return data as any[];
 }});
 const {data:suppressions=[],refetch:reloadSuppressions}=useQuery({queryKey:["marketing-suppressions"],queryFn:async()=>{
  const {data,error}=await (supabase as any).from("marketing_suppressions").select("email,reason,created_at").order("created_at",{ascending:false}).limit(100);
  if(error)throw error;return data as any[];
 }});
 const {data:artworks=[],refetch:reloadArtworks}=useQuery({queryKey:["marketing-artwork"],queryFn:async()=>{
  const {data,error}=await supabase.storage.from("campaign-artwork").list("assets",{limit:100,sortBy:{column:"created_at",order:"desc"}});
  if(error)throw error;return data||[];
 }});
 const {data:events=[]}=useQuery({queryKey:["campaign-events",selectedEvents?.id],enabled:!!selectedEvents,queryFn:async()=>{
  const {data,error}=await (supabase as any).from("campaign_events").select("event_type,event_at,metadata").eq("campaign_id",selectedEvents!.id).order("event_at",{ascending:false}).limit(200);
  if(error)throw error;return data as any[];
 }});
 const filtered=useMemo(()=>campaigns.filter(c=>c.campaign_name.toLowerCase().includes(search.toLowerCase())),[campaigns,search]);
 const summary=useMemo(()=>({
  campaigns:campaigns.length,
  queued:campaigns.filter(c=>["draft","approved","scheduled","ready","sending"].includes(c.status)).length,
  sent:campaigns.reduce((v,c)=>v+(c.sent_count||0),0),
  delivered:campaigns.reduce((v,c)=>v+(c.delivered_count||0),0)
 }),[campaigns]);
 const template=templates.find(t=>t.id===templateId);
 const invoke=async(action:string,body:Record<string,unknown>={})=>{
  const {data,error}=await supabase.functions.invoke("campaign-manager",{body:{action,...body}});
  if(error||data?.error)throw new Error(data?.error||error?.message||"Action failed");
  return data;
 };
 async function operation(task:()=>Promise<unknown>,success:string){
  setBusy(true);
  try{await task();toast({title:success});await Promise.all([refetch(),reloadContacts(),reloadSuppressions()]);return true;}
  catch(e:any){toast({title:"Campaign action failed",description:e?.message||String(e),variant:"destructive"});return false;}
  finally{setBusy(false);}
 }
 async function createCampaign(){
  const ok=await operation(async()=>{
   const r=await invoke("create",{name,template_id:templateId,audience,tag,user_ids:userIds,track_opens:openTracking,track_clicks:clickTracking});
   setSelected(campaigns.find(c=>c.id===r.id)||null);
   setName("");setUserIds([]);setTag("");setTemplateId("");
   setTab("history");
  },"Campaign draft created. Review and approve before sending.");
  return ok;
 }
 async function confirmAction(){
  if(!confirm)return;
  const {campaign,action}=confirm;
  const token=action==="approve"?"APPROVE":action==="start"?"START":null;
  if(token && typed!==token)return;
  const body:Record<string,unknown>={campaign_id:campaign.id};
  if(token)body.confirm=token;
  if(action==="start"&&schedule)body.scheduled_at=new Date(schedule).toISOString();
  const ok=await operation(()=>invoke(action,body),label(action)+" completed");
  if(ok){setConfirm(null);setTyped("");setSchedule("");}
 }
 async function runBatch(){
  await operation(async()=>{
   const {data,error}=await supabase.functions.invoke("campaign-dispatch",{body:{}});
   if(error||data?.error)throw new Error(data?.error||error?.message||"Dispatch failed");
   toast({title:"Dispatch batch",description:`${data.sent||0} sent, ${data.failed||0} failed, ${data.suppressed||0} suppressed`});
  },"Batch processed");
 }
 async function importContacts(){
  if(!attest||source.trim().length<3||evidence.trim().length<10||!csv.length||(!consentDate&&!csv.every(r=>r.consent_at)))return;
  const ok=await operation(async()=>{
   let added=0;
   for(let i=0;i<csv.length;i+=200){
    const rows=csv.slice(i,i+200).map(r=>({...r,consent_at:r.consent_at||consentDate}));
    const res=await invoke("import_contacts",{contacts:rows,consent_source:source,consent_evidence:evidence,confirm:"CONSENT VERIFIED"});
    added+=res.imported||0;
   }
   toast({title:"Import finished",description:`${added} new contacts. Previously imported and unsubscribed addresses were not reactivated.`});
   setCsv([]);setSource("");setEvidence("");setAttest(false);
  },"Contacts imported");
  return ok;
 }
 async function uploadArtwork(files:FileList|null){
  if(!files?.length)return;
  setAssetsBusy(true);
  try{
   for(const file of Array.from(files)){
    if(!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)||file.size>5*1024*1024)throw new Error(file.name+": PNG, JPG, WebP or GIF up to 5 MB only");
    const ext=file.type==="image/jpeg"?"jpg":file.type.split("/")[1];
    const path="assets/"+crypto.randomUUID()+"."+ext;
    const {error}=await supabase.storage.from("campaign-artwork").upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    setLastArtworkUrl(supabase.storage.from("campaign-artwork").getPublicUrl(path).data.publicUrl);
   }
   await reloadArtworks();
   toast({title:"Artwork uploaded",description:"Public marketing artwork URLs are ready to use in templates."});
  }catch(e:any){toast({title:"Upload failed",description:e?.message||String(e),variant:"destructive"});}
  finally{setAssetsBusy(false);}
 }
 async function exportRecipients(c:Campaign){
  setBusy(true);
  try{
   const rows:any[]=[];
   for(let n=0;n<20000;n+=500){
    const {data,error}=await supabase.from("campaign_recipients").select("email,full_name,account_number,status,sent_at,delivered_at,opened_at,bounced_at,clicked_at,error_message").eq("campaign_id",c.id).order("created_at").range(n,n+499);
    if(error)throw error;
    rows.push(...(data||[]));if(!data||data.length<500)break;
   }
   const headers=["email","full_name","account_number","status","sent_at","delivered_at","opened_at","bounced_at","clicked_at","error_message"];
   downloadCsv("occta-campaign-"+c.id+".csv",headers,rows.map(r=>headers.map(h=>r[h])));
   toast({title:"Recipient report exported"});
  }catch(e:any){toast({title:"Export failed",description:e?.message,variant:"destructive"});}
  finally{setBusy(false);}
 }
 const actionButtons=(c:Campaign)=>(
  <div className="flex flex-wrap gap-1">
   <Button size="sm" variant="outline" onClick={()=>setSelected(c)}>Report</Button>
   <Button size="sm" variant="outline" onClick={()=>setSelectedEvents(c)}>Events</Button>
   <Button size="sm" variant="outline" disabled={busy} onClick={()=>exportRecipients(c)}><Download className="h-4 w-4"/></Button>
   {c.status==="draft"&&<Button size="sm" onClick={()=>{setConfirm({campaign:c,action:"approve"});setTyped("");}}>Approve</Button>}
   {c.status==="approved"&&<Button size="sm" onClick={()=>{setConfirm({campaign:c,action:"start"});setTyped("");}}>Start / schedule</Button>}
   {["ready","scheduled","sending"].includes(c.status)&&<Button size="sm" variant="destructive" onClick={()=>setConfirm({campaign:c,action:"pause"})}>Pause</Button>}
   {c.status==="paused"&&<Button size="sm" variant="outline" onClick={()=>setConfirm({campaign:c,action:"resume"})}>Resume</Button>}
  </div>
 );
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="font-display text-2xl">Campaign Manager</h2><p className="text-sm text-muted-foreground">Consented email campaigns, artwork, approvals and delivery evidence. Billing emails are separate.</p></div>
   <Button onClick={()=>setTab("create")}><Plus className="mr-2 h-4 w-4"/>New campaign</Button>
  </div>
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
   {[["Campaigns",summary.campaigns,BarChart3],["In progress",summary.queued,History],["Accepted for sending",summary.sent,Mail],["Confirmed delivered",summary.delivered,CheckCircle]].map(([label,value,Icon]:any)=>(
    <Card key={label}><CardContent className="p-4"><Icon className="h-4 w-4 text-muted-foreground"/><div className="mt-2 text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>
   ))}
  </div>
  <Tabs value={tab} onValueChange={setTab}>
   <TabsList className="h-auto flex-wrap justify-start">
    <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="create">Create</TabsTrigger><TabsTrigger value="contacts">Bulk contacts</TabsTrigger><TabsTrigger value="artwork">Artwork</TabsTrigger><TabsTrigger value="history">History & reports</TabsTrigger><TabsTrigger value="suppression">Suppression</TabsTrigger>
   </TabsList>
   <TabsContent value="overview" className="space-y-3">
    <div className="rounded border p-4 text-sm"><ShieldCheck className="mb-2 h-5 w-5"/>Only addresses with recorded marketing opt-in are eligible. Unsubscribed, bounced and complained addresses are excluded at audience creation and rechecked before sending. Open rates are estimates; delivery requires a provider event.</div>
    <div className="flex flex-wrap gap-2">
     <Button variant="outline" onClick={()=>setTab("create")}>Create draft <ArrowUpRight className="ml-2 h-4 w-4"/></Button>
     <Button variant="outline" onClick={()=>setTab("contacts")}>Import email list</Button>
     <Button variant="outline" onClick={()=>setTab("artwork")}>Artwork library</Button>
     <Button variant="outline" onClick={()=>setTab("history")}>Campaign history</Button>
    </div>
    <p className="text-sm text-muted-foreground">Sending is never triggered by draft creation or approval. Starting a campaign authorises dispatch; the worker must be configured and running for scheduled or continued delivery.</p>
   </TabsContent>
   <TabsContent value="create" className="space-y-4 rounded border p-5">
    <h3 className="font-semibold">Create campaign draft</h3>
    <div className="grid gap-4 md:grid-cols-2">
     <div className="space-y-2"><label className="text-sm font-medium">Campaign name</label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="October broadband newsletter"/></div>
     <div className="space-y-2"><label className="text-sm font-medium">Approved reusable email template</label>
      <Select value={templateId} onValueChange={setTemplateId}><SelectTrigger><SelectValue placeholder="Choose a template"/></SelectTrigger><SelectContent>{templates.map(t=><SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}</SelectContent></Select>
      <p className="text-xs text-muted-foreground">Create or edit templates in the Communications → Templates tab.</p>
     </div>
     <div className="space-y-2"><label className="text-sm font-medium">Recipient audience</label><Select value={audience} onValueChange={setAudience}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
      <SelectItem value="customers">Customers with email marketing consent</SelectItem><SelectItem value="contacts">Imported opted-in contacts</SelectItem><SelectItem value="combined">Customers + imported contacts</SelectItem><SelectItem value="selected">Select consenting customers</SelectItem>
     </SelectContent></Select></div>
     {(audience==="contacts"||audience==="combined")&&<div className="space-y-2"><label className="text-sm font-medium">Contact tag (optional)</label><Input placeholder="e.g. business-broadband" value={tag} onChange={e=>setTag(e.target.value)}/></div>}
    </div>
    {audience==="selected"&&<RecipientPicker selectedIds={userIds} onChange={setUserIds}/>}
    <div className="flex flex-wrap gap-6 text-sm">
     <label className="flex items-center gap-2"><Checkbox checked={openTracking} onCheckedChange={v=>setOpenTracking(v===true)}/>Enable open pixels (privacy review required)</label>
     <label className="flex items-center gap-2"><Checkbox checked={clickTracking} onCheckedChange={v=>setClickTracking(v===true)}/>Enable tracked links (privacy review required)</label>
    </div>
    {template&&<div className="space-y-2"><p className="text-sm font-medium">Preview — {template.subject}</p><iframe title="Template preview" sandbox="" className="h-60 w-full rounded border bg-white" srcDoc={template.html_body}/></div>}
    <div className="flex flex-wrap gap-3"><Button disabled={busy||name.trim().length<3||!templateId||(audience==="selected"&&!userIds.length)} onClick={createCampaign}><Plus className="mr-2 h-4 w-4"/>Save draft (does not send)</Button>
     <p className="self-center text-xs text-muted-foreground">Recipients are snapshotted and counted server-side. Approval is a separate action.</p>
    </div>
   </TabsContent>
   <TabsContent value="contacts" className="space-y-4 rounded border p-5">
    <h3 className="font-semibold">Bulk import opted-in email contacts</h3>
    <p className="text-sm text-muted-foreground">CSV columns: {columns.join(", ")}. Tags are separated with semicolons. Consent date must be provided per row or below. Previously unsubscribed addresses never become subscribed through import.</p>
    <Input type="file" accept=".csv,text/csv" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error("CSV must be 2 MB or smaller");setCsv(parseCampaignCsv(await file.text()));}catch(err:any){setCsv([]);toast({title:"CSV import error",description:err.message,variant:"destructive"});}}}/>
    {csv.length>0&&<p className="text-sm font-medium">{csv.length} rows ready for review — {csv.slice(0,3).map(x=>x.email).join(", ")}{csv.length>3?" …":""}</p>}
    <div className="grid gap-3 md:grid-cols-2">
     <div><label className="text-xs font-medium">Consent source</label><Input value={source} onChange={e=>setSource(e.target.value)} placeholder="Website opt-in form / event signup"/></div>
     <div><label className="text-xs font-medium">Consent date (if missing from CSV)</label><Input type="date" value={consentDate} onChange={e=>setConsentDate(e.target.value)}/></div>
    </div>
    <div><label className="text-xs font-medium">Evidence of explicit consent</label><Textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Describe consent wording, where the opt-in occurred and how its evidence can be verified."/></div>
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={attest} onCheckedChange={v=>setAttest(v===true)}/><span>I confirm every uploaded address has verifiable, valid consent for OCCTA marketing. I have checked the file for accuracy.</span></label>
    <Button disabled={busy||!attest||!csv.length||source.trim().length<3||evidence.trim().length<10} onClick={importContacts}><Upload className="mr-2 h-4 w-4"/>Import {csv.length} contacts</Button>
    <h4 className="mt-4 font-semibold">Recent contacts</h4>
    <div className="max-h-64 overflow-auto rounded border text-sm">{contacts.map((c:any)=><div key={c.email} className="flex justify-between gap-3 border-b p-2"><span className="truncate">{c.email} <span className="text-muted-foreground">{c.company||""}</span></span><Badge variant="outline">{c.consent_status}</Badge></div>)}{!contacts.length&&<p className="p-4 text-muted-foreground">No imported contacts.</p>}</div>
   </TabsContent>
   <TabsContent value="artwork" className="space-y-4 rounded border p-5">
    <h3 className="font-semibold">Campaign artwork library</h3>
    <p className="text-sm text-muted-foreground">Upload multiple images, copy hosted URLs and insert them into HTML templates. This bucket is publicly readable: never upload customer data or confidential documents.</p>
    <Input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" disabled={assetsBusy} onChange={e=>uploadArtwork(e.target.files)}/>
    {lastArtworkUrl&&<div className="flex gap-2"><Input readOnly value={lastArtworkUrl}/><Button variant="outline" onClick={()=>navigator.clipboard.writeText(lastArtworkUrl)}>Copy</Button></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{artworks.map(file=>{
     const url=supabase.storage.from("campaign-artwork").getPublicUrl("assets/"+file.name).data.publicUrl;
     return <div key={file.name} className="min-w-0 rounded border p-3"><img loading="lazy" alt="Campaign artwork" src={url} className="h-36 w-full rounded bg-muted object-contain"/><div className="mt-2 truncate text-xs">{file.name}</div><Button size="sm" variant="outline" className="mt-2" onClick={()=>navigator.clipboard.writeText(`<img src="${url}" alt="OCCTA campaign" style="max-width:100%;height:auto"/>`)}>Copy HTML</Button></div>;
    })}</div>
   </TabsContent>
   <TabsContent value="history" className="space-y-3">
    <div className="flex flex-wrap gap-3"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search campaign history" className="max-w-md"/><Button variant="outline" onClick={()=>refetch()}>Refresh</Button><Button variant="outline" disabled={busy} onClick={runBatch}><Play className="mr-2 h-4 w-4"/>Process next approved batch (up to 30)</Button></div>
    <div className="overflow-auto rounded border"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50">{["Campaign","Status","Recipients","Sent","Delivered","Opened*","Failed","Created","Actions"].map(s=><th key={s} className="whitespace-nowrap p-3 text-left">{s}</th>)}</tr></thead><tbody>{filtered.map(c=><tr key={c.id} className="border-b"><td className="min-w-40 p-3"><b>{c.campaign_name}</b><div className="text-xs text-muted-foreground">{c.email_templates?.template_name||"Template removed"}</div></td><td className="p-3"><Badge variant="outline">{label(c.status)}</Badge></td><td className="p-3">{c.total_recipients||0}</td><td className="p-3">{c.sent_count||0}</td><td className="p-3">{c.delivered_count||0}</td><td className="p-3">{c.opened_count||0}</td><td className="p-3">{c.failed_count||0}</td><td className="whitespace-nowrap p-3">{date(c.created_at)}</td><td className="p-3">{actionButtons(c)}</td></tr>)}{!filtered.length&&<tr><td colSpan={9} className="p-5 text-center text-muted-foreground">{loading?"Loading campaigns...":"No campaigns found"}</td></tr>}</tbody></table></div>
    <p className="text-xs text-muted-foreground">*Open and click events are approximate because of privacy tools, image blocking and link scanners. A sent email is accepted by the provider, not proof of delivery.</p>
   </TabsContent>
   <TabsContent value="suppression" className="space-y-4 rounded border p-5">
    <h3 className="font-semibold">Do not email / global marketing suppression</h3>
    <div className="flex gap-2"><Input type="email" value={manualSuppression} onChange={e=>setManualSuppression(e.target.value)} placeholder="email@example.com"/><Button disabled={busy||!manualSuppression.includes("@")} onClick={async()=>{const ok=await operation(()=>invoke("suppress",{email:manualSuppression}),"Address suppressed");if(ok)setManualSuppression("");}}>Suppress</Button></div>
    <p className="text-xs text-muted-foreground">Suppression does not block transactional contract, service or billing emails.</p>
    <div className="max-h-64 overflow-auto">{suppressions.map((s:any)=><div key={s.email} className="flex justify-between border-b p-2 text-sm"><span>{s.email}</span><span>{label(s.reason)} · {date(s.created_at)}</span></div>)}{!suppressions.length&&<p className="p-4 text-sm text-muted-foreground">No suppressed addresses found.</p>}</div>
   </TabsContent>
  </Tabs>
  <CampaignDetailDialog campaign={selected} onClose={()=>setSelected(null)}/>
  <Dialog open={!!selectedEvents} onOpenChange={open=>!open&&setSelectedEvents(null)}><DialogContent className="max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>Event history — {selectedEvents?.campaign_name}</DialogTitle></DialogHeader><div className="space-y-2">{events.map((e:any,i:number)=><div className="flex justify-between gap-2 border-b py-2 text-xs" key={i}><span>{label(e.event_type)}</span><span>{date(e.event_at)}</span></div>)}{!events.length&&<p>No events yet.</p>}</div></DialogContent></Dialog>
  <Dialog open={!!confirm} onOpenChange={open=>!open&&(setConfirm(null),setTyped(""))}><DialogContent><DialogHeader><DialogTitle>{label(confirm?.action||"")} campaign</DialogTitle></DialogHeader>
   <p className="text-sm">Campaign: <b>{confirm?.campaign.campaign_name}</b>. Recipients: {confirm?.campaign.total_recipients||0}. Approval and start are separate audited actions. Starting can cause real emails to be sent by the dispatch worker.</p>
   {confirm?.action==="start"&&<div><label className="text-sm font-medium">Optional scheduled date/time (local timezone)</label><Input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)}/><p className="text-xs text-muted-foreground">Leave blank to make the campaign ready now.</p></div>}
   {(confirm?.action==="approve"||confirm?.action==="start")&&<div><label className="text-xs">Type {confirm.action==="approve"?"APPROVE":"START"} to confirm</label><Input autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)}/></div>}
   <DialogFooter><Button variant="outline" onClick={()=>setConfirm(null)}>Cancel</Button><Button disabled={busy||((confirm?.action==="approve"||confirm?.action==="start")&&typed!==(confirm.action==="approve"?"APPROVE":"START"))} onClick={confirmAction}>Confirm {confirm?.action}</Button></DialogFooter>
  </DialogContent></Dialog>
 </div>;
}
