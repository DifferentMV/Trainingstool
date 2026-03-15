/* Glam Trainer — V2.0 (Vanilla JS, GitHub Pages) */

const FIREBASE_URL = "https://ds-trainingstool-default-rtdb.europe-west1.firebasedatabase.app";

async function fbGet(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  if (!res.ok) return null;
  return await res.json();
}
async function fbSet(path, value) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  return res.ok;
}
async function fbPush(path, value) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  if (!res.ok) return null;
  return (await res.json()).name;
}
async function fbPatch(path, patch) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  return res.ok;
}
async function fbGetAnjaTasks() {
  const data = await fbGet("anja_tasks");
  if (!data) return [];
  return Object.entries(data).map(([fbKey, task]) => ({ ...task, _fbKey: fbKey }));
}
async function fbGetCuckold() { return await fbGet("cuckold") || {}; }
async function fbSetCuckold(data) { await fbSet("cuckold", { ...data, updatedAt: nowISO() }); }
async function fbGetCustomWishes() {
  const data = await fbGet("custom_wishes");
  if (!data) return [];
  return Object.entries(data).map(([fbKey, w]) => ({ ...w, _fbKey: fbKey }));
}
async function fbAddCustomWish(titel) { return await fbPush("custom_wishes", { titel, createdAt: nowISO() }); }
async function fbDeleteCustomWish(fbKey) {
  const res = await fetch(`${FIREBASE_URL}/custom_wishes/${fbKey}.json`, { method: "DELETE" });
  return res.ok;
}

const STORAGE = {
  settings: "gt_settings_v1", tasks: "gt_tasks_v1", goals: "gt_goals_v1",
  steps: "gt_goal_steps_v1", log: "gt_log_v1", schedule: "gt_schedule_v1", goalOverrides: "gt_goal_overrides_v1",
};
const DEFAULT_SETTINGS = {
  dayMode: "normal", minGapGoalsMin: 90, minGapTasksMin: 45, maxUnitsPerBundle: 5,
  ntfyGoalsTopic: "", ntfyTasksTopic: "", ntfyReportTopic: "", ntfyToken: "", tickSeconds: 20,
};
const $ = (id) => document.getElementById(id);

function nowISO() { return new Date().toISOString(); }
function todayKey(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10); }
function pad2(n) { return String(n).padStart(2,"0"); }
function fmtTime(d) { return pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function fmtDateTimeLocal(iso) { if (!iso) return ""; return new Date(iso).toLocaleString("de-DE"); }
function parseTimeToDateToday(hhmm) {
  const [h,m] = String(hhmm||"").split(":").map(Number);
  if (!Number.isFinite(h)||!Number.isFinite(m)) return null;
  const d = new Date(); d.setHours(h,m,0,0); return d;
}
function randInt(min,max) { const a=Math.min(min,max),b=Math.max(min,max); return a+Math.floor(Math.random()*(b-a+1)); }
function clamp(v,min,max) { return Math.max(min,Math.min(max,v)); }
function normId(x) { return String(x||"").trim().toUpperCase(); }
function normStr(x) { return String(x||"").trim(); }
function toast(msg) {
  const t=$("toast"); if(!t) return;
  t.textContent=msg; t.style.display="block";
  clearTimeout(toast._t); toast._t=setTimeout(()=>{t.style.display="none";},1400);
}
function loadJSON(key,fallback) { try { const raw=localStorage.getItem(key); if(!raw) return fallback; return JSON.parse(raw); } catch { return fallback; } }
function saveJSON(key,value) { localStorage.setItem(key,JSON.stringify(value)); }
function startOfWeek(d=new Date()) { const x=new Date(d),day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
function inThisWeek(dateISO) { const d=new Date(dateISO),s=startOfWeek(),e=new Date(s); e.setDate(e.getDate()+7); return d>=s&&d<e; }
async function fetchText(url) { const res=await fetch(url,{cache:"no-store"}); if(!res.ok) throw new Error(`${url} nicht gefunden (${res.status})`); return await res.text(); }
function parseCSV(text) {
  const cleaned=String(text||"").replace(/^\uFEFF/,"");
  const lines=cleaned.split(/\r?\n/).filter(l=>l.trim().length);
  if(!lines.length) return [];
  const sep=lines[0].includes(";")?";":",";
  let header=lines.shift().split(sep).map(s=>s.trim());
  header[0]=header[0].replace(/^\uFEFF/,"").trim();
  return lines.map(line=>{ const parts=line.split(sep).map(s=>(s??"").trim()); const row={}; header.forEach((h,i)=>row[h]=parts[i]??""); return row; });
}
function normalizeBool(v) { const s=String(v||"").trim().toLowerCase(); return s==="true"||s==="ja"||s==="1"||s==="y"||s==="yes"; }
function getField(row,aliases,fallback="") { for(const a of aliases){if(row[a]!==undefined&&String(row[a]).trim()!=="")return String(row[a]).trim();} return fallback; }

const state = {
  settings: loadJSON(STORAGE.settings,DEFAULT_SETTINGS), tasksData: loadJSON(STORAGE.tasks,[]),
  goalsData: loadJSON(STORAGE.goals,[]), goalsStepsData: loadJSON(STORAGE.steps,[]),
  goalOverrides: loadJSON(STORAGE.goalOverrides,{}), route: "#/nav", filter: "all",
  anjaTasks: [], cuckold: { gefuehl: null, wunsch: null }, customWishes: [],
};

function persistSettings() { saveJSON(STORAGE.settings,state.settings); }
function getLog() { return loadJSON(STORAGE.log,[]); }
function setLog(x) { saveJSON(STORAGE.log,x); }
function getSchedule() { return loadJSON(STORAGE.schedule,null); }
function setSchedule(x) { saveJSON(STORAGE.schedule,x); }
function persistOverrides() { saveJSON(STORAGE.goalOverrides,state.goalOverrides); }
function setDayMode(mode) { state.settings.dayMode=mode; persistSettings(); regenIfNeeded(true); render(); }

async function loadAllCSV() {
  const [tasksTxt,goalsTxt,stepsTxt] = await Promise.all([
    fetchText("tasks.csv").catch(()=>""), fetchText("goals.csv").catch(()=>""), fetchText("goal_uebungen.csv").catch(()=>""),
  ]);
  state.tasksData=tasksTxt?parseCSV(tasksTxt):[];
  state.goalsData=goalsTxt?parseCSV(goalsTxt):[];
  state.goalsStepsData=stepsTxt?parseCSV(stepsTxt):[];
  saveJSON(STORAGE.tasks,state.tasksData); saveJSON(STORAGE.goals,state.goalsData); saveJSON(STORAGE.steps,state.goalsStepsData);
}

async function loadAnjaTasks() {
  try { state.anjaTasks=await fbGetAnjaTasks(); }
  catch(e) { console.warn("Firebase Ladefehler:",e); state.anjaTasks=[]; }
}

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
    addLogEntry({ id:`log-anja-${Date.now()}-${Math.floor(Math.random()*10000)}`, typ:"aufgabe",
      dayKey:todayKey(), createdAt:nowISO(), title:task.title||"Aufgabe", status,
      schwierigkeit:feedback.schwierigkeit||null, gerne:feedback.gerne||null,
      rueckmeldung:feedback.rueckmeldung||"", belegWA:feedback.belegWA||false });
  }
  try {
    const patch={status,updatedAt:task.updatedAt};
    if(feedback.rueckmeldung!==undefined) patch.rueckmeldung=feedback.rueckmeldung;
    if(feedback.schwierigkeit!==undefined) patch.schwierigkeit=feedback.schwierigkeit;
    if(feedback.gerne!==undefined) patch.gerne=feedback.gerne;
    if(feedback.belegWA!==undefined) patch.belegWA=feedback.belegWA;
    if(task.doneAt) patch.doneAt=task.doneAt;
    if(task.acceptedAt) patch.acceptedAt=task.acceptedAt;
    await fbPatch(`anja_tasks/${task._fbKey}`,patch);
  } catch(e) { console.warn("Firebase Statusfehler:",e); }
}

