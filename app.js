/* Glam Trainer — V3.0 */

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

// ── Wünsche (Marlo) ──
async function fbGetWuensche() { const data=await fbGet("wuensche"); if(!data) return []; return Object.entries(data).map(([k,v])=>({...v,_fbKey:k})); }
async function fbAddWunsch(titel) { return await fbPush("wuensche",{titel,createdAt:nowISO()}); }
async function fbDeleteWunsch(fbKey) { return await fbDelete(`wuensche/${fbKey}`); }

// ── Wochenplan ──
async function fbGetWochenplan() { const data=await fbGet("wochenplan"); if(!data) return []; return Object.entries(data).map(([k,v])=>({...v,_fbKey:k})); }
async function fbAddWochenplanEintrag(entry) { return await fbPush("wochenplan",entry); }
async function fbPatchWochenplanEintrag(fbKey,patch) { return await fbPatch(`wochenplan/${fbKey}`,patch); }
async function fbDeleteWochenplanEintrag(fbKey) { return await fbDelete(`wochenplan/${fbKey}`); }

const STORAGE = { settings:"gt_settings_v1",tasks:"gt_tasks_v1",goals:"gt_goals_v1",steps:"gt_goal_steps_v1",log:"gt_log_v1",schedule:"gt_schedule_v1",goalOverrides:"gt_goal_overrides_v1" };
const DEFAULT_SETTINGS = { dayMode:"normal",minGapGoalsMin:90,maxUnitsPerBundle:5,ntfyGoalsTopic:"",ntfyTasksTopic:"",ntfyToken:"",tickSeconds:20 };
const $ = id => document.getElementById(id);

function nowISO() { return new Date().toISOString(); }
function todayKey(d=new Date()) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
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

// ── State ──
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

// ── CSV ──
async function loadAllCSV() {
  const [tt,gt,st]=await Promise.all([fetchText("tasks.csv").catch(()=>""),fetchText("goals.csv").catch(()=>""),fetchText("goal_uebungen.csv").catch(()=>"")]);
  state.tasksData=tt?parseCSV(tt):[]; state.goalsData=gt?parseCSV(gt):[]; state.goalsStepsData=st?parseCSV(st):[];
  saveJSON(STORAGE.tasks,state.tasksData); saveJSON(STORAGE.goals,state.goalsData); saveJSON(STORAGE.steps,state.goalsStepsData);
}

// ── Anja Tasks ──
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

// ── Goals ──
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

// ── Schedule ──
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

// ── Push ──
const FIXED_NTFY_TOPIC = "my-secret-task-topic-4711";

async function sendNtfy(topic,token,message,title) {
  const t = topic || FIXED_NTFY_TOPIC;
  if(!t) return false;
  const headers={"Content-Type":"text/plain; charset=utf-8","Title":title||"Glam Trainer","Priority":"default","Tags":"bell"};
  if(token) headers["Authorization"]=`Bearer ${token}`;
  const res=await fetch(`https://ntfy.sh/${encodeURIComponent(t)}`,{method:"POST",headers,body:message});
  if(!res.ok){const txt=await res.text();throw new Error(`Push fehlgeschlagen (${res.status}): ${txt.slice(0,140)}`);} return true;
}
async function maybeDispatchPushes() {
  const schedule=getSchedule(); if(!schedule||schedule.dayKey!==todayKey()) return;
  const s=state.settings,now=new Date();
  const due=(schedule.units||[]).filter(u=>u.status==="geplant"&&u.plannedAt&&new Date(u.plannedAt)<=now);
  if(!due.length) return;
  const lastPush=schedule.lastPushAtGoals;
  if(lastPush&&(Date.now()-new Date(lastPush).getTime())<s.minGapGoalsMin*60*1000) return;
  const show=due.slice(0,s.maxUnitsPerBundle),more=due.length-show.length;
  const lines=[`Trainingseinheiten faellig: ${due.length}`,""]; show.forEach(u=>lines.push(`- ${u.ziel_name} Stufe ${u.stufe}`));
  if(more>0) lines.push(`+${more} weitere`); lines.push("","Oeffne die App.");
  try{await sendNtfy(s.ntfyGoalsTopic,s.ntfyToken,lines.join("\n"),"Training");schedule.lastPushAtGoals=nowISO();setSchedule(schedule);toast("Push gesendet.");}catch(e){console.warn(e);}
}

// ── Progression ──
function completeUnit(unitId,result) {
  const schedule=getSchedule(); if(!schedule) return;
  const idx=(schedule.units||[]).findIndex(u=>u.id===unitId); if(idx<0) return;
  const u=schedule.units[idx]; u.status=result.status; u.doneAt=nowISO(); setSchedule(schedule);
  addLogEntry({id:`log-${Date.now()}`,typ:u.typ,dayKey:schedule.dayKey,createdAt:nowISO(),ziel_id:u.ziel_id,ziel_name:u.ziel_name,stufe:u.stufe,uebung:result.uebungText||"",status:result.status,rueckmeldung:result.rueckmeldung||"",gern:result.gern||null,notiz:result.notiz||"",plannedLabel:u.plannedLabel||""});
  if(u.typ==="ziel") applyProgression(u.ziel_id);
}
function applyProgression(goalId) {
  const gid=normId(goalId),logs=getLog().filter(e=>e.typ==="ziel"&&normId(e.ziel_id)===gid);
  const last2=logs.slice(0,2),consecAbort=last2.length===2&&last2.every(x=>x.status==="abgebrochen");
  const aborts=logs.slice(0,7).filter(x=>x.status==="abgebrochen").length;
  const goal=getGoalsNormalized().find(g=>normId(g.ziel_id)===gid); if(!goal) return;
  const cur=goal.aktuelle_stufe,maxS=goal.max_stufe; let newS=cur;
  if(consecAbort||aborts>=3){newS=Math.max(1,cur-1);}
  else{const succ=logs.filter(e=>Number(e.stufe)===cur&&e.status==="erledigt");if(succ.length>=5){let pts=0;for(const s of succ){if(s.rueckmeldung==="leicht")pts+=2;else if(s.rueckmeldung==="okay")pts+=1;}if(pts>=6)newS=Math.min(maxS,cur+1);}}
  if(newS!==cur){setGoalOverride(gid,{aktuelle_stufe:newS});toast(newS>cur?"Naechste Stufe!":"Eine Stufe zurueck.");regenIfNeeded(true);render();}
}

// ── UI Helpers ──
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
function moduleTile(icon,title,lines,btnText,onClick) {
  return h("div",{class:"card"},[h("div",{style:"display:flex;align-items:flex-start;gap:10px"},[h("div",{class:"badge task",style:"width:38px;height:38px"},[icon]),h("div",{style:"flex:1"},[h("div",{style:"font-weight:900;font-size:16px"},[title]),h("div",{class:"small",style:"margin-top:6px;white-space:pre-line"},[lines])])]),h("div",{class:"hr"},[]),h("button",{class:"btn secondary",type:"button",onclick:onClick},[btnText])]);
}
function ratingRow(label) {
  const btns=[1,2,3,4,5].map(n=>{const b=document.createElement("button");b.className="btn secondary";b.type="button";b.textContent=String(n);b.style.cssText="min-width:52px;min-height:52px;font-size:20px;font-weight:700;border-radius:12px;";return b;});
  const row=h("div",{style:"display:flex;flex-direction:column;gap:6px;margin-top:8px;"},[h("div",{class:"small"},[label]),h("div",{style:"display:flex;gap:10px;flex-wrap:wrap;"},btns)]);
  row.dataset.selected="";
  btns.forEach((b,i)=>{b.addEventListener("click",()=>{
    btns.forEach(x=>{
      x.style.background="";x.style.borderColor="";x.style.color="";x.style.transform="";x.style.fontWeight="";
    });
    b.style.background="rgba(164,107,138,.9)";
    b.style.borderColor="rgba(164,107,138,1)";
    b.style.color="#fff";
    b.style.transform="scale(1.15)";
    b.style.fontWeight="900";
    row.dataset.selected=String(i+1);
  });});
  return row;
}

// ── Unit Detail Modal ──
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
  const btnDel=h("button",{class:"btn danger",type:"button"},["Loeschen"]);
  const btnClose=h("button",{class:"btn secondary",type:"button"},["Zurueck"]);
  const body=h("div",{},[h("div",{class:"modal-header"},[h("div",{class:"modal-title"},[title]),closeBtn]),h("div",{class:"hr"},[]),h("div",{class:"small"},[u.plannedLabel?`Geplant: ${u.plannedLabel}`:""]),h("div",{style:"white-space:pre-line;font-size:16px;font-weight:800;margin-top:8px"},[main]),h("div",{class:"hr"},[]),h("div",{class:"small"},["Rueckmeldung:"]),statusRow,feedbackRow,gernSel,note,h("div",{class:"row",style:"margin-top:10px"},[btnSave,btnClose,btnDel])]);
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
    if(!chosenStatus){toast("Bitte Geschafft oder Abgebrochen waehlen.");return;}
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

// ════════════════════════════════════════════════
// ── START (Vorfilter) ──
// ════════════════════════════════════════════════
function renderStart() {
  return h("div",{style:"display:flex;flex-direction:column;gap:24px;align-items:center;justify-content:center;min-height:60vh;"},[
    h("div",{style:"font-size:22px;font-weight:900;letter-spacing:.05em;color:var(--text,#f2f3f5);"},["Glam Trainer"]),
    h("div",{style:"display:flex;flex-direction:column;gap:16px;width:100%;max-width:340px;"},[
      h("button",{class:"btn",type:"button",style:"min-height:80px;font-size:22px;font-weight:900;border-radius:20px;",onclick:()=>{state.subPath="sub";location.hash="#/sub/home";}},["🜂  Sub"]),
      h("button",{class:"btn secondary",type:"button",style:"min-height:80px;font-size:22px;font-weight:900;border-radius:20px;",onclick:()=>{state.subPath="dom";location.hash="#/dom/start";}},["👑  Dom"]),
    ]),
  ]);
}

