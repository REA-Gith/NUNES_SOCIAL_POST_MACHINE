import { getSharedState } from "../../../lib/shared-state";
import { GET as getIntegrationHealth } from "../../integrations/status/route";

async function getFacebookLive(token,cfg){
  if(!token?.access_token || !cfg?.accountId) return [];
  try{
    let pageToken=token.access_token;
    const pages=await fetch("https://graph.facebook.com/v24.0/me/accounts?fields=id,access_token&access_token="+encodeURIComponent(token.access_token),{cache:"no-store"});
    const pj=await pages.json().catch(()=>({}));
    const page=(pj.data||[]).find(x=>String(x.id)===String(cfg.accountId));
    if(page?.access_token) pageToken=page.access_token;
    const r=await fetch(`https://graph.facebook.com/v24.0/${cfg.accountId}/posts?fields=id,message,created_time,permalink_url,full_picture&limit=12&access_token=${encodeURIComponent(pageToken)}`,{cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) return [];
    return (j.data||[]).map(x=>({
      id:x.id,
      text:x.message||"",
      createdAt:x.created_time||"",
      url:x.permalink_url||"",
      mediaUrl:x.full_picture||"",
      source:"Facebook"
    }));
  }catch(e){ console.warn("[ACCOUNTS HUB] Facebook feed unavailable",String(e?.message||e)); return [] }
}

async function getInstagramLive(token,cfg){
  if(!token?.access_token || !cfg?.accountId) return [];
  try{
    const direct=token?.connectionMode==="instagram-login" || cfg?.connectionMode==="instagram-login";
    const base=direct?"https://graph.instagram.com":"https://graph.facebook.com/v24.0";
    const r=await fetch(`${base}/${encodeURIComponent(cfg.accountId)}/media?fields=id,caption,media_type,media_url,permalink,timestamp,thumbnail_url&limit=12&access_token=${encodeURIComponent(token.access_token)}`,{cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) {
      console.warn("[ACCOUNTS HUB] Instagram feed unavailable",j?.error?.message||`HTTP ${r.status}`);
      return [];
    }
    return (j.data||[]).map(x=>({
      id:x.id,
      text:x.caption||"",
      createdAt:x.timestamp||"",
      url:x.permalink||"",
      mediaUrl:x.thumbnail_url||x.media_url||"",
      mediaType:x.media_type||"",
      source:"Instagram"
    }));
  }catch(e){ console.warn("[ACCOUNTS HUB] Instagram feed unavailable",String(e?.message||e)); return [] }
}

export async function GET(){
  const [history,fbCfg,igCfg,waCfg,liCfg,ytCfg,fbTok,igTok,waTok,liTok,ytTok,waNumbersRaw]=await Promise.all([
    getSharedState("history:posts"),
    getSharedState("config:facebook"),
    getSharedState("config:instagram"),
    getSharedState("config:whatsapp"),
    getSharedState("config:linkedin"),
    getSharedState("config:youtube"),
    getSharedState("token:facebook"),
    getSharedState("token:instagram"),
    getSharedState("token:whatsapp"),
    getSharedState("token:linkedin"),
    getSharedState("token:youtube"),
    getSharedState("whatsapp:numbers")
  ]);

  const healthResponse=await getIntegrationHealth();
  const healthPayload=await healthResponse.json();
  const integrationHealth=healthPayload.integrations||{};
  const isConnected=(name)=>integrationHealth[name]?.connected===true;
  const posts=Array.isArray(history)?history:[];
  const waNumbers=Array.isArray(waNumbersRaw)?waNumbersRaw:[];
  const waConnectedCount=waNumbers.filter(n=>n?.enabled!==false && n?.phoneNumberId && (n?.accessToken||waTok?.access_token)).length || (waTok?.access_token&&waCfg?.accountId?1:0);
  const [facebookLive,instagramLive]=await Promise.all([
    getFacebookLive(fbTok,fbCfg),
    getInstagramLive(igTok,igCfg)
  ]);

  const byChannel=(name)=>posts.filter(x=>String(x.channel||"").toLowerCase()===name.toLowerCase()).slice(0,20);

  return Response.json({
    ok:true,
    accounts:{
      LinkedIn:{
        connectionHealth:integrationHealth.LinkedIn?.publishingHealth||integrationHealth.LinkedIn?.mode||"unknown",
        connectionError:integrationHealth.LinkedIn?.actionRequired||"",
        connected:isConnected("LinkedIn"),
        configured:Boolean(liCfg?.clientId&&liCfg?.clientSecret),
        name:liTok?.profile?.name||"Nunes Instrumentation",
        accountId:liCfg?.accountId||liTok?.author_urn||"",
        recent:byChannel("LinkedIn"),
        capabilities:["Content","Publishing","Settings","Permissions"]
      },
      Facebook:{
        connectionHealth:integrationHealth.Facebook?.publishingHealth||integrationHealth.Facebook?.mode||"unknown",
        connectionError:integrationHealth.Facebook?.actionRequired||"",
        signedIn:Boolean(fbTok?.access_token),
        sharedSaved:Boolean(fbTok?.access_token),
        connected:isConnected("Facebook"),
        configured:Boolean(fbCfg?.clientId&&fbCfg?.clientSecret),
        name:fbCfg?.name||"Nunes Instrumentation",
        accountId:fbCfg?.accountId||"",
        recent:facebookLive.length?facebookLive:byChannel("Facebook"),
        capabilities:["Content","Ads","Insights","Messages","Comments","Settings","Permissions"]
      },
      Instagram:{
        connectionHealth:integrationHealth.Instagram?.publishingHealth||integrationHealth.Instagram?.mode||"unknown",
        connectionError:integrationHealth.Instagram?.actionRequired||"",
        connected:isConnected("Instagram"),
        configured:Boolean(igCfg?.clientId&&igCfg?.clientSecret),
        name:igCfg?.name||"Instagram Professional",
        accountId:igCfg?.accountId||"",
        recent:instagramLive.length?instagramLive:byChannel("Instagram"),
        capabilities:["Content","Ads","Insights","Messages","Comments","Settings","Permissions"]
      },
      YouTube:{
        connectionHealth:integrationHealth.YouTube?.publishingHealth||integrationHealth.YouTube?.mode||"unknown",
        connectionError:integrationHealth.YouTube?.actionRequired||"",
        connected:isConnected("YouTube"),
        configured:Boolean(ytCfg?.clientId&&ytCfg?.clientSecret),
        name:"Nunes Instrumentation YouTube",
        accountId:ytCfg?.accountId||"",
        recent:byChannel("YouTube"),
        capabilities:["Content","Publishing","Settings","Permissions"]
      },
      WhatsApp:{
        connectionHealth:integrationHealth.WhatsApp?.publishingHealth||integrationHealth.WhatsApp?.mode||"unknown",
        connectionError:integrationHealth.WhatsApp?.actionRequired||"",
        connected:isConnected("WhatsApp"),
        configured:Boolean(waCfg?.clientId&&waCfg?.clientSecret),
        name:waCfg?.verifiedName||"WhatsApp Business",
        phone:waCfg?.phone||"",
        accountId:waCfg?.accountId||"",
        wabaId:waCfg?.secondaryId||"",
        numberCount:integrationHealth.WhatsApp?.numbersConnected||0,
        numbersConfigured:waNumbers.length || (waCfg?.accountId?1:0),
        recent:byChannel("WhatsApp"),
        capabilities:["Messages","Templates","Numbers","Settings","Permissions"]
      }
    }
  });
}