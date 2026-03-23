/* Glam Trainer — V3.0 (Full Version with Wochenplan Status & Logging) */

const FIREBASE_URL = "https://ds-trainingstool-default-rtdb.europe-west1.firebasedatabase.app";

async function fbGet(path) { const res=await fetch(`${FIREBASE_URL}/${path}.json`); if(!res.ok) return null; return await res.json(); }
async function fbSet(path,value) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}); return res.ok; }
async function fbPush(path,value) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}); if(!res.ok) return null; return (await res.json()).name; }
async function fbPatch(path,patch) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}); return res.ok; }
async function fbDelete(path) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"DELETE"}); return res.ok; }

async function fbGetAnjaTasks() { const data=await fbGet("anja_tasks"); if(!data) return []; return Object.entries(data).map(([k,v])=>({...v,_fbKey:k})); }
async function fbGetCuckold() { return await fbGet("cuckold")||{}; }
async function fbSetCuckold(data) { await fbSet("cuckold",{...data,updatedAt:nowISO()}); }
async function fbGetCustomWishes() { const data=await fbGet("custom_wishes"); if(!data) return []; return Object.entries(data).map(([k,v])=>({...v,_fbKey:k})); }
async function fbAddCustomWish(titel) { return await fbPush("custom_wishes",{titel,createdAt:nowISO()}); }
async function fbDeleteCustomWish(fbKey) { return await fbDelete(`custom_wishes/${fbKey}`); }
async function fbGetPisslog() { const data=await fbGet("konditionierung_log"); if(!data) return []; return Object.entries(data).map(([k,v])=>({...v,_fbKey:k})).sort((a,b)=>new Date(b.ts)-new Date(a.ts)); }
async function fbAddPisslog(entry) { return await fbPush("konditionierung_log",entry); }
async function fbGetWuensche() { const data=await fbGet("wuensche"); if(!data) return []; return Object.entries(data).map(([k,v])=>({...v,_fbKey:k})); }
async function fbAddWunsch(titel) { return await fbPush("wuensche",{titel,createdAt:nowISO()}); }
async function fbDeleteWunsch(fbKey) { return await fbDelete(`wuensche/${fbKey}`); }
async function fbGetWochenplan() { const data=await fbGet("wochenplan"); if(!data) return []; return Object.entries(data).map(([k,v])=>({...v,_fbKey:k})); }
async function fbAddWochenplanEintrag(entry) { return await fbPush("wochenplan",entry); }
async function fbPatchWochenplanEintrag(fbKey,patch) { return await fbPatch(`wochenplan/${fbKey}`,patch); }
async function fbDeleteWochenplanEintrag(fbKey) { return await fbDelete(`wochenplan/${fbKey}`); }

async function setWochenplanStatus(fbKey, status, titel) {
  const patch = { status: status, updatedAt: nowISO() };
  const ok = await fbPatchWochenplanEintrag(fbKey, patch);
  if (ok) {
    toast(status === 'done' ? "Erledigt!" : "Übersprungen");
    if (status === 'done') {
      await fbAddPisslog({ ts: nowISO(), txt: `Wochenplan erledigt: ${titel}`, type: "Wochenplan" });
    }
    const entry = state.wochenplan.find(e => e._fbKey === fbKey);
    if (entry) entry.status = status;
    render();
  }
}

const STORAGE = { settings:"gt_settings_v1",tasks:"gt_tasks_v1",goals:"gt_goals_v1",steps:"gt_goal_steps_v1",log:"gt_log_v1",schedule:"gt_schedule_v1",goalOverrides:"gt_goal_overrides_v1" };
const DEFAULT_SETTINGS = { dayMode:"normal",minGapGoalsMin:90,maxUnitsPerBundle:5,ntfyGoalsTopic:"",ntfyTasksTopic:"",ntfyToken:"",tickSeconds:20 };
const $ = id => document.getElementById(id);

