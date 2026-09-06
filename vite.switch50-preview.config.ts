import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
export default defineConfig({
  plugins:[react(),{name:"isolated-switch50-api",configureServer(server){
    const statuses=["eligible","payout_queued","issued","blocked","pending"];
    const rewards=statuses.map((status,i)=>({id:"11111111-1111-4111-8111-"+String(i+1).padStart(12,"0"),
      order_id:"22222222-2222-4222-8222-"+String(i+1).padStart(12,"0"),customer_id:"synthetic",status,version:1,reward_amount:50,
      eligibility_due_at:"2026-10-08T12:00:00Z",payout_reference:status==="issued"?"TEST-TRANSFER-01":null,
      blocked_reason:status==="blocked"?"account_in_arrears":null,manual_hold:false,needs_review:false}));
    server.middlewares.use(async(req,res,next)=>{
      if(req.url!=="/functions/v1/switch50-admin")return next();
      let raw="";for await(const chunk of req)raw+=chunk;
      const body=JSON.parse(raw||"{}");let data:unknown={ok:true};
      if(body.action==="status"){const list=rewards.filter(r=>body.status==="all"||!body.status||r.status===body.status);data={ok:true,rewards:list,total:list.length,can_admin:true,failed_messages:0};}
      else if(body.action==="history")data={ok:true,events:[{id:1,event_type:"reward_eligible",created_at:"2026-10-08T12:00:00Z",actor_id:null,from_status:"pending",to_status:"eligible",details:{source:"synthetic verification"}}],messages:[]};
      else if(body.reward_id){const r=rewards.find(r=>r.id===body.reward_id);
        if(r){r.status=({queue_payout:"payout_queued",mark_issued:"issued",block:"blocked",release:"eligible",reverse:"reversed"} as Record<string,string>)[body.action]??r.status;r.version++;r.payout_reference=body.payout_reference??r.payout_reference;}}
      res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));
    });
  }}],
  define:{"import.meta.env.VITE_SUPABASE_URL":JSON.stringify("http://127.0.0.1:8082"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":JSON.stringify("isolated-preview-key")},
  resolve:{alias:{"@":path.resolve(__dirname,"src")}},
  server:{host:"127.0.0.1",port:8082,strictPort:true}
});