function normalizeGoalRow(raw) {
  const ziel_id=normId(getField(raw,["ziel_id","id","ziel","zielid","zielId"]));
  const ziel_name=normStr(getField(raw,["ziel_name","name","titel","zielname"],""))||ziel_id;
  const aktivCSV=normalizeBool(getField(raw,["aktiv","active"],"false"));
  const aktuelle_stufeCSV=parseInt(getField(raw,["aktuelle_stufe","stufe","level"],"1"),10)||1;
  const max_stufe=parseInt(getField(raw,["max_stufe","maxlevel","stufen_max","stufe_max"],"5"),10)||5;
  const min=parseInt(getField(raw,["min","min_pro_zeitraum","min_zeitraum"],"0"),10)||0;
  const max=parseInt(getField(raw,["max","max_pro_zeitraum","max_zeitraum"],"0"),10)||0;
  const zeitraum=normStr(getField(raw,["zeitraum","periode"],"TAG")).toUpperCase()==="WOCHE"?"WOCHE":"TAG";
  const modus=normStr(getField(raw,["modus","mode"],"flexibel")).toLowerCase();
  const zeit_von=normStr(getField(raw,["zeit_von","von"],"14:00"));
  const zeit_bis=normStr(getField(raw,["zeit_bis","bis"],"20:00"));
  const feste_zeit=normStr(getField(raw,["feste_zeit","uhrzeit","fix"],"09:00"));
  const gewichtung=parseInt(getField(raw,["gewichtung","weight"],"1"),10)||1;
  const ov=state.goalOverrides[ziel_id]||{};
  const aktiv=(typeof ov.aktiv==="boolean")?ov.aktiv:aktivCSV;
  const aktuelle_stufe=(typeof ov.aktuelle_stufe==="number")?ov.aktuelle_stufe:aktuelle_stufeCSV;
  return { ziel_id, ziel_name, aktiv,
    aktuelle_stufe:clamp(aktuelle_stufe,1,Math.max(1,max_stufe)),
    max_stufe:Math.max(1,max_stufe), min:Math.max(0,min), max:Math.max(0,max),
    zeitraum, modus, zeit_von, zeit_bis, feste_zeit, gewichtung };
}
function getGoalsNormalized() { return (state.goalsData||[]).map(normalizeGoalRow).filter(g=>g.ziel_id); }
function setGoalOverride(goalId,patch) { const gid=normId(goalId); state.goalOverrides[gid]={...(state.goalOverrides[gid]||{}),...patch}; persistOverrides(); }