function nowISO() { return new Date().toISOString(); }
function todayKey(d=new Date()) { const x=new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10); }
function pad2(n) { return String(n).padStart(2,"0"); }
function fmtTime(d) { return pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function fmtDateTimeLocal(iso) { if(!iso) return ""; return new Date(iso).toLocaleString("de-DE"); }
function parseTimeToDateToday(hhmm) { const [h,m]=String(hhmm||"").split(":").map(Number); if(!Number.isFinite(h)||!Number.isFinite(m)) return null; const d=new Date(); d.setHours(h,m,0,0); return d; }
function randInt(min,max) { const a=Math.min(min,max),b=Math.max(min,max); return a+Math.floor(Math.random()*(b-a+1)); }
function clamp(v,min,max) { return Math.max(min,Math.min(max,v)); }
function normId(x) { return String(x||"").trim().toUpperCase(); }
function normStr(x) { return String(x||"").trim(); }
function toast(msg) { const t=$("toast"); if(!t) return; t.textContent=msg; t.style.display="block"; clearTimeout(toast._t); toast._t=setTimeout(()=>{t.style.display="none";},1400); }
function loadJSON(key,fallback) { try { const r=localStorage.getItem(key); if(!r) return fallback; return JSON.parse(r); } catch { return fallback; } }
function saveJSON(key,value) { localStorage.setItem(key,JSON.stringify(value)); }
function startOfWeek(d=new Date()) { const x=new Date(d),day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
function inThisWeek(iso) { const d=new Date(iso),s=startOfWeek(),e=new Date(s); e.setDate(e.getDate()+7); return d>=s&&d<e; }
async function fetchText(url) { const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(`${url} (${r.status})`); return await r.text(); }

function parseCSV(text) {
  const cleaned=String(text||"").replace(/^\uFEFF/,"");
  const lines=cleaned.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length) return [];
  const sep=lines[0].includes(";")?";":",";
  let hdr=lines.shift().split(sep).map(s=>s.trim()); hdr[0]=hdr[0].replace(/^\uFEFF/,"").trim();
  return lines.map(line=>{ const p=line.split(sep).map(s=>(s??"").trim()); const r={}; hdr.forEach((h,i)=>r[h]=p[i]??""); return r; });
}
function normalizeBool(v) { const s=String(v||"").trim().toLowerCase(); return s==="true"||s==="ja"||s==="1"||s==="y"||s==="yes"; }
function getField(row,aliases,fallback="") { for(const a of aliases){if(row[a]!==undefined&&String(row[a]).trim()!=="")return String(row[a]).trim();} return fallback; }

const state = {
  settings: loadJSON(STORAGE.settings,DEFAULT_SETTINGS),
  tasksData: loadJSON(STORAGE.tasks,[]), goalsData: loadJSON(STORAGE.goals,[]),
  goalsStepsData: loadJSON(STORAGE.steps,[]), goalOverrides: loadJSON(STORAGE.goalOverrides,{}),
  route: "#/start", filter: "all", subFilter: "all",
  anjaTasks: [], cuckold: {gefuehl:null,wunsch:null}, customWishes: [], pisslog: [], wuensche: [], wochenplan: [],
};

function persistSettings() { saveJSON(STORAGE.settings,state.settings); }
function getLog() { return loadJSON(STORAGE.log,[]); }
function setLog(x) { saveJSON(STORAGE.log,x); }
function getSchedule() { return loadJSON(STORAGE.schedule,null); }
function setSchedule(x) { saveJSON(STORAGE.schedule,x); }
function persistOverrides() { saveJSON(STORAGE.goalOverrides,state.goalOverrides); }
function setDayMode(mode) { state.settings.dayMode=mode; persistSettings(); regenIfNeeded(true); render(); }

async function loadAllCSV() {
  const [tt,gt,st]=await Promise.all([fetchText("tasks.csv").catch(()=>""),fetchText("goals.csv").catch(()=>""),fetchText("goal_uebungen.csv").catch(()=>"")]);
  state.tasksData=tt?parseCSV(tt):[]; state.goalsData=gt?parseCSV(gt):[]; state.goalsStepsData=st?parseCSV(st):[];
  saveJSON(STORAGE.tasks,state.tasksData); saveJSON(STORAGE.goals,state.goalsData); saveJSON(STORAGE.steps,state.goalsStepsData);
}

async function loadAnjaTasks() { try { state.anjaTasks=await fbGetAnjaTasks(); } catch(e) { state.anjaTasks=[]; } }
function addLogEntry(entry) { const log=getLog(); log.unshift(entry); setLog(log); }

async function setAnjaTaskStatus(taskId,status,feedback={}) {
  const task=state.anjaTasks.find(t=>t.id===taskId); if(!task) return;
  task.status=status; task.updatedAt=nowISO();
  if(feedback.rueckmeldung!==undefined) task.rueckmeldung=feedback.rueckmeldung;
  if(feedback.schwierigkeit!==undefined) task.schwierigkeit=feedback.schwierigkeit;
  if(feedback.gerne!==undefined) task.gerne=feedback.gerne;
  if(feedback.belegWA!==undefined) task.belegWA=feedback.belegWA;
  if(status==="erledigt") task.doneAt=nowISO();
  if(status==="angenommen") task.acceptedAt=nowISO();
  if(status==="erledigt"||status==="abgebrochen") {
    addLogEntry({id:`log-anja-${Date.now()}`,typ:"aufgabe",dayKey:todayKey(),createdAt:nowISO(),
      title:task.title||"Aufgabe",status,schwierigkeit:feedback.schwierigkeit||null,
      gerne:feedback.gerne||null,rueckmeldung:feedback.rueckmeldung||"",belegWA:feedback.belegWA||false});
  }
  try {
    const patch={status,updatedAt:task.updatedAt};
    ["rueckmeldung","schwierigkeit","gerne","belegWA"].forEach(k=>{if(feedback[k]!==undefined)patch[k]=feedback[k];});
    if(task.doneAt) patch.doneAt=task.doneAt;
    if(task.acceptedAt) patch.acceptedAt=task.acceptedAt;
    await fbPatch(`anja_tasks/${task._fbKey}`,patch);
  } catch(e) { console.warn(e); }
}

function normalizeGoalRow(raw) {
  const ziel_id=normId(getField(raw,["ziel_id","id","ziel","zielid","zielId"]));
  const ziel_name=normStr(getField(raw,["ziel_name","name","titel","zielname"],""))||ziel_id;
  const aktivCSV=normalizeBool(getField(raw,["aktiv","active"],"false"));
  const aCSV=parseInt(getField(raw,["aktuelle_stufe","stufe","level"],"1"),10)||1;
  const max_stufe=parseInt(getField(raw,["max_stufe","maxlevel","stufen_max","stufe_max"],"5"),10)||5;
  const min=parseInt(getField(raw,["min","min_pro_zeitraum","min_zeitraum"],"0"),10)||0;
  const max=parseInt(getField(raw,["max","max_pro_zeitraum","max_zeitraum"],"0"),10)||0;
  const zeitraum=normStr(getField(raw,["zeitraum","periode"],"TAG")).toUpperCase()==="WOCHE"?"WOCHE":"TAG";
  const modus=normStr(getField(raw,["modus","mode"],"flexibel")).toLowerCase();
  const ov=state.goalOverrides[ziel_id]||{};
  return { ziel_id, ziel_name, aktiv:typeof ov.aktiv==="boolean"?ov.aktiv:aktivCSV,
    aktuelle_stufe:clamp(typeof ov.aktuelle_stufe==="number"?ov.aktuelle_stufe:aCSV,1,Math.max(1,max_stufe)),
    max_stufe:Math.max(1,max_stufe), min:Math.max(0,min), max:Math.max(0,max), zeitraum, modus,
    zeit_von:normStr(getField(raw,["zeit_von","von"],"14:00")), zeit_bis:normStr(getField(raw,["zeit_bis","bis"],"20:00")),
    feste_zeit:normStr(getField(raw,["feste_zeit","uhrzeit","fix"],"09:00")) };
}
function getGoalsNormalized() { return (state.goalsData||[]).map(normalizeGoalRow).filter(g=>g.ziel_id); }
function setGoalOverride(goalId,patch) { const gid=normId(goalId); state.goalOverrides[gid]={...(state.goalOverrides[gid]||{}),...patch}; persistOverrides(); }
function countGoalDone(goalId,period) {
  const gid=normId(goalId),log=getLog();
  if(period==="TAG"){const t=todayKey();return log.filter(e=>e.typ==="ziel"&&normId(e.ziel_id)===gid&&e.status==="erledigt"&&e.dayKey===t).length;}
  return log.filter(e=>e.typ==="ziel"&&normId(e.ziel_id)===gid&&e.status==="erledigt"&&inThisWeek(e.createdAt)).length;
}
function computeGoalQuota(goal) { const period=goal.zeitraum==="WOCHE"?"WOCHE":"TAG"; return {period,min:parseInt(goal.min||"0",10)||0,max:parseInt(goal.max||"0",10)||0,done:countGoalDone(goal.ziel_id,period)}; }
function pickExerciseForGoal(goalId,stufe) {
  const gid=normId(goalId),lvl=parseInt(stufe||"1",10)||1;
  const rows=(state.goalsStepsData||[]).map(r=>({ziel_id:normId(r.ziel_id||r.goal_id||r.ziel||""),stufe:parseInt(r.stufe||"1",10)||1,titel:String(r.titel||r.uebung||"").trim()})).filter(x=>x.ziel_id&&x.titel);
  const list=rows.filter(x=>x.ziel_id===gid&&x.stufe===lvl);
  return list.length?list[Math.floor(Math.random()*list.length)]:null;
}

function pickRandomTimeBetween(a,b) { const from=parseTimeToDateToday(a),to=parseTimeToDateToday(b); if(!from||!to||to<=from) return null; return new Date(from.getTime()+Math.random()*(to.getTime()-from.getTime())); }
function ensureMinGap(dates,candidate,minMin) { const gap=minMin*60*1000; for(const d of dates){if(Math.abs(d.getTime()-candidate.getTime())<gap)return false;} return true; }
function generateGoalUnitsForToday(activeGoals) {
  const mode=state.settings.dayMode; if(mode==="aussetzen"||!activeGoals.length) return [];
  const units=[];
  for(const g of activeGoals) {
    const {period,min,max,done}=computeGoalQuota(g); if(max>0&&done>=max) continue;
    let want=0;
    if(period==="TAG"){const minA=mode==="sanft"?Math.min(min,1):min,baseMax=(max>0)?max:(min>0?min:1),maxA=mode==="sanft"?Math.min(baseMax,1):baseMax,minU=Math.max(0,minA),maxU=Math.max(minU,maxA);want=(maxU===0&&minU===0)?0:randInt(minU,maxU);}
    else{if(done<min)want=1;else if(max>0&&done<max){const p=mode==="sanft"?0.25:mode==="herausfordernd"?0.55:0.4;want=Math.random()<p?1:0;}}
    for(let i=0;i<want;i++) units.push({id:`goalunit-${g.ziel_id}-${todayKey()}-${i}-${Math.floor(Math.random()*100000)}`,typ:"ziel",ziel_id:g.ziel_id,ziel_name:g.ziel_name,stufe:clamp(g.aktuelle_stufe,1,g.max_stufe),plannedAt:null,plannedLabel:"",status:"geplant",createdAt:nowISO()});
  }
  const plannedDates=[];
  for(const u of units) {
    const g=activeGoals.find(x=>normId(x.ziel_id)===normId(u.ziel_id)); if(!g) continue;
    let dt=g.modus==="ritualisiert"?parseTimeToDateToday(g.feste_zeit)||new Date():pickRandomTimeBetween(g.zeit_von,g.zeit_bis)||new Date();
    const softGap=Math.max(10,Math.floor(state.settings.minGapGoalsMin/2)); let tries=0;
    while(tries<12&&!ensureMinGap(plannedDates,dt,softGap)){dt=new Date(dt.getTime()+randInt(8,22)*60*1000);tries++;}
    plannedDates.push(dt); plannedDates.sort((a,b)=>a-b); u.plannedAt=dt.toISOString(); u.plannedLabel=fmtTime(dt);
  }
  units.sort((a,b)=>new Date(a.plannedAt)-new Date(b.plannedAt)); return units;
}
function regenIfNeeded(force=false) {
  const t=todayKey(),activeGoals=getGoalsNormalized().filter(g=>g.aktiv===true),activeIds=new Set(activeGoals.map(g=>normId(g.ziel_id)));
  let schedule=getSchedule();
  if(schedule&&schedule.dayKey===t) {
    const before=schedule.units?.length||0;
    schedule.units=(schedule.units||[]).filter(u=>u.typ!=="ziel"||activeIds.has(normId(u.ziel_id)));
    if(schedule.units.length!==before) setSchedule(schedule);
    if(!force) return;
  }
  setSchedule({dayKey:t,createdAt:nowISO(),lastPushAtGoals:schedule?.lastPushAtGoals||null,units:generateGoalUnitsForToday(activeGoals)});
}

function h(tag,attrs={},children=[]) {
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==="class") el.className=v;
    else if(k.startsWith("on")&&typeof v==="function") el.addEventListener(k.slice(2).toLowerCase(),v);
    else if(k==="html") el.innerHTML=v;
    else el.setAttribute(k,v);
  }
  (Array.isArray(children)?children:[children]).forEach(c=>{if(c==null)return;el.appendChild(typeof c==="string"?document.createTextNode(c):c);});
  return el;
}
function sectionTitle(icon,title,rightEl) { return h("div",{class:"section-title"},[h("h2",{},[`${icon} ${title}`]),h("div",{class:"right"},rightEl?[rightEl]:[])]) }
function chip(label,active,onClick) { return h("button",{class:"chip"+(active?" active":""),type:"button",onclick:onClick},[label]); }
function openModal(contentEl) {
  const bd=h("div",{class:"modal-backdrop"},[h("div",{class:"modal"},[contentEl])]);
  bd.addEventListener("click",(e)=>{if(e.target===bd)bd.remove();}); document.body.appendChild(bd); return ()=>bd.remove();
}

