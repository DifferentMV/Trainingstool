/* Glam Trainer — V4.1 FINAL
   - KEIN Dauer-Rendern mehr
   - passt zu deinem bestehenden HTML (topbar / wrap / bottomnav)
   - stabil bei Sync
*/

const FIREBASE_URL = "https://ds-trainingstool-default-rtdb.europe-west1.firebasedatabase.app";

/* =========================
   BASIC HELPERS
========================= */

const $ = id => document.getElementById(id);

function nowISO() { return new Date().toISOString(); }
function todayKey() { const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
function pad2(n){return String(n).padStart(2,"0");}
function fmtTime(d){return d?pad2(d.getHours())+":"+pad2(d.getMinutes()):"--:--";}

function loadJSON(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}

function deepEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}

function toast(msg){
  const t=$("toast");
  if(!t)return;
  t.textContent=msg;
  t.style.display="block";
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>t.style.display="none",1400);
}

/* =========================
   FIREBASE
========================= */

async function fb(path,options={}){
  try{
    const r=await fetch(`${FIREBASE_URL}/${path}.json`,options);
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch(e){
    console.warn("FB ERROR:",path,e);
    return null;
  }
}

const fbGet = path => fb(path);
const fbSet = (p,v)=>fb(p,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)});
const fbPush = async(p,v)=>{const r=await fb(p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)});return r?.name||null;}
const fbPatch = (p,v)=>fb(p,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)});
const fbDelete = p=>fb(p,{method:"DELETE"});

/* =========================
   STATE
========================= */

const state={
  route:"#/start",
  filter:"all",

  anjaTasks:[],
  wochenplan:[],
  wuensche:[],
  customWishes:[],
  cuckold:{},
  pisslog:[],

  settings: loadJSON("gt_settings",{dayMode:"normal"})
};

let lastRenderSig="";

/* =========================
   RENDER CONTROL
========================= */

function getSig(){
  return JSON.stringify({
    route:state.route,
    filter:state.filter,
    anja:state.anjaTasks,
    wp:state.wochenplan,
    w:state.wuensche,
    cw:state.customWishes,
    log:state.pisslog
  });
}

function requestRender(){
  const sig=getSig();
  if(sig===lastRenderSig) return;
  lastRenderSig=sig;
  render();
}

/* =========================
   ROUTING
========================= */

function onRoute(){
  state.route=window.location.hash||"#/start";
  requestRender();
}

/* =========================
   UI HELPER
========================= */

function h(tag,attrs={},children=[]){
  const el=document.createElement(tag);
  for(const[k,v]of Object.entries(attrs)){
    if(k==="class")el.className=v;
    else if(k.startsWith("on"))el.addEventListener(k.slice(2).toLowerCase(),v);
    else el.setAttribute(k,v);
  }
  [].concat(children).forEach(c=>{
    if(c==null)return;
    el.appendChild(typeof c==="string"?document.createTextNode(c):c);
  });
  return el;
}

/* =========================
   RENDER PAGES
========================= */

function renderStart(main){
  state.anjaTasks
    .filter(t=>t.status==="offen"||t.status==="angenommen")
    .forEach(t=>{
      main.appendChild(h("div",{class:"card"},[
        h("h3",{},[t.title||"Aufgabe"]),
        h("p",{},[t.desc||""]),
        h("button",{class:"btn",onclick:()=>setAnjaStatus(t.id,"angenommen")},["Annehmen"])
      ]));
    });
}

function renderPlan(main){
  state.wochenplan.forEach(e=>{
    main.appendChild(h("div",{class:"card"},[
      h("div",{},[`${e.zeit||"--"} - ${e.titel}`]),
      h("button",{onclick:()=>setWP(e._fbKey,"done")},["✅"]),
      h("button",{onclick:()=>setWP(e._fbKey,"skip")},["❌"])
    ]));
  });
}

function renderWuensche(main){
  state.wuensche.forEach(w=>{
    main.appendChild(h("div",{class:"card"},[w.titel]));
  });
}

function renderLog(main){
  state.pisslog.forEach(l=>{
    main.appendChild(h("div",{class:"card"},[l.txt]));
  });
}

/* =========================
   MAIN RENDER
========================= */

function render(){

  const header=document.querySelector("header.topbar");
  const main=document.querySelector("main.wrap");
  const nav=$("bottomnav");

  if(!header||!main||!nav){
    console.warn("DOM missing");
    return;
  }

  header.innerHTML="";
  main.innerHTML="";
  nav.innerHTML="";

  /* HEADER */
  header.appendChild(h("div",{class:"title"},["Glam Trainer"]));

  /* NAV */
  const mkBtn=(hash,label)=>h("button",{
    class:state.route===hash?"active":"",
    onclick:()=>location.hash=hash
  },[label]);

  nav.appendChild(mkBtn("#/start","Start"));
  nav.appendChild(mkBtn("#/plan","Plan"));
  nav.appendChild(mkBtn("#/wuensche","Wünsche"));
  nav.appendChild(mkBtn("#/log","Log"));

  /* CONTENT */
  if(state.route==="#/plan") renderPlan(main);
  else if(state.route==="#/wuensche") renderWuensche(main);
  else if(state.route==="#/log") renderLog(main);
  else renderStart(main);
}

/* =========================
   ACTIONS
========================= */

async function setAnjaStatus(id,status){
  const t=state.anjaTasks.find(x=>x.id===id);
  if(!t)return;

  t.status=status;
  await fbPatch(`anja_tasks/${t._fbKey}`,{status});
  requestRender();
}

async function setWP(key,status){
  await fbPatch(`wochenplan/${key}`,{status});
  state.wochenplan=state.wochenplan.map(e=>e._fbKey===key?{...e,status}:e);
  requestRender();
}

/* =========================
   SYNC (ohne UI nerven)
========================= */

async function sync(){

  const [
    anja,
    wp,
    wu,
    cw,
    log
  ] = await Promise.all([
    fbGet("anja_tasks"),
    fbGet("wochenplan"),
    fbGet("wuensche"),
    fbGet("custom_wishes"),
    fbGet("konditionierung_log")
  ]);

  let changed=false;

  const map=(d)=>d?Object.entries(d).map(([k,v])=>({...v,_fbKey:k})):[];

  if(anja && !deepEqual(state.anjaTasks,map(anja))){
    state.anjaTasks=map(anja);
    changed=true;
  }

  if(wp && !deepEqual(state.wochenplan,map(wp))){
    state.wochenplan=map(wp);
    changed=true;
  }

  if(wu && !deepEqual(state.wuensche,map(wu))){
    state.wuensche=map(wu);
    changed=true;
  }

  if(cw && !deepEqual(state.customWishes,map(cw))){
    state.customWishes=map(cw);
    changed=true;
  }

  if(log && !deepEqual(state.pisslog,map(log))){
    state.pisslog=map(log);
    changed=true;
  }

  if(changed) requestRender();
}

/* =========================
   INIT
========================= */

async function init(){

  window.addEventListener("hashchange",onRoute);
  onRoute();

  await sync();
  requestRender();

  setInterval(sync,15000);
}

window.addEventListener("load",init);
