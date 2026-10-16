import { directSharedStateReady, getSharedState, setSharedState } from "../../lib/shared-state";

function authorized(request){
  const expected=process.env.SOCIAL_STATE_BRIDGE_SECRET||"";
  const received=request.headers.get("x-nunes-bridge-secret")||"";
  return Boolean(expected && received && expected===received);
}

export async function GET(request){
  if(!authorized(request)) return Response.json({ok:false,error:"Unauthorized"},{status:401});
  if(!directSharedStateReady()) return Response.json({ok:false,error:"Direct shared state is unavailable on this host."},{status:503});
  const key=new URL(request.url).searchParams.get("key")||"";
  if(!key || key.length>200) return Response.json({ok:false,error:"Invalid key"},{status:400});
  const value=await getSharedState(key);
  return Response.json({ok:true,value});
}

export async function POST(request){
  if(!authorized(request)) return Response.json({ok:false,error:"Unauthorized"},{status:401});
  if(!directSharedStateReady()) return Response.json({ok:false,error:"Direct shared state is unavailable on this host."},{status:503});
  const body=await request.json().catch(()=>({}));
  const key=String(body.key||"");
  if(!key || key.length>200) return Response.json({ok:false,error:"Invalid key"},{status:400});
  const ok=await setSharedState(key,body.value);
  return Response.json({ok},{status:ok?200:502});
}