async function registerServiceWorker() {
  if(!("serviceWorker" in navigator)) return;
  try {
    const reg=await navigator.serviceWorker.register("sw.js");
    console.log("SW registered",reg.scope);
  } catch(e) { console.warn("SW failed",e); }
}
async function maybeDispatchPushes() {
  const schedule=getSchedule(); if(!schedule||!schedule.units) return;
  const now=new Date(), t=todayKey(); if(schedule.dayKey!==t) return;
  const topic=state.settings.ntfyGoalsTopic, token=state.settings.ntfyToken; if(!topic) return;
  const lastPush=schedule.lastPushAtGoals?new Date(schedule.lastPushAtGoals):new Date(0);
  if(now.getTime()-lastPush.getTime()<10*60*1000) return;
  const due=schedule.units.filter(u=>u.status==="geplant"&&u.plannedAt&&new Date(u.plannedAt)<=now);
  if(!due.length) return;
  const body=due.map(u=>`${u.plannedLabel} - ${u.ziel_name}`).join("\n");
  try {
    const res=await fetch(`https://ntfy.sh/${topic}`,{method:"POST",body,headers:token?{"Authorization":`Bearer ${token}`}:{}});
    if(res.ok){ schedule.lastPushAtGoals=now.toISOString(); setSchedule(schedule); }
  } catch(e) { console.warn("Push failed",e); }
}

