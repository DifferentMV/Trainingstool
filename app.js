/* Glam Trainer — V4.0
   Fokus:
   - kein ständiges Neu-Rendern aller Seiten
   - gezielte UI-Updates nur bei echten Änderungen
   - robusteres Firebase-Handling
   - weniger direkte State-Mutationen
*/

const FIREBASE_URL = "https://ds-trainingstool-default-rtdb.europe-west1.firebasedatabase.app";

const STORAGE = {
  settings: "gt_settings_v1",
  tasks: "gt_tasks_v1",
  goals: "gt_goals_v1",
  steps: "gt_goal_steps_v1",
  log: "gt_log_v1",
  schedule: "gt_schedule_v1",
  goalOverrides: "gt_goal_overrides_v1"
};

const DEFAULT_SETTINGS = {
  dayMode: "normal",
  minGapGoalsMin: 90,
  maxUnitsPerBundle: 5,
  ntfyGoalsTopic: "",
  ntfyTasksTopic: "",
  ntfyToken: "",
  tickSeconds: 20
};

const ROUTES = {
  START: "#/start",
  PLAN: "#/plan",
  WUENSCHE: "#/wuensche",
  LOG: "#/log"
};

const STATUS = {
  GEPLANT: "geplant",
  ERLEDIGT: "erledigt",
  DONE: "done",
  SKIP: "skip",
  OFFEN: "offen",
  ANGENOMMEN: "angenommen",
  ABGEBROCHEN: "abgebrochen"
};

const TYPE = {
  ZIEL: "ziel",
  WOCHENPLAN: "Wochenplan"
};

const $ = id => document.getElementById(id);

function nowISO() {
  return new Date().toISOString();
}

function todayKey(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "--:--";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDateTimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-DE");
}

function parseTimeToDateToday(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function randInt(min, max) {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normId(x) {
  return String(x || "").trim().toUpperCase();
}

function normStr(x) {
  return String(x || "").trim();
}

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    t.style.display = "none";
  }, 1400);
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inThisWeek(iso) {
  const d = new Date(iso);
  const s = startOfWeek();
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return d >= s && d < e;
}

async function fetchText(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} (${r.status})`);
  return await r.text();
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",")}}`;
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

/* ------------------------------
   Firebase
------------------------------ */

async function fbRequest(path, options = {}) {
  const url = `${FIREBASE_URL}/${path}.json`;
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    console.warn("Firebase network error:", path, err);
    throw err;
  }

  if (!res.ok) {
    console.warn("Firebase request failed:", path, res.status);
    throw new Error(`Firebase request failed: ${path} (${res.status})`);
  }

  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function fbGet(path) {
  try {
    return await fbRequest(path);
  } catch {
    return null;
  }
}

