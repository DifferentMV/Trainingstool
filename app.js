/* Glam Trainer — V1 (Vanilla JS, GitHub Pages) */
/* Storage: localStorage. Push: ntfy.sh. */

const STORAGE = {
  settings: "gt_settings_v1",
  tasks: "gt_tasks_v1",
  goals: "gt_goals_v1",
  steps: "gt_goal_steps_v1",
  log: "gt_log_v1",
  schedule: "gt_schedule_v1",
  inbox: "gt_inbox_v1",
};

const DEFAULT_SETTINGS = {
  dayMode: "normal",                 // aussetzen | sanft | normal | herausfordernd
  minGapGoalsMin: 90,
  minGapTasksMin: 45,
  maxUnitsPerBundle: 5,

  ntfyGoalsTopic: "",
  ntfyTasksTopic: "",
  ntfyReportTopic: "",
  ntfyToken: "",

  tickSeconds: 20, // Push-Dispatch im offenen Tab
};

const $ = (id) => document.getElementById(id);

function nowISO(){ return new Date().toISOString(); }
function todayKey(d=new Date()){
  const x=new Date(d); x.setHours(0,0,0,0);
  return x.toISOString().slice(0,10);
}
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtTime(d){ return pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function parseTimeToDateToday(hhmm){
  const [h,m]=String(hhmm||"").split(":").map(Number);
  if(!Number.isFinite(h)||!Number.isFinite(m)) return null;
  const d=new Date(); d.setHours(h,m,0,0); return d;
}
function randInt(min,max){
  const a=Math.min(min,max), b=Math.max(min,max);
  return a + Math.floor(Math.random()*(b-a+1));
}
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function toast(msg){
  const t=$("toast");
  t.textContent=msg;
  t.style.display="block";
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>{ t.style.display="none"; }, 1400);
}