function onRoute() { state.route=window.location.hash||"#/start"; state.filter="all"; state.subFilter="all"; render(); }
function setupBridge() {
  window.setDayMode=setDayMode;
  window.setGoalOverride=(id,p)=>{setGoalOverride(id,p);render();};
  window.deleteWunsch=async(k)=>{if(confirm("Wunsch löschen?")){await fbDeleteWunsch(k);state.wuensche=await fbGetWuensche();render();}};
  window.deleteCustomWish=async(k)=>{if(confirm("Wunsch löschen?")){await fbDeleteCustomWish(k);state.customWishes=await fbGetCustomWishes();render();}};
  window.setAnjaStatus=async(id,s)=>{await setAnjaTaskStatus(id,s);render();};
  window.setWochenplanStatus=setWochenplanStatus;
}

function renderStart() {
  const c=$("content");
  const anjaOpen=state.anjaTasks.filter(t=>t.status==="offen"||t.status==="angenommen");
  if(anjaOpen.length) {
    c.appendChild(sectionTitle("👑","Anjas Aufgaben"));
    anjaOpen.forEach(t=>{
      const card=h("div",{class:"card task-card "+(t.status==="angenommen"?"accepted":"")},[
        h("div",{class:"task-header"},[h("h3",{},[t.title||"Aufgabe"]),h("span",{class:"badge"},[t.typ==="pflicht"?"Pflicht":"Bonus"])]),
        h("p",{},[t.desc||""]),
        t.status==="offen"?h("button",{class:"btn primary full",onclick:()=>window.setAnjaStatus(t.id,"angenommen")},["Annehmen"]):
        h("button",{class:"btn primary full",onclick:()=>renderAnjaFeedback(t)},["Erledigt melden"])
      ]);
      c.appendChild(card);
    });
  }
  const schedule=getSchedule();
  if(schedule && schedule.dayKey===todayKey()){
    c.appendChild(sectionTitle("📅","Heutiger Plan"));
    const list=schedule.units||[];
    if(!list.length) c.appendChild(h("p",{style:"text-align:center;opacity:0.6"},["Keine Ziele für heute."]));
    else {
      list.forEach(u=>{
        const isDone=u.status==="erledigt";
        const item=h("div",{class:"card goal-item "+(isDone?"done":"")},[
          h("div",{class:"goal-time"},[u.plannedLabel||"--:--"]),
          h("div",{class:"goal-info"},[h("div",{class:"goal-name"},[u.ziel_name]),h("div",{class:"goal-sub"},[isDone?`Erledigt um ${fmtTime(new Date(u.doneAt))}`:`Stufe ${u.stufe}`])]),
          !isDone?h("button",{class:"btn secondary small",onclick:()=>renderGoalAction(u)},["Start"]):null
        ]);
        c.appendChild(item);
      });
    }
  }
}