async function fbSet(path, value) {
  try {
    await fbRequest(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    return true;
  } catch {
    return false;
  }
}

async function fbPush(path, value) {
  try {
    const data = await fbRequest(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    return data?.name || null;
  } catch {
    return null;
  }
}

async function fbPatch(path, patch) {
  try {
    await fbRequest(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    return true;
  } catch {
    return false;
  }
}

async function fbDelete(path) {
  try {
    await fbRequest(path, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}

async function fbGetAnjaTasks() {
  const data = await fbGet("anja_tasks");
  if (!data) return [];
  return Object.entries(data).map(([k, v]) => ({ ...v, _fbKey: k }));
}

async function fbGetCuckold() {
  return (await fbGet("cuckold")) || {};
}

async function fbSetCuckold(data) {
  return await fbSet("cuckold", { ...data, updatedAt: nowISO() });
}

async function fbGetCustomWishes() {
  const data = await fbGet("custom_wishes");
  if (!data) return [];
  return Object.entries(data).map(([k, v]) => ({ ...v, _fbKey: k }));
}

async function fbAddCustomWish(titel) {
  return await fbPush("custom_wishes", { titel, createdAt: nowISO() });
}

async function fbDeleteCustomWish(fbKey) {
  return await fbDelete(`custom_wishes/${fbKey}`);
}

async function fbGetPisslog() {
  const data = await fbGet("konditionierung_log");
  if (!data) return [];
  return Object.entries(data)
    .map(([k, v]) => ({ ...v, _fbKey: k }))
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

async function fbAddPisslog(entry) {
  return await fbPush("konditionierung_log", entry);
}

async function fbGetWuensche() {
  const data = await fbGet("wuensche");
  if (!data) return [];
  return Object.entries(data).map(([k, v]) => ({ ...v, _fbKey: k }));
}

async function fbAddWunsch(titel) {
  return await fbPush("wuensche", { titel, createdAt: nowISO() });
}

async function fbDeleteWunsch(fbKey) {
  return await fbDelete(`wuensche/${fbKey}`);
}

async function fbGetWochenplan() {
  const data = await fbGet("wochenplan");
  if (!data) return [];
  return Object.entries(data).map(([k, v]) => ({ ...v, _fbKey: k }));
}

async function fbAddWochenplanEintrag(entry) {
  return await fbPush("wochenplan", entry);
}

async function fbPatchWochenplanEintrag(fbKey, patch) {
  return await fbPatch(`wochenplan/${fbKey}`, patch);
}

async function fbDeleteWochenplanEintrag(fbKey) {
  return await fbDelete(`wochenplan/${fbKey}`);
}

/* ------------------------------
   CSV
------------------------------ */

function parseCSV(text) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  let hdr = lines.shift().split(sep).map(s => s.trim());
  hdr[0] = hdr[0].replace(/^\uFEFF/, "").trim();

  return lines.map(line => {
    const p = line.split(sep).map(s => (s ?? "").trim());
    const r = {};
    hdr.forEach((h, i) => {
      r[h] = p[i] ?? "";
    });
    return r;
  });
}

function normalizeBool(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "ja" || s === "1" || s === "y" || s === "yes";
}

function getField(row, aliases, fallback = "") {
  for (const a of aliases) {
    if (row[a] !== undefined && String(row[a]).trim() !== "") {
      return String(row[a]).trim();
    }
  }
  return fallback;
}

/* ------------------------------
   State
------------------------------ */

const state = {
  settings: loadJSON(STORAGE.settings, DEFAULT_SETTINGS),
  tasksData: loadJSON(STORAGE.tasks, []),
  goalsData: loadJSON(STORAGE.goals, []),
  goalsStepsData: loadJSON(STORAGE.steps, []),
  goalOverrides: loadJSON(STORAGE.goalOverrides, {}),
  route: window.location.hash || ROUTES.START,
  filter: "all",
  subFilter: "all",

  anjaTasks: [],
  cuckold: { gefuehl: null, wunsch: null },
  customWishes: [],
  pisslog: [],
  wuensche: [],
  wochenplan: []
};

const ui = {
  initialized: false,
  syncRunning: false,
  syncTimer: null,
  pushTimer: null,
  renderQueued: false,
  lastRenderSignature: ""
};

function persistSettings() {
  saveJSON(STORAGE.settings, state.settings);
}

function getLog() {
  return loadJSON(STORAGE.log, []);
}

function setLog(x) {
  saveJSON(STORAGE.log, x);
}

function getSchedule() {
  return loadJSON(STORAGE.schedule, null);
}

function setSchedule(x) {
  saveJSON(STORAGE.schedule, x);
}

function persistOverrides() {
  saveJSON(STORAGE.goalOverrides, state.goalOverrides);
}

function setDayMode(mode) {
  if (state.settings.dayMode === mode) return;
  state.settings = { ...state.settings, dayMode: mode };
  persistSettings();
  regenIfNeeded(true);
  requestRender("dayMode");
}

/* ------------------------------
   Goal-Daten
------------------------------ */

function normalizeGoalRow(raw) {
  const ziel_id = normId(getField(raw, ["ziel_id", "id", "ziel", "zielid", "zielId"]));
  const ziel_name = normStr(getField(raw, ["ziel_name", "name", "titel", "zielname"], "")) || ziel_id;
  const aktivCSV = normalizeBool(getField(raw, ["aktiv", "active"], "false"));
  const aCSV = parseInt(getField(raw, ["aktuelle_stufe", "stufe", "level"], "1"), 10) || 1;
  const max_stufe = parseInt(getField(raw, ["max_stufe", "maxlevel", "stufen_max", "stufe_max"], "5"), 10) || 5;
  const min = parseInt(getField(raw, ["min", "min_pro_zeitraum", "min_zeitraum"], "0"), 10) || 0;
  const max = parseInt(getField(raw, ["max", "max_pro_zeitraum", "max_zeitraum"], "0"), 10) || 0;
  const zeitraum = normStr(getField(raw, ["zeitraum", "periode"], "TAG")).toUpperCase() === "WOCHE" ? "WOCHE" : "TAG";
  const modus = normStr(getField(raw, ["modus", "mode"], "flexibel")).toLowerCase();
  const ov = state.goalOverrides[ziel_id] || {};

  return {
    ziel_id,
    ziel_name,
    aktiv: typeof ov.aktiv === "boolean" ? ov.aktiv : aktivCSV,
    aktuelle_stufe: clamp(typeof ov.aktuelle_stufe === "number" ? ov.aktuelle_stufe : aCSV, 1, Math.max(1, max_stufe)),
    max_stufe: Math.max(1, max_stufe),
    min: Math.max(0, min),
    max: Math.max(0, max),
    zeitraum,
    modus,
    zeit_von: normStr(getField(raw, ["zeit_von", "von"], "14:00")),
    zeit_bis: normStr(getField(raw, ["zeit_bis", "bis"], "20:00")),
    feste_zeit: normStr(getField(raw, ["feste_zeit", "uhrzeit", "fix"], "09:00"))
  };
}

function getGoalsNormalized() {
  return (state.goalsData || []).map(normalizeGoalRow).filter(g => g.ziel_id);
}

function setGoalOverride(goalId, patch) {
  const gid = normId(goalId);
  const before = state.goalOverrides[gid] || {};
  const next = { ...before, ...patch };

  if (deepEqual(before, next)) return;

  state.goalOverrides = {
    ...state.goalOverrides,
    [gid]: next
  };
  persistOverrides();
  regenIfNeeded(true);
  requestRender("goalOverride");
}

function countGoalDone(goalId, period) {
  const gid = normId(goalId);
  const log = getLog();

  if (period === "TAG") {
    const t = todayKey();
    return log.filter(
      e =>
        e.typ === TYPE.ZIEL &&
        normId(e.ziel_id) === gid &&
        e.status === STATUS.ERLEDIGT &&
        e.dayKey === t
    ).length;
  }

  return log.filter(
    e =>
      e.typ === TYPE.ZIEL &&
      normId(e.ziel_id) === gid &&
      e.status === STATUS.ERLEDIGT &&
      inThisWeek(e.createdAt)
  ).length;
}

function computeGoalQuota(goal) {
  const period = goal.zeitraum === "WOCHE" ? "WOCHE" : "TAG";
  return {
    period,
    min: parseInt(goal.min || "0", 10) || 0,
    max: parseInt(goal.max || "0", 10) || 0,
    done: countGoalDone(goal.ziel_id, period)
  };
}

function pickExerciseForGoal(goalId, stufe) {
  const gid = normId(goalId);
  const lvl = parseInt(stufe || "1", 10) || 1;

  const rows = (state.goalsStepsData || [])
    .map(r => ({
      ziel_id: normId(r.ziel_id || r.goal_id || r.ziel || ""),
      stufe: parseInt(r.stufe || "1", 10) || 1,
      titel: String(r.titel || r.uebung || "").trim()
    }))
    .filter(x => x.ziel_id && x.titel);

  const list = rows.filter(x => x.ziel_id === gid && x.stufe === lvl);
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

function pickRandomTimeBetween(a, b) {
  const from = parseTimeToDateToday(a);
  const to = parseTimeToDateToday(b);
  if (!from || !to || to <= from) return null;
  return new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));
}

function ensureMinGap(dates, candidate, minMin) {
  const gap = minMin * 60 * 1000;
  for (const d of dates) {
    if (Math.abs(d.getTime() - candidate.getTime()) < gap) return false;
  }
  return true;
}

function generateGoalUnitsForToday(activeGoals) {
  const mode = state.settings.dayMode;
  if (mode === "aussetzen" || !activeGoals.length) return [];

  const units = [];

  for (const g of activeGoals) {
    const { period, min, max, done } = computeGoalQuota(g);

    if (max === 0 && min === 0) continue;
    if (max > 0 && done >= max) continue;

    let want = 0;

    if (period === "TAG") {
      const minA = mode === "sanft" ? Math.min(min, 1) : min;
      const baseMax = max > 0 ? max : (min > 0 ? min : 1);
      const maxA = mode === "sanft" ? Math.min(baseMax, 1) : baseMax;
      const minU = Math.max(0, minA);
      const maxU = Math.max(minU, maxA);
      want = (maxU === 0 && minU === 0) ? 0 : randInt(minU, maxU);
    } else {
      if (done < min) {
        want = 1;
      } else if (max > 0 && done < max) {
        const p = mode === "sanft" ? 0.25 : mode === "herausfordernd" ? 0.55 : 0.4;
        want = Math.random() < p ? 1 : 0;
      }
    }

    for (let i = 0; i < want; i++) {
      units.push({
        id: `goalunit-${g.ziel_id}-${todayKey()}-${i}-${Math.floor(Math.random() * 100000)}`,
        typ: TYPE.ZIEL,
        ziel_id: g.ziel_id,
        ziel_name: g.ziel_name,
        stufe: clamp(g.aktuelle_stufe, 1, g.max_stufe),
        plannedAt: null,
        plannedLabel: "",
        status: STATUS.GEPLANT,
        createdAt: nowISO()
      });
    }
  }

  const plannedDates = [];

  for (const u of units) {
    const g = activeGoals.find(x => normId(x.ziel_id) === normId(u.ziel_id));
    if (!g) continue;

    let dt = g.modus === "ritualisiert"
      ? (parseTimeToDateToday(g.feste_zeit) || new Date())
      : (pickRandomTimeBetween(g.zeit_von, g.zeit_bis) || new Date());

    const softGap = Math.max(10, Math.floor(state.settings.minGapGoalsMin / 2));
    let tries = 0;

    while (tries < 12 && !ensureMinGap(plannedDates, dt, softGap)) {
      dt = new Date(dt.getTime() + randInt(8, 22) * 60 * 1000);
      tries++;
    }

    plannedDates.push(dt);
    plannedDates.sort((a, b) => a - b);

    u.plannedAt = dt.toISOString();
    u.plannedLabel = fmtTime(dt);
  }

  units.sort((a, b) => new Date(a.plannedAt) - new Date(b.plannedAt));
  return units;
}

function regenIfNeeded(force = false) {
  const t = todayKey();
  const activeGoals = getGoalsNormalized().filter(g => g.aktiv === true);
  const activeIds = new Set(activeGoals.map(g => normId(g.ziel_id)));
  let schedule = getSchedule();

  if (schedule && schedule.dayKey === t) {
    const before = schedule.units?.length || 0;
    const filtered = (schedule.units || []).filter(
      u => u.typ !== TYPE.ZIEL || activeIds.has(normId(u.ziel_id))
    );

    if (filtered.length !== before) {
      schedule = { ...schedule, units: filtered };
      setSchedule(schedule);
    }

    if (!force) return;
  }

  setSchedule({
    dayKey: t,
    createdAt: nowISO(),
    lastPushAtGoals: schedule?.lastPushAtGoals || null,
    units: generateGoalUnitsForToday(activeGoals)
  });
}

/* ------------------------------
   Data loading
------------------------------ */

async function loadAllCSV() {
  const [tt, gt, st] = await Promise.all([
    fetchText("tasks.csv").catch(() => ""),
    fetchText("goals.csv").catch(() => ""),
    fetchText("goal_uebungen.csv").catch(() => "")
  ]);

  state.tasksData = tt ? parseCSV(tt) : [];
  state.goalsData = gt ? parseCSV(gt) : [];
  state.goalsStepsData = st ? parseCSV(st) : [];

  saveJSON(STORAGE.tasks, state.tasksData);
  saveJSON(STORAGE.goals, state.goalsData);
  saveJSON(STORAGE.steps, state.goalsStepsData);
}

async function loadAnjaTasks() {
  try {
    state.anjaTasks = await fbGetAnjaTasks();
  } catch {
    state.anjaTasks = [];
  }
}

function addLogEntry(entry) {
  const log = getLog();
  log.unshift(entry);
  setLog(log);
}

/* ------------------------------
   Actions
------------------------------ */

async function setAnjaTaskStatus(taskId, status, feedback = {}) {
  const idx = state.anjaTasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;

  const oldTask = state.anjaTasks[idx];
  const updatedTask = {
    ...oldTask,
    status,
    updatedAt: nowISO()
  };

  if (feedback.rueckmeldung !== undefined) updatedTask.rueckmeldung = feedback.rueckmeldung;
  if (feedback.schwierigkeit !== undefined) updatedTask.schwierigkeit = feedback.schwierigkeit;
  if (feedback.gerne !== undefined) updatedTask.gerne = feedback.gerne;
  if (feedback.belegWA !== undefined) updatedTask.belegWA = feedback.belegWA;
  if (status === STATUS.ERLEDIGT) updatedTask.doneAt = nowISO();
  if (status === STATUS.ANGENOMMEN) updatedTask.acceptedAt = nowISO();

  state.anjaTasks = state.anjaTasks.map((t, i) => i === idx ? updatedTask : t);

  if (status === STATUS.ERLEDIGT || status === STATUS.ABGEBROCHEN) {
    addLogEntry({
      id: `log-anja-${Date.now()}`,
      typ: "aufgabe",
      dayKey: todayKey(),
      createdAt: nowISO(),
      title: updatedTask.title || "Aufgabe",
      status,
      schwierigkeit: feedback.schwierigkeit || null,
      gerne: feedback.gerne || null,
      rueckmeldung: feedback.rueckmeldung || "",
      belegWA: feedback.belegWA || false
    });
  }

  try {
    const patch = { status, updatedAt: updatedTask.updatedAt };
    ["rueckmeldung", "schwierigkeit", "gerne", "belegWA"].forEach(k => {
      if (feedback[k] !== undefined) patch[k] = feedback[k];
    });
    if (updatedTask.doneAt) patch.doneAt = updatedTask.doneAt;
    if (updatedTask.acceptedAt) patch.acceptedAt = updatedTask.acceptedAt;

    await fbPatch(`anja_tasks/${updatedTask._fbKey}`, patch);
  } catch (e) {
    console.warn(e);
  }

  requestRender("anjaTaskStatus");
}

async function setWochenplanStatus(fbKey, status, titel) {
  const patch = { status, updatedAt: nowISO() };
  const ok = await fbPatchWochenplanEintrag(fbKey, patch);

  if (!ok) {
    toast("Speichern fehlgeschlagen");
    return;
  }

  state.wochenplan = state.wochenplan.map(e =>
    e._fbKey === fbKey ? { ...e, ...patch } : e
  );

  toast(status === STATUS.DONE ? "Erledigt!" : "Übersprungen");

  if (status === STATUS.DONE) {
    await fbAddPisslog({
      ts: nowISO(),
      txt: `Wochenplan erledigt: ${titel}`,
      type: TYPE.WOCHENPLAN
    });
  }

  requestRender("wochenplanStatus");
}

/* ------------------------------
   Push / SW
------------------------------ */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("sw.js");
    console.log("SW registered", reg.scope);
  } catch (e) {
    console.warn("SW failed", e);
  }
}

async function maybeDispatchPushes() {
  const schedule = getSchedule();
  if (!schedule || !schedule.units) return;
  if (schedule.dayKey !== todayKey()) return;

  const now = new Date();
  const topic = state.settings.ntfyGoalsTopic;
  const token = state.settings.ntfyToken;
  if (!topic) return;

  const lastPush = schedule.lastPushAtGoals ? new Date(schedule.lastPushAtGoals) : new Date(0);
  if (now.getTime() - lastPush.getTime() < 10 * 60 * 1000) return;

  const due = schedule.units.filter(
    u => u.status === STATUS.GEPLANT && u.plannedAt && new Date(u.plannedAt) <= now
  );

  if (!due.length) return;

  const body = due.map(u => `${u.plannedLabel} - ${u.ziel_name}`).join("\n");

  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (res.ok) {
      schedule.lastPushAtGoals = now.toISOString();
      setSchedule(schedule);
    }
  } catch (e) {
    console.warn("Push failed", e);
  }
}

/* ------------------------------
   Rendering helpers
------------------------------ */

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") {
      el.className = v;
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "html") {
      el.innerHTML = v;
    } else {
      el.setAttribute(k, v);
    }
  }

  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });

  return el;
}