// ════════════════════════════════════════════════
// ── SUB VIEWS ──
// ════════════════════════════════════════════════
function renderSubHome() {
  regenIfNeeded(false);
  const schedule=getSchedule(),units=schedule?.units||[],now=new Date(),todayStart=new Date();todayStart.setHours(0,0,0,0);const todayEnd=new Date(todayStart);todayEnd.setDate(todayEnd.getDate()+1);

  // Ziel-Einheiten
  const dueGoals=units.filter(u=>u.status==="geplant"&&u.plannedAt&&new Date(u.plannedAt)<=now);
  const plannedGoals=units.filter(u=>u.status==="geplant"&&u.plannedAt&&new Date(u.plannedAt)>now);

  // Anja-Tasks
  const anjaDue=state.anjaTasks.filter(t=>{
    if(t.status!=="offen"&&t.status!=="angenommen") return false;
    if(!t.dueAt) return t.status==="angenommen"; // kein Datum + angenommen = sofort fällig
    return new Date(t.dueAt)<=now;
  });
  const anjaPlanned=state.anjaTasks.filter(t=>{
    if(t.status!=="offen"&&t.status!=="angenommen") return false;
    if(!t.dueAt) return t.status==="offen"; // kein Datum + offen = heute geplant (wartet auf Annahme)
    const due=new Date(t.dueAt);
    return due>now&&due<todayEnd;
  });

  function anjaCard(t) {
    return h("div",{class:"item"},[
      h("div",{class:"badge task"},["👑"]),
      h("div",{class:"item-main"},[
        h("div",{class:"item-title"},[t.title||"Aufgabe"]),
        h("div",{class:"item-sub"},[`Status: ${t.status}`+(t.dueAt?` · Fällig: ${fmtDateTimeLocal(t.dueAt)}`:"")]),
        h("div",{class:"row",style:"margin-top:8px;"},[
          h("button",{class:"btn secondary",type:"button",onclick:()=>{location.hash="#/sub/tasks";}},["Zu Aufgaben →"]),
        ]),
      ]),
    ]);
  }

  const filtered=(arr)=>{if(state.subFilter==="goals")return arr.filter(x=>x.typ==="ziel");if(state.subFilter==="tasks")return arr.filter(x=>x.typ==="aufgabe");return arr;};
  const chips=h("div",{class:"chips"},[chip("Alle",state.subFilter==="all",()=>{state.subFilter="all";render();}),chip("🎯 Ziele",state.subFilter==="goals",()=>{state.subFilter="goals";render();}),chip("🧩 Aufgaben",state.subFilter==="tasks",()=>{state.subFilter="tasks";render();})]);

  const allDue=[...filtered(dueGoals).map(listItemCard),...(state.subFilter==="goals"?[]:anjaDue.map(anjaCard))];
  const allPlanned=[...filtered(plannedGoals).map(listItemCard),...(state.subFilter==="goals"?[]:anjaPlanned.map(anjaCard))];

  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[
    h("div",{class:"card"},[sectionTitle("🔔","Jetzt faellig",chips),allDue.length?h("div",{class:"list"},allDue):h("div",{class:"small"},["Keine Einheiten faellig."])]),
    h("div",{class:"card"},[sectionTitle("📅","Heute geplant",null),allPlanned.length?h("div",{class:"list"},allPlanned):h("div",{class:"small"},["Heute ist nichts weiter geplant."])]),
  ]);
}

