import { getSharedState } from "../../../lib/shared-state";

export async function POST(request) {
  try {
    const body=await request.json().catch(()=>({}));
    const mediaUrl=String(body.mediaUrl||"").trim();
    const caption=String(body.caption||"NUNES Instagram connection test").trim();

    if(!/^https:\/\//i.test(mediaUrl)){
      return Response.json({ok:false,error:"A public HTTPS image/video URL is required."},{status:400});
    }

    const [token,config]=await Promise.all([
      getSharedState("token:instagram"),
      getSharedState("config:instagram")
    ]);

    if(!token?.access_token||!config?.accountId||config?.verified!==true||config?.connectionMode!=="instagram-login"){
      return Response.json({
        ok:false,
        error:"Connect Instagram separately using Instagram Login before testing publishing.",
        connectionMode:config?.connectionMode||"",
        connected:false
      },{status:409});
    }

    const graphBase="https://graph.instagram.com";
    const isVideo=/\.(mp4|mov|m4v|webm)(\?|$)/i.test(mediaUrl);
    const create=new URLSearchParams({access_token:token.access_token,caption});

    if(isVideo){
      create.set("media_type","REELS");
      create.set("video_url",mediaUrl);
    }else{
      create.set("image_url",mediaUrl);
    }

    const r1=await fetch(`${graphBase}/${encodeURIComponent(config.accountId)}/media`,{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:create,
      cache:"no-store"
    });
    const j1=await r1.json().catch(()=>({}));

    if(!r1.ok||!j1.id){
      return Response.json({ok:false,error:"Instagram media container creation failed.",meta:j1},{status:502});
    }

    if(isVideo){
      for(let i=0;i<18;i++){
        const sr=await fetch(`${graphBase}/${encodeURIComponent(j1.id)}?fields=status_code&access_token=${encodeURIComponent(token.access_token)}`,{cache:"no-store"});
        const sj=await sr.json().catch(()=>({}));
        if(sj.status_code==="FINISHED") break;
        if(sj.status_code==="ERROR"||sj.status_code==="EXPIRED"){
          return Response.json({ok:false,error:"Instagram Reel processing failed.",meta:sj},{status:502});
        }
        await new Promise(r=>setTimeout(r,2500));
      }
    }

    const publish=new URLSearchParams({creation_id:String(j1.id),access_token:token.access_token});
    const r2=await fetch(`${graphBase}/${encodeURIComponent(config.accountId)}/media_publish`,{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:publish,
      cache:"no-store"
    });
    const j2=await r2.json().catch(()=>({}));

    if(!r2.ok||!j2.id){
      return Response.json({ok:false,error:"Instagram publish failed.",containerId:j1.id,meta:j2},{status:502});
    }

    return Response.json({
      ok:true,
      status:"POSTED",
      mediaId:String(j2.id),
      instagramAccountId:String(config.accountId),
      username:config.name||token.username||"",
      connectionMode:"instagram-login"
    });
  }catch(e){
    console.error("[INSTAGRAM TEST]",String(e?.message||e));
    return Response.json({ok:false,error:String(e?.message||"Instagram test post failed")},{status:500});
  }
}