function sectionTitle(icon, title, rightEl) {
  return h("div", { class: "section-title" }, [
    h("h2", {}, [`${icon} ${title}`]),
    h("div", { class: "right" }, rightEl ? [rightEl] : [])
  ]);
}

function chip(label, active, onClick) {
  return h("button", {
    class: "chip" + (active ? " active" : ""),
    type: "button",
    onclick: onClick
  }, [label]);
}

function openModal(contentEl) {
  const bd = h("div", { class: "modal-backdrop" }, [
    h("div", { class: "modal" }, [contentEl])
  ]);

  bd.addEventListener("click", e => {
    if (e.target === bd) bd.remove();
  });

  document.body.appendChild(bd);
  return () => bd.remove();
}

function getRenderSignature() {
  const base = {
    route: state.route,
    filter: state.filter,
    subFilter: state.subFilter
  };

  if (state.route === ROUTES.START) {
    const schedule = getSchedule();
    return stableStringify({
      ...base,
      anjaTasks: state.anjaTasks,
      schedule: schedule && schedule.dayKey === todayKey() ? schedule.units : []
    });
  }

  if (state.route === ROUTES.PLAN) {
    return stableStringify({
      ...base,
      goalsData: state.goalsData,
      goalOverrides: state.goalOverrides,
      wochenplan: state.wochenplan,
      log: getLog()
    });
  }

  if (state.route === ROUTES.WUENSCHE) {
    return stableStringify({
      ...base,
      customWishes: state.customWishes,
      wuensche: state.wuensche,
      cuckold: state.cuckold
    });
  }

  if (state.route === ROUTES.LOG) {
    return stableStringify({
      ...base,
      pisslog: state.pisslog
    });
  }

  return stableStringify(base);
}