function renderSubGoals() {
  const goals=getGoalsNormalized();
  const cards=goals.map(g=>{
    const {period,min,max,done}=computeGoalQuota(g);
    const freq=period==="TAG"?`Heute: ${done} / ${min}-${max||min}`:`Woche: ${done} / ${min}-${max||min}`;
    const mod=g.modus==="ritualisiert"?`ritualisiert ${g.feste_zeit||"09:00"}`:`flexibel ${g.zeit_von||"14:00"}-${g.zeit_bis||"20:00"}`;
    const bBack=h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",...(g.aktuelle_stufe<=1?{disabled:"true"}:{}),onclick:()=>{setGoalOverride(g.ziel_id,{aktuelle_stufe:Math.max(1,g.aktuelle_stufe-1)});toast(`Stufe ${g.aktuelle_stufe-1}`);regenIfNeeded(true);render();}},["< Stufe"]);
    const bFwd=h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",...(g.aktuelle_stufe>=g.max_stufe?{disabled:"true"}:{}),onclick:()=>{setGoalOverride(g.ziel_id,{aktuelle_stufe:Math.min(g.max_stufe,g.aktuelle_stufe+1)});toast(`Stufe ${g.aktuelle_stufe+1}`);regenIfNeeded(true);render();}},["Stufe >"]);
    return h("div",{class:"item"},[h("div",{class:"badge goal"},["🎯"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[g.ziel_name]),h("div",{class:"item-sub"},[`Stufe ${g.aktuelle_stufe} von ${g.max_stufe}\n${freq}\n${mod}`]),h("div",{class:"row",style:"margin-top:10px;gap:8px;flex-wrap:wrap;"},[h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",onclick:()=>toggleGoalActive(g.ziel_id)},[g.aktiv?"Pausieren":"Aktivieren"]),bBack,bFwd])])]);
  });
  return h("div",{class:"card"},[sectionTitle("🎯","Ziele",null),cards.length?h("div",{class:"list"},cards):h("div",{class:"small"},["Keine Ziele in goals.csv gefunden."])]);
}
function toggleGoalActive(goalId) { const gid=normId(goalId),goal=getGoalsNormalized().find(g=>normId(g.ziel_id)===gid); setGoalOverride(gid,{aktiv:!(goal?!!goal.aktiv:false)}); regenIfNeeded(true);render(); }

function renderAnjaInbox() {
  const active=state.anjaTasks.filter(t=>t.status==="offen"||t.status==="angenommen");
  const done=state.anjaTasks.filter(t=>t.status==="erledigt"||t.status==="abgebrochen").sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  const canExec=t=>!t.dueAt||new Date(t.dueAt)<=new Date();
  function buildCard(t) {
    const locked=!canExec(t);
    const meta=[`Status: ${t.status}`,t.dueAt?`Faellig: ${fmtDateTimeLocal(t.dueAt)}`:"Faellig: sofort",t.note?`Bemerkung: ${t.note}`:""].filter(Boolean).join("\n");
    const btnAccept=h("button",{class:"btn secondary",type:"button",onclick:async()=>{await setAnjaTaskStatus(t.id,"angenommen");toast("Angenommen.");render();}},["Annehmen"]);
    const schwRow=ratingRow("Schwierigkeit (1=leicht, 5=schwer)"),gerneRow=ratingRow("Wie gerne? (1=widerwillig, 5=sehr gerne)");
    const txtNote=h("textarea",{class:"textarea",placeholder:"Anmerkung (optional)...",style:"min-height:56px;font-size:14px;"},[]);
    const cbWA=h("input",{type:"checkbox",id:`wa_${t.id}`,style:"width:22px;height:22px;"});
    const waLabel=h("label",{style:"display:flex;align-items:center;gap:8px;font-size:14px;color:var(--muted)"},[cbWA,"Beleg per WhatsApp"]);
    const doneForm=h("div",{style:"display:none;flex-direction:column;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#242838);"},[schwRow,gerneRow,txtNote,waLabel,h("div",{class:"row"},[h("button",{class:"btn",type:"button",style:"flex:1;min-height:48px;",onclick:async()=>{await setAnjaTaskStatus(t.id,"erledigt",{schwierigkeit:schwRow.dataset.selected?parseInt(schwRow.dataset.selected):null,gerne:gerneRow.dataset.selected?parseInt(gerneRow.dataset.selected):null,rueckmeldung:txtNote.value.trim(),belegWA:cbWA.checked});toast("Gespeichert.");render();}},["Abschicken"]),h("button",{class:"btn secondary",type:"button",style:"min-height:48px;",onclick:()=>{doneForm.style.display="none";}},["Abbrechen"])])]);
    const txtAbort=h("textarea",{class:"textarea",placeholder:"Grund (Pflicht)...",style:"min-height:56px;font-size:14px;"},[]);
    const abortForm=h("div",{style:"display:none;flex-direction:column;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#242838);"},[h("div",{class:"small"},["Warum abgebrochen?"]),txtAbort,h("div",{class:"row"},[h("button",{class:"btn danger",type:"button",style:"flex:1;min-height:48px;",onclick:async()=>{if(!txtAbort.value.trim()){toast("Bitte Grund angeben.");return;}await setAnjaTaskStatus(t.id,"abgebrochen",{rueckmeldung:txtAbort.value.trim()});toast("Abgebrochen.");render();}},["Bestaetigen"]),h("button",{class:"btn secondary",type:"button",style:"min-height:48px;",onclick:()=>{abortForm.style.display="none";}},["Abbrechen"])])]);
    const btnDone=h("button",{class:"btn secondary",type:"button",...(locked?{disabled:"true"}:{}),style:"flex:1;min-height:48px;",onclick:()=>{doneForm.style.display=doneForm.style.display==="none"?"flex":"none";abortForm.style.display="none";}},["Erledigt"]);
    const btnAbort=h("button",{class:"btn secondary",type:"button",...(locked?{disabled:"true"}:{}),style:"min-height:48px;",onclick:()=>{abortForm.style.display=abortForm.style.display==="none"?"flex":"none";doneForm.style.display="none";}},["Abbruch"]);
    const btnDel=h("button",{class:"btn secondary",type:"button",style:"min-height:48px;color:#c25d6a;border-color:rgba(194,93,106,.4);",onclick:async()=>{if(!t._fbKey){toast("Kein Key.");return;}try{await fbPatch(`anja_tasks/${t._fbKey}`,{status:"geloescht",updatedAt:nowISO()});state.anjaTasks=state.anjaTasks.filter(x=>x._fbKey!==t._fbKey);toast("Geloescht.");render();}catch(e){toast("Fehler.");}}},["✕"]);
    return h("div",{class:"item"},[h("div",{class:"badge task"},["👑"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[t.title||"Aufgabe"]),h("div",{class:"item-sub"},[meta]),h("div",{class:"row",style:"margin-top:10px;gap:8px;flex-wrap:wrap;"},[t.status==="offen"?btnAccept:null,btnDone,btnAbort,btnDel,locked?h("div",{class:"small"},["(gesperrt)"]):null].filter(Boolean)),doneForm,abortForm])]);
  }
  function buildDoneCard(t) {
    const ok=t.status==="erledigt";
    const meta=[t.doneAt?`Erledigt: ${fmtDateTimeLocal(t.doneAt)}`:"",t.schwierigkeit?`Schwierigkeit: ${t.schwierigkeit}/5`:"",t.gerne?`Gerne: ${t.gerne}/5`:"",t.rueckmeldung?`Notiz: ${t.rueckmeldung}`:"",t.belegWA?"Beleg per WhatsApp":""].filter(Boolean).join("\n");
    return h("div",{class:"item",style:"opacity:0.75;"},[h("div",{class:"badge task",style:ok?"background:rgba(100,200,120,.15)":"background:rgba(200,80,80,.12)"},[ok?"V":"X"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[t.title||"Aufgabe"]),h("div",{class:"item-sub"},[meta])])]);
  }
  const refreshBtn=h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",onclick:async()=>{toast("Lade...");await loadAnjaTasks();render();toast("Aktualisiert.");}},["🔄"]);
  return h("div",{class:"card"},[sectionTitle("👑","Aufgaben von Anja",refreshBtn),active.length?h("div",{class:"list"},active.map(buildCard)):h("div",{class:"small"},["Keine offenen Aufgaben."]),done.length?h("div",{class:"hr",style:"margin:16px 0"},[]):null,done.length?h("div",{class:"small",style:"margin-bottom:8px;font-weight:700;"},["Abgeschlossen"]):null,done.length?h("div",{class:"list"},done.map(buildDoneCard)):null].filter(Boolean));
}

function renderSubTasks() {
  const rubriken=[...new Set((state.tasksData||[]).filter(r=>String(r.typ||"Aufgabe").trim().toLowerCase()!=="wunsch").map(r=>(r.rubrik||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
  const rubSel=h("select",{class:"select",id:"rubSel"},[h("option",{value:""},["Rubrik waehlen"]),...rubriken.map(r=>h("option",{value:r},[r]))]);
  const taskSel=h("select",{class:"select",id:"taskSel",disabled:"true"},[h("option",{value:""},["Aufgabe waehlen"])]);
  const out=h("div",{id:"taskOut",style:"white-space:pre-line;font-weight:800;margin-top:10px"},[""]);
  const btnRandom=h("button",{class:"btn secondary",type:"button"},["Zufallsaufgabe"]);
  const btnPush=h("button",{class:"btn secondary",type:"button"},["Push senden"]);
  function getItems(rub){return(state.tasksData||[]).filter(r=>String(r.typ||"Aufgabe").trim().toLowerCase()!=="wunsch").map(r=>({rubrik:(r.rubrik||"").trim(),titel:(r.titel||"").trim()})).filter(x=>x.rubrik===rub&&x.titel);}
  function setOut(it){out.textContent=`Aufgabe\nRubrik: ${it.rubrik}\n\n${it.titel}`;out.dataset.payload=JSON.stringify(it);}
  function rebuild(){const rub=rubSel.value;taskSel.innerHTML="";taskSel.appendChild(h("option",{value:""},["Aufgabe waehlen"]));if(!rub){taskSel.disabled=true;return;}const items=getItems(rub);items.forEach((it,idx)=>taskSel.appendChild(h("option",{value:String(idx)},[it.titel])));taskSel.disabled=!items.length;}
  rubSel.onchange=()=>{rebuild();out.textContent="";delete out.dataset.payload;};
  taskSel.onchange=()=>{const items=getItems(rubSel.value),idx=parseInt(taskSel.value||"-1",10);if(idx>=0&&items[idx])setOut(items[idx]);};
  btnRandom.onclick=()=>{if(!rubSel.value){toast("Rubrik waehlen.");return;}const items=getItems(rubSel.value);if(!items.length){toast("Keine Aufgaben.");return;}setOut(items[Math.floor(Math.random()*items.length)]);toast("Zufallsaufgabe.");};
  btnPush.onclick=async()=>{const p=out.dataset.payload?JSON.parse(out.dataset.payload):null;if(!p){toast("Erst Aufgabe waehlen.");return;}try{await sendNtfy(state.settings.ntfyTasksTopic||FIXED_NTFY_TOPIC,state.settings.ntfyToken,`Aufgabe\nRubrik: ${p.rubrik}\n\n${p.titel}`,"Aufgabe");toast("Push gesendet.");}catch(e){toast("Push fehlgeschlagen.");}};
  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[renderAnjaInbox(),h("div",{class:"card"},[sectionTitle("🧩","Aufgaben (Katalog)",null),h("div",{class:"small"},["Optional. Keine Progression, keine Strafen."]),h("div",{class:"hr"},[]),rubSel,taskSel,h("div",{class:"row"},[btnRandom,btnPush]),out])]);
}

// ── Konditionierung / Pisslog ──
function renderPisslog() {
  const stufen=[
    {key:"vergessen",emoji:"😶",label:"Vergessen"},
    {key:"neutral",emoji:"💧",label:"Neutral"},
    {key:"erregung",emoji:"🍆",label:"Erregung"},
    {key:"erledigt",emoji:"🔥",label:"Erregung + Erektion + geklappt"},
  ];
  const log=state.pisslog||[];
  const counts={vergessen:0,neutral:0,erregung:0,erledigt:0};
  log.forEach(e=>{if(counts[e.stufe]!==undefined)counts[e.stufe]++;});
  const total=log.length;

  // Haupt-Button + Auswahl
  let selectedStufe=null;
  const stufenBtns=stufen.map(s=>{
    const b=document.createElement("button");
    b.className="btn secondary"; b.type="button";
    b.style.cssText="min-height:72px;font-size:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:16px;flex:1;";
    b.innerHTML=`<span style="font-size:32px">${s.emoji}</span><span style="font-size:11px;color:var(--muted,#b9bcc6)">${s.label}</span>`;
    b.addEventListener("click",async()=>{
      stufenBtns.forEach(x=>{x.style.background="";x.style.borderColor="";x.style.transform="";});
      b.style.background="rgba(164,107,138,.8)"; b.style.borderColor="rgba(164,107,138,1)"; b.style.transform="scale(1.05)";
      selectedStufe=s.key;
    });
    return b;
  });
  const txtKontext=h("input",{type:"text",class:"input",placeholder:"Kontext (optional): Outdoor, Pissoir, zu Hause...",style:"min-height:48px;font-size:15px;"});
  const btnLog=h("button",{class:"btn",type:"button",style:"min-height:56px;font-size:17px;font-weight:900;",onclick:async()=>{
    if(!selectedStufe){toast("Bitte eine Stufe auswaehlen.");return;}
    const entry={ts:nowISO(),stufe:selectedStufe,kontext:txtKontext.value.trim()};
    const fbKey=await fbAddPisslog(entry).catch(()=>null);
    if(fbKey){state.pisslog.unshift({...entry,_fbKey:fbKey});toast("Protokolliert.");render();}
    else{toast("Fehler beim Speichern.");}
  }},["💧 Pinkelpause protokollieren"]);

  // Stats
  const statsEl=total>0?h("div",{class:"card"},[
    sectionTitle("📊","Verlauf",null),
    h("div",{style:"display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;"},
      stufen.map(s=>h("div",{style:"text-align:center;background:rgba(255,255,255,.04);border-radius:12px;padding:10px 4px;"},[
        h("div",{style:"font-size:24px;"},[s.emoji]),
        h("div",{style:"font-size:18px;font-weight:900;margin-top:4px;"},[String(counts[s.key])]),
        h("div",{class:"small"},[`${total>0?Math.round(counts[s.key]/total*100):0}%`]),
      ]))
    ),
    h("div",{class:"small",style:"margin-top:8px;text-align:right;"},[`${total} Eintraege gesamt`]),
  ]):null;

  // Letzte Eintraege
  const recentEl=log.length>0?h("div",{class:"card"},[
    sectionTitle("📓","Letzte Eintraege",null),
    h("div",{class:"list"},log.slice(0,15).map(e=>{
      const s=stufen.find(x=>x.key===e.stufe)||{emoji:"?",label:e.stufe};
      return h("div",{class:"item"},[
        h("div",{class:"badge task",style:"font-size:22px;"},[s.emoji]),
        h("div",{class:"item-main"},[
          h("div",{class:"item-title"},[s.label]),
          h("div",{class:"item-sub"},[fmtDateTimeLocal(e.ts)+(e.kontext?` · ${e.kontext}`:"")]),
        ])
      ]);
    })),
  ]):null;

  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[
    h("div",{class:"card"},[
      sectionTitle("💧","Pinkelpause",null),
      h("div",{class:"small",style:"margin-bottom:12px;"},["Konditionierungslog. Einfach antippen nach dem Pinkeln."]),
      h("div",{style:"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"},stufenBtns),
      txtKontext,
      h("div",{style:"margin-top:12px;"},[btnLog]),
    ]),
    statsEl,
    recentEl,
  ].filter(Boolean));
}

// ── Cuckold (Sub) ──
function getWunschItems() {
  const csvW=(state.tasksData||[]).filter(r=>{const typ=String(r.typ||"").trim().toLowerCase(),w=String(r.wunsch||"").trim().toUpperCase();return typ==="wunsch"||w==="W";}).map(r=>({titel:String(r.titel||"").trim(),custom:false})).filter(x=>x.titel);
  const fbW=(state.customWishes||[]).map(w=>({titel:String(w.titel||"").trim(),custom:true,_fbKey:w._fbKey})).filter(x=>x.titel);
  return [...csvW,...fbW];
}
function renderCuckold() {
  const smileys=["","😔","😕","😐","🙂","😍"],cuck=state.cuckold||{};
  const gefBtns=[1,2,3,4,5].map(n=>{
    const b=document.createElement("button");b.className="btn secondary";b.type="button";b.textContent=smileys[n];
    b.style.cssText="font-size:32px;min-width:56px;min-height:56px;border-radius:14px;";
    if(cuck.gefuehl===n){b.style.background="rgba(164,107,138,.8)";b.style.borderColor="rgba(164,107,138,1)";b.style.transform="scale(1.15)";}
    b.addEventListener("click",async()=>{state.cuckold={...state.cuckold,gefuehl:n};await fbSetCuckold(state.cuckold);toast("Gefuehl gespeichert.");render();});
    return b;
  });
  const alleW=getWunschItems();
  const sel=document.createElement("select");sel.className="select";sel.style.cssText="width:100%;min-height:48px;font-size:15px;";
  const optP=document.createElement("option");optP.value="";optP.textContent="Wunsch auswaehlen...";sel.appendChild(optP);
  alleW.forEach(w=>{const opt=document.createElement("option");opt.value=w.titel;opt.textContent=(w.custom?"✏ ":"")+w.titel;if(cuck.wunsch===w.titel)opt.selected=true;sel.appendChild(opt);});
  sel.addEventListener("change",async()=>{state.cuckold={...state.cuckold,wunsch:sel.value||null};await fbSetCuckold(state.cuckold);toast(sel.value?"Wunsch gesetzt.":"Wunsch entfernt.");render();});
  const customList=(state.customWishes||[]).map(w=>h("div",{style:"display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line,#242838);"},[h("div",{style:"flex:1;font-size:14px;"},[w.titel]),h("button",{class:"btn secondary",type:"button",style:"min-height:36px;padding:4px 10px;font-size:13px;color:#c25d6a;",onclick:async()=>{if(!w._fbKey)return;await fbDeleteCustomWish(w._fbKey);state.customWishes=state.customWishes.filter(x=>x._fbKey!==w._fbKey);if(state.cuckold.wunsch===w.titel){state.cuckold={...state.cuckold,wunsch:null};await fbSetCuckold(state.cuckold);}toast("Wunsch geloescht.");render();}},["✕"])]));
  const txtNew=h("input",{type:"text",class:"input",placeholder:"Neuen Wunsch eingeben...",style:"min-height:48px;font-size:15px;"});
  const btnAdd=h("button",{class:"btn",type:"button",style:"min-height:48px;",onclick:async()=>{const val=txtNew.value.trim();if(!val){toast("Bitte Wunsch eingeben.");return;}const fbKey=await fbAddCustomWish(val);state.customWishes.push({titel:val,_fbKey:fbKey,createdAt:nowISO()});toast("Wunsch hinzugefuegt.");render();}},["+ Hinzufuegen"]);
  const currentStatus=h("div",{class:"card",style:"text-align:center;"},[h("div",{style:"font-size:56px;margin:8px 0;"},[smileys[cuck.gefuehl]||"-"]),cuck.gefuehl?h("div",{class:"small"},[`Gefuehl: ${cuck.gefuehl}/5`]):h("div",{class:"small"},["Noch kein Gefuehl eingetragen."]),cuck.wunsch?h("div",{style:"margin-top:10px;font-size:15px;font-weight:700;"},[`Wunsch: ${cuck.wunsch}`]):null].filter(Boolean));
  return h("div",{style:"display:flex;flex-direction:column;gap:12px;"},[
    currentStatus,
    h("div",{class:"card"},[h("div",{class:"small",style:"margin-bottom:8px;"},["Wie geht es dir gerade? (1=schlecht, 5=gut)"]),h("div",{style:"display:flex;gap:10px;flex-wrap:wrap;"},gefBtns)]),
    h("div",{class:"card"},[h("div",{class:"small",style:"margin-bottom:8px;"},["Mein Wunsch als Belohnung:"]),sel,h("div",{class:"hr",style:"margin:14px 0;"}),h("div",{class:"small",style:"margin-bottom:8px;"},["Eigenen Wunsch hinzufuegen:"]),h("div",{class:"row"},[txtNew,btnAdd]),customList.length?h("div",{style:"margin-top:12px;"},[h("div",{class:"small",style:"margin-bottom:6px;"},["Eigene Wuensche:"]),...customList]):null].filter(Boolean)),
  ]);
}

// ── Sub Log ──
function renderSubLog() {
  const log=getLog();
  const filterCh=h("div",{class:"chips"},[
    chip("Alle",state.filter==="all",()=>{state.filter="all";render();}),
    chip("🎯 Ziele",state.filter==="goals",()=>{state.filter="goals";render();}),
    chip("🧩 Aufgaben",state.filter==="tasks",()=>{state.filter="tasks";render();}),
    chip("💧 Kondit.",state.filter==="kond",()=>{state.filter="kond";render();}),
  ]);
  const stufen=[{key:"vergessen",emoji:"😶"},{key:"neutral",emoji:"💧"},{key:"erregung",emoji:"🍆"},{key:"erledigt",emoji:"🔥"}];
  let list=[];
  if(state.filter==="kond") {
    list=(state.pisslog||[]).map(e=>{
      const s=stufen.find(x=>x.key===e.stufe)||{emoji:"?"};
      return h("div",{class:"item"},[h("div",{class:"badge task",style:"font-size:22px;"},[s.emoji]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[(stufen.find(x=>x.key===e.stufe)||{label:e.stufe}).label||e.stufe]),h("div",{class:"item-sub"},[fmtDateTimeLocal(e.ts)+(e.kontext?` · ${e.kontext}`:"")])]) ]);
    });
  } else {
    const filtered=log.filter(e=>state.filter==="all"||(state.filter==="goals"&&e.typ==="ziel")||(state.filter==="tasks"&&e.typ==="aufgabe"));
    list=filtered.map(e=>{
      const isGoal=e.typ==="ziel",sub=[];
      if(isGoal){if(e.uebung)sub.push(`Uebung: ${e.uebung}`);if(e.rueckmeldung)sub.push(`Rueckmeldung: ${e.rueckmeldung}`);if(e.gern)sub.push(`Gern: ${e.gern}/5`);}
      else{if(e.schwierigkeit)sub.push(`Schwierigkeit: ${e.schwierigkeit}/5`);if(e.gerne)sub.push(`Gerne: ${e.gerne}/5`);if(e.rueckmeldung)sub.push(`Notiz: ${e.rueckmeldung}`);if(e.belegWA)sub.push("Beleg per WhatsApp");}
      if(e.status)sub.push(`Status: ${e.status}`);if(e.notiz)sub.push(`Notiz: ${e.notiz}`);
      return h("div",{class:"item"},[h("div",{class:"badge "+(isGoal?"goal":"task")},[isGoal?"🎯":"👑"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[isGoal?`${e.ziel_name} - Stufe ${e.stufe}`:(e.title||"Aufgabe")]),h("div",{class:"item-sub"},[`${new Date(e.createdAt).toLocaleString("de-DE")}\n${sub.join("\n")}`])])]);
    });
  }
  return h("div",{class:"card"},[sectionTitle("📓","Log",filterCh),list.length?h("div",{class:"list"},list):h("div",{class:"small"},["Noch keine Eintraege."])]);
}

// ── Sub Settings ──
function renderSubSettings() {
  const s=state.settings;
  const topicGoals=h("input",{class:"input",type:"text",value:s.ntfyGoalsTopic,placeholder:"Topic Ziele (ntfy)"});
  const topicTasks=h("input",{class:"input",type:"text",value:s.ntfyTasksTopic,placeholder:"Topic Aufgaben (ntfy)"});
  const token=h("input",{class:"input",type:"text",value:s.ntfyToken,placeholder:"ntfy Token (optional)"});
  const gapGoals=h("input",{class:"input",type:"number",min:"0",step:"1",value:String(s.minGapGoalsMin)});
  const maxBundle=h("input",{class:"input",type:"number",min:"1",step:"1",value:String(s.maxUnitsPerBundle)});
  const btnSave=h("button",{class:"btn",type:"button"},["Speichern"]);
  const btnReload=h("button",{class:"btn secondary",type:"button"},["CSV neu laden"]);
  btnSave.onclick=()=>{s.ntfyGoalsTopic=topicGoals.value.trim();s.ntfyTasksTopic=topicTasks.value.trim();s.ntfyToken=token.value.trim();s.minGapGoalsMin=parseInt(gapGoals.value||"0",10)||0;s.maxUnitsPerBundle=parseInt(maxBundle.value||"5",10)||5;persistSettings();toast("Gespeichert.");};
  btnReload.onclick=async()=>{try{await loadAllCSV();toast("CSV geladen.");regenIfNeeded(true);render();}catch(e){toast("CSV Fehler.");}};
  return h("div",{class:"card"},[sectionTitle("⚙️","Einstellungen",null),h("div",{class:"hr"},[]),h("div",{class:"small"},["ntfy Topics"]),topicGoals,topicTasks,token,h("div",{class:"hr"},[]),h("div",{class:"small"},["Push Abstand"]),gapGoals,maxBundle,h("div",{class:"row",style:"margin-top:10px"},[btnSave,btnReload])]);
}

// ════════════════════════════════════════════════
// ── DOM VIEWS ──
// ════════════════════════════════════════════════
async function loadGoalsFromCSV() {
  try {
    const [goalsTxt,stepsTxt]=await Promise.all([fetchText("goals.csv").catch(()=>""),fetchText("goal_uebungen.csv").catch(()=>"")]);
    return {goals:goalsTxt?parseCSV(goalsTxt):[],steps:stepsTxt?parseCSV(stepsTxt):[]};
  } catch {return {goals:[],steps:[]};}
}

function renderDomStart() {
  const smileys=["","😔","😕","😐","🙂","😍"],cuck=state.cuckold||{};
  // Cuckold-Status
  const cuckCard=cuck.gefuehl?h("div",{class:"card"},[sectionTitle("🤍","Cuckold",null),h("div",{style:"font-size:48px;text-align:center;margin:8px 0;"},[smileys[cuck.gefuehl]||""]),h("div",{class:"small",style:"text-align:center;"},[`Gefuehl: ${cuck.gefuehl}/5`]),cuck.wunsch?h("div",{style:"margin-top:12px;font-size:15px;font-weight:700;"},[`Wunsch: ${cuck.wunsch}`]):null].filter(Boolean)):null;
  // Ziele
  const zieleCard=h("div",{class:"card"},[sectionTitle("🎯","Aktive Ziele",null),h("div",{class:"small",id:"domGoalsList"},["Lade..."])]);
  loadGoalsFromCSV().then(({goals,steps})=>{
    const box=document.getElementById("domGoalsList"); if(!box) return;
    const norm=goals.map(raw=>{
      const ziel_id=String(raw.ziel_id||"").trim().toUpperCase(),ziel_name=String(raw.ziel_name||raw.name||"").trim()||ziel_id;
      const aktiv=["true","ja","1"].includes(String(raw.aktiv||"").trim().toLowerCase());
      const aktuelle_stufe=parseInt(raw.aktuelle_stufe||"1",10)||1,max_stufe=parseInt(raw.max_stufe||"5",10)||5;
      const ov=state.goalOverrides[ziel_id]||{};
      return {ziel_id,ziel_name,aktiv:typeof ov.aktiv==="boolean"?ov.aktiv:aktiv,aktuelle_stufe:typeof ov.aktuelle_stufe==="number"?ov.aktuelle_stufe:aktuelle_stufe,max_stufe};
    }).filter(g=>g.ziel_id&&g.aktiv);
    if(!norm.length){box.textContent="Keine aktiven Ziele.";return;}
    box.textContent=""; box.className="list";
    norm.forEach(g=>{
      const ex=steps.map(r=>({ziel_id:String(r.ziel_id||"").trim().toUpperCase(),stufe:parseInt(r.stufe||"1",10)||1,titel:String(r.titel||r.uebung||"").trim()})).filter(x=>x.ziel_id===g.ziel_id&&x.stufe===g.aktuelle_stufe&&x.titel);
      const uebung=ex.length?ex[Math.floor(Math.random()*ex.length)].titel:"";
      box.appendChild(h("div",{class:"item"},[h("div",{class:"badge goal"},["🎯"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[g.ziel_name]),h("div",{class:"item-sub"},[`Stufe ${g.aktuelle_stufe}/${g.max_stufe}${uebung?"\nAktuell: "+uebung:""}`])])]));
    });
  });
  // Offene Aufgaben
  const openTasks=state.anjaTasks.filter(t=>t.status==="offen"||t.status==="angenommen");
  const aufgabenCard=h("div",{class:"card"},[sectionTitle("👑","Offene Aufgaben",h("button",{class:"btn secondary",type:"button",style:"min-height:36px;",onclick:async()=>{toast("Lade...");await loadAnjaTasks();render();toast("Aktualisiert.");}},["🔄"])),openTasks.length?h("div",{class:"list"},openTasks.map(t=>h("div",{class:"item"},[h("div",{class:"badge task"},["👑"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[t.title||"Aufgabe"]),h("div",{class:"item-sub"},[[`Status: ${t.status}`,t.dueAt?`Faellig: ${fmtDateTimeLocal(t.dueAt)}`:""].filter(Boolean).join(" · ")])])]))):h("div",{class:"small"},["Keine offenen Aufgaben."])]);
  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[cuckCard,zieleCard,aufgabenCard].filter(Boolean));
}

