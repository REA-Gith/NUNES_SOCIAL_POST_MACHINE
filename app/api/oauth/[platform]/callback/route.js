import { NextResponse } from "next/server";
import { OAUTH } from "../../../../lib/oauth-config";
import { seal, cookieName, COOKIE_OPTIONS, readConfig, secretFromJar } from "../../../../lib/oauth-store";
import { getSharedState, setSharedState } from "../../../../lib/shared-state";

const FB_GRAPH = "https://graph.facebook.com/v24.0";

function publicOrigin(request) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

async function exchangeLongLivedFacebook(shortToken, clientId, clientSecret) {
  const u=new URL(`${FB_GRAPH}/oauth/access_token`);
  u.searchParams.set("grant_type","fb_exchange_token");
  u.searchParams.set("client_id",clientId);
  u.searchParams.set("client_secret",clientSecret);
  u.searchParams.set("fb_exchange_token",shortToken);
  const r=await fetch(u,{cache:"no-store"});
  const j=await r.json().catch(()=>({}));
  if(r.ok&&j?.access_token) return j;
  console.warn("[FACEBOOK OAUTH] long-lived exchange unavailable",j?.error?.message||`HTTP ${r.status}`);
  return null;
}

async function exchangeLongLivedInstagram(shortToken, clientSecret) {
  const u=new URL("https://graph.instagram.com/access_token");
  u.searchParams.set("grant_type","ig_exchange_token");
  u.searchParams.set("client_secret",clientSecret);
  u.searchParams.set("access_token",shortToken);
  const r=await fetch(u,{cache:"no-store"});
  const j=await r.json().catch(()=>({}));
  if(r.ok&&j?.access_token) return j;
  console.warn("[INSTAGRAM OAUTH] long-lived exchange unavailable",j?.error?.message||`HTTP ${r.status}`);
  return null;
}