function requestRender(reason = "") {
  if (ui.renderQueued) return;

  ui.renderQueued = true;
  requestAnimationFrame(() => {
    ui.renderQueued = false;
    const nextSignature = getRenderSignature();
    if (nextSignature === ui.lastRenderSignature) return;
    render(reason);
    ui.lastRenderSignature = nextSignature;
  });
}

/* ------------------------------
   Route / bridge
------------------------------ */

function onRoute() {
  const nextRoute = window.location.hash || ROUTES.START;
  const routeChanged = state.route !== nextRoute;

  state.route = nextRoute;
  state.filter = "all";
  state.subFilter = "all";

  if (routeChanged) requestRender("route");
}

function setupBridge() {
  window.setDayMode = setDayMode;
  window.setGoalOverride = (id, p) => {
    setGoalOverride(id, p);
  };

  window.deleteWunsch = async k => {
    if (!confirm("Wunsch löschen?")) return;
    const ok = await fbDeleteWunsch(k);
    if (!ok) return toast("Löschen fehlgeschlagen");

    state.wuensche = state.wuensche.filter(w => w._fbKey !== k);
    requestRender("deleteWunsch");
  };

  window.deleteCustomWish = async k => {
    if (!confirm("Wunsch löschen?")) return;
    const ok = await fbDeleteCustomWish(k);
    if (!ok) return toast("Löschen fehlgeschlagen");

    state.customWishes = state.customWishes.filter(w => w._fbKey !== k);
    requestRender("deleteCustomWish");
  };

  window.setAnjaStatus = async (id, s, feedback) => {
    await setAnjaTaskStatus(id, s, feedback);
  };

  window.setWochenplanStatus = setWochenplanStatus;
}