function renderDomAufgaben() {
  const iframe=h("iframe",{src:"control_panel.html",style:"width:100%;height:600px;min-height:400px;border:0;border-radius:16px;background:transparent;",loading:"lazy",scrolling:"yes"});
  return h("div",{class:"card"},[h("div",{style:"font-weight:900;font-size:16px;margin-bottom:8px"},["Aufgaben erstellen"]),h("div",{class:"hr"},[]),iframe]);
}

function renderDomRueckmeldungen() {
  const done=state.anjaTasks.filter(t=>t.status==="erledigt"||t.status==="abgebrochen").sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  const refreshBtn=h("button",{class:"btn secondary",type:"button",style:"min-height:36px;",onclick:async()=>{toast("Lade...");await loadAnjaTasks();render();toast("Aktualisiert.");}},["🔄"]);
  function buildCard(t) {
    const ok=t.status==="erledigt";
    const meta=[t.doneAt?`Erledigt: ${fmtDateTimeLocal(t.doneAt)}`:"",t.schwierigkeit?`Schwierigkeit: ${t.schwierigkeit}/5`:"",t.gerne?`Gerne: ${t.gerne}/5`:"",t.rueckmeldung?`Notiz: ${t.rueckmeldung}`:"",t.belegWA?"📱 Beleg per WhatsApp":""].filter(Boolean).join("\n");
    return h("div",{class:"item"},[h("div",{class:"badge task",style:ok?"background:rgba(100,200,120,.15)":"background:rgba(200,80,80,.12)"},[ok?"✓":"✗"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[t.title||"Aufgabe"]),h("div",{class:"item-sub"},[meta])])]);
  }
  return h("div",{class:"card"},[sectionTitle("📬","Rueckmeldungen",refreshBtn),done.length?h("div",{class:"list"},done.map(buildCard)):h("div",{class:"small"},["Noch keine Rueckmeldungen."])]);
}

