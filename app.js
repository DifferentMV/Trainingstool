/* Glam Trainer — V3.0 (Full Update: Wochenplan Status & Logging) */

const FIREBASE_URL = "https://ds-trainingstool-default-rtdb.europe-west1.firebasedatabase.app";

// ── Basis Firebase Funktionen ──
async function fbGet(path) { const res=await fetch(`${FIREBASE_URL}/${path}.json`); if(!res.ok) return null; return await res.json(); }
async function fbSet(path,value) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}); return res.ok; }
async function fbPush(path,value) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}); if(!res.ok) return null; return (await res.json()).name; }
async function fbPatch(path,patch) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}); return res.ok; }
async function fbDelete(path) { const res=await fetch(`${FIREBASE_URL}/${path}.json`,{method:"DELETE"}); return res.ok; }

// ── Daten-Abfragen ──
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

// ── Wochenplan Logik ──
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
      await fbPush("konditionierung_log", {
        ts: nowISO(),
        txt: `Wochenplan-Aufgabe erledigt: ${titel}`,
        type: "Wochenplan"
      });
    }
    const entry = state.wochenplan.find(e => e._fbKey === fbKey);
    if (entry) entry.status = status;
    render(); // Gesamte UI neu zeichnen
  }
}

// ── Interne Verwaltung & State ──
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

// ── Schedule Logik ──
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

// ── Wochenplan Rendering ──
function renderWochenplan() {
  const container = $("wochenplan-list");
  if (!container) return h("div", {}, ["Wochenplan-Container nicht gefunden"]);

  const tage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const list = h("div", { class: "wp-container" }, tage.map(tag => {
    const tagesEintraege = state.wochenplan.filter(e => e.tag === tag);
    if (tagesEintraege.length === 0) return null;

    return h("div", { class: "wp-tag-group", style: "margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px" }, [
      h("h3", { style: "color:rgba(164,107,138,1); margin-bottom:8px" }, [tag]),
      ...tagesEintraege.map(e => {
        let textStyle = "font-weight:600;";
        if (e.status === 'done') textStyle += "text-decoration:line-through; color:#4caf50;";
        if (e.status === 'skip') textStyle += "color:#888; opacity:0.6;";

        return h("div", { class: "wp-item", style: "display:flex; justify-content:space-between; align-items:center; padding:5px 0" }, [
          h("div", { style: textStyle }, [`${e.zeit || '--:--'} - ${e.titel}`]),
          h("div", { class: "wp-actions", style: "display:flex; gap:8px" }, [
            h("button", { 
              class: "btn secondary small", 
              style: "padding:2px 8px; font-size:12px",
              onclick: () => setWochenplanStatus(e._fbKey, 'done', e.titel)
            }, ["✅"]),
            h("button", { 
              class: "btn secondary small", 
              style: "padding:2px 8px; font-size:12px",
              onclick: () => setWochenplanStatus(e._fbKey, 'skip', e.titel)
            }, ["❌"])
          ])
        ]);
      })
    ]);
  }));
  
  container.innerHTML = "";
  container.appendChild(list);
}

// ── Haupt-Render Logik ──
function render() {
  const root = $("app"); if(!root) return;
  root.innerHTML = "";
  
  // Navigation & Header
  const nav = h("nav", {class:"main-nav"}, [
    chip("Start", state.route==="#/start", () => {state.route="#/start"; render();}),
    chip("Plan", state.route==="#/plan", () => {state.route="#/plan"; render();}),
    chip("Wünsche", state.route==="#/wuensche", () => {state.route="#/wuensche"; render();}),
    chip("Log", state.route==="#/log", () => {state.route="#/log"; render();})
  ]);
  root.appendChild(nav);

  const content = h("div", {id:"content", class:"container"});
  root.appendChild(content);

  if(state.route === "#/plan") {
    content.appendChild(sectionTitle("📅", "Wochenplan"));
    const wpList = h("div", {id:"wochenplan-list"});
    content.appendChild(wpList);
    renderWochenplan();
  } else if(state.route === "#/wuensche") {
    content.appendChild(sectionTitle("✨", "Wünsche & Marlo"));
    // Hier käme die Wünsche-Logik rein
  } else if(state.route === "#/log") {
    content.appendChild(sectionTitle("📜", "Aktivitätslog"));
    const logList = h("div", {class:"log-list"}, state.pisslog.map(entry => 
      h("div", {class:"card small"}, [
        h("div", {class:"small"}, [fmtDateTimeLocal(entry.ts)]),
        h("div", {style:"font-weight:700"}, [entry.txt || entry.uebung || "Eintrag"])
      ])
    ));
    content.appendChild(logList);
  } else {
    // Default: Startseite
    content.appendChild(sectionTitle("👋", "Hallo Marlo"));
    content.appendChild(h("p", {}, ["Willkommen im Glam Trainer. Deine aktuellen Aufgaben findest du im Plan."]));
  }
}

// ── Initialisierung ──
async function init() {
  await loadAllCSV().catch(console.warn);
  await loadAnjaTasks();
  
  const [cuckData, customWishData, pisslogData, wuenscheData, wochenplanData] = await Promise.all([
    fbGetCuckold().catch(()=>({})),
    fbGetCustomWishes().catch(()=>[]),
    fbGetPisslog().catch(()=>[]),
    fbGetWuensche().catch(()=>[]),
    fbGetWochenplan().catch(()=>[])
  ]);
  
  state.cuckold = cuckData || {gefuehl:null, wunsch:null};
  state.customWishes = customWishData || [];
  state.pisslog = pisslogData || [];
  state.wuensche = wuenscheData || [];
  state.wochenplan = wochenplanData || [];
  
  regenIfNeeded(true);
  render();
}

window.addEventListener("load", init);