/* ------------------------------
   Render pages
------------------------------ */

function renderStart() {
  const c = $("content");
  const anjaOpen = state.anjaTasks.filter(t => t.status === STATUS.OFFEN || t.status === STATUS.ANGENOMMEN);

  if (anjaOpen.length) {
    c.appendChild(sectionTitle("👑", "Anjas Aufgaben"));

    anjaOpen.forEach(t => {
      const card = h("div", {
        class: "card task-card " + (t.status === STATUS.ANGENOMMEN ? "accepted" : "")
      }, [
        h("div", { class: "task-header" }, [
          h("h3", {}, [t.title || "Aufgabe"]),
          h("span", { class: "badge" }, [t.typ === "pflicht" ? "Pflicht" : "Bonus"])
        ]),
        h("p", {}, [t.desc || ""]),
        t.status === STATUS.OFFEN
          ? h("button", {
              class: "btn primary full",
              onclick: () => window.setAnjaStatus(t.id, STATUS.ANGENOMMEN)
            }, ["Annehmen"])
          : h("button", {
              class: "btn primary full",
              onclick: () => renderAnjaFeedback(t)
            }, ["Erledigt melden"])
      ]);

      c.appendChild(card);
    });
  }

  const schedule = getSchedule();
  if (schedule && schedule.dayKey === todayKey()) {
    c.appendChild(sectionTitle("📅", "Heutiger Plan"));
    const list = schedule.units || [];

    if (!list.length) {
      c.appendChild(h("p", {
        style: "text-align:center;opacity:0.6"
      }, ["Keine Ziele für heute."]));
    } else {
      list.forEach(u => {
        const isDone = u.status === STATUS.ERLEDIGT;

        const item = h("div", {
          class: "card goal-item " + (isDone ? "done" : "")
        }, [
          h("div", { class: "goal-time" }, [u.plannedLabel || "--:--"]),
          h("div", { class: "goal-info" }, [
            h("div", { class: "goal-name" }, [u.ziel_name]),
            h("div", { class: "goal-sub" }, [
              isDone
                ? `Erledigt um ${fmtTime(new Date(u.doneAt))}`
                : `Stufe ${u.stufe}`
            ])
          ]),
          !isDone
            ? h("button", {
                class: "btn secondary small",
                onclick: () => renderGoalAction(u)
              }, ["Start"])
            : null
        ]);

        c.appendChild(item);
      });
    }
  }
}