function renderAnjaFeedback(t) {
  const close=openModal(h("div",{class:"feedback-form"},[
    h("h3",{},["Rückmeldung an Anja"]),
    h("label",{},["Wie war es?"]),
    h("textarea",{id:"fb-txt",placeholder:"Deine Nachricht..."}),
    h("label",{},["Schwierigkeit (1-5)"]),
    h("input",{id:"fb-diff",type:"range",min:"1",max:"5",value:"3"}),
    h("label",{},["Wie gerne gemacht? (1-5)"]),
    h("input",{id:"fb-like",type:"range",min:"1",max:"5",value:"3"}),
    h("div",{class:"modal-actions"},[
      h("button",{class:"btn",onclick:()=>close()},["Abbrechen"]),
      h("button",{class:"btn primary",onclick:async()=>{
        const rueckmeldung=$("fb-txt").value;
        const schwierigkeit=parseInt($("fb-diff").value);
        const gerne=parseInt($("fb-like").value);
        await window.setAnjaStatus(t.id,"erledigt",{rueckmeldung,schwierigkeit,gerne});
        close();
      }},["Absenden"])
    ])
  ]));
}

function renderGoalAction(u) {
  const ex=pickExerciseForGoal(u.ziel_id,u.stufe);
  const close=openModal(h("div",{class:"goal-action-modal"},[
    h("h2",{},[u.ziel_name]),
    h("div",{class:"exercise-box"},[
      h("h4",{},["Übung (Stufe "+u.stufe+"):"]),
      h("p",{class:"big-text"},[ex?ex.titel:"Keine spezifische Übung gefunden."])
    ]),
    h("div",{class:"modal-actions"},[
      h("button",{class:"btn",onclick:()=>close()},["Später"]),
      h("button",{class:"btn primary",onclick:()=>{
        u.status="erledigt"; u.doneAt=nowISO();
        const schedule=getSchedule(); const idx=schedule.units.findIndex(x=>x.id===u.id);
        if(idx!==-1) schedule.units[idx]=u; setSchedule(schedule);
        addLogEntry({id:`log-ziel-${Date.now()}`,typ:"ziel",dayKey:todayKey(),createdAt:nowISO(),ziel_id:u.ziel_id,ziel_name:u.ziel_name,stufe:u.stufe,uebung:ex?ex.titel:"",status:"erledigt"});
        fbAddPisslog({ts:nowISO(),txt:`Ziel erledigt: ${u.ziel_name} (${ex?ex.titel:"Keine Übung"})`,type:"Ziel"});
        close(); render();
      }},["Erledigt"])
    ])
  ]));
}