function loadJSON(key, fallback){
  try{
    const raw=localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function startOfWeek(d=new Date()){
  const x=new Date(d);
  const day=(x.getDay()+6)%7; // Mon=0
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
function inThisWeek(dateISO){
  const d=new Date(dateISO);
  const s=startOfWeek();
  const e=new Date(s); e.setDate(e.getDate()+7);
  return d>=s && d<e;
}

async function fetchText(url){
  const res = await fetch(url, {cache:"no-store"});
  if(!res.ok) throw new Error(`${url} nicht gefunden (${res.status})`);
  return await res.text();
}

function parseCSV(text){
  // simple CSV/; parser (private use; no quoted separators)
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
  if(!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines.shift().split(sep).map(s=>s.trim());
  return lines.map(line=>{
    const parts=line.split(sep).map(s=>(s??"").trim());
    const row={};
    header.forEach((h,i)=>row[h]=parts[i]??"");
    return row;
  });
}

function normalizeBool(v){
  const s=String(v||"").trim().toLowerCase();
  return s==="true"||s==="ja"||s==="1"||s==="y"||s==="yes";
}
function getField(row, aliases, fallback=""){
  for(const a of aliases){
    if(row[a] !== undefined && String(row[a]).trim() !== "") return String(row[a]).trim();
  }
  return fallback;
}
/* ---------- State ---------- */

const state = {
  settings: loadJSON(STORAGE.settings, DEFAULT_SETTINGS),
  tasksData: loadJSON(STORAGE.tasks, []),
  goalsData: loadJSON(STORAGE.goals, []),
  goalsStepsData: loadJSON(STORAGE.steps, []),

  route: "#/home",
  filter: "all", // all | goals | tasks
};

function persistSettings(){
  saveJSON(STORAGE.settings, state.settings);
}
function getLog(){ return loadJSON(STORAGE.log, []); }
function setLog(x){ saveJSON(STORAGE.log, x); }

function getSchedule(){ return loadJSON(STORAGE.schedule, null); }
function setSchedule(x){ saveJSON(STORAGE.schedule, x); }

function getInbox(){ return loadJSON(STORAGE.inbox, []); }
function setInbox(x){ saveJSON(STORAGE.inbox, x); }

function setDayMode(mode){
  state.settings.dayMode = mode;
  persistSettings();
  regenIfNeeded(true);
  render();
}

/* ---------- CSV load ---------- */

async function loadAllCSV(){
  const [tasksTxt, goalsTxt, stepsTxt] = await Promise.all([
    fetchText("tasks.csv").catch(()=> ""),
    fetchText("goals.csv").catch(()=> ""),
    fetchText("goal_uebungen.csv").catch(()=> ""),
  ]);

  state.tasksData = tasksTxt ? parseCSV(tasksTxt) : [];
  state.goalsData = goalsTxt ? parseCSV(goalsTxt) : [];
  state.goalsStepsData = stepsTxt ? parseCSV(stepsTxt) : [];

  saveJSON(STORAGE.tasks, state.tasksData);
  saveJSON(STORAGE.goals, state.goalsData);
  saveJSON(STORAGE.steps, state.goalsStepsData);
}

/* ---------- Schedule generation (Goals only core) ---------- */

function countGoalDoneThisPeriod(goalId, period){
  const log=getLog();
  if(period==="TAG"){
    const t=todayKey();
    return log.filter(e=>e.typ==="ziel" && e.ziel_id===goalId && e.status==="erledigt" && e.dayKey===t).length;
  }
  return log.filter(e=>e.typ==="ziel" && e.ziel_id===goalId && e.status==="erledigt" && inThisWeek(e.createdAt)).length;
}

function computeGoalQuota(goal){
  const period=(goal.zeitraum||"TAG").toUpperCase()==="WOCHE" ? "WOCHE" : "TAG";
  const min=parseInt(goal.min||"0",10) || 0;
  const max=parseInt(goal.max||"0",10) || 0;
  const done=countGoalDoneThisPeriod(goal.ziel_id, period);
  return {period, min, max, done};
}

function pickRandomTimeBetween(fromHHMM, toHHMM){
  const from=parseTimeToDateToday(fromHHMM);
  const to=parseTimeToDateToday(toHHMM);
  if(!from || !to || to<=from) return null;
  const t = from.getTime() + Math.random()*(to.getTime()-from.getTime());
  return new Date(t);
}

function ensureMinGap(sortedDates, candidate, minGapMinutes){
  const gap=minGapMinutes*60*1000;
  for(const d of sortedDates){
    if(Math.abs(d.getTime()-candidate.getTime()) < gap) return false;
  }
  return true;
}

function generateGoalUnitsForToday(){
  const mode=state.settings.dayMode;
  const goals = state.goalsData.map(g=>({
  ziel_id: getField(g, ["ziel_id","id","ziel","zielid","zielId"]),
  ziel_name: getField(g, ["ziel_name","name","ziel_name_de","titel","zielname"], ""),
  aktiv: normalizeBool(getField(g, ["aktiv","active"], "false")),
  stufe: parseInt(getField(g, ["aktuelle_stufe","stufe","level"], "1"),10)||1,
  max: parseInt(getField(g, ["max_stufe","max","maxlevel"], "5"),10)||5,
  min: parseInt(getField(g, ["min","min_pro_zeitraum"], "0"),10)||0,
  maxp: parseInt(getField(g, ["max","max_pro_zeitraum"], "0"),10)||0,
  zeitraum: getField(g, ["zeitraum","periode"], "TAG").toUpperCase(),
  modus: getField(g, ["modus","mode"], "flexibel").toLowerCase(),
  zeit_von: getField(g, ["zeit_von","von"], "14:00"),
  zeit_bis: getField(g, ["zeit_bis","bis"], "20:00"),
  feste_zeit: getField(g, ["feste_zeit","uhrzeit","fix"], "09:00"),
})).filter(g=>g.ziel_id);

  if(mode==="aussetzen") return [];

  const units=[];
  for(const g of goals){
    const {period, min, max, done} = computeGoalQuota(g);
    if(max>0 && done>=max) continue;

    let want=0;

    if(period==="TAG"){
      const minAdj = (mode==="sanft") ? Math.min(min,1) : min;
      const maxAdj = (mode==="sanft") ? Math.min(max||1,1) : (mode==="herausfordernd" ? (max||min||1) : (max||min||1));
      const minUse = Math.max(0, minAdj);
      const maxUse = Math.max(minUse, maxAdj);
      want = (maxUse===0 && minUse===0) ? 0 : randInt(minUse, maxUse);
    } else {
      if(done < min) want = 1;
      else if(max>0 && done < max){
        const p = mode==="sanft" ? 0.25 : (mode==="herausfordernd" ? 0.55 : 0.40);
        want = (Math.random() < p) ? 1 : 0;
      }
    }

    for(let i=0;i<want;i++){
      units.push({
        id: `goalunit-${g.ziel_id}-${todayKey()}-${i}-${Math.floor(Math.random()*100000)}`,
        typ: "ziel",
        ziel_id: g.ziel_id,
        ziel_name: g.ziel_name || g.ziel_id,
        stufe: clamp(g.aktuelle_stufe, 1, g.max_stufe),
        plannedAt: null,
        plannedLabel: "",
        status: "geplant",
        createdAt: nowISO(),
      });
    }
  }

  const plannedDates=[];
  for(const u of units){
    const g = goals.find(x=>x.ziel_id===u.ziel_id);
    if(!g) continue;

    let dt=null;
    if(g.modus==="ritualisiert"){
      dt=parseTimeToDateToday(g.feste_zeit) || new Date();
    }else{
      dt=pickRandomTimeBetween(g.zeit_von, g.zeit_bis) || new Date();
    }

    const softGap = Math.max(10, Math.floor(state.settings.minGapGoalsMin/2));
    let tries=0;
    while(tries<12 && !ensureMinGap(plannedDates, dt, softGap)){
      dt = new Date(dt.getTime() + randInt(8, 22)*60*1000);
      tries++;
    }

    plannedDates.push(dt);
    plannedDates.sort((a,b)=>a-b);

    u.plannedAt = dt.toISOString();
    u.plannedLabel = fmtTime(dt);
  }

  units.sort((a,b)=> new Date(a.plannedAt)-new Date(b.plannedAt));
  return units;
}

function pickExerciseForGoal(goalId, stufe){
  const rows=state.goalsStepsData.map(r=>({
    ziel_id: r.ziel_id||r.goal_id||"",
    stufe: parseInt(r.stufe||"1",10) || 1,
    titel: r.titel||"",
  })).filter(x=>x.ziel_id && x.titel);

  const list = rows.filter(x=>x.ziel_id===goalId && x.stufe===stufe);
  if(!list.length) return null;
  return list[Math.floor(Math.random()*list.length)];
}

function regenIfNeeded(force=false){
  const schedule=getSchedule();
  const t=todayKey();
  if(!force && schedule && schedule.dayKey===t) return;

  const units = generateGoalUnitsForToday();

  const newSchedule = {
    dayKey: t,
    createdAt: nowISO(),
    lastPushAtGoals: schedule?.lastPushAtGoals || null,
    units,
  };
  setSchedule(newSchedule);
}

/* ---------- Push (ntfy) ---------- */

async function sendNtfy(topic, token, message, title){
  if(!topic) return false;
  const headers={
    "Content-Type":"text/plain; charset=utf-8",
    "Title": title || "Glam Trainer",
    "Priority":"default",
    "Tags":"bell"
  };
  if(token) headers["Authorization"]=`Bearer ${token}`;
  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {method:"POST", headers, body:message});
  if(!res.ok){
    const txt=await res.text();
    throw new Error(`Push fehlgeschlagen (${res.status}): ${txt.slice(0,140)}`);
  }
  return true;
}

function canSendPush(lastISO, minGapMinutes){
  if(!lastISO) return true;
  const last=new Date(lastISO).getTime();
  return (Date.now()-last) >= minGapMinutes*60*1000;
}

async function maybeDispatchPushes(){
  const schedule=getSchedule();
  if(!schedule || schedule.dayKey!==todayKey()) return;

  const settings=state.settings;
  const now=new Date();

  const due = schedule.units.filter(u=>u.status==="geplant" && u.plannedAt && new Date(u.plannedAt) <= now);
  if(!due.length) return;

  if(!canSendPush(schedule.lastPushAtGoals, settings.minGapGoalsMin)) return;

  const show = due.slice(0, settings.maxUnitsPerBundle);
  const more = due.length - show.length;

  const lines = [];
  lines.push(`Trainingseinheiten fällig: ${due.length}`);
  lines.push("");
  show.forEach(u=> lines.push(`• ${u.ziel_name} – Stufe ${u.stufe}`));
  if(more>0) lines.push(`… +${more} weitere`);
  lines.push("");
  lines.push("Öffne die App.");

  try{
    await sendNtfy(settings.ntfyGoalsTopic, settings.ntfyToken, lines.join("\n"), "Training fällig");
    schedule.lastPushAtGoals = nowISO();
    setSchedule(schedule);
    toast("Push gesendet.");
  }catch(e){
    console.warn(e);
  }
}

/* ---------- Log + completion + progression ---------- */

function addLogEntry(entry){
  const log=getLog();
  log.unshift(entry);
  setLog(log);
}

function completeUnit(unitId, result){
  const schedule=getSchedule();
  if(!schedule) return;

  const idx=schedule.units.findIndex(u=>u.id===unitId);
  if(idx<0) return;

  const u=schedule.units[idx];
  u.status = result.status; // erledigt | abgebrochen
  u.doneAt = nowISO();
  setSchedule(schedule);

  addLogEntry({
    id: `log-${Date.now()}-${Math.floor(Math.random()*10000)}`,
    typ: u.typ,
    dayKey: schedule.dayKey,
    createdAt: nowISO(),
    ziel_id: u.ziel_id,
    ziel_name: u.ziel_name,
    stufe: u.stufe,
    uebung: result.uebungText || "",
    status: result.status,
    rueckmeldung: result.rueckmeldung || "",
    gern: result.gern || null,
    notiz: result.notiz || "",
    plannedLabel: u.plannedLabel || "",
  });

  if(u.typ==="ziel"){
    applyProgression(u.ziel_id);
  }
}

function applyProgression(goalId){
  // einfache, robuste Stufenlogik:
  // - Rück: wenn 2× hintereinander abgebrochen ODER 3× abgebrochen in den letzten 7
  // - Vor: wenn >=5 erledigt auf aktueller Stufe UND Punkte >=6 (leicht=2, okay=1, schwer=0)
  const logs = getLog().filter(e=>e.typ==="ziel" && e.ziel_id===goalId);

  const last2 = logs.slice(0,2);
  const consecAbort = last2.length===2 && last2.every(x=>x.status==="abgebrochen");
  const last7 = logs.slice(0,7);
  const aborts = last7.filter(x=>x.status==="abgebrochen").length;

  const idx = state.goalsData.findIndex(g => (g.ziel_id||g.id||"") === goalId);
  if(idx<0) return;

  const g = state.goalsData[idx];
  const cur = parseInt(g.aktuelle_stufe||g.stufe||"1",10) || 1;
  const maxStufe = parseInt(g.max_stufe||g.max||"5",10) || 5;

  let newStufe = cur;

  if(consecAbort || aborts>=3){
    newStufe = Math.max(1, cur-1);
  } else {
    const onLevel = logs.filter(e=>e.stufe===cur);
    const success = onLevel.filter(e=>e.status==="erledigt");
    if(success.length >= 5){
      let points=0;
      for(const s of success){
        if(s.rueckmeldung==="leicht") points+=2;
        else if(s.rueckmeldung==="okay") points+=1;
      }
      if(points >= 6){
        newStufe = Math.min(maxStufe, cur+1);
      }
    }
  }

  if(newStufe !== cur){
    g.aktuelle_stufe = String(newStufe);
    state.goalsData[idx] = g;
    saveJSON(STORAGE.goals, state.goalsData);
    toast(newStufe>cur ? "Nächste Stufe freigeschaltet." : "Eine Stufe zurück (sanft).");
  }
}

/* ---------- UI helpers ---------- */

function setActiveNav(route){
  document.querySelectorAll(".navbtn").forEach(b=>{
    const r=b.getAttribute("data-route");
    b.classList.toggle("active", route.startsWith(r));
  });
}

function h(tag, attrs={}, children=[]){
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==="class") el.className=v;
    else if(k.startsWith("on") && typeof v==="function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if(k==="html") el.innerHTML=v;
    else el.setAttribute(k, v);
  }
  (children||[]).forEach(c=>{
    if(c===null || c===undefined) return;
    if(typeof c==="string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}

function sectionTitle(icon, title, rightEl){
  return h("div", {class:"section-title"}, [
    h("h2", {}, [ `${icon} ${title}` ]),
    h("div", {class:"right"}, rightEl ? [rightEl] : [])
  ]);
}

function chip(label, active, onClick){
  return h("button", {class:"chip"+(active?" active":""), type:"button", onclick:onClick}, [label]);
}

function openModal(contentEl){
  const backdrop=h("div",{class:"modal-backdrop"},[
    h("div",{class:"modal"},[ contentEl ])
  ]);
  backdrop.addEventListener("click",(e)=>{ if(e.target===backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  return ()=>backdrop.remove();
}

/* ---------- Unit detail modal ---------- */

function unitDetailModal(unit){
  const schedule=getSchedule();
  const u = schedule?.units?.find(x=>x.id===unit.id) || unit;

  let exercise=null;
  if(u.typ==="ziel"){
    exercise = pickExerciseForGoal(u.ziel_id, u.stufe);
  }

  const title = u.typ==="ziel" ? `🎯 Trainingseinheit` : `🧩 Aufgabe`;
  const main = u.typ==="ziel"
    ? `${u.ziel_name} – Stufe ${u.stufe}\n\n${exercise?.titel ? "Übung: "+exercise.titel : "Keine Übung in goal_uebungen.csv gefunden."}`
    : (u.title || u.aufgabe || "");

  const closeBtn=h("button",{class:"modal-close",type:"button"},["✕"]);
  const header=h("div",{class:"modal-header"},[
    h("div",{class:"modal-title"},[title]),
    closeBtn
  ]);

  const statusRow=h("div",{class:"row"},[
    h("button",{class:"btn secondary",type:"button", id:"btnDone"},["Geschafft"]),
    h("button",{class:"btn secondary",type:"button", id:"btnAbort"},["Abgebrochen"])
  ]);

  const feedbackRow=h("div",{class:"row", style:"margin-top:8px"},[
    h("button",{class:"btn secondary",type:"button", id:"fb1"},["leicht"]),
    h("button",{class:"btn secondary",type:"button", id:"fb2"},["okay"]),
    h("button",{class:"btn secondary",type:"button", id:"fb3"},["schwer"])
  ]);

  const gernSel=h("select",{class:"select", id:"gernSel"},[
    h("option",{value:""},["Gern gemacht? (optional)"]),
    ...[1,2,3,4,5].map(n=>h("option",{value:String(n)},[String(n)]))
  ]);

  const note=h("textarea",{class:"textarea", id:"note", placeholder:"Notiz (optional)"} ,[]);

  const btnSave=h("button",{class:"btn",type:"button"},["Speichern"]);
  const btnDelete=h("button",{class:"btn danger",type:"button"},["Eintrag löschen"]);
  const btnClose=h("button",{class:"btn secondary",type:"button"},["Zurück"]);

  const footer=h("div",{class:"row", style:"margin-top:10px"},[btnSave, btnClose, btnDelete]);

  const body=h("div",{},[
    header,
    h("div",{class:"hr"},[]),
    h("div",{class:"small"},[u.plannedLabel ? `Geplant: ${u.plannedLabel}` : "" ]),
    h("div",{style:"white-space:pre-line; font-size:16px; font-weight:800; margin-top:8px"},[main]),
    h("div",{class:"hr"},[]),
    h("div",{class:"small"},["Rückmeldung (für Ziele empfohlen):"]),
    statusRow,
    feedbackRow,
    gernSel,
    note,
    footer
  ]);

  const close=openModal(body);
  closeBtn.onclick=close;
  btnClose.onclick=close;

  let chosenStatus=null;
  let rueck=null;

  function setBtnActive(btn){
    [body.querySelector("#btnDone"), body.querySelector("#btnAbort")].forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
  }
  function setFbActive(btn){
    [body.querySelector("#fb1"), body.querySelector("#fb2"), body.querySelector("#fb3")].forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
  }

  body.querySelector("#btnDone").onclick=()=>{ chosenStatus="erledigt"; setBtnActive(body.querySelector("#btnDone")); };
  body.querySelector("#btnAbort").onclick=()=>{ chosenStatus="abgebrochen"; setBtnActive(body.querySelector("#btnAbort")); };

  body.querySelector("#fb1").onclick=()=>{ rueck="leicht"; setFbActive(body.querySelector("#fb1")); };
  body.querySelector("#fb2").onclick=()=>{ rueck="okay"; setFbActive(body.querySelector("#fb2")); };
  body.querySelector("#fb3").onclick=()=>{ rueck="schwer"; setFbActive(body.querySelector("#fb3")); };

  btnSave.onclick=()=>{
    if(!chosenStatus){ toast("Bitte: Geschafft oder Abgebrochen wählen."); return; }
    if(u.typ==="ziel" && !rueck){ toast("Bitte Rückmeldung wählen (leicht/okay/schwer)."); return; }

    completeUnit(u.id, {
      status: chosenStatus,
      rueckmeldung: rueck || "",
      gern: body.querySelector("#gernSel").value ? parseInt(body.querySelector("#gernSel").value,10) : null,
      notiz: body.querySelector("#note").value.trim(),
      uebungText: exercise?.titel || "",
    });

    close();
    render();
  };

  btnDelete.onclick=()=>{
    const schedule=getSchedule();
    if(!schedule) return;
    const idx=schedule.units.findIndex(x=>x.id===u.id);
    if(idx>=0){
      schedule.units.splice(idx,1);
      setSchedule(schedule);
      toast("Gelöscht.");
      close();
      render();
    }
  };
}

/* ---------- Views ---------- */

function listItemCard(unit){
  const badgeClass = unit.typ==="ziel" ? "badge goal" : "badge task";
  const badgeIcon = unit.typ==="ziel" ? "🎯" : "🧩";
  const title = unit.typ==="ziel"
    ? `${unit.ziel_name} – Stufe ${unit.stufe}`
    : `${unit.title||unit.aufgabe||"Aufgabe"}`;

  const sub = unit.typ==="ziel"
    ? "Übung: (wird beim Öffnen gewählt)"
    : (unit.rubrik ? `Rubrik: ${unit.rubrik}` : "");

  return h("div", {class:"item"}, [
    h("div", {class:badgeClass}, [badgeIcon]),
    h("div", {class:"item-main"}, [
      h("div", {class:"item-title"}, [title]),
      h("div", {class:"item-sub"}, [sub]),
      h("div", {class:"row", style:"margin-top:10px; gap:10px"}, [
        h("button",{class:"btn secondary", type:"button", onclick:()=>unitDetailModal(unit)},["Öffnen"])
      ])
    ]),
    h("div", {class:"time"}, [unit.plannedLabel || ""])
  ]);
}

function moduleTile(icon, title, lines, btnText, onClick){
  return h("div",{class:"card"},[
    h("div",{style:"display:flex;align-items:flex-start;gap:10px"},[
      h("div",{class:"badge task", style:"width:38px;height:38px"},[icon]),
      h("div",{style:"flex:1"},[
        h("div",{style:"font-weight:900;font-size:16px"},[title]),
        h("div",{class:"small", style:"margin-top:6px;white-space:pre-line"},[lines])
      ])
    ]),
    h("div",{class:"hr"},[]),
    h("button",{class:"btn secondary", type:"button", onclick:onClick},[btnText])
  ]);
}

function goalsSummaryText(){
  const goals=state.goalsData.map(g=>({
    id:g.ziel_id||g.id||"",
    name:g.ziel_name||g.name||g.ziel_id||"",
    aktiv: normalizeBool(g.aktiv),
    stufe: parseInt(g.aktuelle_stufe||g.stufe||"1",10)||1,
    max: parseInt(g.max_stufe||g.max||"5",10)||5,
  })).filter(g=>g.id && g.aktiv);

  if(!goals.length) return "Aktiv: 0\nKeine aktiven Ziele.";
  const lines = goals.slice(0,3).map(g=>`${g.name} – Stufe ${g.stufe}/${g.max}`);
  return `Aktiv: ${goals.length}\n`+lines.join("\n");
}

function tasksSummaryText(){
  const inbox=getInbox();
  return `Inbox: ${inbox.length}\nOptional: Aufgaben sind lustbasiert.`;
}

function renderHome(){
  regenIfNeeded(false);
  const schedule=getSchedule();
  const units=(schedule?.units||[]);
  const now=new Date();

  const due=units.filter(u=>u.status==="geplant" && u.plannedAt && new Date(u.plannedAt)<=now);
  const planned=units.filter(u=>u.status==="geplant" && u.plannedAt && new Date(u.plannedAt)>now);

  const filtered=(arr)=>{
    if(state.filter==="all") return arr;
    if(state.filter==="goals") return arr.filter(x=>x.typ==="ziel");
    if(state.filter==="tasks") return arr.filter(x=>x.typ==="aufgabe");
    return arr;
  };

  const chips=h("div",{class:"chips"},[
    chip("Alle", state.filter==="all", ()=>{state.filter="all"; render();}),
    chip("🎯 Ziele", state.filter==="goals", ()=>{state.filter="goals"; render();}),
    chip("🧩 Aufgaben", state.filter==="tasks", ()=>{state.filter="tasks"; render();}),
  ]);

  const dueList=h("div",{class:"list"}, filtered(due).map(listItemCard));
  const plannedList=h("div",{class:"list"}, filtered(planned).map(listItemCard));

  return h("div",{style:"display:flex;flex-direction:column;gap:12px"},[
    h("div",{class:"card"},[
      sectionTitle("🔔","Jetzt fällig", chips),
      filtered(due).length ? dueList : h("div",{class:"small"},["Keine Einheiten fällig."])
    ]),
    h("div",{class:"card"},[
      sectionTitle("📅","Heute geplant", null),
      filtered(planned).length ? plannedList : h("div",{class:"small"},["Heute ist nichts weiter geplant."])
    ]),
    h("div",{class:"grid2"},[
      moduleTile("🎯","Ziele", goalsSummaryText(), "Ziele öffnen", ()=>{location.hash="#/goals";}),
      moduleTile("🧩","Aufgaben", tasksSummaryText(), "Aufgaben öffnen", ()=>{location.hash="#/tasks";}),
    ])
  ]);
}

function renderGoals(){
  const goals = state.goalsData.map(g=>({
  ziel_id: getField(g, ["ziel_id","id","ziel","zielid","zielId"]),
  ziel_name: getField(g, ["ziel_name","name","ziel_name_de","titel","zielname"], ""),
  aktiv: normalizeBool(getField(g, ["aktiv","active"], "false")),
  stufe: parseInt(getField(g, ["aktuelle_stufe","stufe","level"], "1"),10)||1,
  max: parseInt(getField(g, ["max_stufe","max","maxlevel"], "5"),10)||5,
  min: parseInt(getField(g, ["min","min_pro_zeitraum"], "0"),10)||0,
  maxp: parseInt(getField(g, ["max","max_pro_zeitraum"], "0"),10)||0,
  zeitraum: getField(g, ["zeitraum","periode"], "TAG").toUpperCase(),
  modus: getField(g, ["modus","mode"], "flexibel").toLowerCase(),
  zeit_von: getField(g, ["zeit_von","von"], "14:00"),
  zeit_bis: getField(g, ["zeit_bis","bis"], "20:00"),
  feste_zeit: getField(g, ["feste_zeit","uhrzeit","fix"], "09:00"),
})).filter(g=>g.ziel_id);

  const cards = goals.map(g=>{
    const {period, min, max, done} = computeGoalQuota(g);
    const freq = period==="TAG"
      ? `Heute: ${done} / ${min}–${max||min}`
      : `Diese Woche: ${done} / ${min}–${max||min}`;
    const mod = g.modus==="ritualisiert" ? `ritualisiert ${g.feste_zeit||"09:00"}` : `flexibel ${g.zeit_von||"14:00"}–${g.zeit_bis||"20:00"}`;
    return h("div",{class:"item"},[
      h("div",{class:"badge goal"},["🎯"]),
      h("div",{class:"item-main"},[
        h("div",{class:"item-title"},[g.ziel_name]),
        h("div",{class:"item-sub"},[`Stufe ${g.stufe} von ${g.max}\n${freq}\n${mod}`]),
        h("div",{class:"row", style:"margin-top:10px"},[
          h("button",{class:"btn secondary", type:"button", onclick:()=>toggleGoalActive(g.ziel_id)},[g.aktiv ? "Pausieren" : "Aktivieren"]),
        ])
      ])
    ]);
  });

  return h("div",{class:"card"},[
    sectionTitle("🎯","Ziele", null),
    cards.length ? h("div",{class:"list"}, cards) : h("div",{class:"small"},["Keine Ziele in goals.csv gefunden."])
  ]);
}

function toggleGoalActive(goalId){
  const idx=state.goalsData.findIndex(g => (g.ziel_id||g.id||"")===goalId);
  if(idx<0) return;
  const g=state.goalsData[idx];
  g.aktiv = normalizeBool(g.aktiv) ? "false" : "true";
  state.goalsData[idx]=g;
  saveJSON(STORAGE.goals, state.goalsData);
  regenIfNeeded(true);
  render();
}

function renderTasks(){
  const rubriken=[...new Set(state.tasksData.map(r=>(r.rubrik||"").trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"de"));

  const rubSel=h("select",{class:"select", id:"rubSel"},[
    h("option",{value:""},["Rubrik wählen"]),
    ...rubriken.map(r=>h("option",{value:r},[r]))
  ]);

  const out=h("div",{id:"taskOut", style:"white-space:pre-line; font-weight:800; margin-top:10px"},[""]);

  const btnRandom=h("button",{class:"btn secondary", type:"button"},["Zufallsaufgabe"]);
  const btnPush=h("button",{class:"btn secondary", type:"button"},["Push senden (Aufgabe)"]);

  btnRandom.onclick=()=>{
    const rub=rubSel.value;
    if(!rub){ toast("Bitte Rubrik wählen."); return; }
    const items=state.tasksData
      .map(r=>({
        rubrik:(r.rubrik||"").trim(),
        titel:(r.titel||"").trim(),
        klasse:(r.klasse||"").trim()
      }))
      .filter(x=>x.rubrik===rub && x.titel);
    if(!items.length){ toast("Keine Aufgaben in dieser Rubrik."); return; }
    const it=items[Math.floor(Math.random()*items.length)];
    out.textContent = `🧩 Aufgabe\nRubrik: ${it.rubrik}\n\n${it.titel}${it.klasse ? "\n\nKlasse: "+it.klasse : ""}`;
    out.dataset.payload = JSON.stringify(it);
    toast("Gewählt.");
  };

  btnPush.onclick=async()=>{
    const payload=out.dataset.payload ? JSON.parse(out.dataset.payload) : null;
    if(!payload){ toast("Erst eine Aufgabe wählen."); return; }
    const s=state.settings;
    try{
      await sendNtfy(s.ntfyTasksTopic, s.ntfyToken, `Aufgabe\nRubrik: ${payload.rubrik}\n\n${payload.titel}`, "Aufgabe");
      toast("Push gesendet.");
    }catch(e){
      toast("Push fehlgeschlagen.");
      console.warn(e);
    }
  };

  return h("div",{class:"card"},[
    sectionTitle("🧩","Aufgaben", null),
    h("div",{class:"small"},["Aufgaben sind optional (Lust / Anja). Keine Progression, keine Strafen."]),
    h("div",{class:"hr"},[]),
    rubSel,
    h("div",{class:"row"},[btnRandom, btnPush]),
    out
  ]);
}

function renderLog(){
  const log=getLog();
  const filterCh=h("div",{class:"chips"},[
    chip("Alle", state.filter==="all", ()=>{state.filter="all"; render();}),
    chip("🎯 Ziele", state.filter==="goals", ()=>{state.filter="goals"; render();}),
    chip("🧩 Aufgaben", state.filter==="tasks", ()=>{state.filter="tasks"; render();}),
  ]);

  const filtered = log.filter(e=>{
    if(state.filter==="all") return true;
    if(state.filter==="goals") return e.typ==="ziel";
    if(state.filter==="tasks") return e.typ==="aufgabe";
    return true;
  });

  const list = filtered.map(e=>{
    const badge=e.typ==="ziel" ? "🎯" : "🧩";
    const title = e.typ==="ziel"
      ? `${e.ziel_name} – Stufe ${e.stufe}`
      : (e.title||"Aufgabe");

    const subLines=[];
    if(e.typ==="ziel"){
      if(e.uebung) subLines.push(`Übung: ${e.uebung}`);
      if(e.rueckmeldung) subLines.push(`Rückmeldung: ${e.rueckmeldung}`);
      if(e.gern) subLines.push(`Gern: ${e.gern}/5`);
    }
    if(e.status) subLines.push(`Status: ${e.status}`);
    if(e.notiz) subLines.push(`Notiz: ${e.notiz}`);

    return h("div",{class:"item"},[
      h("div",{class:"badge "+(e.typ==="ziel"?"goal":"task")},[badge]),
      h("div",{class:"item-main"},[
        h("div",{class:"item-title"},[title]),
        h("div",{class:"item-sub"},[`${new Date(e.createdAt).toLocaleString("de-DE")}\n${subLines.join("\n")}`])
      ])
    ]);
  });

  return h("div",{class:"card"},[
    sectionTitle("📓","Log", filterCh),
    filtered.length ? h("div",{class:"list"}, list) : h("div",{class:"small"},["Noch keine Einträge."])
  ]);
}

function renderSettings(){
  const s=state.settings;

  const topicGoals=h("input",{class:"input", type:"text", value:s.ntfyGoalsTopic, placeholder:"Topic Ziele (ntfy)"});
  const topicTasks=h("input",{class:"input", type:"text", value:s.ntfyTasksTopic, placeholder:"Topic Aufgaben (ntfy)"});
  const token=h("input",{class:"input", type:"text", value:s.ntfyToken, placeholder:"ntfy Token (optional)"});

  const gapGoals=h("input",{class:"input", type:"number", min:"0", step:"1", value:String(s.minGapGoalsMin)});
  const maxBundle=h("input",{class:"input", type:"number", min:"1", step:"1", value:String(s.maxUnitsPerBundle)});

  const btnSave=h("button",{class:"btn", type:"button"},["Speichern"]);
  const btnTestGoals=h("button",{class:"btn secondary", type:"button"},["Push testen (Ziele)"]);
  const btnReload=h("button",{class:"btn secondary", type:"button"},["CSV neu laden"]);

  btnSave.onclick=()=>{
    s.ntfyGoalsTopic=topicGoals.value.trim();
    s.ntfyTasksTopic=topicTasks.value.trim();
    s.ntfyToken=token.value.trim();
    s.minGapGoalsMin=parseInt(gapGoals.value||"0",10)||0;
    s.maxUnitsPerBundle=parseInt(maxBundle.value||"5",10)||5;
    persistSettings();
    toast("Gespeichert.");
  };

  btnTestGoals.onclick=async()=>{
    try{ await sendNtfy(s.ntfyGoalsTopic, s.ntfyToken, "Test vom Glam Trainer (Ziele)", "Push-Test"); toast("Gesendet."); }
    catch(e){ console.warn(e); toast("Fehler."); }
  };

  btnReload.onclick=async()=>{
    try{
      await loadAllCSV();
      toast("CSV geladen.");
      regenIfNeeded(true);
      render();
    }catch(e){
      console.warn(e);
      toast("CSV Fehler.");
    }
  };

  return h("div",{class:"card"},[
    sectionTitle("⚙️","Einstellungen", null),
    h("div",{class:"small"},["Hinweis: Push/Erinnerungen funktionieren zuverlässig, solange die App gelegentlich geöffnet ist."]),
    h("div",{class:"hr"},[]),
    h("div",{class:"small"},["ntfy Topics"]),
    topicGoals, topicTasks, token,
    h("div",{class:"hr"},[]),
    h("div",{class:"small"},["Push Abstand & Bündelung"]),
    gapGoals, maxBundle,
    h("div",{class:"row", style:"margin-top:10px"},[btnSave, btnReload, btnTestGoals]),
  ]);
}

function render(){
  $("dayMode").value = state.settings.dayMode;
  setActiveNav(state.route);

  const view=$("view");
  view.innerHTML="";

  if(state.route.startsWith("#/goals")) view.appendChild(renderGoals());
  else if(state.route.startsWith("#/tasks")) view.appendChild(renderTasks());
  else if(state.route.startsWith("#/log")) view.appendChild(renderLog());
  else if(state.route.startsWith("#/settings")) view.appendChild(renderSettings());
  else view.appendChild(renderHome());
}

/* ---------- Routing + init ---------- */

function onRoute(){
  state.route = location.hash || "#/home";
  setActiveNav(state.route);
  render();
}

async function init(){
  const d=new Date();
  $("todayLabel").textContent = d.toLocaleDateString("de-DE", {weekday:"long", day:"2-digit", month:"2-digit", year:"numeric"});

  $("dayMode").addEventListener("change", (e)=>setDayMode(e.target.value));
  $("btnSync").addEventListener("click", async()=>{
    try{
      await loadAllCSV();
      toast("CSV geladen.");
      regenIfNeeded(true);
      render();
    }catch(e){
      console.warn(e);
      toast("CSV Fehler.");
    }
  });

  document.querySelectorAll(".navbtn").forEach(b=>{
    b.addEventListener("click", ()=>{ location.hash = b.getAttribute("data-route"); });
  });

  window.addEventListener("hashchange", onRoute);

  // Service Worker
  if("serviceWorker" in navigator){
    try{ await navigator.serviceWorker.register("./service-worker.js", {scope:"./"}); }catch{}
  }

  // load CSV best effort
  try{ await loadAllCSV(); } catch(e){ console.warn(e); }

  regenIfNeeded(true);

  setInterval(()=>{ maybeDispatchPushes(); }, state.settings.tickSeconds*1000);

  if(!location.hash) location.hash="#/home";
  onRoute();
}

init();
