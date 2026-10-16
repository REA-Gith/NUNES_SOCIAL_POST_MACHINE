"use client";

import { useEffect, useState } from "react";

export default function MetaConnectPage(){
  const [state,setState]=useState(null);
  const [clientId,setClientId]=useState("");
  const [clientSecret,setClientSecret]=useState("");
  const [configId,setConfigId]=useState("");
  const [facebookPageId,setFacebookPageId]=useState("");
  const [wabaId,setWabaId]=useState("");
  const [phoneNumberId,setPhoneNumberId]=useState("");
  const [whatsappToken,setWhatsappToken]=useState("");
  const [msg,setMsg]=useState("");
  const [oauthCompleted,setOauthCompleted]=useState(false);
  const [oauthError,setOauthError]=useState("");
  const [oauthDetail,setOauthDetail]=useState("");
  const [viewMode,setViewMode]=useState("admin");
  const [fbHealth,setFbHealth]=useState(null);
  const [igHealth,setIgHealth]=useState(null);
  const [testMediaUrl,setTestMediaUrl]=useState("");
  const [testCaption,setTestCaption]=useState("NUNES Instagram connection test");
  const [testResult,setTestResult]=useState("");
  const [testBusy,setTestBusy]=useState(false);

  async function refresh(){
    const [r,sr]=await Promise.all([
      fetch("/api/meta/setup",{cache:"no-store"}),
      fetch("/api/integrations/status",{cache:"no-store"})
    ]);
    const j=await r.json().catch(()=>({}));
    const sj=await sr.json().catch(()=>({}));
    setState(j);
    setFbHealth(sj.integrations?.Facebook||null);
    setIgHealth(sj.integrations?.Instagram||null);
    if(j.facebook?.pageId) setFacebookPageId(j.facebook.pageId);
    if(j.whatsapp?.wabaId) setWabaId(j.whatsapp.wabaId);
    if(j.whatsapp?.phoneNumberId) setPhoneNumberId(j.whatsapp.phoneNumberId);
  }

  useEffect(()=>{
    refresh();
    if(typeof window!=="undefined"){
      const q=new URLSearchParams(window.location.search);
      setOauthCompleted(q.get("connected")==="1");
      setOauthError(q.get("error")||"");
      setOauthDetail(q.get("detail")||"");
    }
  },[]);

  async function saveAndConnect(e){
    e.preventDefault();
    setMsg("Saving Meta setup...");
    const r=await fetch("/api/meta/setup",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        clientId,clientSecret,configId,facebookPageId,wabaId,phoneNumberId,whatsappToken
      })
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok){
      setMsg(j.error||"Unable to save Meta setup");
      return;
    }
    setClientSecret("");
    setWhatsappToken("");
    setMsg("Saved. Opening Meta authorization...");
    window.location.href=j.connectUrl;
  }

  async function testInstagram(){
    if(!testMediaUrl.trim()){
      setTestResult("Add a public HTTPS image/video URL first.");
      return;
    }
    setTestBusy(true);
    setTestResult("Verifying Instagram and publishing test post...");
    try{
      const r=await fetch("/api/meta/test-instagram",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mediaUrl:testMediaUrl.trim(),caption:testCaption.trim()})
      });
      const j=await r.json().catch(()=>({}));
      setTestResult(r.ok&&j.ok
        ? `Posted successfully. Instagram media ID: ${j.mediaId}`
        : (j.error || j.detail || "Instagram test post failed."));
      await refresh();
    }catch(e){
      setTestResult(String(e?.message||"Instagram test post failed."));
    }finally{
      setTestBusy(false);
    }
  }

  const fbSignedIn=fbHealth ? Boolean(fbHealth.signedIn) : Boolean(state?.facebook?.connected);
  const fbReady=fbHealth ? Boolean(fbHealth.publishingReady) : Boolean(state?.facebook?.connected);
  const fb=fbSignedIn;
  const ig=igHealth ? Boolean(igHealth.connected) : Boolean(state?.instagram?.connected);
  const wa=Boolean(state?.whatsapp?.connected);
  const connectedCount=[fb,ig,wa].filter(Boolean).length;

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
        <div className="sideGroupLabel">OVERVIEW</div>
        <nav className="sideNav">
          <a className="sideLink" href="/"><span>⌂</span>Dashboard</a>
          <a className="sideLink active" href="/"><span>◎</span>Connections</a>
        </nav>
        <div className="sideGroupLabel">SOCIAL</div>
        <nav className="sideNav secondary">
          <a className="sideLink active" href="/connect/Meta"><span>M</span>Meta Business</a>
          <a className="sideLink" href="/"><span>▤</span>Content</a>
          <a className="sideLink" href="/"><span>➤</span>Publishing</a>
        </nav>
        <div className="sidebarBottom">
          <a className="sideLink" href="/">⚙ Settings</a>
          <div className="userCard"><div className="avatar">NI</div><div><strong>Nunes Instruments</strong><span>Admin</span></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspaceTop">
          <div className="searchBox">⌕<input placeholder="Search anything..." /></div>
          <div className="topActions"><a className="quickCreate" href="/">＋ Quick Create</a><div className="miniAvatar">NI</div></div>
        </header>

        <main className="contentArea">
          <div className="pageHeading">
            <div><span>META BUSINESS</span><h1>Connect Facebook & WhatsApp</h1><p>Facebook and WhatsApp use the Meta Business connection. Instagram is connected separately so it can use a different Instagram account.</p></div>
            <span className={connectedCount===3?"pill ok":"pill"}>{connectedCount}/3 CONNECTED</span>
          </div>

          {oauthCompleted && <div className={fb||ig||wa?"important":"warning"}><strong>{fb||ig||wa?"Meta authorization returned — verified server status loaded":"Meta authorization returned — verification still required"}</strong><span>{fb||ig||wa?"Only resources verified by the server are marked Connected below.":"The OAuth redirect alone is not treated as a connection. Check the service cards and action-required message below."}</span></div>}
          <div className="modeSwitch metaModeSwitch">
            <button className={viewMode==="admin"?"active":""} onClick={()=>setViewMode("admin")}>Admin View</button>
            <button className={viewMode==="tech"?"active":""} onClick={()=>setViewMode("tech")}>Tech View</button>
          </div>
          {fbHealth?.configured && fbHealth?.signedIn && !fbHealth?.publishingReady && <div className="warning">
            <strong>Facebook action required: {String(fbHealth.mode).replaceAll("-"," ")}</strong>
            <span>{fbHealth.actionRequired || "Reconnect Meta and grant the required Page permissions."}</span>
            {fbHealth.health?.missingPermissions?.length>0 && <small>Missing: {fbHealth.health.missingPermissions.join(", ")}</small>}
          </div>}
          {igHealth?.configured && !igHealth?.connected && <div className="warning instagramFixWarning">
            <strong>Instagram needs one Meta asset link</strong>
            <span>{igHealth.actionRequired || "Link the Instagram Professional account to the Nunes Instrumentation Facebook Page, then reconnect Meta."}</span>
            {igHealth.repair?.detail&&<small>{igHealth.repair.detail}</small>}
            <div className="instagramFixSteps">
              <b>1</b><span>Meta Business Settings → Accounts → Pages → Nunes Instrumentation</span>
              <b>2</b><span>Connected assets / Linked accounts → connect @nunesinstrumentation</span>
              <b>3</b><span>Return here and click Reconnect Meta securely</span>
            </div>
          </div>}
          {oauthError && <div className="warning metaError"><strong>Meta connection failed: {oauthError}</strong><span>{oauthDetail || "Retry after checking the Meta configuration and app permissions."}</span></div>}

          <section className="metaStatusGrid">
            <div className={fbReady?"metaServiceCard connected":fbSignedIn?"metaServiceCard attention":"metaServiceCard"}>
              <div className="metaServiceIcon fb">f</div>
              <div>
                <strong>Facebook</strong>
                <span>{fbReady?"Connected":fbSignedIn?"Needs attention":state?.facebook?.pageId?"Configured":"Not connected"}</span>
                {state?.facebook?.name&&<small>{state.facebook.name}</small>}
                {fbSignedIn&&!fbReady&&<small>Publishing: action required</small>}
                {fbReady&&<small>Publishing: ready</small>}
              </div>
              <b>{fbReady?"✓":fbSignedIn?"!":"—"}</b>
            </div>
            <div className={ig?"metaServiceCard connected":oauthCompleted?"metaServiceCard attention":"metaServiceCard"}>
              <div className="metaServiceIcon ig">◎</div>
              <div><strong>Instagram</strong><span>{ig?"Connected":oauthCompleted?"Needs attention":state?.instagram?.userId?"Configured":"Not connected"}</span>{state?.instagram?.name&&<small>@{state.instagram.name}</small>}</div>
              <b>{ig?"✓":oauthCompleted?"!":"—"}</b>
            </div>
            <div className={wa?"metaServiceCard connected":oauthCompleted?"metaServiceCard attention":"metaServiceCard"}>
              <div className="metaServiceIcon wa">WA</div>
              <div><strong>WhatsApp</strong><span>{wa?"Connected":oauthCompleted?"Needs attention":state?.whatsapp?.phoneNumberId?"Configured":"Not connected"}</span>{state?.whatsapp?.phone&&<small>{state.whatsapp.phone}</small>}</div>
              <b>{wa?"✓":oauthCompleted?"!":"—"}</b>
            </div>
          </section>

          {ig && <section className="connectCard" style={{marginBottom:18}}>
            <div className="brandBubble metaBubble">◎</div>
            <h2>Instagram Test Post</h2>
            <p>Use one public HTTPS image or video URL. The server re-verifies the linked Instagram Professional account before publishing.</p>
            <div className="apiSetupForm">
              <label>Public media URL
                <input value={testMediaUrl} onChange={e=>setTestMediaUrl(e.target.value)} placeholder="https://example.com/image.jpg"/>
              </label>
              <label>Test caption
                <input value={testCaption} onChange={e=>setTestCaption(e.target.value)} placeholder="NUNES Instagram connection test"/>
              </label>
              <button className="primary wideBtn" type="button" onClick={testInstagram} disabled={testBusy}>
                {testBusy?"Publishing...":"Publish Instagram Test"}
              </button>
              {testResult&&<div className="saveMsg">{testResult}</div>}
            </div>
          </section>}

          <section className="connectDashboardGrid">
            <article className="connectCard dashboardConnectCard">
              <div className="brandBubble metaBubble">M</div>
              <h2>{viewMode==="admin"?"Meta Account Access":"Meta API Setup"}</h2>
              <p>{viewMode==="admin"
                ?"Your Meta login and account connection are stored securely on the server and shared across computers. Only reconnect when Meta permissions need to be refreshed."
                :"Enter or update Meta developer credentials and technical account IDs."}</p>

              {viewMode==="tech" && <form className="apiSetupForm metaSetupForm" onSubmit={saveAndConnect}>
                <label>Meta App ID
                  <input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Paste Meta App ID" required/>
                </label>
                <label>Meta App Secret
                  <input type="password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Paste Meta App Secret" required/>
                </label>
                <label>Facebook Login for Business Configuration ID
                  <input value={configId} onChange={e=>setConfigId(e.target.value)} placeholder="Paste Configuration ID from Facebook Login for Business → Configurations" required/>
                </label>

                <div className="metaOptionalTitle">Optional IDs — leave blank for auto-detection</div>
                <label>Facebook Page ID
                  <input value={facebookPageId} onChange={e=>setFacebookPageId(e.target.value)} placeholder="Auto-detect after authorization"/>
                </label>
                <label>WhatsApp Business Account ID (WABA)
                  <input value={wabaId} onChange={e=>setWabaId(e.target.value)} placeholder="Auto-detect if WhatsApp Business access is granted"/>
                </label>
                <label>WhatsApp Phone Number ID
                  <input value={phoneNumberId} onChange={e=>setPhoneNumberId(e.target.value)} placeholder="Auto-detect from WABA"/>
                </label>

                <details className="advancedMeta">
                  <summary>Advanced WhatsApp fallback</summary>
                  <label>WhatsApp System User / Permanent Access Token
                    <input type="password" value={whatsappToken} onChange={e=>setWhatsappToken(e.target.value)} placeholder="Optional — use only if automatic WhatsApp authorization is unavailable"/>
                  </label>
                </details>

                <button className="primary wideBtn" type="submit">Save & Connect Meta</button>
                {msg&&<div className="saveMsg">{msg}</div>}
              </form>}

              {viewMode==="admin" && state?.metaConfigured && <div className="connectedSummary">
                <div className="connectedCheck">{fbSignedIn||ig||wa?"✓":"!"}</div>
                <div>
                  <strong>{fbSignedIn?"Facebook login saved on shared server":"Meta setup saved securely"}</strong>
                  <span>{fbSignedIn
                    ?"This login persists across computers. Publishing permission is checked separately and does not erase the saved login."
                    :"API credentials are hidden in Admin View. Connect Meta once to save the account session."}</span>
                </div>
              </div>}

              {state?.metaConfigured && <a className="loginBtn metaLogin" href="/api/oauth/facebook/start">{igHealth?.configured&&!igHealth?.connected?"Reconnect Meta & detect Instagram":fbReady?"Reconnect Meta securely":fbSignedIn?"Grant missing Facebook publishing permission":"Connect Meta securely"}</a>}
              <button className="secondaryBtn" onClick={refresh}>Refresh connection status</button>
            </article>

            {viewMode==="tech" && <aside className="setupHelpCard">
              <span className="eyebrow">MANUAL META SETUP</span>
              <h3>Do these once in Meta Developers</h3>
              <div className="steps">
                <div><b>1</b><span>Create/select one Meta Business app.</span></div>
                <div><b>2</b><span>Add Facebook Login / Facebook Login for Business and WhatsApp products. Instagram connects separately through Instagram Login.</span></div>
                <div><b>3</b><span>Register callback URL:<small>{typeof window!=="undefined"?window.location.origin+"/api/oauth/facebook/callback":""}</small></span></div>
                <div><b>4</b><span>Enable the required permissions, then return here and click Save & Connect Meta.</span></div>
              </div>

              <div className="metaPerms">
                <strong>Add these permissions inside the Meta Business Login configuration</strong>
                <span>pages_show_list</span>
                <span>pages_read_engagement</span>
                <span>pages_manage_posts</span>
                <span>business_management</span>
                <span>whatsapp_business_management</span>
                <span>whatsapp_business_messaging</span>
              </div>
            </aside>}
          </section>
        </main>
      </section>
    </div>
  );
}