function renderPlan() {
  const c=$("content");
  c.appendChild(h("div",{class:"tabs"},[
    chip("Ziele",state.filter==="all",()=>{state.filter="all";render();}),
    chip("Wochenplan",state.filter==="woche",()=>{state.filter="woche";render();})
  ]));
  if(state.filter==="woche"){
    c.appendChild(h("div",{id:"wochenplan-list"}));
    renderWochenplan();
  } else {
    const goals=getGoalsNormalized();
    goals.forEach(g=>{
      const quota=computeGoalQuota(g);
      const card=h("div",{class:"card goal-config "+(g.aktiv?"":"inactive")},[
        h("div",{class:"config-header"},[
          h("div",{},[h("h3",{},[g.ziel_name]),h("div",{class:"small"},[`${quota.done} / ${quota.max?quota.max:quota.min+' (Min)'} (${quota.period})`])]),
          h("div",{class:"toggle",onclick:()=>window.setGoalOverride(g.ziel_id,{aktiv:!g.aktiv})},[g.aktiv?"AN":"AUS"])
        ]),
        g.aktiv?h("div",{class:"config-body"},[
          h("label",{},["Stufe: "+g.aktuelle_stufe]),
          h("input",{type:"range",min:"1",max:g.max_stufe,value:g.aktuelle_stufe,onchange:(e)=>window.setGoalOverride(g.ziel_id,{aktuelle_stufe:parseInt(e.target.value)})})
        ]):null
      ]);
      c.appendChild(card);
    });
  }
}

