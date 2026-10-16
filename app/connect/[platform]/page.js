"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { isEnabledProvider } from "../../lib/social-providers";

const OFFICIAL = {
  LinkedIn: "https://www.linkedin.com/login",
  Facebook: "https://www.facebook.com/login",
  Instagram: "https://www.instagram.com/accounts/login/",
  YouTube: "https://accounts.google.com/ServiceLogin?service=youtube"
};

const FIELDS = {
  LinkedIn:{accountLabel:"Author URN (optional now)",accountPlaceholder:"urn:li:organization:123456789"},
  Facebook:{accountLabel:"Facebook Page ID",accountPlaceholder:"123456789012345"},
  Instagram:{accountLabel:"Instagram User ID (auto-detected after login)",accountPlaceholder:"Leave blank for automatic detection"},
  YouTube:{accountLabel:"YouTube Channel ID (optional)",accountPlaceholder:"UC..."}
};

const META = {
  LinkedIn: { color: "#0A66C2", icon: "in" },
  Facebook: { color: "#1877F2", icon: "f" },
  Instagram: { color: "#E1306C", icon: "◎" },
  YouTube: { color: "#FF0000", icon: "▶" }
};

export default function ConnectPlatform() {
  const params = useParams();
  const qs = useSearchParams();
  const platform = decodeURIComponent(String(params.platform || ""));
  useEffect(() => {
    if (!isEnabledProvider(platform)) {
      window.location.replace("/");
      return;
    }
    if (platform === "Facebook") {
      window.location.replace("/connect/Meta");
    }
  }, [platform]);
  const [state, setState] = useState(null);
  const [secureReady,setSecureReady]=useState(true);
  const [clientId,setClientId]=useState("");
  const [clientSecret,setClientSecret]=useState("");
  const [accountId,setAccountId]=useState("");
  const [saveMsg,setSaveMsg]=useState("");
  const [viewMode,setViewMode]=useState("admin");

  async function refresh() {
    const r = await fetch("/api/integrations/status", { cache: "no-store" });
    const j = await r.json();
    setState(j.integrations?.[platform] || null);
    setSecureReady(j.secureStorageReady !== false);
  }

  useEffect(() => { refresh(); }, [platform]);

  const meta = META[platform] || META.LinkedIn;
  const error = qs.get("error");
  const connected = state?.connected;
  const field=FIELDS[platform];

  async function saveApiSetup(e){
    e.preventDefault();
    setSaveMsg("Saving securely...");
    const normalizedAccountId = platform==="LinkedIn" && /^\d+$/.test(accountId.trim())
      ? `urn:li:organization:${accountId.trim()}`
      : accountId.trim();
    const r=await fetch("/api/integrations/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:platform.toLowerCase(),clientId,clientSecret,accountId:normalizedAccountId})});
    const j=await r.json().catch(()=>({}));
    if(j.ok){
      setClientSecret("");
      setSaveMsg("Saved. Opening secure authorization...");
      window.location.href=j.connectUrl || `/api/oauth/${platform.toLowerCase()}/start`;
      return;
    }else{
      setSaveMsg(j.error||"Unable to save API setup");
    }
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
        <div className="sideGroupLabel">OVERVIEW</div>
        <nav className="sideNav">
          <a className="sideLink" href="/"><span>⌂</span>Dashboard</a>
          <a className="sideLink active" href="/#connections"><span>◎</span>Connections</a>
        </nav>
        <div className="sideGroupLabel">SOCIAL</div>
        <nav className="sideNav secondary">
          <a className="sideLink active" href="/#connections"><span>↗</span>Social Networks</a>
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
            <div><span>SOCIAL NETWORKS</span><h1>Connect {platform}</h1><p>Authorize and manage this network inside the NUNES Social Studio.</p></div>
            <span className={connected ? "pill ok" : "pill"}>{connected ? "CONNECTED" : "NOT CONNECTED"}</span>
          </div>

          <section className="connectDashboardGrid">
            <article className="connectCard dashboardConnectCard">
              <div className="brandBubble" style={{ background: meta.color }}>{meta.icon}</div>
              <h2>{platform} connection</h2>
              <p>{platform==="Instagram"
                ?"Connect the Instagram Professional account directly. This login is independent from the Facebook account."
                :"Use the official provider authorization so NUNES can publish approved posts directly."}</p>

              <div className="modeSwitch">
                <button className={viewMode==="admin"?"active":""} onClick={()=>setViewMode("admin")}>Admin View</button>
                <button className={viewMode==="tech"?"active":""} onClick={()=>setViewMode("tech")}>Tech View</button>
              </div>

              {connected && viewMode==="admin" && (
                <div className="connectedSummary">
                  <div className="connectedCheck">✓</div>
                  <div><strong>{platform} is connected</strong><span>NUNES can use this account from the shared server connection. API credentials are hidden in Admin View.</span></div>
                </div>
              )}

              {!connected && error === "app-not-configured" && (
                <div className="warning"><strong>API setup required</strong><span>Open Tech View, enter the provider credentials once, then authorize the account.</span></div>
              )}

              {viewMode==="tech" && (
                <form className="apiSetupForm" onSubmit={saveApiSetup}>
                  <h3>API Setup</h3>
                  <label>Client ID / App ID<input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Paste Client ID / App ID" required /></label>
                  <label>Client Secret / App Secret<input type="password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Paste Client Secret / App Secret" required /></label>
                  {field && <label>{field.accountLabel}<input value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder={field.accountPlaceholder} disabled={platform==="Instagram"} /></label>}
                  {platform==="Instagram"&&<div className="important"><strong>Separate Instagram login</strong><span>Use the Instagram App ID and App Secret from Meta Developers. The Instagram account does not need to be the same Facebook login used by NUNES.</span></div>}
                  <button className="primary wideBtn" type="submit">Save & Connect Now</button>
                  {saveMsg && <div className="saveMsg">{saveMsg}</div>}
                </form>
              )}

              {connected && viewMode==="admin" ? (
                <>
                  <a className="loginBtn" style={{ background: meta.color }} href={`/api/oauth/${platform.toLowerCase()}/start`}>Reconnect {platform}</a>
                  <a className="secondaryBtn wideBtn" href="/" >Back to Accounts Hub</a>
                  <button className="secondaryBtn" onClick={refresh}>Refresh status</button>
                </>
              ) : state?.configured ? (
                <a className="loginBtn" style={{ background: meta.color }} href={`/api/oauth/${platform.toLowerCase()}/start`}>
                  Reconnect securely with {platform}
                </a>
              ) : null}

              {(!connected || viewMode==="tech") && <>
                <a className="secondaryBtn wideBtn" href={OFFICIAL[platform]} target="_blank" rel="noreferrer">Open official {platform} login</a>
                <button className="secondaryBtn" onClick={refresh}>Refresh connection status</button>
              </>}
            </article>

            {viewMode==="tech" && <aside className="setupHelpCard">
              <span className="eyebrow">SETUP CHECKLIST</span>
              <h3>Connect in four steps</h3>
              <div className="steps">
                <div><b>1</b><span>Create the provider developer app once.</span></div>
                <div><b>2</b><span>Paste Client ID/Secret in API Setup.</span></div>
                <div><b>3</b><span>Register this callback URL:<small>{typeof window!=="undefined" ? `${window.location.origin}/api/oauth/${platform.toLowerCase()}/callback` : ""}</small></span></div>
                <div><b>4</b><span>Click Connect securely and approve access.</span></div>
              </div>
            </aside>}
          </section>
        </main>
      </section>
    </div>
  );
}