function renderAnjaFeedback(t) {
  const close = openModal(h("div", { class: "feedback-form" }, [
    h("h3", {}, ["Rückmeldung an Anja"]),
    h("label", {}, ["Wie war es?"]),
    h("textarea", { id: "fb-txt", placeholder: "Deine Nachricht..." }),
    h("label", {}, ["Schwierigkeit (1-5)"]),
    h("input", { id: "fb-diff", type: "range", min: "1", max: "5", value: "3" }),
    h("label", {}, ["Wie gerne gemacht? (1-5)"]),
    h("input", { id: "fb-like", type: "range", min: "1", max: "5", value: "3" }),
    h("div", { class: "modal-actions" }, [
      h("button", { class: "btn", onclick: () => close() }, ["Abbrechen"]),
      h("button", {
        class: "btn primary",
        onclick: async () => {
          const rueckmeldung = $("fb-txt").value;
          const schwierigkeit = parseInt($("fb-diff").value, 10);
          const gerne = parseInt($("fb-like").value, 10);
          await window.setAnjaStatus(t.id, STATUS.ERLEDIGT, { rueckmeldung, schwierigkeit, gerne });
          close();
        }
      }, ["Absenden"])
    ])
  ]));
}

function renderGoalAction(u) {
  const ex = pickExerciseForGoal(u.ziel_id, u.stufe);

  const close = openModal(h("div", { class: "goal-action-modal" }, [
    h("h2", {}, [u.ziel_name]),
    h("div", { class: "exercise-box" }, [
      h("h4", {}, [`Übung (Stufe ${u.stufe}):`]),
      h("p", { class: "big-text" }, [ex ? ex.titel : "Keine spezifische Übung gefunden."])
    ]),
    h("div", { class: "modal-actions" }, [
      h("button", { class: "btn", onclick: () => close() }, ["Später"]),
      h("button", {
        class: "btn primary",
        onclick: async () => {
          const schedule = getSchedule();
          if (!schedule || !Array.isArray(schedule.units)) return;

          const updatedUnits = schedule.units.map(x =>
            x.id === u.id
              ? { ...x, status: STATUS.ERLEDIGT, doneAt: nowISO() }
              : x
          );

          setSchedule({ ...schedule, units: updatedUnits });

          addLogEntry({
            id: `log-ziel-${Date.now()}`,
            typ: TYPE.ZIEL,
            dayKey: todayKey(),
            createdAt: nowISO(),
            ziel_id: u.ziel_id,
            ziel_name: u.ziel_name,
            stufe: u.stufe,
            uebung: ex ? ex.titel : "",
            status: STATUS.ERLEDIGT
          });

          await fbAddPisslog({
            ts: nowISO(),
            txt: `Ziel erledigt: ${u.ziel_name} (${ex ? ex.titel : "Keine Übung"})`,
            type: "Ziel"
          });

          close();
          requestRender("goalDone");
        }
      }, ["Erledigt"])
    ])
  ]));
}

function renderPlan() {
  const c = $("content");

  c.appendChild(h("div", { class: "tabs" }, [
    chip("Ziele", state.filter === "all", () => {
      if (state.filter === "all") return;
      state.filter = "all";
      requestRender("planFilterGoals");
    }),
    chip("Wochenplan", state.filter === "woche", () => {
      if (state.filter === "woche") return;
      state.filter = "woche";
      requestRender("planFilterWeek");
    })
  ]));

  if (state.filter === "woche") {
    c.appendChild(h("div", { id: "wochenplan-list" }));
    renderWochenplan();
    return;
  }

  const goals = getGoalsNormalized();
  goals.forEach(g => {
    const quota = computeGoalQuota(g);

    const card = h("div", {
      class: "card goal-config " + (g.aktiv ? "" : "inactive")
    }, [
      h("div", { class: "config-header" }, [
        h("div", {}, [
          h("h3", {}, [g.ziel_name]),
          h("div", { class: "small" }, [
            `${quota.done} / ${quota.max ? quota.max : `${quota.min} (Min)`} (${quota.period})`
          ])
        ]),
        h("div", {
          class: "toggle",
          onclick: () => window.setGoalOverride(g.ziel_id, { aktiv: !g.aktiv })
        }, [g.aktiv ? "AN" : "AUS"])
      ]),
      g.aktiv
        ? h("div", { class: "config-body" }, [
            h("label", {}, [`Stufe: ${g.aktuelle_stufe}`]),
            h("input", {
              type: "range",
              min: "1",
              max: String(g.max_stufe),
              value: String(g.aktuelle_stufe),
              onchange: e => {
                window.setGoalOverride(g.ziel_id, {
                  aktuelle_stufe: parseInt(e.target.value, 10)
                });
              }
            })
          ])
        : null
    ]);

    c.appendChild(card);
  });
}