function renderWochenplan() {
  const c=$("wochenplan-list"); if(!c) return;
  c.innerHTML="";
  const tage=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
  tage.forEach(tag=>{
    const list=state.wochenplan.filter(e=>e.tag===tag);
    if(!list.length) return;
    const group=h("div",{class:"wp-tag-group"},[h("h3",{},[tag])]);
    list.forEach(e=>{
      const isDone = e.status === 'done';
      const isSkip = e.status === 'skip';
      group.appendChild(h("div",{class:`wp-item ${e.status||""}`, style:"display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:4px; border-radius:4px; background:rgba(255,255,255,0.05)"},[
        h("div",{style:isDone?"text-decoration:line-through;color:#4caf50; font-weight:bold":isSkip?"opacity:0.5":""},[`${e.zeit||'--:--'} - ${e.titel}`]),
        h("div",{class:"wp-actions", style:"display:flex; gap:5px"},[
          h("button",{class:"btn small", style:"background:#4caf50; padding:2px 6px", onclick:()=>window.setWochenplanStatus(e._fbKey,'done',e.titel)},["✅"]),
          h("button",{class:"btn small", style:"background:#f44336; padding:2px 6px", onclick:()=>window.setWochenplanStatus(e._fbKey,'skip',e.titel)},["❌"])
        ])
      ]));
    });
    c.appendChild(group);
  });
}

function renderWuensche() {
  const c=$("content");
  c.appendChild(h("div",{class:"tabs"},[
    chip("Marlo",state.filter==="all",()=>{state.filter="all";render();}),
    chip("Anja",state.filter==="anja",()=>{state.filter="anja";render();}),
    chip("Cuckold",state.filter==="cuck",()=>{state.filter="cuck";render();})
  ]));
  if(state.filter==="anja"){
    c.appendChild(h("div",{class:"input-group"},[
      h("input",{id:"inp-wish",placeholder:"Neuer Wunsch..."}),
      h("button",{class:"btn primary",onclick:async()=>{
        const v=$("inp-wish").value; if(!v) return;
        await fbAddCustomWish(v); state.customWishes=await fbGetCustomWishes(); render();
      }},["Hinzufügen"])
    ]));
    state.customWishes.forEach(w=>{
      c.appendChild(h("div",{class:"card small flex-row"},[h("span",{},[w.titel]),h("button",{class:"btn small",onclick:()=>window.deleteCustomWish(w._fbKey)},["Löschen"])]));
    });
  } else if(state.filter==="cuck"){
    c.appendChild(h("div",{class:"card"},[
      h("h3",{},["Wie fühlst du dich heute?"]),
      h("select",{id:"cuck-gefuehl",onchange:async(e)=>{state.cuckold.gefuehl=e.target.value; await fbSetCuckold(state.cuckold);}},[
        h("option",{value:""},["-- wählen --"]),
        ...["Demütig","Geil","Frustriert","Dankbar","Eifersüchtig"].map(v=>h("option",{value:v,selected:state.cuckold.gefuehl===v},[v]))
      ]),
      h("h3",{},["Dein größter Wunsch aktuell?"]),
      h("textarea",{id:"cuck-wunsch",onblur:async(e)=>{state.cuckold.wunsch=e.target.value; await fbSetCuckold(state.cuckold);}},[state.cuckold.wunsch||""])
    ]));
  } else {
    c.appendChild(h("div",{class:"input-group"},[
      h("input",{id:"inp-m-wish",placeholder:"Marlo's Wunsch..."}),
      h("button",{class:"btn primary",onclick:async()=>{
        const v=$("inp-m-wish").value; if(!v) return;
        await fbAddWunsch(v); state.wuensche=await fbGetWuensche(); render();
      }},["Senden"])
    ]));
    state.wuensche.forEach(w=>{
      c.appendChild(h("div",{class:"card small flex-row"},[h("span",{},[w.titel]),h("button",{class:"btn small",onclick:()=>window.deleteWunsch(w._fbKey)},["X"])]));
    });
  }
}

