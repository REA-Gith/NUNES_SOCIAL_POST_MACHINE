"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PLATFORMS = [
  ["LinkedIn","in","80–140 words","Professional, conversational"],
  ["Facebook","f","60–120 words","Friendly, practical"],
  ["Instagram","◎","45–90 words","Visual, energetic"],
  ["YouTube","▶","40–100 words","Clear, searchable"]
];

const ACTIVE_SOCIAL_COUNT = 5;

const PLATFORM_META = {
  LinkedIn:{note:"B2B authority & decision-makers",purpose:"Professional credibility, industry insights, product expertise and lead generation.",template:"Hook → business problem → expert insight → proof/value → CTA",caps:["Text","Image","Link"]},
  Facebook:{note:"Community & customer trust",purpose:"Company updates, offers, service stories, products and broad customer engagement.",template:"Friendly opener → benefit → practical details → CTA",caps:["Text","Image","Video"]},
  Instagram:{note:"Visual brand & product discovery",purpose:"Product visuals, reels, applications and brand awareness.",template:"Visual hook → short benefit → application → CTA → hashtags",caps:["Image","Reel","Caption"]},
  YouTube:{note:"Deep education & demos",purpose:"Product demonstrations, tutorials, comparisons and searchable technical education.",template:"Search title → problem → demo/explanation → takeaway → CTA",caps:["Video"]}
};

const ANGLES = ["AUTO — Choose Best Angle","Educational","Problem / Solution","Industry Insight","Behind the Scenes","Product Spotlight","Buyer Question","How-To","Common Mistake","Quick Tip","New Arrival","Customer Problem","Comparison","FAQ","Company Update"];

function chooseAngle(topic){
  const t=topic.toLowerCase();
  if(/how|guide|choose|select/.test(t)) return "How-To";
  if(/mistake|avoid|wrong/.test(t)) return "Common Mistake";
  if(/new|launch|arrival/.test(t)) return "New Arrival";
  if(/problem|issue|why/.test(t)) return "Problem / Solution";
  return "Educational";
}

function buildVariants(topic,brief,angle,cta){
  const resolved=angle===ANGLES[0]?chooseAngle(topic):angle;
  const intro=resolved==="How-To"
    ? `A simple way to approach ${topic} is to start with the actual application before comparing models or prices.`
    : resolved==="Common Mistake"
    ? `A common mistake with ${topic} is deciding too early, before the real requirement is clear.`
    : resolved==="Problem / Solution"
    ? `If ${topic} is creating confusion or delay, simplify the requirement first and then compare the available options.`
    : `Here is a practical way to think about ${topic}.`;
  const body=brief||"Define the application, required result, working conditions, quantity and location first. That makes the recommendation clearer and avoids choosing something that does not fit the actual job.";
  const action=cta||"Send us your requirement, quantity and location and our team will help with the next step.";
  return {
    LinkedIn:`${intro}\n\n${body}\n\nGood selection is not only about a model number. It is about matching the instrument or solution to the real application and checking the relevant specification before purchase.\n\n${action}\n\n#NunesInstruments #Instrumentation #IndustrialSolutions`,
    Facebook:`${intro}\n\n${body}\n\n${action} We will keep the recommendation practical and based on what you actually need.\n\n#NunesInstruments`,
    Instagram:`${intro}\n\n${body}\n\nNeed help choosing? Send us your requirement.\n\n#NunesInstruments #Instrumentation #TestingEquipment #IndustrialTools #Laboratory #Engineering`,
    YouTube:`${topic} — practical buyer guidance from Nunes Instruments.\n\n${body}\n\n${action} Subscribe for more instrumentation, testing and laboratory equipment guidance.`
  };
}

