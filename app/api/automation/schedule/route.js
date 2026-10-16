import { getSharedState, setSharedState } from "../../../lib/shared-state";

const KEY="automation:instagram-schedules";

async function load(){
  const value=await getSharedState(KEY);
  return Array.isArray(value)?value:[];
}

export async function GET(){
  try{
    const [items,igToken,igCfg]=await Promise.all([
      load(),
      getSharedState("token:instagram"),
      getSharedState("config:instagram")
    ]);
    return Response.json({
      ok:true,
      instagramConnected:Boolean(igToken?.access_token&&igCfg?.accountId&&igCfg?.verified===true),
      accountName:igCfg?.name||igToken?.username||"",
      schedules:items
    });
  }catch(e){
    console.error("[AUTO POST] schedule load failed",String(e?.message||e));
    return Response.json({ok:false,error:"Unable to load auto-post schedule."},{status:500});
  }
}

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({}));
    const items=await load();
    const action=String(body.action||"add");

    if(action==="add"){
      const [igToken,igCfg]=await Promise.all([
        getSharedState("token:instagram"),
        getSharedState("config:instagram")
      ]);
      if(!igToken?.access_token||!igCfg?.accountId||igCfg?.verified!==true){
        return Response.json({ok:false,error:"Connect and verify Instagram before scheduling automatic posts."},{status:409});
      }
      const caption=String(body.caption||"").trim();
      const mediaUrl=String(body.mediaUrl||"").trim();
      const scheduledAt=String(body.scheduledAt||"").trim();
      const when=Date.parse(scheduledAt);
      if(!caption) return Response.json({ok:false,error:"Caption is required."},{status:400});
      if(!/^https:\/\//i.test(mediaUrl)) return Response.json({ok:false,error:"A public HTTPS image/video URL is required for Instagram."},{status:400});
      if(!Number.isFinite(when)||when<=Date.now()+60_000) return Response.json({ok:false,error:"Choose a future schedule time at least 1 minute from now."},{status:400});
      const now=new Date().toISOString();
      const item={id:crypto.randomUUID(),platform:"Instagram",caption:caption.slice(0,2200),mediaUrl:mediaUrl.slice(0,2000),scheduledAt:new Date(when).toISOString(),status:"SCHEDULED",enabled:true,createdAt:now,updatedAt:now,attempts:0};
      const next=[...items,item].slice(-250);
      const saved=await setSharedState(KEY,next);
      if(!saved) return Response.json({ok:false,error:"Could not save the schedule to shared storage."},{status:502});
      return Response.json({ok:true,item});
    }

    if(action==="toggle"){
      const id=String(body.id||"");
      let found=false;
      const next=items.map(item=>item.id===id?(found=true,{...item,enabled:body.enabled!==false,updatedAt:new Date().toISOString()}):item);
      if(!found) return Response.json({ok:false,error:"Schedule not found."},{status:404});
      return Response.json({ok:await setSharedState(KEY,next)});
    }

    if(action==="remove"){
      const id=String(body.id||"");
      const next=items.filter(item=>item.id!==id);
      if(next.length===items.length) return Response.json({ok:false,error:"Schedule not found."},{status:404});
      return Response.json({ok:await setSharedState(KEY,next)});
    }

    return Response.json({ok:false,error:"Unsupported action."},{status:400});
  }catch(e){
    console.error("[AUTO POST] schedule update failed",String(e?.message||e));
    return Response.json({ok:false,error:"Unable to update auto-post schedule."},{status:500});
  }
}
