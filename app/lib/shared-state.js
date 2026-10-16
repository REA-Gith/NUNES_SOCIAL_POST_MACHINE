import crypto from "crypto";

function directReady(){
  return Boolean(
    process.env.SOCIAL_STATE_API_URL &&
    process.env.SOCIAL_STATE_SHARED_SECRET &&
    process.env.SOCIAL_STATE_ENCRYPTION_KEY
  );
}

function bridgeReady(){
  return Boolean(
    process.env.SOCIAL_STATE_BRIDGE_URL &&
    process.env.SOCIAL_STATE_BRIDGE_SECRET
  );
}

function sharedReady(){
  return directReady() || bridgeReady();
}

function key(){
  const secret=process.env.SOCIAL_STATE_ENCRYPTION_KEY || "";
  if(!secret) throw new Error("SOCIAL_STATE_ENCRYPTION_KEY is required");
  return crypto.createHash("sha256").update(secret).digest();
}

function seal(value){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,data]).toString("base64url");
}

function unseal(token){
  if(!token) return null;
  try{
    const raw=Buffer.from(token,"base64url");
    const iv=raw.subarray(0,12);
    const tag=raw.subarray(12,28);
    const data=raw.subarray(28);
    const decipher=crypto.createDecipheriv("aes-256-gcm",key(),iv);
    decipher.setAuthTag(tag);
    const out=Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
    return JSON.parse(out);
  }catch{
    return null;
  }
}

export async function getSharedState(stateKey){
  if(!sharedReady()) return null;
  try{
    if(directReady()){
      const url=new URL(process.env.SOCIAL_STATE_API_URL);
      url.searchParams.set("key",stateKey);
      const r=await fetch(url,{
        headers:{"x-nunes-secret":process.env.SOCIAL_STATE_SHARED_SECRET},
        cache:"no-store"
      });
      if(!r.ok) return null;
      const j=await r.json();
      const blob=j?.payload?.blob;
      return unseal(blob);
    }

    const url=new URL(process.env.SOCIAL_STATE_BRIDGE_URL);
    url.searchParams.set("key",stateKey);
    const r=await fetch(url,{
      headers:{"x-nunes-bridge-secret":process.env.SOCIAL_STATE_BRIDGE_SECRET},
      cache:"no-store"
    });
    if(!r.ok) return null;
    const j=await r.json();
    return j?.value ?? null;
  }catch(e){
    console.error("[SHARED STATE] read failed",String(e?.message||e));
    return null;
  }
}

export async function setSharedState(stateKey,value){
  if(!sharedReady()) return false;
  try{
    if(directReady()){
      const r=await fetch(process.env.SOCIAL_STATE_API_URL,{
        method:"POST",
        headers:{
          "content-type":"application/json",
          "x-nunes-secret":process.env.SOCIAL_STATE_SHARED_SECRET
        },
        body:JSON.stringify({key:stateKey,payload:{blob:seal(value)}}),
        cache:"no-store"
      });
      return r.ok;
    }

    const r=await fetch(process.env.SOCIAL_STATE_BRIDGE_URL,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-nunes-bridge-secret":process.env.SOCIAL_STATE_BRIDGE_SECRET
      },
      body:JSON.stringify({key:stateKey,value}),
      cache:"no-store"
    });
    return r.ok;
  }catch(e){
    console.error("[SHARED STATE] write failed",String(e?.message||e));
    return false;
  }
}

export function sharedStateReady(){
  return sharedReady();
}

export function directSharedStateReady(){
  return directReady();
}