function renderDomLog() {
  const log=getLog();
  const stufen=[{key:"vergessen",emoji:"😶"},{key:"neutral",emoji:"💧"},{key:"erregung",emoji:"🍆"},{key:"erledigt",emoji:"🔥"}];
  const filterCh=h("div",{class:"chips"},[
    chip("Alle",state.filter==="all",()=>{state.filter="all";render();}),
    chip("🎯 Ziele",state.filter==="goals",()=>{state.filter="goals";render();}),
    chip("🧩 Aufgaben",state.filter==="tasks",()=>{state.filter="tasks";render();}),
    chip("💧 Kondit.",state.filter==="kond",()=>{state.filter="kond";render();}),
  ]);
  let list=[];
  if(state.filter==="kond") {
    list=(state.pisslog||[]).map(e=>{
      const s=stufen.find(x=>x.key===e.stufe)||{emoji:"?"};
      return h("div",{class:"item"},[h("div",{class:"badge task",style:"font-size:22px;"},[s.emoji]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[e.stufe]),h("div",{class:"item-sub"},[fmtDateTimeLocal(e.ts)+(e.kontext?` · ${e.kontext}`:"")])]) ]);
    });
  } else {
    const filtered=log.filter(e=>state.filter==="all"||(state.filter==="goals"&&e.typ==="ziel")||(state.filter==="tasks"&&e.typ==="aufgabe"));
    list=filtered.map(e=>{
      const isGoal=e.typ==="ziel",sub=[];
      if(isGoal){if(e.uebung)sub.push(`Uebung: ${e.uebung}`);if(e.rueckmeldung)sub.push(`Rueckmeldung: ${e.rueckmeldung}`);}
      else{if(e.schwierigkeit)sub.push(`Schwierigkeit: ${e.schwierigkeit}/5`);if(e.gerne)sub.push(`Gerne: ${e.gerne}/5`);if(e.rueckmeldung)sub.push(`Notiz: ${e.rueckmeldung}`);}
      if(e.status)sub.push(`Status: ${e.status}`);
      return h("div",{class:"item"},[h("div",{class:"badge "+(isGoal?"goal":"task")},[isGoal?"🎯":"👑"]),h("div",{class:"item-main"},[h("div",{class:"item-title"},[isGoal?`${e.ziel_name} - Stufe ${e.stufe}`:(e.title||"Aufgabe")]),h("div",{class:"item-sub"},[`${new Date(e.createdAt).toLocaleString("de-DE")}\n${sub.join("\n")}`])])]);
    });
  }
  return h("div",{class:"card"},[sectionTitle("📓","Log",filterCh),list.length?h("div",{class:"list"},list):h("div",{class:"small"},["Noch keine Eintraege."])]);
}