function renderWochenplan() {
  const c = $("wochenplan-list");
  if (!c) return;

  c.innerHTML = "";
  const tage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  tage.forEach(tag => {
    const list = state.wochenplan.filter(e => e.tag === tag);
    if (!list.length) return;

    const group = h("div", { class: "wp-tag-group" }, [h("h3", {}, [tag])]);

    list.forEach(e => {
      const isDone = e.status === STATUS.DONE;
      const isSkip = e.status === STATUS.SKIP;

      group.appendChild(h("div", {
        class: `wp-item ${e.status || ""}`,
        style: "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:4px; border-radius:4px; background:rgba(255,255,255,0.05)"
      }, [
        h("div", {
          style: isDone
            ? "text-decoration:line-through;color:#4caf50;font-weight:bold"
            : isSkip
              ? "opacity:0.5"
              : ""
        }, [`${e.zeit || "--:--"} - ${e.titel}`]),
        h("div", {
          class: "wp-actions",
          style: "display:flex; gap:5px"
        }, [
          h("button", {
            class: "btn small",
            style: "background:#4caf50; padding:2px 6px",
            onclick: () => window.setWochenplanStatus(e._fbKey, STATUS.DONE, e.titel)
          }, ["✅"]),
          h("button", {
            class: "btn small",
            style: "background:#f44336; padding:2px 6px",
            onclick: () => window.setWochenplanStatus(e._fbKey, STATUS.SKIP, e.titel)
          }, ["❌"])
        ])
      ]));
    });

    c.appendChild(group);
  });
}

function renderWuensche() {
  const c = $("content");

  c.appendChild(h("div", { class: "tabs" }, [
    chip("Marlo", state.filter === "all", () => {
      if (state.filter === "all") return;
      state.filter = "all";
      requestRender("wishFilterMarlo");
    }),
    chip("Anja", state.filter === "anja", () => {
      if (state.filter === "anja") return;
      state.filter = "anja";
      requestRender("wishFilterAnja");
    }),
    chip("Cuckold", state.filter === "cuck", () => {
      if (state.filter === "cuck") return;
      state.filter = "cuck";
      requestRender("wishFilterCuck");
    })
  ]));

  if (state.filter === "anja") {
    c.appendChild(h("div", { class: "input-group" }, [
      h("input", { id: "inp-wish", placeholder: "Neuer Wunsch..." }),
      h("button", {
        class: "btn primary",
        onclick: async () => {
          const input = $("inp-wish");
          const v = input.value.trim();
          if (!v) return;

          const key = await fbAddCustomWish(v);
          if (!key) return toast("Speichern fehlgeschlagen");

          state.customWishes = [
            ...state.customWishes,
            { titel: v, createdAt: nowISO(), _fbKey: key }
          ];
          input.value = "";
          requestRender("addCustomWish");
        }
      }, ["Hinzufügen"])
    ]));

    state.customWishes.forEach(w => {
      c.appendChild(h("div", { class: "card small flex-row" }, [
        h("span", {}, [w.titel]),
        h("button", {
          class: "btn small",
          onclick: () => window.deleteCustomWish(w._fbKey)
        }, ["Löschen"])
      ]));
    });

    return;
  }

  if (state.filter === "cuck") {
    c.appendChild(h("div", { class: "card" }, [
      h("h3", {}, ["Wie fühlst du dich heute?"]),
      h("select", {
        id: "cuck-gefuehl",
        onchange: async e => {
          const next = { ...state.cuckold, gefuehl: e.target.value };
          const ok = await fbSetCuckold(next);
          if (!ok) return toast("Speichern fehlgeschlagen");
          state.cuckold = next;
        }
      }, [
        h("option", { value: "" }, ["-- wählen --"]),
        ...["Demütig", "Geil", "Frustriert", "Dankbar", "Eifersüchtig"].map(v =>
          h("option", { value: v, selected: state.cuckold.gefuehl === v }, [v])
        )
      ]),
      h("h3", {}, ["Dein größter Wunsch aktuell?"]),
      h("textarea", {
        id: "cuck-wunsch",
        onblur: async e => {
          const next = { ...state.cuckold, wunsch: e.target.value };
          const ok = await fbSetCuckold(next);
          if (!ok) return toast("Speichern fehlgeschlagen");
          state.cuckold = next;
        }
      }, [state.cuckold.wunsch || ""])
    ]));

    return;
  }

  c.appendChild(h("div", { class: "input-group" }, [
    h("input", { id: "inp-m-wish", placeholder: "Marlo's Wunsch..." }),
    h("button", {
      class: "btn primary",
      onclick: async () => {
        const input = $("inp-m-wish");
        const v = input.value.trim();
        if (!v) return;

        const key = await fbAddWunsch(v);
        if (!key) return toast("Speichern fehlgeschlagen");

        state.wuensche = [
          ...state.wuensche,
          { titel: v, createdAt: nowISO(), _fbKey: key }
        ];
        input.value = "";
        requestRender("addWish");
      }
    }, ["Senden"])
  ]));

  state.wuensche.forEach(w => {
    c.appendChild(h("div", { class: "card small flex-row" }, [
      h("span", {}, [w.titel]),
      h("button", {
        class: "btn small",
        onclick: () => window.deleteWunsch(w._fbKey)
      }, ["X"])
    ]));
  });
}

function renderLog() {
  const c = $("content");
  const log = state.pisslog;

  if (!log.length) {
    c.appendChild(h("p", {
      style: "text-align:center;opacity:0.6;margin-top:20px"
    }, ["Noch keine Einträge im Log."]));
    return;
  }

  log.forEach(e => {
    c.appendChild(h("div", {
      class: "card log-entry " + (e.type || "")
    }, [
      h("div", { class: "log-time" }, [fmtDateTimeLocal(e.ts)]),
      h("div", { class: "log-txt" }, [e.txt || e.uebung || "Aktivität"])
    ]));
  });
}