async function facebookIdentity(accessToken) {
  const profileRes=await fetch(`${FB_GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,{cache:"no-store"});
  const profile=profileRes.ok?await profileRes.json().catch(()=>null):null;
  const permRes=await fetch(`${FB_GRAPH}/me/permissions?access_token=${encodeURIComponent(accessToken)}`,{cache:"no-store"});
  const permJson=await permRes.json().catch(()=>({}));
  const scopes=permRes.ok&&Array.isArray(permJson.data)?permJson.data.filter(x=>x.status==="granted").map(x=>x.permission):[];
  return {profile,scopes};
}

async function instagramIdentity(accessToken) {
  const u=new URL("https://graph.instagram.com/me");
  u.searchParams.set("fields","id,user_id,username,account_type,profile_picture_url");
  u.searchParams.set("access_token",accessToken);
  const r=await fetch(u,{cache:"no-store"});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j?.error?.message||`Instagram profile lookup failed (HTTP ${r.status})`);
  const id=String(j.id||j.user_id||"").trim();
  if(!id) throw new Error("Instagram did not return an account ID.");
  return {...j,id};
}

async function discoverFacebookPage(accessToken, configuredPageId) {
  const r=await fetch(
    `${FB_GRAPH}/me/accounts?fields=id,name,access_token,tasks&access_token=${encodeURIComponent(accessToken)}`,
    {cache:"no-store"}
  );
  const j=await r.json().catch(()=>({}));
  if(!r.ok) return {page:null,detail:j?.error?.message||`HTTP ${r.status}`};
  const pages=Array.isArray(j.data)?j.data:[];
  const page=(configuredPageId?pages.find(x=>String(x.id)===String(configuredPageId)):null)||pages[0]||null;
  return {page,detail:""};
}

async function discoverWhatsApp(accessToken, basePayload) {
  try{
    const bizRes=await fetch(`${FB_GRAPH}/me/businesses?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,{cache:"no-store"});
    const bizJson=await bizRes.json().catch(()=>({}));
    const businesses=Array.isArray(bizJson.data)?bizJson.data:[];
    for(const biz of businesses){
      const wabaRes=await fetch(`${FB_GRAPH}/${encodeURIComponent(biz.id)}/owned_whatsapp_business_accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,{cache:"no-store"});
      const wabaJson=await wabaRes.json().catch(()=>({}));
      const waba=Array.isArray(wabaJson.data)?wabaJson.data[0]:null;
      if(!waba?.id) continue;
      const phoneRes=await fetch(`${FB_GRAPH}/${encodeURIComponent(waba.id)}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(accessToken)}`,{cache:"no-store"});
      const phoneJson=await phoneRes.json().catch(()=>({}));
      const phone=Array.isArray(phoneJson.data)?phoneJson.data[0]:null;
      const existingWa=(await getSharedState("config:whatsapp"))||{};
      await setSharedState("config:whatsapp",{
        ...existingWa,
        platform:"whatsapp",
        accountId:phone?.id||existingWa.accountId||"",
        secondaryId:String(waba.id),
        name:waba.name||existingWa.name||"",
        phone:phone?.display_phone_number||existingWa.phone||"",
        verifiedName:phone?.verified_name||existingWa.verifiedName||"",
        connectionStatus:phone?.id?"connected":"needs-attention",
        validatedAt:Date.now(),
        updatedAt:Date.now(),
        savedAt:existingWa.savedAt||Date.now()
      });
      if(phone?.id){
        await setSharedState("token:whatsapp",{...basePayload,platform:"WhatsApp",waba_id:String(waba.id),phone_number_id:String(phone.id),validatedAt:Date.now()});
      }
      return;
    }
  }catch(e){
    console.warn("[WHATSAPP DISCOVERY]",String(e?.message||e));
  }
}

export async function GET(request,{params}) {
  const {platform}=await params;
  const id=String(platform||"").toLowerCase();
  const config=OAUTH[id];
  const currentUrl=new URL(request.url);

  const targetForError=(code,detail="")=>{
    const q=new URLSearchParams({error:code});
    if(detail) q.set("detail",String(detail).slice(0,300));
    if(id==="facebook") return new URL(`/connect/Meta?${q.toString()}`,publicOrigin(request));
    return new URL(`/connect/${config?.label||platform}?${q.toString()}`,publicOrigin(request));
  };

  const saved=(await getSharedState(`config:${id}`))||readConfig(request.cookies,id);
  const clientId=saved?.clientId||(config?process.env[config.clientId]:null);
  const clientSecret=saved?.clientSecret||(config?process.env[config.clientSecret]:null);
  if(!config||!clientId||!clientSecret) return NextResponse.redirect(targetForError("app-not-configured"));

  const state=currentUrl.searchParams.get("state");
  const code=currentUrl.searchParams.get("code");
  const oauthError=currentUrl.searchParams.get("error");
  const expected=request.cookies.get(`nunes_state_${id}`)?.value;
  if(oauthError||!code||!state||!expected||state!==expected){
    const detail=currentUrl.searchParams.get("error_description")||(state!==expected?"OAuth state mismatch or expired login session":"");
    return NextResponse.redirect(targetForError("oauth-failed",detail));
  }

  const redirectUri=`${publicOrigin(request)}/api/oauth/${id}/callback`;
  const body=new URLSearchParams({
    grant_type:"authorization_code",
    code,
    redirect_uri:redirectUri
  });
  let headers={"Content-Type":"application/x-www-form-urlencoded"};
  let tokenUrl=config.token;

  if(config.basic){
    headers.Authorization="Basic "+Buffer.from(clientId+":"+clientSecret).toString("base64");
  }else if(config.meta){
    tokenUrl+=`?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
  }else{
    body.set("client_id",clientId);
    body.set("client_secret",clientSecret);
  }

  if(config.pkce){
    const verifier=request.cookies.get(`nunes_pkce_${id}`)?.value;
    if(!verifier) return NextResponse.redirect(targetForError("pkce-missing"));
    body.set("code_verifier",verifier);
    headers.Authorization="Basic "+Buffer.from(clientId+":"+clientSecret).toString("base64");
  }

  try{
    const tr=await fetch(tokenUrl,{method:config.meta?"GET":"POST",headers,body:config.meta?undefined:body,cache:"no-store"});
    const raw=await tr.text();
    let data={};
    try{data=JSON.parse(raw)}catch{}
    if(!tr.ok||!data.access_token){
      const detail=data?.error?.message||data?.error_description||raw||`HTTP ${tr.status}`;
      console.error("[OAUTH] token exchange failed",{platform:id,status:tr.status,detail:String(detail).slice(0,500)});
      return NextResponse.redirect(targetForError("token-exchange",detail));
    }

    let accessToken=data.access_token;
    let expiresIn=Number(data.expires_in||0)||null;
    let scopes=String(data.scope||config.scope||"").split(/[ ,]+/).filter(Boolean);
    let author_urn=null;
    let profile=null;
    let providerProfile=null;

    if(id==="linkedin"){
      const ur=await fetch("https://api.linkedin.com/v2/userinfo",{headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store"});
      if(ur.ok){
        profile=await ur.json();
        if(profile?.sub) author_urn=`urn:li:person:${profile.sub}`;
      }
    }

    if(id==="facebook"){
      const long=await exchangeLongLivedFacebook(accessToken,clientId,clientSecret);
      if(long?.access_token){accessToken=long.access_token;expiresIn=Number(long.expires_in||expiresIn||0)||null;}
      const identity=await facebookIdentity(accessToken);
      providerProfile=identity.profile;
      if(identity.scopes.length) scopes=identity.scopes;
    }

    if(id==="instagram"&&config.instagramDirect){
      const long=await exchangeLongLivedInstagram(accessToken,clientSecret);
      if(long?.access_token){accessToken=long.access_token;expiresIn=Number(long.expires_in||expiresIn||0)||null;}
      providerProfile=await instagramIdentity(accessToken);
      scopes=["instagram_business_basic","instagram_business_content_publish"];
    }

    const now=Date.now();
    const basePayload={
      platform:config.label,
      access_token:accessToken,
      refresh_token:data.refresh_token||null,
      expires_in:expiresIn,
      expires_at:expiresIn?now+expiresIn*1000:null,
      scope:scopes.join(" "),
      scopes,
      author_urn,
      profile:profile?{sub:profile.sub||null,name:profile.name||null}:null,
      createdAt:now,
      updatedAt:now
    };

    if(id==="instagram"&&config.instagramDirect){
      const igId=String(providerProfile.id);
      const instagramPayload={
        ...basePayload,
        platform:"Instagram",
        instagram_user_id:igId,
        username:providerProfile.username||"",
        account_type:providerProfile.account_type||"",
        profile_picture_url:providerProfile.profile_picture_url||"",
        connectionMode:"instagram-login",
        verified:true,
        validatedAt:now
      };
      const existing=(await getSharedState("config:instagram"))||{};
      await Promise.all([
        setSharedState("token:instagram",instagramPayload),
        setSharedState("config:instagram",{
          ...existing,
          platform:"instagram",
          clientId,
          clientSecret,
          accountId:igId,
          secondaryId:"",
          name:providerProfile.username||existing.name||"",
          accountType:providerProfile.account_type||"",
          profilePictureUrl:providerProfile.profile_picture_url||"",
          connectionMode:"instagram-login",
          verified:true,
          connectionStatus:"connected",
          validatedAt:now,
          updatedAt:now,
          savedAt:existing.savedAt||now
        })
      ]);
    }else{
      await setSharedState(`token:${id}`,basePayload);
    }

    if(id==="facebook"){
      await setSharedState("token:facebook",basePayload);
      const existingFb=(await getSharedState("config:facebook"))||{};
      const discovery=await discoverFacebookPage(accessToken,existingFb.accountId);
      if(discovery.page?.id){
        await setSharedState("config:facebook",{
          ...existingFb,
          platform:"facebook",
          accountId:String(discovery.page.id),
          name:discovery.page.name||existingFb.name||"",
          tasks:Array.isArray(discovery.page.tasks)?discovery.page.tasks:[],
          metaUserId:providerProfile?.id||existingFb.metaUserId||"",
          connectionStatus:"connected",
          validatedAt:now,
          updatedAt:now,
          savedAt:existingFb.savedAt||now
        });
      }else if(discovery.detail){
        console.warn("[FACEBOOK OAUTH] page discovery incomplete",discovery.detail);
      }
      await discoverWhatsApp(accessToken,basePayload);
    }

    const secret=secretFromJar(request.cookies);
    if(!secret) return NextResponse.redirect(targetForError("secure-session-missing","Secure browser session cookie was not returned after login"));

    const destination=id==="facebook"?"/connect/Meta?connected=1":`/connect/${config.label}?connected=1`;
    const response=NextResponse.redirect(new URL(destination,publicOrigin(request)));
    response.cookies.set(cookieName(config.label),seal(id==="instagram"?{...basePayload,username:providerProfile?.username||"",instagram_user_id:providerProfile?.id||"",connectionMode:"instagram-login"}:basePayload,secret),COOKIE_OPTIONS);
    response.cookies.delete(`nunes_state_${id}`);
    response.cookies.delete(`nunes_pkce_${id}`);
    return response;
  }catch(e){
    console.error("[OAUTH CALLBACK]",id,String(e?.message||e));
    return NextResponse.redirect(targetForError("callback-exception",e?.message||"Unexpected OAuth callback failure"));
  }
}