export default function Home(){
  const [tab,setTab]=useState("Dashboard");
  const [topic,setTopic]=useState("");
  const [brief,setBrief]=useState("");
  const [cta,setCta]=useState("");
  const [angle,setAngle]=useState(ANGLES[0]);
  const [mediaUrl,setMediaUrl]=useState("");
  const [selected,setSelected]=useState(PLATFORMS.map(x=>x[0]));
  const [drafts,setDrafts]=useState({});
  const [connections,setConnections]=useState({});
  const [accountHub,setAccountHub]=useState({});
  const [hubAccount,setHubAccount]=useState("Facebook");
  const [results,setResults]=useState([]);
  const [savedResults,setSavedResults]=useState([]);
  const [resultsError,setResultsError]=useState("");
  const [resultsLoading,setResultsLoading]=useState(false);
  const [search,setSearch]=useState("");
  const [timeframe,setTimeframe]=useState("7 Days");
  const [attachments,setAttachments]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [uploadError,setUploadError]=useState("");
  const [appMode,setAppMode]=useState("admin");
  const fileInputRef=useRef(null);
  const imageInputRef=useRef(null);
  const publishInFlightRef=useRef(false);
  const [publishing,setPublishing]=useState(false);
  const [publishBatchId,setPublishBatchId]=useState(null);
  const [automation,setAutomation]=useState({instagramConnected:false,accountName:"",schedules:[]});
  const [autoCaption,setAutoCaption]=useState("");
  const [autoMediaUrl,setAutoMediaUrl]=useState("");
  const [autoScheduledAt,setAutoScheduledAt]=useState("");
  const [autoMessage,setAutoMessage]=useState("");
  const [autoBusy,setAutoBusy]=useState(false);

  async function refreshConnections(){
    try{
      const r=await fetch("/api/integrations/status",{cache:"no-store"});
      const j=await r.json();
      setConnections(j.integrations||{});
    }catch{}
  }
  async function refreshAccountHub(){
    try{
      const r=await fetch("/api/accounts/hub",{cache:"no-store"});
      const j=await r.json();
      if(r.ok && j?.accounts) setAccountHub(j.accounts);
    }catch{}
  }
  async function refreshAutomation(){
    try{
      const r=await fetch("/api/automation/schedule",{cache:"no-store"});
      const j=await r.json();
      if(r.ok&&j.ok) setAutomation({instagramConnected:Boolean(j.instagramConnected),accountName:j.accountName||"",schedules:Array.isArray(j.schedules)?j.schedules:[]});
    }catch(e){console.warn("[AUTO POST UI] refresh failed",e?.message||e);}
  }

  async function saveInstagramSchedule(){
    setAutoBusy(true);setAutoMessage("");
    try{
      const r=await fetch("/api/automation/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add",caption:autoCaption,mediaUrl:autoMediaUrl,scheduledAt:autoScheduledAt})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.ok) throw new Error(j.error||"Unable to schedule Instagram post.");
      setAutoCaption("");setAutoMediaUrl("");setAutoScheduledAt("");
      setAutoMessage("Instagram post scheduled.");
      await refreshAutomation();
    }catch(e){setAutoMessage(e.message||"Unable to schedule Instagram post.");}
    finally{setAutoBusy(false);}
  }

  async function updateInstagramSchedule(action,id,enabled){
    setAutoBusy(true);setAutoMessage("");
    try{
      const r=await fetch("/api/automation/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,id,enabled})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.ok) throw new Error(j.error||"Unable to update schedule.");
      await refreshAutomation();
    }catch(e){setAutoMessage(e.message||"Unable to update schedule.");}
    finally{setAutoBusy(false);}
  }

  async function refreshPublishingHistory(){
    setResultsLoading(true);
    try {
      const r=await fetch("/api/publishing-history",{cache:"no-store"});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||"Publishing history unavailable");
      setSavedResults(j.posts||[]);setResultsError("");
    }catch(e){setResultsError(e.message||"Could not load publishing history");}
    finally{setResultsLoading(false);}
  }
  useEffect(()=>{refreshConnections();refreshAccountHub();refreshPublishingHistory();refreshAutomation()},[]);

  const connectedCount=useMemo(()=>PLATFORMS.filter(p=>connections[p[0]]?.connected).length + (connections.WhatsApp?.connected?1:0),[connections]);
  const readyCount=useMemo(()=>PLATFORMS.filter(p=>connections[p[0]]?.configured).length + (connections.WhatsApp?.configured?1:0),[connections]);
  const successfulPosts=results.filter(r=>r.status==="POSTED").length;
  const scheduledInstagram=automation.schedules.filter(x=>x.status==="SCHEDULED"&&x.enabled!==false).length;
  const publishedLast7Days=savedResults.filter(p=>p?.external?.status==="POSTED" && Date.parse(p.publishedAt||0)>=Date.now()-7*24*60*60*1000).length;

  function runSearch(){
    const q=search.trim().toLowerCase();
    if(!q) return;
    if(q.includes("whatsapp")) { window.location.href="/whatsapp"; return; }
    const platform=PLATFORMS.find(([name])=>name.toLowerCase().includes(q));
    if(platform){
      window.location.href=`/connect/${encodeURIComponent(platform[0])}`;
      return;
    }
    if(q.includes("connect")||q.includes("network")) return setTab("Connections");
    if(q.includes("result")||q.includes("history")) return setTab("Results");
    if(q.includes("preview")||q.includes("publish")) return setTab("Preview");
    if(q.includes("create")||q.includes("post")||q.includes("content")) return setTab("Create Post");
    setTab("Dashboard");
  }

  function formatFileSize(bytes){
    if(bytes < 1024) return bytes+" B";
    if(bytes < 1024*1024) return (bytes/1024).toFixed(1)+" KB";
    return (bytes/(1024*1024)).toFixed(1)+" MB";
  }

  async function uploadFiles(fileList){
    const files=Array.from(fileList||[]);
    if(!files.length) return;
    setUploading(true);
    setUploadError("");
    try{
      for(const file of files){
        const form=new FormData();
        form.set("file",file,file.name||"pasted-file");
        const r=await fetch("/api/upload",{method:"POST",body:form});
        const j=await r.json().catch(()=>({}));
        if(!r.ok || !j.ok) throw new Error(j.error||`Upload failed: ${file.name}`);
        const uploaded=j.file;
        setAttachments(prev=>[...prev,uploaded]);
        if(!mediaUrl && /^image\//.test(uploaded.type||"") || (!mediaUrl && /^video\//.test(uploaded.type||""))){
          setMediaUrl(uploaded.url);
        }
      }
    }catch(e){
      setUploadError(e.message||"Upload failed");
    }finally{
      setUploading(false);
    }
  }

  function handlePaste(e){
    const files=Array.from(e.clipboardData?.files||[]);
    if(files.length){
      e.preventDefault();
      uploadFiles(files);
    }
  }

  function removeAttachment(index){
    setAttachments(prev=>{
      const removed=prev[index];
      const next=prev.filter((_,i)=>i!==index);
      if(removed?.url===mediaUrl){
        const nextMedia=next.find(x=>/^image\//.test(x.type||"")||/^video\//.test(x.type||""));
        setMediaUrl(nextMedia?.url||"");
      }
      return next;
    });
  }

  function shareWhatsApp(){
    const message=[
      topic || "Nunes Instruments",
      brief,
      cta
    ].filter(Boolean).join("\n\n");
    if(!message.trim()) return alert("Add a topic or message first.");
    window.open("https://wa.me/?text="+encodeURIComponent(message),"_blank","noopener,noreferrer");
  }

  function generate(){
    if(!topic.trim()) return alert("Add a post topic first.");
    const all=buildVariants(topic.trim(),brief.trim(),angle,cta.trim());
    const out={}; selected.forEach(p=>out[p]=all[p]); setDrafts(out); setPublishBatchId(null); setTab("Preview");
  }

  async function postEverywhere(){
    if(publishInFlightRef.current) return;
    publishInFlightRef.current=true;
    setPublishing(true);
    const batchId=publishBatchId||crypto.randomUUID();
    setPublishBatchId(batchId);
    const rr=[];
    try {
    for(const platform of [...new Set(selected)]){
      if(!drafts[platform]) continue;
      try{
        const r=await fetch("/api/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,channel:platform,text:drafts[platform],mediaUrl,angle,attachments,idempotencyKey:`${batchId}:${platform.toLowerCase()}`})});
        const j=await r.json();
        rr.push({id:j.post?.id||`${batchId}:${platform}`,platform,topic,text:drafts[platform],mediaUrl,attachments,publishedAt:j.post?.publishedAt||new Date().toISOString(),status:j.external?.status||(j.ok?"ARCHIVED":"FAILED"),error:j.external?.error||j.error||null,technicalError:j.external?.technicalError||null,action:j.external?.action||null,externalId:j.external?.externalId||null,url:j.post?.url||j.external?.permalink||"",saved:j.post?.savedPreview===true,deliveryVerified:j.post?.deliveryVerified===true});
      }catch(e){rr.push({id:`${batchId}:${platform}`,platform,topic,text:drafts[platform],mediaUrl,attachments,publishedAt:new Date().toISOString(),status:"FAILED",error:e?.message||"Network error"})}
    }
    setResults(rr); await Promise.all([refreshPublishingHistory(),refreshAccountHub()]); setTab("Results");
    } finally { publishInFlightRef.current=false; setPublishing(false); }
  }

  const nav=[
    ["Dashboard","⌂"],["Accounts Hub","◉"],["Create Post","＋"],["Auto Posting","⏱"],["Connections","◎"],["Preview","▣"],["Results","✓"]
  ];

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark">N</div><div><strong>NUNES</strong><span>Social Studio</span></div></div>
        <div className="sideGroupLabel">OVERVIEW</div>
        <nav className="sideNav">
          {nav.map(([name,icon])=><button key={name} onClick={()=>setTab(name)} className={tab===name?"active":""}><span>{icon}</span>{name}</button>)}
        </nav>

        <div className="sideGroupLabel">SOCIAL</div>
        <nav className="sideNav secondary">
          <button onClick={()=>{setTab("Accounts Hub");refreshAccountHub()}}><span>◎</span>Accounts Hub</button>
          <button onClick={()=>setTab("Connections")}><span>↗</span>Social Networks</button>
          <button onClick={()=>setTab("Create Post")}><span>▤</span>Content</button>
          <button onClick={()=>setTab("Preview")}><span>➤</span>Publishing</button>\n          <button onClick={()=>{setTab("Auto Posting");refreshAutomation()}}><span>⏱</span>Auto Posting</button>
          <button onClick={()=>setTab("Dashboard")}><span>⌁</span>Analytics</button>
        </nav>

        <div className="sidebarBottom">
          <button onClick={()=>setTab("Connections")}>⚙ Settings</button>
          <div className="userCard"><div className="avatar">NI</div><div><strong>Nunes Instruments</strong><span>Admin</span></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspaceTop">
          <div className="searchBox">⌕<input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runSearch()}} placeholder="Search anything..."/></div>
          <div className="topActions">
            <div className="modeSwitch globalMode">
              <button className={appMode==="admin"?"active":""} onClick={()=>setAppMode("admin")}>Admin</button>
              <button className={appMode==="tech"?"active":""} onClick={()=>setAppMode("tech")}>Tech</button>
            </div>
            <button className="quickCreate" onClick={()=>setTab("Create Post")}>＋ Quick Create</button>
            <button className="iconBtn" title="Publishing results" onClick={()=>setTab("Results")}>✓</button>
            <button className="iconBtn" title="Social connections" onClick={()=>setTab("Connections")}>◎</button>
            <div className="miniAvatar">NI</div>
          </div>
        </header>

        <main className="contentArea">
          {tab==="Dashboard" && (
            <>
              <div className="welcomeRow">
                <div><h1>Good morning 👋</h1><p>Here’s what’s happening across your social publishing workspace today.</p></div>
                <div className="filters"><button onClick={()=>setTab("Connections")}>Account: Nunes Instruments</button><button onClick={()=>setTimeframe(v=>v==="7 Days"?"30 Days":v==="30 Days"?"90 Days":"7 Days")}>Timeframe: {timeframe}</button></div>
              </div>

              <section className="executiveHero">
                <div className="executiveHeroCopy">
                  <span className="eyebrow">NUNES SOCIAL COMMAND CENTER</span>
                  <h2>Publish smarter. Keep every channel under control.</h2>
                  <p>One professional workspace for account health, content publishing, Instagram automation and verified delivery history.</p>
                  <div className="heroActions">
                    <button className="primary" onClick={()=>setTab("Create Post")}>＋ Create Post</button>
                    <button className="secondaryBtn" onClick={()=>{setTab("Auto Posting");refreshAutomation()}}>⏱ Instagram Auto Posting</button>
                  </div>
                </div>
                <div className="instagramLaunchCard">
                  <div className="igLaunchIcon">◎</div>
                  <div>
                    <span>INSTAGRAM AUTOMATION</span>
                    <strong>{automation.instagramConnected?"Ready":"Needs connection"}</strong>
                    <small>{automation.instagramConnected?(automation.accountName?"@"+automation.accountName:"Verified Professional account"):"Connect Instagram to enable scheduled auto-posting."}</small>
                  </div>
                  <button onClick={()=>automation.instagramConnected?setTab("Auto Posting"):window.location.href="/connect/Meta"}>{automation.instagramConnected?"Open Scheduler":"Connect Instagram"}</button>
                </div>
              </section>

              <section className="metricGrid premiumMetrics">
                <div className="metricCard"><span>CONNECTED NETWORKS</span><strong>{connectedCount} of {ACTIVE_SOCIAL_COUNT}</strong><small>{readyCount} configured</small></div>
                <div className="metricCard"><span>POSTS READY</span><strong>{Object.keys(drafts).length}</strong><small>{selected.length} selected</small></div>
                <div className="metricCard"><span>PUBLISHED 7 DAYS</span><strong>{publishedLast7Days}</strong><small>Saved publishing history</small></div>
                <div className="metricCard"><span>INSTAGRAM QUEUE</span><strong>{scheduledInstagram}</strong><small>{automation.instagramConnected?"Autopilot ready":"Connection required"}</small></div>
              </section>

              <section className="networkCards">
                {["LinkedIn","Facebook","Instagram","YouTube","WhatsApp"].map(name=>{
                  const p=PLATFORMS.find(x=>x[0]===name);
                  return <button key={name} className="networkCard" onClick={()=>{window.location.href=name==="WhatsApp"?"/whatsapp":(name==="Facebook"||name==="Instagram")?"/connect/Meta":`/connect/${encodeURIComponent(name)}`}}>
                    <div className="networkHead"><span className="miniPlatform">{name==="WhatsApp"?"WA":p?.[1]}</span><strong>{name}</strong><em className={connections[name]?.connected?"good":"mutedDot"}>{connections[name]?.connected?"Connected":"Setup"}</em></div>
                    <div className="networkValue">{connections[name]?.connected?"Ready":"—"}</div>
                    <svg viewBox="0 0 120 32" aria-hidden="true"><polyline points="0,26 15,23 28,25 42,17 58,19 72,12 88,14 103,8 120,5" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                  </button>
                })}
              </section>

              <section className="analyticsPanel">
                <div className="panelTitle"><div><h2>Audience Growth</h2><p>Follower progress across connected channels</p></div><div className="segment"><button className="active" onClick={()=>setTab("Connections")}>All Networks</button><button className={timeframe==="7 Days"?"active":""} onClick={()=>setTimeframe("7 Days")}>7 Days</button><button className={timeframe==="30 Days"?"active":""} onClick={()=>setTimeframe("30 Days")}>30 Days</button></div></div>
                <div className="analyticsStats"><div><span>Total Networks</span><strong>{connectedCount}</strong></div><div><span>Configured</span><strong>{readyCount}</strong></div><div><span>Selected</span><strong>{selected.length}</strong></div><div><span>Success Rate</span><strong>{results.length?Math.round(successfulPosts/results.length*100):0}%</strong></div></div>
                <div className="chartWrap"><svg viewBox="0 0 900 240" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#16a9df" stopOpacity=".22"/><stop offset="100%" stopColor="#16a9df" stopOpacity="0"/></linearGradient></defs><path d="M0 205 L90 185 L170 198 L255 160 L350 142 L435 165 L520 112 L610 120 L700 90 L795 72 L900 30 L900 240 L0 240 Z" fill="url(#fill)"/><polyline points="0,205 90,185 170,198 255,160 350,142 435,165 520,112 610,120 700,90 795,72 900,30" fill="none" stroke="#16a9df" strokeWidth="4"/></svg></div>
              </section>

              <section className="engagementPanel">
                <div className="panelTitle"><div><h2>Publishing Overview</h2><p>Current workflow health and account readiness</p></div><button className="moreBtn" onClick={()=>setTab("Results")}>•••</button></div>
                <div className="overviewStats"><div><span>Connected</span><strong>{connectedCount}</strong></div><div><span>Configured</span><strong>{readyCount}</strong></div><div><span>Drafts</span><strong>{Object.keys(drafts).length}</strong></div><div><span>Selected</span><strong>{selected.length}</strong></div><div><span>Results</span><strong>{results.length}</strong></div></div>
                <div className="distribution"><span style={{width:`${Math.max(10,connectedCount/ACTIVE_SOCIAL_COUNT*100)}%`}}>Connected</span><span style={{width:`${Math.max(10,(ACTIVE_SOCIAL_COUNT-connectedCount)/ACTIVE_SOCIAL_COUNT*100)}%`}}>Pending</span></div>
              </section>
            </>
          )}

          {tab==="Create Post" && (
            <>
              <div className="pageHeading"><div><span>CONTENT</span><h1>Create a new post</h1><p>Build one idea and adapt it for every selected network.</p></div><button className="primary" onClick={generate}>Generate Posts</button></div>
              <section className="grid two">
                <article className="panel"><h3>Post brief</h3>
                  <label>Post topic / idea<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Example: How to choose the right measuring instrument"/></label>
                  <label>Key message / context<textarea value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Add facts, offer, application, event or message."/></label>
                  <label>Content angle<select value={angle} onChange={e=>setAngle(e.target.value)}>{ANGLES.map(x=><option key={x}>{x}</option>)}</select></label>
                  <label>CTA<input value={cta} onChange={e=>setCta(e.target.value)} placeholder="Example: Send us your application and quantity"/></label>

                  <div className="attachmentManager">
                    <div className="attachmentHead">
                      <div><strong>Images & files</strong><span>Paste an image, drag files here, or upload Excel/PDF/Word/ZIP and other files.</span></div>
                      <span>{attachments.length} attached</span>
                    </div>

                    <div
                      className={`pasteDropZone ${uploading?"uploading":""}`}
                      tabIndex="0"
                      onPaste={handlePaste}
                      onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("dragging")}}
                      onDragLeave={e=>e.currentTarget.classList.remove("dragging")}
                      onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("dragging");uploadFiles(e.dataTransfer.files)}}
                    >
                      <div className="dropIcon">＋</div>
                      <div>
                        <strong>{uploading?"Uploading...":"Paste or drop files here"}</strong>
                        <span>Ctrl+V for screenshots/images · Max 50 MB per file</span>
                      </div>
                      <div className="uploadActions">
                        <button type="button" onClick={()=>imageInputRef.current?.click()}>Upload Image</button>
                        <button type="button" onClick={()=>fileInputRef.current?.click()}>Upload File</button>
                      </div>
                      <input ref={imageInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={e=>{uploadFiles(e.target.files);e.target.value=""}}/>
                      <input ref={fileInputRef} type="file" multiple hidden onChange={e=>{uploadFiles(e.target.files);e.target.value=""}}/>
                    </div>

                    {uploadError && <div className="uploadError">{uploadError}</div>}

                    {attachments.length>0 && <div className="attachmentList">
                      {attachments.map((file,index)=>{
                        const isImage=/^image\//.test(file.type||"");
                        return <div className="attachmentItem" key={file.url+index}>
                          <div className="attachmentPreview">
                            {isImage?<img src={file.url} alt={file.name}/>:<span>{(file.name.split(".").pop()||"FILE").toUpperCase().slice(0,5)}</span>}
                          </div>
                          <div className="attachmentInfo">
                            <strong title={file.name}>{file.name}</strong>
                            <span>{formatFileSize(file.size||0)} · {file.type||"File"}</span>
                            <a href={file.url} target="_blank" rel="noreferrer">Open shared file</a>
                          </div>
                          <button type="button" className="removeAttachment" onClick={()=>removeAttachment(index)}>×</button>
                        </div>
                      })}
                    </div>}

                    <label className="advancedMediaUrl">Media URL (auto-filled for the first uploaded image/video)
                      <input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder="Public image/video URL"/>
                    </label>
                  </div>
                </article>
                <article className="panel socialPublishPanel">
                  <div className="panelHead">
                    <div><h3>Publish to</h3><p className="panelSub">Choose networks and see exactly what each one supports.</p></div>
                    <span>{selected.length}/4 selected</span>
                  </div>
                  <div className="platformGrid upgradedPlatformGrid">
                    {PLATFORMS.map(([name,icon])=>{
                      const meta=PLATFORM_META[name]||{note:"Social post",caps:["Post"]};
                      const connected=Boolean(connections[name]?.connected);
                      const isSelected=selected.includes(name);
                      return <div key={name} className={`platformCardPro ${isSelected?"selected":""}`}>
                        <button className="platformMainAction" onClick={()=>setSelected(s=>s.includes(name)?s.filter(x=>x!==name):[...s,name])}>
                          <span className={`platformIcon brand-${name.toLowerCase()}`}>{icon}</span>
                          <span className="platformText">
                            <strong>{name}</strong>
                            <small>{meta.note}</small>
                          </span>
                          <span className={connected?"statusDot connected":"statusDot"}>{connected?"Connected":"Not connected"}</span>
                        </button>
                        <div className="platformPurpose">
                          <strong>Purpose</strong><span>{meta.purpose}</span>
                          <strong>Template</strong><span>{meta.template}</span>
                        </div>
                        <div className="capRow">{meta.caps.map(cap=><span key={cap}>{cap}</span>)}</div>
                        <div className="platformFooter">
                          <button className="selectBtn" onClick={()=>setSelected(s=>s.includes(name)?s.filter(x=>x!==name):[...s,name])}>{isSelected?"Selected ✓":"Select"}</button>
                          {!connected && <a href={(name==="Facebook"||name==="Instagram")?"/connect/Meta":`/connect/${encodeURIComponent(name)}`}>Connect</a>}
                        </div>
                      </div>
                    })}
                  </div>

                  <div className="whatsappQuickShare">
                    <div className="whatsappBadge">WA</div>
                    <div><strong>WhatsApp Business Hub</strong><span>Manage multiple NUNES WhatsApp numbers separately from normal social publishing.</span></div>
                    <button onClick={()=>{window.location.href="/whatsapp"}}>Manage WhatsApp</button>
                  </div>
                </article>
              </section>
            </>
          )}

          {tab==="Preview" && (
            <>
              <div className="pageHeading"><div><span>PUBLISHING</span><h1>Preview & edit</h1><p>Review each platform version before publishing.</p></div><button className="primary" onClick={postEverywhere} disabled={publishing}>{publishing?"Publishing…":"Post Everywhere"}</button></div>
              <section className="grid two">{selected.map(name=>{const p=PLATFORMS.find(x=>x[0]===name);const postText=drafts[name]||"";const media=attachments.find(x=>/^image\/|^video\//.test(x.type||""))||{};const url=mediaUrl||media.url||"";const isVideo=/\.(mp4|webm|mov)(\?|$)/i.test(url)||/^video\//.test(media.type||"");return <article className="panel" key={name}>
                <div className="panelHead"><h3>{name} post preview</h3><span>{p?.[2]}</span></div>
                <small>{p?.[3]}</small>
                <div style={{border:"1px solid var(--border, #d8dee7)",borderRadius:14,overflow:"hidden",background:"#fff",color:"#192333",margin:"16px 0",maxWidth:name==="Instagram"?440:680,marginInline:"auto"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:14}}>
                    <div style={{width:42,height:42,borderRadius:"50%",background:name==="LinkedIn"?"#0a66c2":name==="Facebook"?"#1877f2":name==="Instagram"?"#b23abe":"#e21b1b",color:"#fff",display:"grid",placeItems:"center",fontWeight:700}}>{p?.[1]}</div>
                    <div><strong style={{display:"block"}}>Nunes Instrumentation</strong><span style={{fontSize:12,color:"#677185"}}>{name} · Preview only · Not published</span></div>
                  </div>
                  {name!=="Instagram"&&<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:"0 14px",fontSize:14,lineHeight:1.6}}>{postText||"Your caption will appear here."}</p>}
                  {url?(isVideo?<video controls preload="metadata" src={url} style={{display:"block",width:"100%",maxHeight:490,background:"#111"}}/>:<img src={url} alt="Post media preview" style={{display:"block",width:"100%",maxHeight:name==="Instagram"?520:420,objectFit:"contain",background:"#f3f4f6"}}/>):<div style={{padding:"36px 16px",textAlign:"center",background:"#f4f6f9",color:"#758195"}}>No media attached — text-only preview</div>}
                  {name==="Instagram"&&<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:"12px 14px",fontSize:14,lineHeight:1.6}}>{postText||"Your Instagram caption will appear here."}</p>}
                  <div style={{padding:"12px 14px",borderTop:"1px solid #e5e7eb",fontSize:12,color:"#6b7280"}}>{name==="YouTube"?"YouTube requires a video upload to publish.":name==="Instagram"?"Instagram typically requires an image or video to publish.":"Visual preview; actual provider layout may vary."}</div>
                </div>
                <label style={{display:"block",fontWeight:600,marginBottom:8}}>Edit {name} caption</label>
                <textarea className="postEditor" value={postText} onChange={e=>{setDrafts(d=>({...d,[name]:e.target.value}));setPublishBatchId(null)}}/>
                <small>{postText.length} characters · Updates the preview as you type</small>
              </article>})}</section>
            </>
          )}

          {tab==="Accounts Hub" && (
            <>
              <div className="pageHeading">
                <div><span>ACCOUNT MANAGEMENT</span><h1>Accounts Hub</h1><p>Access LinkedIn, Facebook, Instagram and WhatsApp from one system.</p></div>
                <button onClick={refreshAccountHub}>Refresh accounts</button>
              </div>

              <section className="accountHubCards">
                {["LinkedIn","Facebook","Instagram","YouTube","WhatsApp"].map(name=>{
                  const a=accountHub[name]||{};
                  const icon=name==="LinkedIn"?"in":name==="Facebook"?"f":name==="Instagram"?"◎":name==="YouTube"?"▶":"WA";
                  const cls=name==="LinkedIn"?"li":name==="Facebook"?"fb":name==="Instagram"?"ig":name==="YouTube"?"yt":"wa";
                  return <button key={name} className={"accountHubCard "+(hubAccount===name?"selected":"")} onClick={()=>setHubAccount(name)}>
                    <div className={"accountHubIcon "+cls}>{icon}</div>
                    <div><strong>{name}</strong><span>{name==="WhatsApp"?`${a.numberCount||0} Numbers Connected`:(a.name||a.phone||"Nunes account")}</span></div>
                    <em className={a.connected?"good":"pending"}>{a.connected?"Connected & saved":"Not connected"}</em>
                  </button>
                })}
              </section>

              {(()=>{
                const a=accountHub[hubAccount]||{};
                const caps=a.capabilities||(
                  hubAccount==="WhatsApp"
                    ? ["Messages","Templates","Settings","Permissions"]
                    : ["Content","Ads","Insights","Messages","Comments","Settings","Permissions"]
                );
                const official=hubAccount==="LinkedIn"
                  ?"https://www.linkedin.com/"
                  : hubAccount==="YouTube"
                    ?"https://studio.youtube.com/"
                    : hubAccount==="WhatsApp"
                      ?"https://business.facebook.com/wa/manage/home"
                      :"https://business.facebook.com/latest/home";
                const connect=hubAccount==="WhatsApp"
                  ?"/whatsapp"
                  :(hubAccount==="Facebook"||hubAccount==="Instagram")
                    ?"/connect/Meta"
                    :hubAccount==="YouTube"
                      ?"/connect/YouTube"
                      :"/connect/LinkedIn";
                return <section className="accountHubLayout">
                  <article className="panel accountManagerPanel">
                    <div className="panelHead">
                      <div><h2>{hubAccount}</h2><p>{a.name||a.phone||"Account management"}</p></div>
                      <span className={a.connected?"pill ok":"pill"}>{a.connected?"SIGNED IN & SAVED":"NOT CONNECTED"}</span>
                    </div>

                    <div className="accountIdentity">
                      <div className={"accountHubIcon large "+(hubAccount==="LinkedIn"?"li":hubAccount==="Facebook"?"fb":hubAccount==="Instagram"?"ig":hubAccount==="YouTube"?"yt":"wa")}>
                        {hubAccount==="LinkedIn"?"in":hubAccount==="Facebook"?"f":hubAccount==="Instagram"?"◎":hubAccount==="YouTube"?"▶":"WA"}
                      </div>
                      <div>
                        <strong>{a.name||hubAccount}</strong>
                        {a.phone&&<span>{a.phone}</span>}
                        {a.accountId&&<small>ID: {a.accountId}</small>}
                      </div>
                      <a className="secondaryBtn" href={connect}>{a.connected?"Connection settings":"Connect account"}</a>
                    </div>

                    <div className="managementGrid">
                      {caps.map(cap=><div className="managementTile" key={cap}>
                        <strong>{cap}</strong>
                        <span>{cap==="Content"?"Create and publish account content":
                               cap==="Ads"?"Access advertising tools":
                               cap==="Insights"?"Review account performance":
                               cap==="Messages"?"Access business messaging":
                               cap==="Comments"?"Manage engagement and replies":
                               cap==="Templates"?"Manage WhatsApp templates":
                               cap==="Permissions"?"Review business/account access":
                               "Manage account settings"}</span>
                      </div>)}
                    </div>

                    <div className="accountActions">
                      <button className="primary" onClick={()=>setTab("Create Post")}>Create / Publish Content</button>
                      <a className="secondaryBtn" href={official} target="_blank" rel="noreferrer">Open official account manager ↗</a>
                    </div>
                  </article>

                  <article className="panel accountFeedPanel">
                    <div className="panelHead">
                      <div><h2>{hubAccount==="WhatsApp"?"Recent activity":"Recent posts"}</h2><p>Live provider posts when available, otherwise shared NUNES publishing history.</p></div>
                      <span>{a.recent?.length||0} items</span>
                    </div>
                    <div className="accountFeed">
                      {(a.recent||[]).length===0
                        ? <div className="empty">{hubAccount==="Instagram"&&!a.connected
                            ?"Connect the Instagram Professional account to load its posts here."
                            : "No recent items available yet."}</div>
                        : a.recent.map((p,i)=><div className="accountPost" key={p.id||i}>
                            {p.mediaUrl&&<img src={p.mediaUrl} alt="" loading="lazy"/>}
                            <div>
                              <strong>{p.topic||p.source||hubAccount}</strong>
                              <p>{p.text||"Published media"}</p>
                              <span>{p.createdAt||p.publishedAt?new Date(p.createdAt||p.publishedAt).toLocaleString():"Recently"}</span>
                              {p.external?.status&&<em>{p.external.status}</em>}
                              {p.url&&<a href={p.url} target="_blank" rel="noreferrer">Open post ↗</a>}
                            </div>
                          </div>)}
                    </div>
                  </article>
                </section>
              })()}
            </>
          )}

          {tab==="Auto Posting" && (
            <>
              <div className="pageHeading">
                <div><span>AUTOMATION</span><h1>Instagram Auto Posting</h1><p>Schedule approved Instagram content and let the production worker publish it automatically when the account is verified.</p></div>
                <button className="secondaryBtn" onClick={refreshAutomation}>Refresh</button>
              </div>

              <section className="automationStatusStrip">
                <div className={automation.instagramConnected?"autoStatus connected":"autoStatus"}>
                  <div className="igLaunchIcon">◎</div>
                  <div><span>Instagram</span><strong>{automation.instagramConnected?"Connected & automation ready":"Not connected"}</strong><small>{automation.accountName?"@"+automation.accountName:"Professional account required"}</small></div>
                </div>
                <div className="autoStatus"><span>Scheduled</span><strong>{scheduledInstagram}</strong><small>Waiting in shared queue</small></div>
                <div className="autoStatus"><span>Worker</span><strong>Daily 9:00 AM IST</strong><small>Vercel Hobby production cron</small></div>
              </section>

              {!automation.instagramConnected&&<div className="warning">
                <strong>Instagram connection required</strong>
                <span>Connect the verified Nunes Instrumentation Instagram Professional account before scheduling automatic posts.</span>
                <a className="secondaryBtn" href="/connect/Meta">Connect Instagram</a>
              </div>}

              <section className="grid two automationGrid">
                <article className="panel autoComposer">
                  <div className="panelHead"><div><h2>Schedule Instagram Post</h2><p>Use a public HTTPS image or video URL. The post publishes only after Instagram is verified.</p></div><span className={automation.instagramConnected?"pill ok":"pill"}>{automation.instagramConnected?"READY":"LOCKED"}</span></div>
                  <label>Caption<textarea value={autoCaption} onChange={e=>setAutoCaption(e.target.value)} placeholder="Write the final Instagram caption, CTA and hashtags."/></label>
                  <label>Image / Reel URL<input value={autoMediaUrl} onChange={e=>setAutoMediaUrl(e.target.value)} placeholder="https://..."/></label>
                  <label>Publish date & time<input type="datetime-local" value={autoScheduledAt} onChange={e=>setAutoScheduledAt(e.target.value)}/></label>
                  {autoMessage&&<div className={autoMessage.includes("scheduled")?"important":"warning"}><span>{autoMessage}</span></div>}
                  <button className="primary wideBtn" onClick={saveInstagramSchedule} disabled={autoBusy||!automation.instagramConnected}>{autoBusy?"Saving…":"Schedule Auto Post"}</button>
                </article>

                <article className="panel instagramPreviewCard">
                  <div className="panelHead"><div><h2>Instagram Preview</h2><p>Preview the scheduled content before it enters the queue.</p></div></div>
                  <div className="igMock">
                    <div className="igMockHead"><div className="igAvatar">NI</div><div><strong>nunesinstrumentation</strong><span>Nunes Instrumentation</span></div></div>
                    {autoMediaUrl?<img src={autoMediaUrl} alt="Instagram preview"/>:<div className="igMockMedia">Add a public image or Reel URL</div>}
                    <div className="igMockCaption">{autoCaption||"Your Instagram caption preview will appear here."}</div>
                  </div>
                </article>
              </section>

              <section className="panel scheduleQueue">
                <div className="panelHead"><div><h2>Auto-post Queue</h2><p>Shared across computers. Failed posts stay visible instead of being silently retried.</p></div><span>{automation.schedules.length} items</span></div>
                <div className="queueList">
                  {automation.schedules.length?automation.schedules.map(item=><div className="queueRow" key={item.id}>
                    <div className="queueThumb">{item.mediaUrl?<img src={item.mediaUrl} alt="" loading="lazy"/>:"◎"}</div>
                    <div className="queueInfo"><strong>{item.caption?.slice(0,90)||"Instagram post"}</strong><span>{item.scheduledAt?new Date(item.scheduledAt).toLocaleString():"No schedule time"}</span>{item.error&&<small>{item.error}</small>}</div>
                    <span className={item.status==="POSTED"?"pill ok":"pill"}>{item.status}</span>
                    {item.status==="SCHEDULED"&&<button className="secondaryBtn" onClick={()=>updateInstagramSchedule("toggle",item.id,item.enabled===false)}>{item.enabled===false?"Enable":"Pause"}</button>}
                    <button className="secondaryBtn dangerLite" onClick={()=>updateInstagramSchedule("remove",item.id)}>Remove</button>
                  </div>):<div className="empty">No scheduled Instagram posts yet.</div>}
                </div>
              </section>
            </>
          )}

          {tab==="Connections" && (
            <>
              <div className="pageHeading">
                <div><span>SOCIAL ACCOUNTS</span><h1>Manage social accounts</h1><p>Only the channels used by Nunes Instrumentation are shown here.</p></div>
                <button onClick={()=>{refreshConnections();refreshAccountHub()}}>Refresh</button>
              </div>
              <section className="activeSocialGrid">
                {["LinkedIn","Facebook","Instagram","YouTube"].map(name=>{
                  const p=PLATFORMS.find(x=>x[0]===name);
                  const meta=PLATFORM_META[name]||{};
                  const state=connections[name]||{};
                  const href=(name==="Facebook"||name==="Instagram")?"/connect/Meta":`/connect/${encodeURIComponent(name)}`;
                  return <article className="activeSocialCard" key={name}>
                    <div className={`platformIcon brand-${name.toLowerCase()}`}>{p?.[1]}</div>
                    <div className="activeSocialText">
                      <strong>{name}</strong>
                      <span>{meta.note}</span>
                    </div>
                    <span className={state.connected?"pill ok":"pill"}>{state.connected?"Connected":"Not connected"}</span>
                    <a className="secondaryBtn" href={href}>{state.connected?"Manage":"Connect "+name}</a>
                  </article>
                })}
                <article className="activeSocialCard whatsappActiveCard">
                  <div className="whatsappBadge">WA</div>
                  <div className="activeSocialText">
                    <strong>WhatsApp</strong>
                    <span>{connections.WhatsApp?.numberCount||0} Numbers Connected</span>
                  </div>
                  <span className={connections.WhatsApp?.connected?"pill ok":"pill"}>{connections.WhatsApp?.connected?"Connected":"Not connected"}</span>
                  <a className="secondaryBtn" href="/whatsapp">Manage WhatsApp</a>
                  <a className="secondaryBtn addWaBtn" href="/whatsapp?add=1">+ Add WhatsApp Number</a>
                </article>
              </section>
            </>
          )}

          {tab==="Results" && (
            <>
              <div className="pageHeading">
                <div><span>RESULTS</span><h1>Publishing results</h1><p>See the content preview, media and actual delivery outcome for every saved post.</p></div>
                <button className="secondaryBtn" onClick={()=>{refreshPublishingHistory();refreshAccountHub()}} disabled={resultsLoading}>{resultsLoading?"Refreshing…":"Refresh posts"}</button>
              </div>
              {resultsError&&<div className="warning" role="alert">{resultsError}</div>}
              <section className="grid two">
                {(() => {
                  const livePosts=Object.entries(accountHub).flatMap(([platform,account])=>(account.recent||[]).map(p=>({
                    id:p.id||p.externalId,platform,topic:p.topic||"",text:p.text||"",mediaUrl:p.mediaUrl||"",publishedAt:p.publishedAt||p.createdAt||"",status:p.external?.status|| (p.url?"POSTED":"UNKNOWN"),externalId:p.externalId||p.id||"",url:p.url||"",source:"provider"
                  })));
                  const all=[...livePosts,...results,...savedResults.map(p=>({id:p.id,platform:p.channel,topic:p.topic,text:p.text,mediaUrl:p.mediaUrl,attachments:p.attachments,publishedAt:p.publishedAt,status:p.external?.status||"UNKNOWN",error:p.external?.error,externalId:p.external?.externalId,technicalError:p.external?.technicalError,action:p.external?.action,url:p.url||p.external?.permalink||"",saved:p.savedPreview===true,deliveryVerified:p.deliveryVerified===true,source:"history"}))];
                  const seen=new Set();
                  const unique=all.filter(r=>{const key=r.url|| (r.source==="provider"&&r.externalId?`${r.platform}:${r.externalId}`:r.id)||[r.platform,r.text,r.publishedAt].join("|");if(seen.has(key))return false;seen.add(key);return true});
                  unique.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
                  return unique.length?unique.map((r,i)=>{
                    const p=PLATFORMS.find(x=>x[0]===r.platform);
                    const media=r.mediaUrl||r.attachments?.find(x=>/^image\/|^video\//.test(x.type||""))?.url||"";
                    const video=/\.(mp4|webm|mov)(\?|$)/i.test(media)||r.attachments?.some(x=>x.url===media&&/^video\//.test(x.type||""));
                    return <article className="panel" key={r.id||i} style={{overflow:"hidden"}}>
                      <div className="panelHead"><div><h3>{r.platform||"Unknown"} post</h3><small>{r.publishedAt?new Date(r.publishedAt).toLocaleString():"Current attempt"}</small></div><span className={`pill ${r.status==="POSTED"?"ok":""}`}>{r.status||"UNKNOWN"}</span></div>
                      <div style={{border:"1px solid var(--border, #d8dee7)",borderRadius:14,overflow:"hidden",background:"#fff",color:"#192333",margin:"12px 0"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:14}}>
                          <div style={{width:42,height:42,borderRadius:"50%",background:r.platform==="LinkedIn"?"#0a66c2":r.platform==="Facebook"?"#1877f2":r.platform==="Instagram"?"#b23abe":"#e21b1b",color:"#fff",display:"grid",placeItems:"center",fontWeight:700}}>{p?.[1]||"N"}</div>
                          <div><strong style={{display:"block"}}>Nunes Instrumentation</strong><span style={{fontSize:12,color:"#677185"}}>{r.platform} · {r.status==="POSTED"?"Published":"Not confirmed published"}</span></div>
                        </div>
                        {media&&(video?<video src={media} controls preload="metadata" style={{width:"100%",maxHeight:370,background:"#000"}}/>:<img src={media} alt={r.topic||"Post media"} loading="lazy" style={{display:"block",width:"100%",maxHeight:370,objectFit:"contain",background:"#f4f6fa"}}/>)}
                        <div style={{padding:16,whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:14,lineHeight:1.6}}>
                          {r.topic&&<strong style={{display:"block",marginBottom:8}}>{r.topic}</strong>}
                          {r.text||"No caption stored"}
                        </div>
                      </div>
                      {r.externalId&&<small>Provider post ID: {r.externalId}</small>}
                      {r.saved&&<small>Preview archived</small>}
                      {r.status==="POSTED"&&!r.deliveryVerified&&<small>Provider accepted the post; public visibility not independently verified.</small>}
                      {r.url&&/^https:\/\//.test(r.url)&&<a className="secondaryBtn" href={r.url} target="_blank" rel="noopener noreferrer">Open post ↗</a>}
                      {r.error&&<div className="resultMessage" role="alert">{r.error}</div>}
                      {r.action==="RECONNECT_META"&&<a className="secondaryBtn resultAction" href="/connect/Meta">Reconnect Meta</a>}
                      {appMode==="tech"&&r.technicalError&&<details className="technicalResult"><summary>Technical details</summary><pre>{r.technicalError}</pre></details>}
                    </article>
                  }):<div className="panel empty">No publishing results yet. Published attempts and saved previews will appear here.</div>;
                })()}
              </section>
            </>
          )}
        </main>
      </section>
    </div>
  );
}