function countGoalDoneThisPeriod(goalId,period) {
  const gid=normId(goalId),log=getLog();
  if(period==="TAG"){const t=todayKey();return log.filter(e=>e.typ==="ziel"&&normId(e.ziel_id)===gid&&e.status==="erledigt"&&e.dayKey===t).length;}
  return log.filter(e=>e.typ==="ziel"&&normId(e.ziel_id)===gid&&e.status==="erledigt"&&inThisWeek(e.createdAt)).length;
}
function computeGoalQuota(goal) {
  const period=goal.zeitraum==="WOCHE"?"WOCHE":"TAG";
  return {period,min:parseInt(goal.min||"0",10)||0,max:parseInt(goal.max||"0",10)||0,done:countGoalDoneThisPeriod(goal.ziel_id,period)};
}
function pickRandomTimeBetween(fromHHMM,toHHMM) {
  const from=parseTimeToDateToday(fromHHMM),to=parseTimeToDateToday(toHHMM);
  if(!from||!to||to<=from) return null;
  return new Date(from.getTime()+Math.random()*(to.getTime()-from.getTime()));
}
function ensureMinGap(sortedDates,candidate,minGapMinutes) {
  const gap=minGapMinutes*60*1000;
  for(const d of sortedDates){if(Math.abs(d.getTime()-candidate.getTime())<gap)return false;}
  return true;
}
function generateGoalUnitsForToday(activeGoals) {
  const mode=state.settings.dayMode;
  if(mode==="aussetzen"||!activeGoals.length) return [];
  const units=[];
  for(const g of activeGoals) {
    const {period,min,max,done}=computeGoalQuota(g);
    if(max>0&&done>=max) continue;
    let want=0;
    if(period==="TAG") {
      const minAdj=mode==="sanft"?Math.min(min,1):min,baseMax=(max>0)?max:(min>0?min:1);
      const maxAdj=mode==="sanft"?Math.min(baseMax,1):baseMax,minUse=Math.max(0,minAdj),maxUse=Math.max(minUse,maxAdj);
      want=(maxUse===0&&minUse===0)?0:randInt(minUse,maxUse);
    } else {
      if(done<min) want=1;
      else if(max>0&&done<max){const p=mode==="sanft"?0.25:mode==="herausfordernd"?0.55:0.4;want=Math.random()<p?1:0;}
    }
    for(let i=0;i<want;i++){
      units.push({id:`goalunit-${g.ziel_id}-${todayKey()}-${i}-${Math.floor(Math.random()*100000)}`,
        typ:"ziel",ziel_id:g.ziel_id,ziel_name:g.ziel_name,stufe:clamp(g.aktuelle_stufe,1,g.max_stufe),
        plannedAt:null,plannedLabel:"",status:"geplant",createdAt:nowISO()});
    }
  }
  const plannedDates=[];
  for(const u of units) {
    const g=activeGoals.find(x=>normId(x.ziel_id)===normId(u.ziel_id)); if(!g) continue;
    let dt=g.modus==="ritualisiert"?parseTimeToDateToday(g.feste_zeit)||new Date():pickRandomTimeBetween(g.zeit_von,g.zeit_bis)||new Date();
    const softGap=Math.max(10,Math.floor(state.settings.minGapGoalsMin/2));
    let tries=0;
    while(tries<12&&!ensureMinGap(plannedDates,dt,softGap)){dt=new Date(dt.getTime()+randInt(8,22)*60*1000);tries++;}
    plannedDates.push(dt); plannedDates.sort((a,b)=>a-b);
    u.plannedAt=dt.toISOString(); u.plannedLabel=fmtTime(dt);
  }
  units.sort((a,b)=>new Date(a.plannedAt)-new Date(b.plannedAt));
  return units;
}
function cleanScheduleUnits(schedule,activeGoalIdsSet) {
  if(!schedule?.units?.length) return schedule;
  const before=schedule.units.length;
  schedule.units=schedule.units.filter(u=>u.typ!=="ziel"||activeGoalIdsSet.has(normId(u.ziel_id)));
  if(activeGoalIdsSet.size===0) schedule.units=schedule.units.filter(u=>u.typ!=="ziel");
  schedule._cleaned=(before!==schedule.units.length); return schedule;
}
function regenIfNeeded(force=false) {
  const t=todayKey(),activeGoals=getGoalsNormalized().filter(g=>g.aktiv===true);
  const activeIds=new Set(activeGoals.map(g=>normId(g.ziel_id)));
  let schedule=getSchedule();
  if(schedule&&schedule.dayKey===t){
    schedule=cleanScheduleUnits(schedule,activeIds);
    if(schedule._cleaned){delete schedule._cleaned;setSchedule(schedule);}
    if(!force) return;
  }
  setSchedule({dayKey:t,createdAt:nowISO(),lastPushAtGoals:schedule?.lastPushAtGoals||null,units:generateGoalUnitsForToday(activeGoals)});
}
function pickExerciseForGoal(goalId,stufe) {
  const gid=normId(goalId),lvl=parseInt(stufe||"1",10)||1;
  const rows=(state.goalsStepsData||[]).map(r=>({
    ziel_id:normId(r.ziel_id||r.goal_id||r.ziel||""),stufe:parseInt(r.stufe||"1",10)||1,
    titel:String(r.titel||r.uebung||"").trim(),klasse:String(r.klasse||"").trim(),
  })).filter(x=>x.ziel_id&&x.titel);
  const list=rows.filter(x=>x.ziel_id===gid&&x.stufe===lvl);
  if(!list.length) return null;
  return list[Math.floor(Math.random()*list.length)];
}
async function sendNtfy(topic,token,message,title) {
  if(!topic) return false;
  const headers={"Content-Type":"text/plain; charset=utf-8","Title":title||"Glam Trainer","Priority":"default","Tags":"bell"};
  if(token) headers["Authorization"]=`Bearer ${token}`;
  const res=await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`,{method:"POST",headers,body:message});
  if(!res.ok){const txt=await res.text();throw new Error(`Push fehlgeschlagen (${res.status}): ${txt.slice(0,140)}`);}
  return true;
}
function canSendPush(lastISO,minGapMinutes) { if(!lastISO) return true; return (Date.now()-new Date(lastISO).getTime())>=minGapMinutes*60*1000; }
async function maybeDispatchPushes() {
  const schedule=getSchedule(); if(!schedule||schedule.dayKey!==todayKey()) return;
  const settings=state.settings,now=new Date();
  const due=(schedule.units||[]).filter(u=>u.status==="geplant"&&u.plannedAt&&new Date(u.plannedAt)<=now);
  if(!due.length||!canSendPush(schedule.lastPushAtGoals,settings.minGapGoalsMin)) return;
  const show=due.slice(0,settings.maxUnitsPerBundle),more=due.length-show.length;
  const lines=[`Trainingseinheiten faellig: ${due.length}`,""]; show.forEach(u=>lines.push(`- ${u.ziel_name} Stufe ${u.stufe}`));
  if(more>0) lines.push(`+${more} weitere`); lines.push("","Oeffne die App.");
  try{await sendNtfy(settings.ntfyGoalsTopic,settings.ntfyToken,lines.join("\n"),"Training faellig");schedule.lastPushAtGoals=nowISO();setSchedule(schedule);toast("Push gesendet.");}
  catch(e){console.warn(e);}
}
function completeUnit(unitId,result) {
  const schedule=getSchedule(); if(!schedule) return;
  const idx=(schedule.units||[]).findIndex(u=>u.id===unitId); if(idx<0) return;
  const u=schedule.units[idx]; u.status=result.status; u.doneAt=nowISO(); setSchedule(schedule);
  addLogEntry({id:`log-${Date.now()}-${Math.floor(Math.random()*10000)}`,typ:u.typ,dayKey:schedule.dayKey,createdAt:nowISO(),
    ziel_id:u.ziel_id,ziel_name:u.ziel_name,stufe:u.stufe,uebung:result.uebungText||"",status:result.status,
    rueckmeldung:result.rueckmeldung||"",gern:result.gern||null,notiz:result.notiz||"",plannedLabel:u.plannedLabel||""});
  if(u.typ==="ziel") applyProgression(u.ziel_id);
}
function applyProgression(goalId) {
  const gid=normId(goalId),logs=getLog().filter(e=>e.typ==="ziel"&&normId(e.ziel_id)===gid);
  const last2=logs.slice(0,2),consecAbort=last2.length===2&&last2.every(x=>x.status==="abgebrochen");
  const aborts=logs.slice(0,7).filter(x=>x.status==="abgebrochen").length;
  const goal=getGoalsNormalized().find(g=>normId(g.ziel_id)===gid); if(!goal) return;
  const cur=goal.aktuelle_stufe,maxStufe=goal.max_stufe; let newStufe=cur;
  if(consecAbort||aborts>=3){newStufe=Math.max(1,cur-1);}
  else{const success=logs.filter(e=>Number(e.stufe)===cur&&e.status==="erledigt");
    if(success.length>=5){let points=0;for(const s of success){if(s.rueckmeldung==="leicht")points+=2;else if(s.rueckmeldung==="okay")points+=1;}if(points>=6)newStufe=Math.min(maxStufe,cur+1);}
  }
  if(newStufe!==cur){setGoalOverride(gid,{aktuelle_stufe:newStufe});toast(newStufe>cur?"Naechste Stufe freigeschaltet.":"Eine Stufe zurueck (sanft).");regenIfNeeded(true);render();}
}

function setActiveNav(route) { document.querySelectorAll(".navbtn").forEach(b=>{b.classList.toggle("active",route.startsWith(b.getAttribute("data-route")));}); }
function h(tag,attrs={},children=[]) {
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==="class") el.className=v;
    else if(k.startsWith("on")&&typeof v==="function") el.addEventListener(k.slice(2).toLowerCase(),v);
    else if(k==="html") el.innerHTML=v;
    else el.setAttribute(k,v);
  }
  (children||[]).forEach(c=>{if(c==null)return;el.appendChild(typeof c==="string"?document.createTextNode(c):c);});
  return el;
}
function sectionTitle(icon,title,rightEl) {
  return h("div",{class:"section-title"},[h("h2",{},[`${icon} ${title}`]),h("div",{class:"right"},rightEl?[rightEl]:[])]);
}
function chip(label,active,onClick) { return h("button",{class:"chip"+(active?" active":""),type:"button",onclick:onClick},[label]); }
function openModal(contentEl) {
  const backdrop=h("div",{class:"modal-backdrop"},[h("div",{class:"modal"},[contentEl])]);
  backdrop.addEventListener("click",(e)=>{if(e.target===backdrop)backdrop.remove();});
  document.body.appendChild(backdrop); return ()=>backdrop.remove();
}
function unitDetailModal(unit) {
  const schedule=getSchedule(),u=schedule?.units?.find(x=>x.id===unit.id)||unit;
  const exercise=u.typ==="ziel"?pickExerciseForGoal(u.ziel_id,u.stufe):null;
  const title=u.typ==="ziel"?"Trainingseinheit":"Aufgabe";
  const main=u.typ==="ziel"?`${u.ziel_name} - Stufe ${u.stufe}\n\n${exercise?.titel?"Uebung: "+exercise.titel:"Keine Uebung gefunden."}`:( u.title||u.aufgabe||"");
  const closeBtn=h("button",{class:"modal-close",type:"button"},["X"]);
  const statusRow=h("div",{class:"row"},[h("button",{class:"btn secondary",type:"button",id:"btnDone"},["Geschafft"]),h("button",{class:"btn secondary",type:"button",id:"btnAbort"},["Abgebrochen"])]);
  const feedbackRow=h("div",{class:"row",style:"margin-top:8px"},[h("button",{class:"btn secondary",type:"button",id:"fb1"},["leicht"]),h("button",{class:"btn secondary",type:"button",id:"fb2"},["okay"]),h("button",{class:"btn secondary",type:"button",id:"fb3"},["schwer"])]);
  const gernSel=h("select",{class:"select",id:"gernSel"},[h("option",{value:""},["Gern gemacht? (optional)"]),...[1,2,3,4,5].map(n=>h("option",{value:String(n)},[String(n)]))]);
  const note=h("textarea",{class:"textarea",id:"note",placeholder:"Notiz (optional)"},[]);
  const btnSave=h("button",{class:"btn",type:"button"},["Speichern"]);
  const btnDel=h("button",{class:"btn danger",type:"button"},["Eintrag loeschen"]);
  const btnClose=h("button",{class:"btn secondary",type:"button"},["Zurueck"]);
  const body=h("div",{},[h("div",{class:"modal-header"},[h("div",{class:"modal-title"},[title]),closeBtn]),h("div",{class:"hr"},[]),h("div",{class:"small"},[u.plannedLabel?`Geplant: ${u.plannedLabel}`:""]),h("div",{style:"white-space:pre-line;font-size:16px;font-weight:800;margin-top:8px"},[main]),h("div",{class:"hr"},[]),h("div",{class:"small"},["Rueckmeldung (fuer Ziele empfohlen):"]),statusRow,feedbackRow,gernSel,note,h("div",{class:"row",style:"margin-top:10px"},[btnSave,btnClose,btnDel])]);
  const close=openModal(body); closeBtn.onclick=close; btnClose.onclick=close;
  let chosenStatus=null,rueck=null;
  function activateBtn(btn,group){group.forEach(b=>{b.style.background="";b.style.color="";b.style.borderColor="";b.style.fontWeight="";});btn.style.background="rgba(164,107,138,.9)";btn.style.color="#fff";btn.style.borderColor="rgba(164,107,138,1)";btn.style.fontWeight="900";}
  const sBtns=[body.querySelector("#btnDone"),body.querySelector("#btnAbort")];
  const fBtns=[body.querySelector("#fb1"),body.querySelector("#fb2"),body.querySelector("#fb3")];
  body.querySelector("#btnDone").onclick=()=>{chosenStatus="erledigt";activateBtn(body.querySelector("#btnDone"),sBtns);};
  body.querySelector("#btnAbort").onclick=()=>{chosenStatus="abgebrochen";activateBtn(body.querySelector("#btnAbort"),sBtns);};
  body.querySelector("#fb1").onclick=()=>{rueck="leicht";activateBtn(body.querySelector("#fb1"),fBtns);};
  body.querySelector("#fb2").onclick=()=>{rueck="okay";activateBtn(body.querySelector("#fb2"),fBtns);};
  body.querySelector("#fb3").onclick=()=>{rueck="schwer";activateBtn(body.querySelector("#fb3"),fBtns);};
  btnSave.onclick=()=>{
    if(!chosenStatus){toast("Bitte: Geschafft oder Abgebrochen waehlen.");return;}
    if(u.typ==="ziel"&&!rueck){toast("Bitte Rueckmeldung waehlen.");return;}
    completeUnit(u.id,{status:chosenStatus,rueckmeldung:rueck||"",gern:body.querySelector("#gernSel").value?parseInt(body.querySelector("#gernSel").value,10):null,notiz:body.querySelector("#note").value.trim(),uebungText:exercise?.titel||""});
    close();render();
  };
  btnDel.onclick=()=>{const s=getSchedule();if(!s)return;const i=(s.units||[]).findIndex(x=>x.id===u.id);if(i>=0){s.units.splice(i,1);setSchedule(s);toast("Geloescht.");close();render();}};
}

function listItemCard(unit) {
  const isGoal=unit.typ==="ziel";
  return h("div",{class:"item"},[h("div",{class:"badge "+(isGoal?"goal":"task")},[isGoal?"🎯":"🧩"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[isGoal?`${unit.ziel_name} - Stufe ${unit.stufe}`:(unit.title||unit.aufgabe||"Aufgabe")]),h("div",{class:"item-sub"},[isGoal?"Uebung: (wird beim Oeffnen gewaehlt)":(unit.rubrik?`Rubrik: ${unit.rubrik}`:"")]),h("div",{class:"row",style:"margin-top:10px;gap:10px"},[h("button",{class:"btn secondary",type:"button",onclick:()=>unitDetailModal(unit)},["Oeffnen"])])]),h("div",{class:"time"},[unit.plannedLabel||""])]);
}
function moduleTile(icon,title,lines,btnText,onClick) {
  return h("div",{class:"card"},[h("div",{style:"display:flex;align-items:flex-start;gap:10px"},[h("div",{class:"badge task",style:"width:38px;height:38px"},[icon]),h("div",{style:"flex:1"},[h("div",{style:"font-weight:900;font-size:16px"},[title]),h("div",{class:"small",style:"margin-top:6px;white-space:pre-line"},[lines])])]),h("div",{class:"hr"},[]),h("button",{class:"btn secondary",type:"button",onclick:onClick},[btnText])]);
}
function goalsSummaryText() { const goals=getGoalsNormalized().filter(g=>g.aktiv); if(!goals.length) return "Aktiv: 0\nKeine aktiven Ziele."; return `Aktiv: ${goals.length}\n`+goals.slice(0,3).map(g=>`${g.ziel_name} - Stufe ${g.aktuelle_stufe}/${g.max_stufe}`).join("\n"); }
function tasksSummaryText() { const open=state.anjaTasks.filter(x=>x.status==="offen"||x.status==="angenommen").length; return `Inbox (Anja): ${open}\nOptional: Aufgaben sind lustbasiert.`; }

function renderNav() {
  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[
    h("div",{class:"card"},[
      sectionTitle("🧭","Start",null),
      h("div",{class:"small"},["Waehle, welchen Bereich du oeffnen willst."]),
      h("div",{class:"hr"},[]),
      h("div",{class:"grid2"},[
        moduleTile("🜂","Sub","Ziele, Trainings, Log & Settings.","Oeffnen",()=>{location.hash="#/home";}),
        moduleTile("👑","Dom","Anjas Aufgaben/Kleidung/Kombination.","Oeffnen",()=>{location.hash="#/anja";}),
        moduleTile("🤍","Cuckold","Gefuehl & Wunsch - fuer Anja.","Oeffnen",()=>{location.hash="#/cuckold";}),
      ]),
    ]),
  ]);
}

async function loadGoalsFromCSV() {
  try {
    const [goalsTxt,stepsTxt]=await Promise.all([fetchText("goals.csv").catch(()=>""),fetchText("goal_uebungen.csv").catch(()=>"")]);
    return {goals:goalsTxt?parseCSV(goalsTxt):[],steps:stepsTxt?parseCSV(stepsTxt):[]};
  } catch {return {goals:[],steps:[]};}
}

function renderAnja() {
  const btnBack=h("button",{class:"btn secondary",type:"button",onclick:()=>{location.hash="#/nav";}},["Zur Startauswahl"]);
  const iframe=h("iframe",{src:"control_panel.html",style:"width:100%;height:600px;min-height:400px;border:0;border-radius:16px;background:transparent;",loading:"lazy",scrolling:"yes"});
  const zieleCard=h("div",{class:"card"},[sectionTitle("🎯","Aktive Ziele",null),h("div",{class:"small",id:"anjaGoalsList"},["Lade Ziele..."])]);
  loadGoalsFromCSV().then(({goals,steps})=>{
    const box=document.getElementById("anjaGoalsList"); if(!box) return;
    const normalized=goals.map(raw=>{
      const ziel_id=String(raw.ziel_id||"").trim().toUpperCase(),ziel_name=String(raw.ziel_name||raw.name||"").trim()||ziel_id;
      const aktiv=["true","ja","1"].includes(String(raw.aktiv||"").trim().toLowerCase());
      const aktuelle_stufe=parseInt(raw.aktuelle_stufe||"1",10)||1,max_stufe=parseInt(raw.max_stufe||"5",10)||5;
      const ov=state.goalOverrides[ziel_id]||{};
      return {ziel_id,ziel_name,aktiv:typeof ov.aktiv==="boolean"?ov.aktiv:aktiv,aktuelle_stufe:typeof ov.aktuelle_stufe==="number"?ov.aktuelle_stufe:aktuelle_stufe,max_stufe};
    }).filter(g=>g.ziel_id&&g.aktiv);
    if(!normalized.length){box.textContent="Keine aktiven Ziele.";return;}
    box.textContent=""; box.className="list";
    normalized.forEach(g=>{
      const ex=steps.map(r=>({ziel_id:String(r.ziel_id||"").trim().toUpperCase(),stufe:parseInt(r.stufe||"1",10)||1,titel:String(r.titel||r.uebung||"").trim()})).filter(x=>x.ziel_id===g.ziel_id&&x.stufe===g.aktuelle_stufe&&x.titel);
      const uebung=ex.length?ex[Math.floor(Math.random()*ex.length)].titel:"";
      box.appendChild(h("div",{class:"item"},[h("div",{class:"badge goal"},["🎯"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[g.ziel_name]),h("div",{class:"item-sub"},[`Stufe ${g.aktuelle_stufe}/${g.max_stufe}${uebung?"\nAktuell: "+uebung:""}`])])]));
    });
  });
  const openTasks=state.anjaTasks.filter(t=>t.status==="offen"||t.status==="angenommen");
  const aufgabenCard=h("div",{class:"card"},[sectionTitle("👑","Offene Aufgaben",null),openTasks.length?h("div",{class:"list"},openTasks.map(t=>h("div",{class:"item"},[h("div",{class:"badge task"},["👑"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[t.title||"Aufgabe"]),h("div",{class:"item-sub"},[[`Status: ${t.status}`,t.dueAt?`Faellig: ${fmtDateTimeLocal(t.dueAt)}`:""].filter(Boolean).join(" - ")])])]))):h("div",{class:"small"},["Keine offenen Aufgaben."])]);
  const smileys=["","😔","😕","😐","🙂","😍"],cuck=state.cuckold||{};
  const cuckCard=cuck.gefuehl?h("div",{class:"card"},[sectionTitle("🤍","Cuckold",null),h("div",{style:"font-size:48px;text-align:center;margin:8px 0;"},[smileys[cuck.gefuehl]||""]),h("div",{class:"small",style:"text-align:center;"},[`Gefuehl: ${cuck.gefuehl}/5`]),cuck.wunsch?h("div",{style:"margin-top:12px;font-size:15px;font-weight:700;"},[`Wunsch: ${cuck.wunsch}`]):null].filter(Boolean)):null;
  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[
    h("div",{class:"card"},[sectionTitle("👑","Dom",btnBack),h("div",{class:"small"},["Ziele & Aufgaben - geraeteuebergreifend via Firebase."])]),
    cuckCard,zieleCard,aufgabenCard,
    h("div",{class:"card"},[h("div",{style:"font-weight:900;font-size:16px;margin-bottom:8px"},["Aufgaben erstellen"]),h("div",{class:"hr"},[]),iframe]),
  ].filter(Boolean));
}

function renderHome() {
  regenIfNeeded(false);
  const schedule=getSchedule(),units=schedule?.units||[],now=new Date();
  const due=units.filter(u=>u.status==="geplant"&&u.plannedAt&&new Date(u.plannedAt)<=now);
  const planned=units.filter(u=>u.status==="geplant"&&u.plannedAt&&new Date(u.plannedAt)>now);
  const filtered=(arr)=>{if(state.filter==="goals")return arr.filter(x=>x.typ==="ziel");if(state.filter==="tasks")return arr.filter(x=>x.typ==="aufgabe");return arr;};
  const chips=h("div",{class:"chips"},[chip("Alle",state.filter==="all",()=>{state.filter="all";render();}),chip("🎯 Ziele",state.filter==="goals",()=>{state.filter="goals";render();}),chip("🧩 Aufgaben",state.filter==="tasks",()=>{state.filter="tasks";render();})]);
  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[
    h("div",{class:"card"},[sectionTitle("🔔","Jetzt faellig",chips),filtered(due).length?h("div",{class:"list"},filtered(due).map(listItemCard)):h("div",{class:"small"},["Keine Einheiten faellig."])]),
    h("div",{class:"card"},[sectionTitle("📅","Heute geplant",null),filtered(planned).length?h("div",{class:"list"},filtered(planned).map(listItemCard)):h("div",{class:"small"},["Heute ist nichts weiter geplant."])]),
    h("div",{class:"grid2"},[moduleTile("🎯","Ziele",goalsSummaryText(),"Ziele oeffnen",()=>{location.hash="#/goals";}),moduleTile("🧩","Aufgaben",tasksSummaryText(),"Aufgaben oeffnen",()=>{location.hash="#/tasks";})]),
  ]);
}

function renderGoals() {
  const goals=getGoalsNormalized();
  const cards=goals.map(g=>{
    const {period,min,max,done}=computeGoalQuota(g);
    const freq=period==="TAG"?`Heute: ${done} / ${min}-${max||min}`:`Diese Woche: ${done} / ${min}-${max||min}`;
    const mod=g.modus==="ritualisiert"?`ritualisiert ${g.feste_zeit||"09:00"}`:`flexibel ${g.zeit_von||"14:00"}-${g.zeit_bis||"20:00"}`;
    const btnBack=h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",...(g.aktuelle_stufe<=1?{disabled:"true"}:{}),onclick:()=>{setGoalOverride(g.ziel_id,{aktuelle_stufe:Math.max(1,g.aktuelle_stufe-1)});toast(`${g.ziel_name}: Stufe ${g.aktuelle_stufe-1}`);regenIfNeeded(true);render();}},["< Stufe"]);
    const btnFwd=h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",...(g.aktuelle_stufe>=g.max_stufe?{disabled:"true"}:{}),onclick:()=>{setGoalOverride(g.ziel_id,{aktuelle_stufe:Math.min(g.max_stufe,g.aktuelle_stufe+1)});toast(`${g.ziel_name}: Stufe ${g.aktuelle_stufe+1}`);regenIfNeeded(true);render();}},["Stufe >"]);
    return h("div",{class:"item"},[h("div",{class:"badge goal"},["🎯"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[g.ziel_name]),h("div",{class:"item-sub"},[`Stufe ${g.aktuelle_stufe} von ${g.max_stufe}\n${freq}\n${mod}`]),h("div",{class:"row",style:"margin-top:10px;gap:8px;flex-wrap:wrap;"},[h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",onclick:()=>toggleGoalActive(g.ziel_id)},[g.aktiv?"Pausieren":"Aktivieren"]),btnBack,btnFwd])])]);
  });
  return h("div",{class:"card"},[sectionTitle("🎯","Ziele",null),cards.length?h("div",{class:"list"},cards):h("div",{class:"small"},["Keine Ziele in goals.csv gefunden."])]);
}
function toggleGoalActive(goalId) { const gid=normId(goalId),goal=getGoalsNormalized().find(g=>normId(g.ziel_id)===gid); setGoalOverride(gid,{aktiv:!(goal?!!goal.aktiv:false)}); regenIfNeeded(true);render(); }

function ratingRow(label) {
  const btnEls=[1,2,3,4,5].map(n=>{const b=document.createElement("button");b.className="btn secondary";b.type="button";b.textContent=String(n);b.style.cssText="min-width:52px;min-height:52px;font-size:20px;font-weight:700;border-radius:12px;";return b;});
  const row=h("div",{style:"display:flex;flex-direction:column;gap:6px;margin-top:8px;"},[h("div",{class:"small"},[label]),h("div",{style:"display:flex;gap:10px;flex-wrap:wrap;"},btnEls)]);
  row.dataset.selected="";
  btnEls.forEach((b,i)=>{b.addEventListener("click",()=>{btnEls.forEach(x=>{x.style.background="";x.style.borderColor="";x.style.color="";x.style.transform="";});b.style.background="rgba(164,107,138,.8)";b.style.borderColor="rgba(164,107,138,1)";b.style.color="#fff";b.style.transform="scale(1.15)";row.dataset.selected=String(i+1);});});
  return row;
}

function renderAnjaInbox() {
  const active=state.anjaTasks.filter(t=>t.status==="offen"||t.status==="angenommen");
  const done=state.anjaTasks.filter(t=>t.status==="erledigt"||t.status==="abgebrochen").sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  const canExecute=t=>!t.dueAt||new Date(t.dueAt)<=new Date();
  function buildActiveCard(t) {
    const locked=!canExecute(t);
    const meta=[`Status: ${t.status}`,t.dueAt?`Faellig am: ${fmtDateTimeLocal(t.dueAt)}`:"Faellig: sofort",t.note?`Bemerkung: ${t.note}`:""].filter(Boolean).join("\n");
    const btnAccept=h("button",{class:"btn secondary",type:"button",onclick:async()=>{await setAnjaTaskStatus(t.id,"angenommen");toast("Aufgabe angenommen.");render();}},["Annehmen"]);
    const schwRow=ratingRow("Schwierigkeit (1=leicht, 5=schwer)"),gerneRow=ratingRow("Wie gerne? (1=widerwillig, 5=sehr gerne)");
    const txtNote=h("textarea",{class:"textarea",placeholder:"Anmerkung (optional)...",style:"min-height:56px;font-size:14px;"},[]);
    const cbWA=h("input",{type:"checkbox",id:`wa_${t.id}`,style:"width:22px;height:22px;"});
    const waLabel=h("label",{style:"display:flex;align-items:center;gap:8px;font-size:14px;color:var(--muted)"},[cbWA,"Beleg kommt per WhatsApp"]);
    const doneForm=h("div",{style:"display:none;flex-direction:column;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#242838);"},[schwRow,gerneRow,txtNote,waLabel,h("div",{class:"row"},[h("button",{class:"btn",type:"button",style:"flex:1;min-height:48px;",onclick:async()=>{await setAnjaTaskStatus(t.id,"erledigt",{schwierigkeit:schwRow.dataset.selected?parseInt(schwRow.dataset.selected):null,gerne:gerneRow.dataset.selected?parseInt(gerneRow.dataset.selected):null,rueckmeldung:txtNote.value.trim(),belegWA:cbWA.checked});toast("Gespeichert.");render();}},["Abschicken"]),h("button",{class:"btn secondary",type:"button",style:"min-height:48px;",onclick:()=>{doneForm.style.display="none";}},["Abbrechen"])])]);
    const txtAbort=h("textarea",{class:"textarea",placeholder:"Grund (Pflicht)...",style:"min-height:56px;font-size:14px;"},[]);
    const abortForm=h("div",{style:"display:none;flex-direction:column;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#242838);"},[h("div",{class:"small"},["Warum abgebrochen?"]),txtAbort,h("div",{class:"row"},[h("button",{class:"btn danger",type:"button",style:"flex:1;min-height:48px;",onclick:async()=>{if(!txtAbort.value.trim()){toast("Bitte Grund angeben.");return;}await setAnjaTaskStatus(t.id,"abgebrochen",{rueckmeldung:txtAbort.value.trim()});toast("Abgebrochen gespeichert.");render();}},["Bestaetigen"]),h("button",{class:"btn secondary",type:"button",style:"min-height:48px;",onclick:()=>{abortForm.style.display="none";}},["Abbrechen"])])]);
    const btnDone=h("button",{class:"btn secondary",type:"button",...(locked?{disabled:"true"}:{}),style:"flex:1;min-height:48px;",onclick:()=>{doneForm.style.display=doneForm.style.display==="none"?"flex":"none";abortForm.style.display="none";}},["Erledigt"]);
    const btnAbort=h("button",{class:"btn secondary",type:"button",...(locked?{disabled:"true"}:{}),style:"min-height:48px;",onclick:()=>{abortForm.style.display=abortForm.style.display==="none"?"flex":"none";doneForm.style.display="none";}},["Abbruch"]);
    const btnDelete=h("button",{class:"btn secondary",type:"button",style:"min-height:48px;color:#c25d6a;border-color:rgba(194,93,106,.4);",onclick:async()=>{if(!t._fbKey){toast("Kein Firebase-Key.");return;}try{await fbPatch(`anja_tasks/${t._fbKey}`,{status:"geloescht",updatedAt:nowISO()});state.anjaTasks=state.anjaTasks.filter(x=>x._fbKey!==t._fbKey);toast("Aufgabe geloescht.");render();}catch(e){toast("Fehler beim Loeschen.");}}},["🗑"]);
    return h("div",{class:"item"},[h("div",{class:"badge task"},["👑"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[t.title||"Aufgabe"]),h("div",{class:"item-sub"},[meta]),h("div",{class:"row",style:"margin-top:10px;gap:8px;flex-wrap:wrap;"},[t.status==="offen"?btnAccept:null,btnDone,btnAbort,btnDelete,locked?h("div",{class:"small"},["(gesperrt bis Faelligkeit)"]):null].filter(Boolean)),doneForm,abortForm])]);
  }
  function buildDoneCard(t) {
    const isErledigt=t.status==="erledigt";
    const meta=[t.doneAt?`Erledigt: ${fmtDateTimeLocal(t.doneAt)}`:"",t.schwierigkeit?`Schwierigkeit: ${t.schwierigkeit}/5`:"",t.gerne?`Gerne: ${t.gerne}/5`:"",t.rueckmeldung?`Notiz: ${t.rueckmeldung}`:"",t.belegWA?"Beleg per WhatsApp":""].filter(Boolean).join("\n");
    return h("div",{class:"item",style:"opacity:0.75;"},[h("div",{class:"badge task",style:isErledigt?"background:rgba(100,200,120,.15)":"background:rgba(200,80,80,.12)"},[isErledigt?"V":"X"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[t.title||"Aufgabe"]),h("div",{class:"item-sub"},[meta])])]);
  }
  const refreshBtn=h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",onclick:async()=>{toast("Lade...");await loadAnjaTasks();render();toast("Aktualisiert.");}},["🔄"]);
  return h("div",{class:"card"},[sectionTitle("👑","Aufgaben",refreshBtn),active.length?h("div",{class:"list"},active.map(buildActiveCard)):h("div",{class:"small"},["Keine offenen Aufgaben."]),done.length?h("div",{class:"hr",style:"margin:16px 0"},[]):null,done.length?h("div",{class:"small",style:"margin-bottom:8px;font-weight:700;"},["Abgeschlossen"]):null,done.length?h("div",{class:"list"},done.map(buildDoneCard)):null].filter(Boolean));
}

function getWunschItems() {
  const csvW=(state.tasksData||[]).filter(r=>{const typ=String(r.typ||"").trim().toLowerCase(),w=String(r.wunsch||"").trim().toUpperCase();return typ==="wunsch"||w==="W";}).map(r=>({titel:String(r.titel||"").trim(),custom:false})).filter(x=>x.titel);
  const fbW=(state.customWishes||[]).map(w=>({titel:String(w.titel||"").trim(),custom:true,_fbKey:w._fbKey})).filter(x=>x.titel);
  return [...csvW,...fbW];
}

function renderCuckold() {
  const btnBack=h("button",{class:"btn secondary",type:"button",onclick:()=>{location.hash="#/nav";}},["Zurueck"]);
  const smileys=["","😔","😕","😐","🙂","😍"],cuck=state.cuckold||{};
  const gefuehlBtns=[1,2,3,4,5].map(n=>{
    const b=document.createElement("button");b.className="btn secondary";b.type="button";b.textContent=smileys[n];
    b.style.cssText="font-size:32px;min-width:56px;min-height:56px;border-radius:14px;";
    if(cuck.gefuehl===n){b.style.background="rgba(164,107,138,.8)";b.style.borderColor="rgba(164,107,138,1)";b.style.transform="scale(1.15)";}
    b.addEventListener("click",async()=>{state.cuckold={...state.cuckold,gefuehl:n};await fbSetCuckold(state.cuckold);toast("Gefuehl gespeichert.");render();});
    return b;
  });
  const gefuehlRow=h("div",{style:"display:flex;flex-direction:column;gap:10px;"},[h("div",{class:"small"},["Wie geht es dir gerade? (1=schlecht, 5=gut)"]),h("div",{style:"display:flex;gap:10px;flex-wrap:wrap;"},gefuehlBtns)]);
  const alleW=getWunschItems();
  const sel=document.createElement("select");sel.className="select";sel.style.cssText="width:100%;min-height:48px;font-size:15px;";
  const optP=document.createElement("option");optP.value="";optP.textContent="Wunsch auswaehlen...";sel.appendChild(optP);
  alleW.forEach(w=>{const opt=document.createElement("option");opt.value=w.titel;opt.textContent=(w.custom?"✏ ":"")+w.titel;if(cuck.wunsch===w.titel)opt.selected=true;sel.appendChild(opt);});
  sel.addEventListener("change",async()=>{state.cuckold={...state.cuckold,wunsch:sel.value||null};await fbSetCuckold(state.cuckold);toast(sel.value?"Wunsch gesetzt.":"Wunsch entfernt.");render();});
  const customList=(state.customWishes||[]).map(w=>h("div",{style:"display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line,#242838);"},[h("div",{style:"flex:1;font-size:14px;"},[w.titel]),h("button",{class:"btn secondary",type:"button",style:"min-height:36px;padding:4px 10px;font-size:13px;color:#c25d6a;border-color:rgba(194,93,106,.4);",onclick:async()=>{if(!w._fbKey)return;await fbDeleteCustomWish(w._fbKey);state.customWishes=state.customWishes.filter(x=>x._fbKey!==w._fbKey);if(state.cuckold.wunsch===w.titel){state.cuckold={...state.cuckold,wunsch:null};await fbSetCuckold(state.cuckold);}toast("Wunsch geloescht.");render();}},["🗑"])]));
  const txtNew=h("input",{type:"text",class:"input",placeholder:"Neuen Wunsch eingeben...",style:"min-height:48px;font-size:15px;"});
  const btnAdd=h("button",{class:"btn",type:"button",style:"min-height:48px;",onclick:async()=>{const val=txtNew.value.trim();if(!val){toast("Bitte Wunsch eingeben.");return;}const fbKey=await fbAddCustomWish(val);state.customWishes.push({titel:val,_fbKey:fbKey,createdAt:nowISO()});toast("Wunsch hinzugefuegt.");render();}},["+ Hinzufuegen"]);
  const wunschCard=h("div",{class:"card"},[
    h("div",{class:"small",style:"margin-bottom:8px;"},["Mein Wunsch als Belohnung:"]),
    sel,
    h("div",{class:"hr",style:"margin:14px 0;"}),
    h("div",{class:"small",style:"margin-bottom:8px;"},["Eigenen Wunsch hinzufuegen:"]),
    h("div",{class:"row"},[txtNew,btnAdd]),
    customList.length?h("div",{style:"margin-top:12px;"},[h("div",{class:"small",style:"margin-bottom:6px;"},["Eigene Wuensche:"]),...customList]):null,
  ].filter(Boolean));
  const currentStatus=h("div",{class:"card",style:"text-align:center;"},[
    h("div",{style:"font-size:56px;margin:8px 0;"},[smileys[cuck.gefuehl]||"-"]),
    cuck.gefuehl?h("div",{class:"small"},[`Gefuehl: ${cuck.gefuehl}/5`]):h("div",{class:"small"},["Noch kein Gefuehl eingetragen."]),
    cuck.wunsch?h("div",{style:"margin-top:10px;font-size:15px;font-weight:700;"},[`Wunsch: ${cuck.wunsch}`]):null,
  ].filter(Boolean));
  return h("div",{style:"display:flex;flex-direction:column;gap:12px;"},[
    h("div",{class:"card"},[
      sectionTitle("🤍","Cuckold",btnBack),
      h("div",{class:"small"},["Dein Gefuehl & Wunsch - sichtbar fuer Anja."]),
    ]),
    currentStatus,
    h("div",{class:"card"},[gefuehlRow]),
    wunschCard,
  ]);
}

function renderTasks() {
  const rubriken=[...new Set((state.tasksData||[]).filter(r=>String(r.typ||"Aufgabe").trim().toLowerCase()!=="wunsch").map(r=>(r.rubrik||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
  const rubSel=h("select",{class:"select",id:"rubSel"},[h("option",{value:""},["Rubrik waehlen"]),...rubriken.map(r=>h("option",{value:r},[r]))]);
  const taskSel=h("select",{class:"select",id:"taskSel",disabled:"true"},[h("option",{value:""},["Aufgabe waehlen"])]);
  const out=h("div",{id:"taskOut",style:"white-space:pre-line;font-weight:800;margin-top:10px"},[""]);
  const btnRandom=h("button",{class:"btn secondary",type:"button"},["Zufallsaufgabe"]);
  const btnPush=h("button",{class:"btn secondary",type:"button"},["Push senden"]);
  function getItemsForRubrik(rub){return(state.tasksData||[]).filter(r=>String(r.typ||"Aufgabe").trim().toLowerCase()!=="wunsch").map(r=>({rubrik:(r.rubrik||"").trim(),titel:(r.titel||"").trim()})).filter(x=>x.rubrik===rub&&x.titel);}
  function setOutFromItem(it){out.textContent=`Aufgabe\nRubrik: ${it.rubrik}\n\n${it.titel}`;out.dataset.payload=JSON.stringify(it);}
  function rebuildTaskSelect(){const rub=rubSel.value;taskSel.innerHTML="";taskSel.appendChild(h("option",{value:""},["Aufgabe waehlen"]));if(!rub){taskSel.disabled=true;return;}const items=getItemsForRubrik(rub);items.forEach((it,idx)=>taskSel.appendChild(h("option",{value:String(idx)},[it.titel])));taskSel.disabled=!items.length;}
  rubSel.onchange=()=>{rebuildTaskSelect();out.textContent="";delete out.dataset.payload;};
  taskSel.onchange=()=>{const items=getItemsForRubrik(rubSel.value),idx=parseInt(taskSel.value||"-1",10);if(idx>=0&&items[idx])setOutFromItem(items[idx]);};
  btnRandom.onclick=()=>{if(!rubSel.value){toast("Bitte Rubrik waehlen.");return;}const items=getItemsForRubrik(rubSel.value);if(!items.length){toast("Keine Aufgaben in dieser Rubrik.");return;}setOutFromItem(items[Math.floor(Math.random()*items.length)]);toast("Zufallsaufgabe gewaehlt.");};
  btnPush.onclick=async()=>{const payload=out.dataset.payload?JSON.parse(out.dataset.payload):null;if(!payload){toast("Erst eine Aufgabe waehlen.");return;}try{await sendNtfy(state.settings.ntfyTasksTopic,state.settings.ntfyToken,`Aufgabe\nRubrik: ${payload.rubrik}\n\n${payload.titel}`,"Aufgabe");toast("Push gesendet.");}catch(e){console.warn(e);toast("Push fehlgeschlagen.");}};
  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[renderAnjaInbox(),h("div",{class:"card"},[sectionTitle("🧩","Aufgaben",null),h("div",{class:"small"},["Aufgaben sind optional. Keine Progression, keine Strafen."]),h("div",{class:"hr"},[]),rubSel,taskSel,h("div",{class:"row"},[btnRandom,btnPush]),out])]);
}

function renderLog() {
  const log=getLog();
  const filterCh=h("div",{class:"chips"},[chip("Alle",state.filter==="all",()=>{state.filter="all";render();}),chip("🎯 Ziele",state.filter==="goals",()=>{state.filter="goals";render();}),chip("🧩 Aufgaben",state.filter==="tasks",()=>{state.filter="tasks";render();})]);
  const filtered=log.filter(e=>state.filter==="all"||(state.filter==="goals"&&e.typ==="ziel")||(state.filter==="tasks"&&e.typ==="aufgabe"));
  const list=filtered.map(e=>{
    const isGoal=e.typ==="ziel",subLines=[];
    if(isGoal){if(e.uebung)subLines.push(`Uebung: ${e.uebung}`);if(e.rueckmeldung)subLines.push(`Rueckmeldung: ${e.rueckmeldung}`);if(e.gern)subLines.push(`Gern: ${e.gern}/5`);}
    else{if(e.schwierigkeit)subLines.push(`Schwierigkeit: ${e.schwierigkeit}/5`);if(e.gerne)subLines.push(`Gerne: ${e.gerne}/5`);if(e.rueckmeldung)subLines.push(`Notiz: ${e.rueckmeldung}`);if(e.belegWA)subLines.push("Beleg per WhatsApp");}
    if(e.status)subLines.push(`Status: ${e.status}`);if(e.notiz)subLines.push(`Notiz: ${e.notiz}`);
    return h("div",{class:"item"},[h("div",{class:"badge "+(isGoal?"goal":"task")},[isGoal?"🎯":"👑"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[isGoal?`${e.ziel_name} - Stufe ${e.stufe}`:(e.title||"Aufgabe")]),h("div",{class:"item-sub"},[`${new Date(e.createdAt).toLocaleString("de-DE")}\n${subLines.join("\n")}`])])]);
  });
  return h("div",{class:"card"},[sectionTitle("📓","Log",filterCh),filtered.length?h("div",{class:"list"},list):h("div",{class:"small"},["Noch keine Eintraege."])]);
}

function renderSettings() {
  const s=state.settings;
  const topicGoals=h("input",{class:"input",type:"text",value:s.ntfyGoalsTopic,placeholder:"Topic Ziele (ntfy)"});
  const topicTasks=h("input",{class:"input",type:"text",value:s.ntfyTasksTopic,placeholder:"Topic Aufgaben (ntfy)"});
  const token=h("input",{class:"input",type:"text",value:s.ntfyToken,placeholder:"ntfy Token (optional)"});
  const gapGoals=h("input",{class:"input",type:"number",min:"0",step:"1",value:String(s.minGapGoalsMin)});
  const maxBundle=h("input",{class:"input",type:"number",min:"1",step:"1",value:String(s.maxUnitsPerBundle)});
  const btnSave=h("button",{class:"btn",type:"button"},["Speichern"]);
  const btnTestGoals=h("button",{class:"btn secondary",type:"button"},["Push testen"]);
  const btnReload=h("button",{class:"btn secondary",type:"button"},["CSV neu laden"]);
  btnSave.onclick=()=>{s.ntfyGoalsTopic=topicGoals.value.trim();s.ntfyTasksTopic=topicTasks.value.trim();s.ntfyToken=token.value.trim();s.minGapGoalsMin=parseInt(gapGoals.value||"0",10)||0;s.maxUnitsPerBundle=parseInt(maxBundle.value||"5",10)||5;persistSettings();toast("Gespeichert.");};
  btnTestGoals.onclick=async()=>{try{await sendNtfy(s.ntfyGoalsTopic,s.ntfyToken,"Test vom Glam Trainer","Push-Test");toast("Gesendet.");}catch(e){console.warn(e);toast("Fehler.");}};
  btnReload.onclick=async()=>{try{await loadAllCSV();toast("CSV geladen.");regenIfNeeded(true);render();}catch(e){console.warn(e);toast("CSV Fehler.");}};
  return h("div",{class:"card"},[sectionTitle("⚙️","Einstellungen",null),h("div",{class:"small"},["Push/Erinnerungen funktionieren zuverlaessig, solange die App gelegentlich geoeffnet ist."]),h("div",{class:"hr"},[]),h("div",{class:"small"},["ntfy Topics"]),topicGoals,topicTasks,token,h("div",{class:"hr"},[]),h("div",{class:"small"},["Push Abstand & Buendelung"]),gapGoals,maxBundle,h("div",{class:"row",style:"margin-top:10px"},[btnSave,btnReload,btnTestGoals])]);
}

function render() {
  const dm=document.getElementById("dayMode"); if(dm) dm.value=state.settings.dayMode;
  setActiveNav(state.route);
  const view=document.getElementById("view"); if(!view) return;
  view.innerHTML=""; view.style.paddingBottom="80px";
  if(state.route.startsWith("#/nav"))           view.appendChild(renderNav());
  else if(state.route.startsWith("#/anja"))     view.appendChild(renderAnja());
  else if(state.route.startsWith("#/cuckold"))  view.appendChild(renderCuckold());
  else if(state.route.startsWith("#/home"))     view.appendChild(renderHome());
  else if(state.route.startsWith("#/goals"))    view.appendChild(renderGoals());
  else if(state.route.startsWith("#/tasks"))    view.appendChild(renderTasks());
  else if(state.route.startsWith("#/log"))      view.appendChild(renderLog());
  else if(state.route.startsWith("#/settings")) view.appendChild(renderSettings());
  else view.appendChild(renderNav());
}

function onRoute() { state.route=location.hash||"#/nav"; setActiveNav(state.route); render(); }
async function registerServiceWorker() { if(!("serviceWorker" in navigator)) return; for(const url of ["./sw.js","./service-worker.js"]){try{await navigator.serviceWorker.register(url,{scope:"./"});return;}catch{}}}
function setupControlPanelBridge() {
  window.addEventListener("message",async(ev)=>{
    const msg=ev?.data; if(!msg||typeof msg!=="object") return;
    if(msg.type==="GT_NEW_TASK"){await loadAnjaTasks();toast("Neue Aufgabe von Anja.");render();}
    if(msg.type==="GT_REFRESH"){await loadAnjaTasks();render();}
  });
}
async function init() {
  const label=document.getElementById("todayLabel");
  if(label) label.textContent=new Date().toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  const dm=document.getElementById("dayMode"); if(dm) dm.addEventListener("change",(e)=>setDayMode(e.target.value));
  const btnSync=document.getElementById("btnSync"); if(btnSync) btnSync.addEventListener("click",async()=>{try{await loadAllCSV();toast("CSV geladen.");regenIfNeeded(true);render();}catch(e){console.warn(e);toast("CSV Fehler.");}});
  document.querySelectorAll(".navbtn").forEach(b=>b.addEventListener("click",()=>{location.hash=b.getAttribute("data-route");}));
  window.addEventListener("hashchange",onRoute);
  setupControlPanelBridge(); await registerServiceWorker();
  const [,,cuckData,customWishData]=await Promise.all([loadAllCSV().catch(console.warn),loadAnjaTasks(),fbGetCuckold().catch(()=>({})),fbGetCustomWishes().catch(()=>[])]);
  state.cuckold=cuckData||{gefuehl:null,wunsch:null}; state.customWishes=customWishData||[];
  regenIfNeeded(true); setInterval(()=>maybeDispatchPushes(),state.settings.tickSeconds*1000);
  setInterval(async()=>{await loadAnjaTasks();const cd=await fbGetCuckold().catch(()=>null);if(cd)state.cuckold=cd;const cw=await fbGetCustomWishes().catch(()=>null);if(cw)state.customWishes=cw;if(state.route.startsWith("#/tasks")||state.route.startsWith("#/anja")||state.route.startsWith("#/cuckold"))render();},30000);
  if(!location.hash) location.hash="#/nav";
  onRoute();
}
init();