function render(reason = "") {
  const root = $("app");
  if (!root) return;

  root.innerHTML = "";

  const nav = h("nav", { class: "main-nav" }, [
    h("button", {
      class: state.route === ROUTES.START ? "active" : "",
      onclick: () => { window.location.hash = ROUTES.START; }
    }, [h("span", {}, ["🏠"]), h("small", {}, ["Start"])]),

    h("button", {
      class: state.route === ROUTES.PLAN ? "active" : "",
      onclick: () => { window.location.hash = ROUTES.PLAN; }
    }, [h("span", {}, ["📅"]), h("small", {}, ["Plan"])]),

    h("button", {
      class: state.route === ROUTES.WUENSCHE ? "active" : "",
      onclick: () => { window.location.hash = ROUTES.WUENSCHE; }
    }, [h("span", {}, ["✨"]), h("small", {}, ["Wünsche"])]),

    h("button", {
      class: state.route === ROUTES.LOG ? "active" : "",
      onclick: () => { window.location.hash = ROUTES.LOG; }
    }, [h("span", {}, ["📜"]), h("small", {}, ["Log"])])
  ]);

  root.appendChild(nav);

  const content = h("div", { id: "content", class: "container fade-in" });
  root.appendChild(content);

  if (state.route === ROUTES.PLAN) renderPlan();
  else if (state.route === ROUTES.WUENSCHE) renderWuensche();
  else if (state.route === ROUTES.LOG) renderLog();
  else renderStart();

  root.appendChild(h("div", { id: "toast", class: "toast" }));

  if (reason) console.log("Rendered:", reason);
}

/* ------------------------------
   Sync
------------------------------ */

function applyIfChanged(key, nextValue) {
  if (deepEqual(state[key], nextValue)) return false;
  state[key] = nextValue;
  return true;
}

function shouldRenderForCurrentRoute(changedKeys) {
  if (!changedKeys.length) return false;

  if (state.route === ROUTES.START) {
    return changedKeys.some(k => ["anjaTasks"].includes(k));
  }

  if (state.route === ROUTES.PLAN) {
    return changedKeys.some(k => ["wochenplan", "goalsData", "goalOverrides"].includes(k));
  }

  if (state.route === ROUTES.WUENSCHE) {
    return changedKeys.some(k => ["customWishes", "wuensche", "cuckold"].includes(k));
  }

  if (state.route === ROUTES.LOG) {
    return changedKeys.some(k => ["pisslog"].includes(k));
  }

  return false;
}

async function syncRemoteData() {
  if (ui.syncRunning) return;
  ui.syncRunning = true;

  try {
    const [
      anjaTasks,
      cuckold,
      customWishes,
      pisslog,
      wuensche,
      wochenplan
    ] = await Promise.all([
      fbGetAnjaTasks().catch(() => null),
      fbGetCuckold().catch(() => null),
      fbGetCustomWishes().catch(() => null),
      fbGetPisslog().catch(() => null),
      fbGetWuensche().catch(() => null),
      fbGetWochenplan().catch(() => null)
    ]);

    const changedKeys = [];

    if (anjaTasks && applyIfChanged("anjaTasks", anjaTasks)) changedKeys.push("anjaTasks");
    if (cuckold && applyIfChanged("cuckold", cuckold)) changedKeys.push("cuckold");
    if (customWishes && applyIfChanged("customWishes", customWishes)) changedKeys.push("customWishes");
    if (pisslog && applyIfChanged("pisslog", pisslog)) changedKeys.push("pisslog");
    if (wuensche && applyIfChanged("wuensche", wuensche)) changedKeys.push("wuensche");
    if (wochenplan && applyIfChanged("wochenplan", wochenplan)) changedKeys.push("wochenplan");

    if (shouldRenderForCurrentRoute(changedKeys)) {
      requestRender("sync");
    }
  } finally {
    ui.syncRunning = false;
  }
}

/* ------------------------------
   Init
------------------------------ */

async function init() {
  if (ui.initialized) return;
  ui.initialized = true;

  window.addEventListener("hashchange", onRoute);
  setupBridge();

  await registerServiceWorker();

  onRoute();

  const [
    _csv,
    _anja,
    cuckData,
    customWishData,
    pisslogData,
    wuenscheData,
    wochenplanData
  ] = await Promise.all([
    loadAllCSV().catch(console.warn),
    loadAnjaTasks(),
    fbGetCuckold().catch(() => ({})),
    fbGetCustomWishes().catch(() => []),
    fbGetPisslog().catch(() => []),
    fbGetWuensche().catch(() => []),
    fbGetWochenplan().catch(() => [])
  ]);

  state.cuckold = cuckData || { gefuehl: null, wunsch: null };
  state.customWishes = customWishData || [];
  state.pisslog = pisslogData || [];
  state.wuensche = wuenscheData || [];
  state.wochenplan = wochenplanData || [];

  regenIfNeeded(true);

  requestRender("init");

  ui.pushTimer = setInterval(() => {
    maybeDispatchPushes();
  }, Math.max(5, state.settings.tickSeconds) * 1000);

  ui.syncTimer = setInterval(() => {
    syncRemoteData();
  }, 15000);
}

window.addEventListener("load", init);
