import { getSharedState, setSharedState } from "../../../lib/shared-state";

const KEY="automation:instagram-schedules";

function authorized(request){
  const expected=process.env.CRON_SECRET||"";
  return Boolean(expected && request.headers.get("authorization")===`Bearer ${expected}`);
}

export async function GET(request){
  if(!authorized(request)) return Response.json({ok:false,error:"Unauthorized"},{status:401});

  const base=(process.env.PUBLIC_APP_URL||new URL(request.url).origin).replace(/\/$/,"");
  const current=await getSharedState(KEY);
  const queue=Array.isArray(current)?current:[];
  const now=Date.now();
  const due=queue.filter(item=>item?.enabled!==false&&item?.status==="SCHEDULED"&&Date.parse(item?.scheduledAt||"")<=now).slice(0,10);

  let posted=0;
  let failed=0;
  const changes=new Map();

  for(const item of due){
    try{
      const r=await fetch(`${base}/api/publish`,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          topic:"Scheduled Instagram Post",
          channel:"Instagram",
          text:item.caption,
          mediaUrl:item.mediaUrl,
          angle:"Scheduled",
          attachments:[],
          idempotencyKey:`instagram-auto:${item.id}`
        }),
        cache:"no-store"
      });
      const j=await r.json().catch(()=>({}));
      if(r.ok && j?.external?.status==="POSTED"){
        posted++;
        changes.set(item.id,{status:"POSTED",enabled:false,postedAt:new Date().toISOString(),externalId:j?.external?.externalId||null,error:null});
      }else{
        failed++;
        changes.set(item.id,{status:"FAILED",enabled:false,error:j?.external?.error||j?.error||"Instagram publish failed."});
      }
    }catch(e){
      failed++;
      changes.set(item.id,{status:"FAILED",enabled:false,error:String(e?.message||e)});
    }
  }

  if(changes.size){
    const updated=queue.map(item=>{
      const patch=changes.get(item.id);
      return patch?{...item,...patch,attempts:(item.attempts||0)+1,updatedAt:new Date().toISOString()}:item;
    });
    await setSharedState(KEY,updated);
  }

  return Response.json({ok:true,processed:due.length,posted,failed});
}
