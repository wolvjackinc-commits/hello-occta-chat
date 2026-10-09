// Deprecated unsafe endpoint. Use campaign-manager (draft/approval) + campaign-dispatch.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Content-Type":"application/json"};
serve(req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 return new Response(JSON.stringify({error:"Legacy direct bulk sending is disabled. Create and approve a campaign in Admin > Communications > Campaign Manager."}),{status:410,headers});
});