function renderLog() {
  const c=$("content");
  const log=state.pisslog;
  if(!log.length) c.appendChild(h("p",{style:"text-align:center;opacity:0.6;margin-top:20px"},["Noch keine Einträge im Log."]));
  log.forEach(e=>{
    c.appendChild(h("div",{class:"card log-entry "+(e.type||"")},[
      h("div",{class:"log-time"},[fmtDateTimeLocal(e.ts)]),
      h("div",{class:"log-txt"},[e.txt||e.uebung||"Aktivität"])
    ]));
  });
}

function render() {
  const root=$("app"); if(!root) return;
  root.innerHTML="";
  const nav=h("nav",{class:"main-nav"},[
    h("button",{class:state.route==="#/start"?"active":"",onclick:()=>{window.location.hash="#/start"}},[h("span",{},["🏠"]),h("small",{},["Start"])]),
    h("button",{class:state.route==="#/plan"?"active":"",onclick:()=>{window.location.hash="#/plan"}},[h("span",{},["📅"]),h("small",{},["Plan"])]),
    h("button",{class:state.route==="#/wuensche"?"active":"",onclick:()=>{window.location.hash="#/wuensche"}},[h("span",{},["✨"]),h("small",{},["Wünsche"])]),
    h("button",{class:state.route==="#/log"?"active":"",onclick:()=>{window.location.hash="#/log"}},[h("span",{},["📜"]),h("small",{},["Log"])])
  ]);
  root.appendChild(nav);
  const content=h("div",{id:"content",class:"container fade-in"});
  root.appendChild(content);
  if(state.route==="#/plan") renderPlan();
  else if(state.route==="#/wuensche") renderWuensche();
  else if(state.route==="#/log") renderLog();
  else renderStart();
  root.appendChild(h("div",{id:"toast",class:"toast"}));
}

async function init() {
  window.addEventListener("hashchange",onRoute);
  onRoute();
  setupBridge();
  await registerServiceWorker();
  const [,,cuckData,customWishData,pisslogData,wuenscheData,wochenplanData]=await Promise.all([
    loadAllCSV().catch(console.warn), loadAnjaTasks(),
    fbGetCuckold().catch(()=>({})), fbGetCustomWishes().catch(()=>[]),
    fbGetPisslog().catch(()=>[]), fbGetWuensche().catch(()=>[]),
    fbGetWochenplan().catch(()=>[]),
  ]);
  state.cuckold=cuckData||{gefuehl:null,wunsch:null};
  state.customWishes=customWishData||[];
  state.pisslog=pisslogData||[];
  state.wuensche=wuenscheData||[];
  state.wochenplan=wochenplanData||[];
  regenIfNeeded(true);
  setInterval(()=>maybeDispatchPushes(),state.settings.tickSeconds*1000);
  setInterval(async()=>{
    await loadAnjaTasks();
    const cd=await fbGetCuckold().catch(()=>null); if(cd) state.cuckold=cd;
    const cw=await fbGetCustomWishes().catch(()=>null); if(cw) state.customWishes=cw;
    const pl=await fbGetPisslog().catch(()=>null); if(pl) state.pisslog=pl;
    const wu=await fbGetWuensche().catch(()=>null); if(wu) state.wuensche=wu;
    const wp=await fbGetWochenplan().catch(()=>null); if(wp) { state.wochenplan=wp; render(); }
  }, 15000);
  render();
}

window.addEventListener("load",init);