// ════════════════════════════════════════════════
// ── NAV & RENDER ──
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
// ── WOCHENPLAN ──
// ════════════════════════════════════════════════

function getWeekDays(fromISO, toISO) {
  const days = [];
  const cur = new Date(fromISO); cur.setHours(0,0,0,0);
  const end = new Date(toISO);   end.setHours(23,59,59,999);
  while (cur <= end) { days.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
  return days;
}

function fmtDateDE(iso) {
  const d = new Date(iso+"T00:00:00");
  return d.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"});
}

function nextMondayISO() {
  const d = new Date(); d.setHours(0,0,0,0);
  const diff = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}
function nextSundayISO(mondayISO) {
  const d = new Date(mondayISO+"T00:00:00"); d.setDate(d.getDate()+6);
  return d.toISOString().slice(0,10);
}

function renderSubWochenplan() {
  const wp = state.wochenplan || [];
  const wuensche = state.wuensche || [];

  // Wuensche verwalten
  const wunschList = wuensche.map(w => h("div",{style:"display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line,#242838);"},[
    h("div",{style:"flex:1;font-size:14px;"},[w.titel]),
    h("button",{class:"btn secondary",type:"button",style:"min-height:32px;padding:4px 10px;font-size:12px;color:#c25d6a;",onclick:async()=>{
      await fbDeleteWunsch(w._fbKey);
      state.wuensche=state.wuensche.filter(x=>x._fbKey!==w._fbKey);
      toast("Wunsch geloescht."); render();
    }},["rosette"]),
  ]));
  const txtWunsch = h("input",{type:"text",class:"input",placeholder:"Neuen Wunsch eingeben...",style:"min-height:44px;"});
  const btnWunschAdd = h("button",{class:"btn secondary",type:"button",onclick:async()=>{
    const val = txtWunsch.value.trim(); if(!val){toast("Bitte Wunsch eingeben.");return;}
    const fbKey = await fbAddWunsch(val);
    state.wuensche.push({titel:val,_fbKey:fbKey,createdAt:nowISO()});
    toast("Wunsch gespeichert."); render();
  }},["+  Hinzufuegen"]);
  const wunschCard = h("div",{class:"card"},[
    h("div",{style:"font-weight:700;font-size:15px;margin-bottom:10px;"},["Meine Wuensche"]),
    h("div",{class:"small",style:"margin-bottom:10px;"},["Wuensche die du in den Wochenplan einplanen kannst."]),
    wuensche.length ? h("div",{style:"margin-bottom:12px;"},wunschList) : h("div",{class:"small",style:"margin-bottom:10px;"},["Noch keine Wuensche gespeichert."]),
    h("div",{class:"row"},[txtWunsch, btnWunschAdd]),
  ]);

  // Neuer Vorschlag – mit localStorage-Entwurf
  const DRAFT_KEY = "gt_wochenplan_draft_v1";

  function saveDraft() {
    const draft = { von: inpVon.value, bis: inpBis.value, tage: {} };
    Array.from(tagesContainer.children).forEach(block=>{
      const day=block.dataset.day; if(!day) return;
      const rows=[];
      Array.from(block._selList.children).forEach(wrapper=>{
        const val=wrapper._sel?.value||"", dauer=wrapper._txtDauer?.value||"";
        if(val||dauer) rows.push({val,dauer});
      });
      if(rows.length) draft.tage[day]=rows;
    });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)||"null"); } catch { return null; }
  }

  function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

  const draft = loadDraft();
  const monday = nextMondayISO();
  const sunday = nextSundayISO(monday);
  const inpVon = h("input",{type:"date",class:"input",value: draft?.von||monday});
  const inpBis = h("input",{type:"date",class:"input",value: draft?.bis||sunday});
  const tagesContainer = h("div",{style:"display:flex;flex-direction:column;gap:12px;margin-top:12px;"});

  function makeSelectForDay(day, preVal) {
    const sel = document.createElement("select"); sel.className="select"; sel.style.flex="1"; sel.style.minHeight="44px";
    const optEmpty = document.createElement("option"); optEmpty.value=""; optEmpty.textContent="-- Eintrag waehlen --"; sel.appendChild(optEmpty);
    const grpW = document.createElement("optgroup"); grpW.label="Meine Wuensche";
    wuensche.forEach(w=>{const o=document.createElement("option");o.value="w:"+w.titel;o.textContent=w.titel;grpW.appendChild(o);});
    sel.appendChild(grpW);
    const anjaDayTasks=(state.anjaTasks||[]).filter(t=>t.dueAt&&t.dueAt.slice(0,10)===day);
    if(anjaDayTasks.length){
      const grpA=document.createElement("optgroup"); grpA.label="Anjas Aufgaben";
      anjaDayTasks.forEach(t=>{const o=document.createElement("option");o.value="a:"+t.id;o.textContent=t.title||"Aufgabe";grpA.appendChild(o);});
      sel.appendChild(grpA);
    }
    if(preVal) sel.value=preVal;
    sel.addEventListener("change", saveDraft);
    return sel;
  }

  function makeDayBlock(day, savedRows) {
    const selList = h("div",{style:"display:flex;flex-direction:column;gap:6px;"});
    function addRow(preVal, preDauer) {
      const sel = makeSelectForDay(day, preVal||"");
      const txtDauer = h("input",{type:"text",class:"input",
        placeholder:"Dauer / Haeufigkeit (z.B. 1h, 3x, 200ml)...",
        style:"min-height:38px;font-size:13px;margin-top:4px;",
        value: preDauer||""});
      txtDauer.addEventListener("input", saveDraft);
      const btnDel = h("button",{class:"btn secondary",type:"button",
        style:"min-height:44px;padding:4px 10px;color:#c25d6a;flex-shrink:0;",
        onclick:()=>{
          if(selList.children.length>1){wrapper.remove();}
          else{sel.value="";txtDauer.value="";}
          saveDraft();
        }},["x"]);
      const topRow = h("div",{style:"display:flex;gap:6px;align-items:center;"},[sel,btnDel]);
      const wrapper = h("div",{style:"display:flex;flex-direction:column;gap:0;"},[topRow,txtDauer]);
      wrapper._sel=sel;
      wrapper._txtDauer=txtDauer;
      selList.appendChild(wrapper);
    }
    if(savedRows&&savedRows.length){
      savedRows.forEach(r=>addRow(r.val,r.dauer));
    } else {
      addRow();
    }
    const btnAdd = h("button",{class:"btn secondary",type:"button",
      style:"min-height:36px;font-size:13px;padding:4px 10px;",
      onclick:()=>{addRow();saveDraft();}
    },["+  Eintrag"]);
    const block = h("div",{style:"border:1px solid var(--line,#242838);border-radius:14px;padding:10px 12px;"},[
      h("div",{style:"font-size:13px;font-weight:700;color:var(--muted,#b9bcc6);margin-bottom:8px;"},[fmtDateDE(day)]),
      selList,
      h("div",{style:"margin-top:6px;"},[btnAdd]),
    ]);
    block.dataset.day=day;
    block._selList=selList;
    return block;
  }

  function rebuildTage() {
    tagesContainer.innerHTML="";
    let days=[];
    try{days=getWeekDays(inpVon.value,inpBis.value);}catch{}
    const saved = loadDraft()?.tage||{};
    days.forEach(day=>tagesContainer.appendChild(makeDayBlock(day, saved[day])));
    saveDraft();
  }
  rebuildTage();
  inpVon.addEventListener("change", ()=>{clearDraft();rebuildTage();});
  inpBis.addEventListener("change",  ()=>{clearDraft();rebuildTage();});

  const btnVorschlag = h("button",{class:"btn",type:"button",style:"min-height:52px;margin-top:12px;font-size:16px;",onclick:async()=>{
    const eintraege=[];
    Array.from(tagesContainer.children).forEach(block=>{
      const day=block.dataset.day; if(!day) return;
      Array.from(block._selList.children).forEach(wrapper=>{
        const val=wrapper._sel&&wrapper._sel.value; if(!val) return;
        const [typ,...rest]=val.split(":");
        const titel=rest.join(":");
        const dauer=(wrapper._txtDauer?.value||"").trim();
        if(titel) eintraege.push({datum:day,typ,titel,dauer,status:"vorschlag",erstellt_von:"sub",createdAt:nowISO()});
      });
    });
    if(!eintraege.length){toast("Bitte mindestens einen Eintrag waehlen.");return;}
    let ok=0;
    for(const e of eintraege){
      const fbKey=await fbAddWochenplanEintrag(e).catch(()=>null);
      if(fbKey){state.wochenplan.push({...e,_fbKey:fbKey});ok++;}
    }
    clearDraft();
    toast(ok+" Eintraege als Vorschlag gespeichert."); render();
  }},["📤 Als Vorschlag senden"]);

  const vorschlagCard = h("div",{class:"card"},[
    h("div",{style:"font-weight:700;font-size:15px;margin-bottom:10px;"},["📅 Neuen Vorschlag erstellen"]),
    h("div",{class:"small",style:"margin-bottom:8px;"},["Zeitraum:"]),
    h("div",{class:"row"},[inpVon,inpBis]),
    tagesContainer,
    btnVorschlag,
  ]);

  // Freigegebene Woche + ICS
  const heute = todayKey();
  const best = wp.filter(e=>e.status==="best\u00e4tigt").sort((a,b)=>a.datum.localeCompare(b.datum));
  const abg  = wp.filter(e=>e.status==="abgelehnt").sort((a,b)=>a.datum.localeCompare(b.datum));
  const off  = wp.filter(e=>e.status==="vorschlag").sort((a,b)=>a.datum.localeCompare(b.datum));

  function wpEl(e) {
    const isPast  = e.datum < heute;
    const isToday = e.datum === heute;
    const isDone  = e.status === "erledigt" || e.status === "uebersprungen";
    const col = e.status==="bestätigt"?"#7ecfa0":e.status==="abgelehnt"?"#c25d6a":e.status==="erledigt"?"#7ecfa0":e.status==="uebersprungen"?"#b9bcc6":"#b9bcc6";
    const sym = e.status==="bestätigt"?"✓":e.status==="abgelehnt"?"✗":e.status==="erledigt"?"✓":e.status==="uebersprungen"?"↷":"⏳";

    const btnErledigt = h("button",{class:"btn",type:"button",style:"min-height:40px;flex:1;font-size:13px;",onclick:async()=>{
      await fbPatchWochenplanEintrag(e._fbKey,{status:"erledigt",updatedAt:nowISO()});
      e.status="erledigt"; toast("Erledigt."); render();
    }},["✓ Erledigt"]);
    const btnUebersprungen = h("button",{class:"btn secondary",type:"button",style:"min-height:40px;flex:1;font-size:13px;",onclick:async()=>{
      await fbPatchWochenplanEintrag(e._fbKey,{status:"uebersprungen",updatedAt:nowISO()});
      e.status="uebersprungen"; toast("Übersprungen."); render();
    }},["↷ Übersprungen"]);

    const aktionRow = isToday && !isDone
      ? h("div",{class:"row",style:"margin-top:8px;gap:8px;"},[btnErledigt, btnUebersprungen])
      : null;

    const statusLabel = isDone
      ? h("div",{class:"small",style:"margin-top:4px;color:"+(e.status==="erledigt"?"#7ecfa0":"#b9bcc6")+";"},
          [e.status==="erledigt"?"✓ Erledigt":"↷ Übersprungen"])
      : null;

    return h("div",{class:"item",style:isPast&&!isDone?"opacity:0.5;":""},[
      h("div",{class:"badge task",style:"font-size:16px;color:"+col+";background:transparent;"},[sym]),
      h("div",{class:"item-main"},[
        h("div",{class:"item-title"},[fmtDateDE(e.datum)+" – "+e.titel+(e.dauer?" · "+e.dauer:"")]),
        e.kommentar?h("div",{class:"small",style:"margin-top:4px;color:#c25d6a;"},["Anja: "+e.kommentar]):null,
        statusLabel,
        aktionRow,
      ].filter(Boolean)),
    ]);
  }

  function exportICS() {
    const best = wp.filter(e=>e.status==="bestätigt");
    if(!best.length){toast("Keine bestätigten Einträge.");return;}
    const byDay = {};
    best.forEach(e=>{if(!byDay[e.datum])byDay[e.datum]=[];byDay[e.datum].push(e);});
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nPRODID:-//GlamTrainer//DE\n";
    Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([datum,eintraege])=>{
      const d=datum.replace(/-/g,"");
      const desc=eintraege.map(e=>(e.dauer?e.dauer+" ":"")+e.titel).join("\n");
      ics += "BEGIN:VEVENT\n";
      ics += "DTSTART;VALUE=DATE:"+d+"\n";
      ics += "SUMMARY:Glam Trainer\n";
      ics += "DESCRIPTION:"+desc.replace(/\n/g,"\\n")+"\n";
      ics += "UID:gt-"+datum+"-"+Date.now()+"@glamtrainer\n";
      ics += "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";
    const blob=new Blob([ics],{type:"text/calendar"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="wochenplan.ics";a.click();
    toast("Kalender exportiert.");
  }

  function buildGoogleLinks() {
    const best = wp.filter(e=>e.status==="bestätigt");
    if(!best.length) return null;
    const byDay = {};
    best.forEach(e=>{if(!byDay[e.datum])byDay[e.datum]=[];byDay[e.datum].push(e);});
    const links = Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([datum,eintraege])=>{
      const d = datum.replace(/-/g,"");
      const summary = "Glam Trainer";
      const details = eintraege.map(e=>(e.dauer?e.dauer+" ":"")+e.titel).join("%0A");
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(summary)}&dates=${d}/${d}&details=${details}`;
      return h("a",{
        href: url,
        target: "_blank",
        style: "display:block;padding:10px 14px;background:rgba(164,107,138,.15);border:1px solid rgba(164,107,138,.4);border-radius:12px;color:var(--text,#f2f3f5);text-decoration:none;font-size:14px;",
      },[fmtDateDE(datum)+" → Google Kalender ↗"]);
    });
    return h("div",{style:"display:flex;flex-direction:column;gap:8px;margin-top:10px;"},[
      h("div",{class:"small",style:"margin-bottom:4px;"},["📱 In Google Kalender öffnen (je Tag):"]),
      ...links,
    ]);
  }

  const exportRow = wp.filter(e=>e.status==="bestätigt").length ? h("div",{style:"display:flex;flex-direction:column;gap:8px;margin-top:12px;"},[
    h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",onclick:exportICS},["📅 Als .ics herunterladen (Desktop)"]),
    buildGoogleLinks(),
  ].filter(Boolean)) : null;

  const planCard = h("div",{class:"card"},[
    h("div",{style:"font-weight:700;font-size:15px;margin-bottom:10px;"},["Freigegebene Woche"]),
    best.length ? h("div",{class:"list"},best.map(wpEl)) : h("div",{class:"small"},["Noch nichts bestaetigt."]),
    exportRow,
    off.length?h("div",{style:"margin-top:12px;"},[h("div",{class:"small",style:"margin-bottom:6px;font-weight:700;"},["Wartet auf Anjas Bestaetigung:"]),h("div",{class:"list"},off.map(wpEl))]):null,
    abg.length?h("div",{style:"margin-top:12px;"},[h("div",{class:"small",style:"margin-bottom:6px;font-weight:700;color:#c25d6a;"},["Abgelehnt:"]),h("div",{class:"list"},abg.map(wpEl))]):null,
  ].filter(Boolean));

  return h("div",{style:"display:flex;flex-direction:column;gap:12px;"},[planCard,vorschlagCard,wunschCard]);
}

function renderDomWochenplan() {
  const wp = state.wochenplan || [];
  const vorschlaege = wp.filter(e=>e.status==="vorschlag").sort((a,b)=>a.datum.localeCompare(b.datum));
  const bestätigt   = wp.filter(e=>e.status==="bestätigt").sort((a,b)=>a.datum.localeCompare(b.datum));

  function buildVorschlagCard(e) {
    const kommentarInput = h("input",{type:"text",class:"input",placeholder:"Kommentar (optional)...",style:"min-height:40px;font-size:14px;display:none;"});
    const btnOk = h("button",{class:"btn",type:"button",style:"min-height:44px;flex:1;",onclick:async()=>{
      await fbPatchWochenplanEintrag(e._fbKey,{status:"bestätigt",updatedAt:nowISO()});
      e.status="bestätigt"; toast("Bestätigt."); render();
    }},["✓ Bestätigen"]);
    const btnNein = h("button",{class:"btn secondary",type:"button",style:"min-height:44px;",onclick:()=>{
      const hidden=kommentarInput.style.display==="none";
      kommentarInput.style.display=hidden?"block":"none";
      btnSendAbgelehnt.style.display=hidden?"block":"none";
    }},["✗ Ablehnen"]);
    const btnSendAbgelehnt = h("button",{class:"btn secondary",type:"button",style:"min-height:40px;color:#c25d6a;border-color:rgba(194,93,106,.4);display:none;",onclick:async()=>{
      const kommentar=kommentarInput.value.trim();
      await fbPatchWochenplanEintrag(e._fbKey,{status:"abgelehnt",kommentar,updatedAt:nowISO()});
      e.status="abgelehnt"; e.kommentar=kommentar; toast("Abgelehnt."); render();
    }},["Absenden"]);
    const btnDel = h("button",{class:"btn secondary",type:"button",style:"min-height:44px;color:#c25d6a;",onclick:async()=>{
      await fbDeleteWochenplanEintrag(e._fbKey);
      state.wochenplan=state.wochenplan.filter(x=>x._fbKey!==e._fbKey); toast("Gelöscht."); render();
    }},["✕"]);
    return h("div",{class:"item"},[
      h("div",{class:"badge task",style:"font-size:18px;background:transparent;"},["⏳"]),
      h("div",{class:"item-main"},[
        h("div",{class:"item-title"},[fmtDateDE(e.datum)+" – "+e.titel+(e.dauer?" · "+e.dauer:"")]),
        h("div",{class:"small"},[e.typ==="w"?"💭 Wunsch":"👑 Aufgabe"]),
        h("div",{class:"row",style:"margin-top:10px;gap:8px;flex-wrap:wrap;"},[btnOk,btnNein,btnDel]),
        kommentarInput, btnSendAbgelehnt,
      ]),
    ]);
  }

  const heute = todayKey();
  function buildBestätigtEl(e) {
    const isPast = e.datum < heute;
    const btnDel = h("button",{class:"btn secondary",type:"button",style:"min-height:36px;padding:4px 10px;font-size:12px;color:#c25d6a;",onclick:async()=>{
      await fbDeleteWochenplanEintrag(e._fbKey);
      state.wochenplan=state.wochenplan.filter(x=>x._fbKey!==e._fbKey); toast("Gelöscht."); render();
    }},["✕"]);
    return h("div",{class:"item",style:isPast?"opacity:0.55;":""},[
      h("div",{class:"badge task",style:"color:#7ecfa0;background:transparent;font-size:18px;"},["✓"]),
      h("div",{class:"item-main"},[
        h("div",{class:"item-title"},[fmtDateDE(e.datum)+" – "+e.titel+(e.dauer?" · "+e.dauer:"")]),
        h("div",{class:"small"},[e.typ==="w"?"💭 Wunsch":"👑 Aufgabe"]),
        h("div",{style:"margin-top:6px;"},[btnDel]),
      ]),
    ]);
  }

  // ── Eintrag direkt hinzufügen (Dom) ──
  const inpDatum = h("input",{type:"date",class:"input",value:heute,style:"min-height:44px;"});

  // Dropdown: offene Aufgaben + Freitext-Option
  const selEintrag = document.createElement("select"); selEintrag.className="select"; selEintrag.style.minHeight="44px";
  const optLeer = document.createElement("option"); optLeer.value=""; optLeer.textContent="-- Aufgabe wählen --"; selEintrag.appendChild(optLeer);
  const grpA = document.createElement("optgroup"); grpA.label="👑 Offene Aufgaben";
  state.anjaTasks.filter(t=>t.status==="offen"||t.status==="angenommen").forEach(t=>{
    const o=document.createElement("option"); o.value="a:"+t.title; o.textContent=t.title||"Aufgabe"; grpA.appendChild(o);
  });
  selEintrag.appendChild(grpA);
  const optFrei = document.createElement("option"); optFrei.value="__frei__"; optFrei.textContent="✏ Eigener Eintrag (Freitext)..."; selEintrag.appendChild(optFrei);

  const txtFrei  = h("input",{type:"text",class:"input",placeholder:"Eigener Eintrag...",style:"min-height:44px;display:none;"});
  const txtDauer = h("input",{type:"text",class:"input",placeholder:"Dauer / Häufigkeit (z.B. 1h, 3x)...",style:"min-height:40px;font-size:13px;"});

  selEintrag.addEventListener("change",()=>{
    txtFrei.style.display = selEintrag.value==="__frei__" ? "block" : "none";
  });

  const btnHinzu = h("button",{class:"btn",type:"button",style:"min-height:48px;",onclick:async()=>{
    const datum = inpDatum.value; if(!datum){toast("Bitte Datum wählen.");return;}
    let titel = "";
    if(selEintrag.value==="__frei__"){
      titel = txtFrei.value.trim(); if(!titel){toast("Bitte Eintrag eingeben.");return;}
    } else {
      const [,...rest] = selEintrag.value.split(":");
      titel = rest.join(":");
    }
    if(!titel){toast("Bitte Eintrag wählen.");return;}
    const dauer = txtDauer.value.trim();
    const entry = {datum,typ:"a",titel,dauer,status:"bestätigt",erstellt_von:"dom",createdAt:nowISO(),updatedAt:nowISO()};
    const fbKey = await fbAddWochenplanEintrag(entry).catch(()=>null);
    if(fbKey){
      state.wochenplan.push({...entry,_fbKey:fbKey});
      toast("Eintrag hinzugefügt.");
      // Felder zurücksetzen
      selEintrag.value=""; txtFrei.value=""; txtDauer.value=""; txtFrei.style.display="none";
      render();
    } else { toast("Fehler beim Speichern."); }
  }},["+ Hinzufügen"]);

  const addCard = h("div",{class:"card"},[
    sectionTitle("➕","Eintrag hinzufügen",null),
    h("div",{class:"small",style:"margin-bottom:10px;"},["Direkt als bestätigt speichern."]),
    h("div",{style:"display:flex;flex-direction:column;gap:8px;"},[
      inpDatum, selEintrag, txtFrei, txtDauer, btnHinzu,
    ]),
  ]);

  const refreshBtn=h("button",{class:"btn secondary",type:"button",style:"min-height:36px;",onclick:async()=>{
    toast("Lade..."); state.wochenplan=await fbGetWochenplan().catch(()=>[]); render(); toast("Aktualisiert.");
  }},["🔄"]);

  return h("div",{style:"display:flex;flex-direction:column;gap:12px;"},[
    addCard,
    h("div",{class:"card"},[
      sectionTitle("📥","Vorschläge",refreshBtn),
      vorschlaege.length
        ? h("div",{class:"list"},vorschlaege.map(buildVorschlagCard))
        : h("div",{class:"small"},["Keine offenen Vorschläge."]),
    ]),
    bestätigt.length ? h("div",{class:"card"},[
      sectionTitle("✓","Freigegeben",null),
      h("div",{class:"list"},bestätigt.map(buildBestätigtEl)),
    ]) : null,
  ].filter(Boolean));
}

function updateNav() {
  const nav=document.getElementById("bottomnav"); if(!nav) return;
  nav.innerHTML="";
  const route=state.route;
  const isStart=route==="#/start";
  const isSub=route.startsWith("#/sub/");
  const isDom=route.startsWith("#/dom/");
  if(isStart){nav.style.display="none";return;}
  nav.style.display="flex";
  if(isSub) {
    const items=[
      {label:"Start",route:"#/start"},
      {label:"Sub",route:"#/sub/home"},
      {label:"Ziele",route:"#/sub/goals"},
      {label:"Aufgaben",route:"#/sub/tasks"},
      {label:"Wochenplan",route:"#/sub/wochenplan"},
      {label:"Kondit.",route:"#/sub/kond"},
      {label:"Cuckold",route:"#/sub/cuckold"},
      {label:"Log",route:"#/sub/log"},
      {label:"Einstellungen",route:"#/sub/settings"},
    ];
    items.forEach(item=>{
      const btn=document.createElement("button");
      btn.className="navbtn"+(route===item.route?" active":"");
      btn.textContent=item.label;
      btn.onclick=()=>{location.hash=item.route;};
      nav.appendChild(btn);
    });
  } else if(isDom) {
    const items=[
      {label:"Start",route:"#/start"},
      {label:"Übersicht",route:"#/dom/start"},
      {label:"Aufgaben",route:"#/dom/aufgaben"},
      {label:"Wochenplan",route:"#/dom/wochenplan"},
      {label:"Rückmeldungen",route:"#/dom/rueckmeldungen"},
      {label:"Log",route:"#/dom/log"},
    ];
    items.forEach(item=>{
      const btn=document.createElement("button");
      btn.className="navbtn"+(route===item.route?" active":"");
      btn.textContent=item.label;
      btn.onclick=()=>{location.hash=item.route;};
      nav.appendChild(btn);
    });
  }
}

function render() {
  const dm=$("dayMode"); if(dm) dm.value=state.settings.dayMode;
  updateNav();
  const view=$("view"); if(!view) return;
  view.innerHTML=""; view.style.paddingBottom="80px";
  const r=state.route;
  if(r==="#/start")                    view.appendChild(renderStart());
  else if(r==="#/sub/home")            view.appendChild(renderSubHome());
  else if(r==="#/sub/goals")           view.appendChild(renderSubGoals());
  else if(r==="#/sub/tasks")           view.appendChild(renderSubTasks());
  else if(r==="#/sub/wochenplan")      view.appendChild(renderSubWochenplan());
  else if(r==="#/sub/kond")            view.appendChild(renderPisslog());
  else if(r==="#/sub/cuckold")         view.appendChild(renderCuckold());
  else if(r==="#/sub/log")             view.appendChild(renderSubLog());
  else if(r==="#/sub/settings")        view.appendChild(renderSubSettings());
  else if(r==="#/dom/start")           view.appendChild(renderDomStart());
  else if(r==="#/dom/aufgaben")        view.appendChild(renderDomAufgaben());
  else if(r==="#/dom/wochenplan")      view.appendChild(renderDomWochenplan());
  else if(r==="#/dom/rueckmeldungen")  view.appendChild(renderDomRueckmeldungen());
  else if(r==="#/dom/log")             view.appendChild(renderDomLog());
  else                                 view.appendChild(renderStart());
}

function onRoute() { state.route=location.hash||"#/start"; render(); }

async function registerServiceWorker() { if(!("serviceWorker" in navigator)) return; for(const url of ["./sw.js","./service-worker.js"]){try{await navigator.serviceWorker.register(url,{scope:"./"});return;}catch{}}}

function setupBridge() {
  window.addEventListener("message",async(ev)=>{
    const msg=ev?.data; if(!msg||typeof msg!=="object") return;
    if(msg.type==="GT_NEW_TASK"||msg.type==="GT_REFRESH"){await loadAnjaTasks();render();}
  });
}

async function init() {
  const label=$("todayLabel"); if(label) label.textContent=new Date().toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  const dm=$("dayMode"); if(dm) dm.addEventListener("change",(e)=>setDayMode(e.target.value));
  const btnSync=$("btnSync"); if(btnSync) btnSync.addEventListener("click",async()=>{try{await loadAllCSV();toast("CSV geladen.");regenIfNeeded(true);render();}catch(e){toast("CSV Fehler.");}});
  window.addEventListener("hashchange",onRoute);
  setupBridge(); await registerServiceWorker();
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
    const wp=await fbGetWochenplan().catch(()=>null); if(wp) state.wochenplan=wp;
    const r=state.route;
    const noRender=["#/dom/aufgaben","#/sub/kond","#/sub/cuckold","#/sub/settings","#/sub/wochenplan"];
    if(noRender.includes(r)) return;
    if(r.startsWith("#/sub/")||r.startsWith("#/dom/")) render();
  },30000);
  if(!location.hash||location.hash==="#/nav"||location.hash==="#/start") location.hash="#/start";
  onRoute();
}
init();
