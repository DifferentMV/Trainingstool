/* Glam Trainer — V1.3 (Vanilla JS, GitHub Pages)
   Storage: localStorage. Push: ntfy.sh.

   Fixes:
   - Startseite leer: renderHome() war durch Copy/Paste zerstört → hier sauber.
   - Neue Route: #/nav (Startauswahl) + #/anja (Control Panel iframe)
   - Anja → App Bridge: postMessage GT_NEW_TASK + ACK zurück (Offen/Angenommen)
   - Inbox Aufgaben: sichtbar in Aufgaben + annehmbar + ausführbar + Log
*/

const STORAGE = {
  settings: "gt_settings_v1",
  tasks: "gt_tasks_v1",
  goals: "gt_goals_v1",
  steps: "gt_goal_steps_v1",
  log: "gt_log_v1",
  schedule: "gt_schedule_v1",
  inbox: "gt_inbox_v2",
  goalOverrides: "gt_goal_overrides_v1",
};

const DEFAULT_SETTINGS = {
  dayMode: "normal", // aussetzen | sanft | normal | herausfordernd
  minGapGoalsMin: 90,
  minGapTasksMin: 45,
  maxUnitsPerBundle: 5,

  ntfyGoalsTopic: "",
  ntfyTasksTopic: "",
  ntfyReportTopic: "",
  ntfyToken: "",

  tickSeconds: 20,
};

const $ = (id) => document.getElementById(id);

/* ---------- Utils ---------- */

function nowISO() { return new Date().toISOString(); }

function todayKey(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtTime(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }

function parseTimeToDateToday(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function randInt(min, max) {
  const a = Math.min(min, max), b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function normId(x) { return String(x || "").trim().toUpperCase(); }
function normStr(x) { return String(x || "").trim(); }

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.display = "none"; }, 1400);
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
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inThisWeek(dateISO) {
  const d = new Date(dateISO);
  const s = startOfWeek();
  const e = new Date(s); e.setDate(e.getDate() + 7);
  return d >= s && d < e;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} nicht gefunden (${res.status})`);
  return await res.text();
}

function parseCSV(text) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  let header = lines.shift().split(sep).map(s => s.trim());
  header[0] = header[0].replace(/^\uFEFF/, "").trim();

  return lines.map(line => {
    const parts = line.split(sep).map(s => (s ?? "").trim());
    const row = {};
    header.forEach((h, i) => row[h] = parts[i] ?? "");
    return row;
  });
}

function normalizeBool(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "ja" || s === "1" || s === "y" || s === "yes";
}

function getField(row, aliases, fallback = "") {
  for (const a of aliases) {
    if (row[a] !== undefined && String(row[a]).trim() !== "") return String(row[a]).trim();
  }
  return fallback;
}

/* ---------- State ---------- */

const state = {
  settings: loadJSON(STORAGE.settings, DEFAULT_SETTINGS),

  tasksData: loadJSON(STORAGE.tasks, []),
  goalsData: loadJSON(STORAGE.goals, []),
  goalsStepsData: loadJSON(STORAGE.steps, []),

  goalOverrides: loadJSON(STORAGE.goalOverrides, {}),

  route: "#/nav",
  filter: "all", // all | goals | tasks
};

function persistSettings() { saveJSON(STORAGE.settings, state.settings); }
function getLog() { return loadJSON(STORAGE.log, []); }
function setLog(x) { saveJSON(STORAGE.log, x); }

function getSchedule() { return loadJSON(STORAGE.schedule, null); }
function setSchedule(x) { saveJSON(STORAGE.schedule, x); }

function getInbox() { return loadJSON(STORAGE.inbox, []); }
function setInbox(x) { saveJSON(STORAGE.inbox, x); }

function persistOverrides() { saveJSON(STORAGE.goalOverrides, state.goalOverrides); }

function setDayMode(mode) {
  state.settings.dayMode = mode;
  persistSettings();
  regenIfNeeded(true);
  render();
}

/* ---------- CSV load ---------- */

async function loadAllCSV() {
  const [tasksTxt, goalsTxt, stepsTxt] = await Promise.all([
    fetchText("tasks.csv").catch(() => ""),
    fetchText("goals.csv").catch(() => ""),
    fetchText("goal_uebungen.csv").catch(() => ""),
  ]);

  state.tasksData = tasksTxt ? parseCSV(tasksTxt) : [];
  state.goalsData = goalsTxt ? parseCSV(goalsTxt) : [];
  state.goalsStepsData = stepsTxt ? parseCSV(stepsTxt) : [];

  saveJSON(STORAGE.tasks, state.tasksData);
  saveJSON(STORAGE.goals, state.goalsData);
  saveJSON(STORAGE.steps, state.goalsStepsData);
}

/* ---------- Goals: Normalisierung + Overrides ---------- */

function normalizeGoalRow(raw) {
  const ziel_id = normId(getField(raw, ["ziel_id", "id", "ziel", "zielid", "zielId"]));
  const ziel_name = normStr(getField(raw, ["ziel_name", "name", "titel", "zielname"], "")) || ziel_id;

  const aktivCSV = normalizeBool(getField(raw, ["aktiv", "active"], "false"));

  const aktuelle_stufeCSV = parseInt(getField(raw, ["aktuelle_stufe", "stufe", "level"], "1"), 10) || 1;
  const max_stufe = parseInt(getField(raw, ["max_stufe", "maxlevel", "stufen_max", "stufe_max"], "5"), 10) || 5;

  const min = parseInt(getField(raw, ["min", "min_pro_zeitraum", "min_zeitraum"], "0"), 10) || 0;
  const max = parseInt(getField(raw, ["max", "max_pro_zeitraum", "max_zeitraum"], "0"), 10) || 0;

  const zeitraum = normStr(getField(raw, ["zeitraum", "periode"], "TAG")).toUpperCase() === "WOCHE" ? "WOCHE" : "TAG";
  const modus = normStr(getField(raw, ["modus", "mode"], "flexibel")).toLowerCase();

  const zeit_von = normStr(getField(raw, ["zeit_von", "von"], "14:00"));
  const zeit_bis = normStr(getField(raw, ["zeit_bis", "bis"], "20:00"));
  const feste_zeit = normStr(getField(raw, ["feste_zeit", "uhrzeit", "fix"], "09:00"));

  const gewichtung = parseInt(getField(raw, ["gewichtung", "weight"], "1"), 10) || 1;

  const ov = state.goalOverrides[ziel_id] || {};
  const aktiv = (typeof ov.aktiv === "boolean") ? ov.aktiv : aktivCSV;
  const aktuelle_stufe = (typeof ov.aktuelle_stufe === "number") ? ov.aktuelle_stufe : aktuelle_stufeCSV;

  return {
    ziel_id,
    ziel_name,
    aktiv,
    aktuelle_stufe: clamp(aktuelle_stufe, 1, Math.max(1, max_stufe)),
    max_stufe: Math.max(1, max_stufe),
    min: Math.max(0, min),
    max: Math.max(0, max),
    zeitraum,
    modus,
    zeit_von,
    zeit_bis,
    feste_zeit,
    gewichtung,
  };
}

function getGoalsNormalized() {
  return (state.goalsData || [])
    .map(normalizeGoalRow)
    .filter(g => g.ziel_id);
}

function setGoalOverride(goalId, patch) {
  const gid = normId(goalId);
  state.goalOverrides[gid] = { ...(state.goalOverrides[gid] || {}), ...patch };
  persistOverrides();
}

/* ---------- Quota ---------- */

function countGoalDoneThisPeriod(goalId, period) {
  const gid = normId(goalId);
  const log = getLog();

  if (period === "TAG") {
    const t = todayKey();
    return log.filter(e =>
      e.typ === "ziel" &&
      normId(e.ziel_id) === gid &&
      e.status === "erledigt" &&
      e.dayKey === t
    ).length;
  }

  return log.filter(e =>
    e.typ === "ziel" &&
    normId(e.ziel_id) === gid &&
    e.status === "erledigt" &&
    inThisWeek(e.createdAt)
  ).length;
}

function computeGoalQuota(goal) {
  const period = goal.zeitraum === "WOCHE" ? "WOCHE" : "TAG";
  const min = parseInt(goal.min || "0", 10) || 0;
  const max = parseInt(goal.max || "0", 10) || 0;
  const done = countGoalDoneThisPeriod(goal.ziel_id, period);
  return { period, min, max, done };
}

/* ---------- Schedule generation (Goals core) ---------- */

function pickRandomTimeBetween(fromHHMM, toHHMM) {
  const from = parseTimeToDateToday(fromHHMM);
  const to = parseTimeToDateToday(toHHMM);
  if (!from || !to || to <= from) return null;
  const t = from.getTime() + Math.random() * (to.getTime() - from.getTime());
  return new Date(t);
}

function ensureMinGap(sortedDates, candidate, minGapMinutes) {
  const gap = minGapMinutes * 60 * 1000;
  for (const d of sortedDates) {
    if (Math.abs(d.getTime() - candidate.getTime()) < gap) return false;
  }
  return true;
}

function generateGoalUnitsForToday(activeGoals) {
  const mode = state.settings.dayMode;
  if (mode === "aussetzen") return [];
  if (!activeGoals.length) return [];

  const units = [];

  for (const g of activeGoals) {
    const { period, min, max, done } = computeGoalQuota(g);
    if (max > 0 && done >= max) continue;

    let want = 0;

    if (period === "TAG") {
      const minAdj = mode === "sanft" ? Math.min(min, 1) : min;
      const baseMax = (max > 0) ? max : (min > 0 ? min : 1);
      const maxAdj = (mode === "sanft") ? Math.min(baseMax, 1) : baseMax;

      const minUse = Math.max(0, minAdj);
      const maxUse = Math.max(minUse, maxAdj);
      want = (maxUse === 0 && minUse === 0) ? 0 : randInt(minUse, maxUse);
    } else {
      if (done < min) want = 1;
      else if (max > 0 && done < max) {
        const p = (mode === "sanft") ? 0.25 : (mode === "herausfordernd" ? 0.55 : 0.4);
        want = Math.random() < p ? 1 : 0;
      }
    }

    for (let i = 0; i < want; i++) {
      units.push({
        id: `goalunit-${g.ziel_id}-${todayKey()}-${i}-${Math.floor(Math.random() * 100000)}`,
        typ: "ziel",
        ziel_id: g.ziel_id,
        ziel_name: g.ziel_name,
        stufe: clamp(g.aktuelle_stufe, 1, g.max_stufe),
        plannedAt: null,
        plannedLabel: "",
        status: "geplant",
        createdAt: nowISO(),
      });
    }
  }

  // Zeiten planen
  const plannedDates = [];
  for (const u of units) {
    const g = activeGoals.find(x => normId(x.ziel_id) === normId(u.ziel_id));
    if (!g) continue;

    let dt = null;
    if (g.modus === "ritualisiert") dt = parseTimeToDateToday(g.feste_zeit) || new Date();
    else dt = pickRandomTimeBetween(g.zeit_von, g.zeit_bis) || new Date();

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

function cleanScheduleUnits(schedule, activeGoalIdsSet) {
  if (!schedule?.units?.length) return schedule;

  const before = schedule.units.length;

  schedule.units = schedule.units.filter(u => {
    // tasks bleiben IMMER
    if (u.typ === "aufgabe") return true;

    // ziele nur wenn aktiv
    if (u.typ !== "ziel") return true;
    return activeGoalIdsSet.has(normId(u.ziel_id));
  });

  if (activeGoalIdsSet.size === 0) {
    schedule.units = schedule.units.filter(u => u.typ !== "ziel");
  }

  const after = schedule.units.length;
  schedule._cleaned = (before !== after);
  return schedule;
}

function regenIfNeeded(force = false) {
  const t = todayKey();
  const activeGoals = getGoalsNormalized().filter(g => g.aktiv === true);
  const activeIds = new Set(activeGoals.map(g => normId(g.ziel_id)));

  let schedule = getSchedule();

  if (schedule && schedule.dayKey === t) {
    schedule = cleanScheduleUnits(schedule, activeIds);
    if (schedule._cleaned) {
      delete schedule._cleaned;
      setSchedule(schedule);
    }
    if (!force) return;
  }

  const units = [
    ...(schedule?.units || []).filter(u => u.typ === "aufgabe" && u.status === "geplant"),
    ...generateGoalUnitsForToday(activeGoals),
  ];

  const newSchedule = {
    dayKey: t,
    createdAt: nowISO(),
    lastPushAtGoals: schedule?.lastPushAtGoals || null,
    units,
  };

  setSchedule(newSchedule);
}

/* ---------- Goal exercises (goal_uebungen.csv) ---------- */

function pickExerciseForGoal(goalId, stufe) {
  const gid = normId(goalId);
  const lvl = parseInt(stufe || "1", 10) || 1;

  const rows = (state.goalsStepsData || []).map(r => ({
    ziel_id: normId(r.ziel_id || r.goal_id || r.ziel || ""),
    stufe: parseInt(r.stufe || "1", 10) || 1,
    titel: String(r.titel || r.uebung || "").trim(),
    klasse: String(r.klasse || "").trim(),
  })).filter(x => x.ziel_id && x.titel);

  const list = rows.filter(x => x.ziel_id === gid && x.stufe === lvl);
  if (!list.length) return null;

  return list[Math.floor(Math.random() * list.length)];
}

/* ---------- Push (ntfy) ---------- */

async function sendNtfy(topic, token, message, title) {
  if (!topic) return false;
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Title": title || "Glam Trainer",
    "Priority": "default",
    "Tags": "bell",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers,
    body: message,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Push fehlgeschlagen (${res.status}): ${txt.slice(0, 140)}`);
  }
  return true;
}

function canSendPush(lastISO, minGapMinutes) {
  if (!lastISO) return true;
  const last = new Date(lastISO).getTime();
  return (Date.now() - last) >= minGapMinutes * 60 * 1000;
}

async function maybeDispatchPushes() {
  const schedule = getSchedule();
  if (!schedule || schedule.dayKey !== todayKey()) return;

  const settings = state.settings;
  const now = new Date();

  const due = (schedule.units || []).filter(u =>
    u.status === "geplant" &&
    u.plannedAt &&
    new Date(u.plannedAt) <= now
  );
  if (!due.length) return;
  if (!canSendPush(schedule.lastPushAtGoals, settings.minGapGoalsMin)) return;

  const show = due.slice(0, settings.maxUnitsPerBundle);
  const more = due.length - show.length;

  const lines = [];
  lines.push(`Fällig: ${due.length}`);
  lines.push("");
  show.forEach(u => {
    if (u.typ === "ziel") lines.push(`• 🎯 ${u.ziel_name} – Stufe ${u.stufe}`);
    else lines.push(`• 🧩 ${u.title || "Aufgabe"}`);
  });
  if (more > 0) lines.push(`… +${more} weitere`);
  lines.push("");
  lines.push("Öffne die App.");

  try {
    await sendNtfy(settings.ntfyGoalsTopic, settings.ntfyToken, lines.join("\n"), "Glam Trainer: fällig");
    schedule.lastPushAtGoals = nowISO();
    setSchedule(schedule);
    toast("Push gesendet.");
  } catch (e) {
    console.warn(e);
  }
}

/* ---------- Log + completion + progression ---------- */

function addLogEntry(entry) {
  const log = getLog();
  log.unshift(entry);
  setLog(log);
}

function completeUnit(unitId, result) {
  const schedule = getSchedule();
  if (!schedule) return;

  const idx = (schedule.units || []).findIndex(u => u.id === unitId);
  if (idx < 0) return;

  const u = schedule.units[idx];
  u.status = result.status; // erledigt | abgebrochen
  u.doneAt = nowISO();
  setSchedule(schedule);

  addLogEntry({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    typ: u.typ,
    dayKey: schedule.dayKey,
    createdAt: nowISO(),
    ziel_id: u.ziel_id || "",
    ziel_name: u.ziel_name || "",
    stufe: u.stufe || "",
    uebung: result.uebungText || "",
    title: u.title || "",
    status: result.status,
    rueckmeldung: result.rueckmeldung || "",
    gern: result.gern || null,
    notiz: result.notiz || "",
    plannedLabel: u.plannedLabel || "",
    dueAt: u.dueAt || "",
    source: u.source || "",
  });

  if (u.typ === "ziel") applyProgression(u.ziel_id);
}

function applyProgression(goalId) {
  const gid = normId(goalId);
  const logs = getLog().filter(e => e.typ === "ziel" && normId(e.ziel_id) === gid);

  const last2 = logs.slice(0, 2);
  const consecAbort = last2.length === 2 && last2.every(x => x.status === "abgebrochen");

  const last7 = logs.slice(0, 7);
  const aborts = last7.filter(x => x.status === "abgebrochen").length;

  const goal = getGoalsNormalized().find(g => normId(g.ziel_id) === gid);
  if (!goal) return;

  const cur = goal.aktuelle_stufe;
  const maxStufe = goal.max_stufe;

  let newStufe = cur;

  if (consecAbort || aborts >= 3) {
    newStufe = Math.max(1, cur - 1);
  } else {
    const onLevel = logs.filter(e => Number(e.stufe) === cur);
    const success = onLevel.filter(e => e.status === "erledigt");
    if (success.length >= 5) {
      let points = 0;
      for (const s of success) {
        if (s.rueckmeldung === "leicht") points += 2;
        else if (s.rueckmeldung === "okay") points += 1;
      }
      if (points >= 6) newStufe = Math.min(maxStufe, cur + 1);
    }
  }

  if (newStufe !== cur) {
    setGoalOverride(gid, { aktuelle_stufe: newStufe });
    toast(newStufe > cur ? "Nächste Stufe freigeschaltet." : "Eine Stufe zurück (sanft).");
    regenIfNeeded(true);
    render();
  }
}

/* ---------- Inbox (Anja Aufgaben) ---------- */

function addInboxTaskFromAnja(payload) {
  const inbox = getInbox();

  const id = String(payload?.id || `anja-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  const exists = inbox.some(x => x.id === id);
  if (exists) return { id, status: "neu" };

  const title = String(payload?.titel || payload?.title || "Neue Aufgabe").trim();
  const note = String(payload?.notiz || payload?.note || "").trim();
  const dueAt = payload?.dueAt ? String(payload.dueAt) : "";

  inbox.unshift({
    id,
    source: "anja",
    title,
    note,
    lines: Array.isArray(payload?.lines) ? payload.lines : [],
    createdAt: payload?.createdAt ? String(payload.createdAt) : nowISO(),
    dueAt,
    status: "neu", // neu | angenommen | erledigt | abgebrochen
  });

  setInbox(inbox);
  return { id, status: "neu" };
}

function setInboxStatus(id, status) {
  const inbox = getInbox();
  const x = inbox.find(t => t.id === id);
  if (!x) return false;
  x.status = status;
  setInbox(inbox);
  return true;
}

function acceptInboxTask(id) {
  const inbox = getInbox();
  const task = inbox.find(t => t.id === id);
  if (!task) return;

  if (task.status !== "neu") return;
  task.status = "angenommen";
  setInbox(inbox);

  // in den heutigen Schedule als Aufgabe übernehmen:
  let schedule = getSchedule();
  const tday = todayKey();
  if (!schedule || schedule.dayKey !== tday) {
    regenIfNeeded(true);
    schedule = getSchedule();
  }

  const plannedAt = task.dueAt ? new Date(task.dueAt) : new Date();
  // Wenn fällig in Zukunft: geplantAt = dueAt, sonst: jetzt + 2min
  const pa = (plannedAt instanceof Date && !isNaN(plannedAt)) ? plannedAt : new Date();
  const finalAt = (pa.getTime() < Date.now() + 60 * 1000) ? new Date(Date.now() + 2 * 60 * 1000) : pa;

  const unit = {
    id: `taskunit-${task.id}`,
    typ: "aufgabe",
    title: task.title,
    note: task.note || "",
    source: "anja",
    dueAt: task.dueAt || "",
    plannedAt: finalAt.toISOString(),
    plannedLabel: fmtTime(finalAt),
    status: "geplant",
    createdAt: nowISO(),
  };

  schedule.units = schedule.units || [];
  const already = schedule.units.some(u => u.id === unit.id);
  if (!already) schedule.units.unshift(unit);

  setSchedule(schedule);
  toast("Aufgabe angenommen.");
  render();

  // Wenn wir gerade in Anjas Ansicht sind: Status im iframe aktualisieren
  try {
    const frame = document.querySelector("iframe[data-anja-frame='1']");
    frame?.contentWindow?.postMessage({ type: "GT_TASK_STATUS", id: task.id, status: "angenommen" }, "*");
  } catch {}
}

function formatDueLabel(dueAtISO) {
  if (!dueAtISO) return "";
  const d = new Date(dueAtISO);
  if (isNaN(d)) return "";
  return d.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/* ---------- UI helpers ---------- */

function setActiveNav(route) {
  document.querySelectorAll(".navbtn").forEach(b => {
    const r = b.getAttribute("data-route");
    b.classList.toggle("active", route.startsWith(r));
  });
}

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  (children || []).forEach(c => {
    if (c === null || c === undefined) return;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
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
  return h("button", { class: "chip" + (active ? " active" : ""), type: "button", onclick: onClick }, [label]);
}

function openModal(contentEl) {
  const backdrop = h("div", { class: "modal-backdrop" }, [
    h("div", { class: "modal" }, [contentEl])
  ]);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  return () => backdrop.remove();
}

/* ---------- Unit detail modal ---------- */

function unitDetailModal(unit) {
  const schedule = getSchedule();
  const u = schedule?.units?.find(x => x.id === unit.id) || unit;

  let exercise = null;
  if (u.typ === "ziel") exercise = pickExerciseForGoal(u.ziel_id, u.stufe);

  const title = u.typ === "ziel" ? `🎯 Trainingseinheit` : `🧩 Aufgabe`;
  const main = u.typ === "ziel"
    ? `${u.ziel_name} – Stufe ${u.stufe}\n\n${exercise?.titel ? "Übung: " + exercise.titel : "Keine Übung in goal_uebungen.csv gefunden."}`
    : `${u.title || "Aufgabe"}${u.note ? "\n\nBemerkung: " + u.note : ""}${u.dueAt ? "\n\nFällig am: " + formatDueLabel(u.dueAt) : ""}`;

  const closeBtn = h("button", { class: "modal-close", type: "button" }, ["✕"]);
  const header = h("div", { class: "modal-header" }, [
    h("div", { class: "modal-title" }, [title]),
    closeBtn
  ]);

  const statusRow = h("div", { class: "row" }, [
    h("button", { class: "btn secondary", type: "button", id: "btnDone" }, ["Geschafft"]),
    h("button", { class: "btn secondary", type: "button", id: "btnAbort" }, ["Abgebrochen"]),
  ]);

  const feedbackRow = h("div", { class: "row", style: "margin-top:8px" }, [
    h("button", { class: "btn secondary", type: "button", id: "fb1" }, ["leicht"]),
    h("button", { class: "btn secondary", type: "button", id: "fb2" }, ["okay"]),
    h("button", { class: "btn secondary", type: "button", id: "fb3" }, ["schwer"]),
  ]);

  const gernSel = h("select", { class: "select", id: "gernSel" }, [
    h("option", { value: "" }, ["Gern gemacht? (optional)"]),
    ...[1, 2, 3, 4, 5].map(n => h("option", { value: String(n) }, [String(n)]))
  ]);

  const note = h("textarea", { class: "textarea", id: "note", placeholder: "Notiz (optional)" }, []);

  const btnSave = h("button", { class: "btn", type: "button" }, ["Speichern"]);
  const btnDelete = h("button", { class: "btn danger", type: "button" }, ["Eintrag löschen"]);
  const btnClose = h("button", { class: "btn secondary", type: "button" }, ["Zurück"]);

  const footer = h("div", { class: "row", style: "margin-top:10px" }, [btnSave, btnClose, btnDelete]);

  const body = h("div", {}, [
    header,
    h("div", { class: "hr" }, []),
    h("div", { class: "small" }, [u.plannedLabel ? `Geplant: ${u.plannedLabel}` : ""]),
    h("div", { style: "white-space:pre-line; font-size:16px; font-weight:800; margin-top:8px" }, [main]),
    h("div", { class: "hr" }, []),
    h("div", { class: "small" }, [u.typ === "ziel" ? "Rückmeldung (für Ziele empfohlen):" : "Status:"]),
    statusRow,
    (u.typ === "ziel" ? feedbackRow : h("div", {}, [])),
    (u.typ === "ziel" ? gernSel : h("div", {}, [])),
    note,
    footer,
  ]);

  const close = openModal(body);
  closeBtn.onclick = close;
  btnClose.onclick = close;

  let chosenStatus = null;
  let rueck = null;

  function setBtnActive(btn) {
    [body.querySelector("#btnDone"), body.querySelector("#btnAbort")].forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }
  function setFbActive(btn) {
    [body.querySelector("#fb1"), body.querySelector("#fb2"), body.querySelector("#fb3")].forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }

  body.querySelector("#btnDone").onclick = () => { chosenStatus = "erledigt"; setBtnActive(body.querySelector("#btnDone")); };
  body.querySelector("#btnAbort").onclick = () => { chosenStatus = "abgebrochen"; setBtnActive(body.querySelector("#btnAbort")); };

  if (u.typ === "ziel") {
    body.querySelector("#fb1").onclick = () => { rueck = "leicht"; setFbActive(body.querySelector("#fb1")); };
    body.querySelector("#fb2").onclick = () => { rueck = "okay"; setFbActive(body.querySelector("#fb2")); };
    body.querySelector("#fb3").onclick = () => { rueck = "schwer"; setFbActive(body.querySelector("#fb3")); };
  }

  btnSave.onclick = () => {
    if (!chosenStatus) { toast("Bitte: Geschafft oder Abgebrochen wählen."); return; }
    if (u.typ === "ziel" && !rueck) { toast("Bitte Rückmeldung wählen (leicht/okay/schwer)."); return; }

    completeUnit(u.id, {
      status: chosenStatus,
      rueckmeldung: rueck || "",
      gern: body.querySelector("#gernSel")?.value ? parseInt(body.querySelector("#gernSel").value, 10) : null,
      notiz: body.querySelector("#note").value.trim(),
      uebungText: exercise?.titel || "",
    });

    // Wenn es eine Inbox-Aufgabe war: Inbox-Status aktualisieren
    if (u.typ === "aufgabe" && u.id?.startsWith("taskunit-")) {
      const inboxId = u.id.replace("taskunit-", "");
      setInboxStatus(inboxId, chosenStatus === "erledigt" ? "erledigt" : "abgebrochen");
      try {
        const frame = document.querySelector("iframe[data-anja-frame='1']");
        frame?.contentWindow?.postMessage({ type: "GT_TASK_STATUS", id: inboxId, status: (chosenStatus === "erledigt" ? "erledigt" : "abgebrochen") }, "*");
      } catch {}
    }

    close();
    render();
  };

  btnDelete.onclick = () => {
    const schedule = getSchedule();
    if (!schedule) return;
    const idx = (schedule.units || []).findIndex(x => x.id === u.id);
    if (idx >= 0) {
      schedule.units.splice(idx, 1);
      setSchedule(schedule);
      toast("Gelöscht.");
      close();
      render();
    }
  };
}

/* ---------- Views ---------- */

function listItemCard(unit) {
  const badgeClass = unit.typ === "ziel" ? "badge goal" : "badge task";
  const badgeIcon = unit.typ === "ziel" ? "🎯" : "🧩";

  const title = unit.typ === "ziel"
    ? `${unit.ziel_name} – Stufe ${unit.stufe}`
    : `${unit.title || "Aufgabe"}`;

  const sub = unit.typ === "ziel"
    ? "Übung: (wird beim Öffnen gewählt)"
    : `${unit.dueAt ? "Fällig am: " + formatDueLabel(unit.dueAt) : "Optional (Anja)"}${unit.note ? "\nBemerkung: " + unit.note : ""}`;

  return h("div", { class: "item" }, [
    h("div", { class: badgeClass }, [badgeIcon]),
    h("div", { class: "item-main" }, [
      h("div", { class: "item-title" }, [title]),
      h("div", { class: "item-sub" }, [sub]),
      h("div", { class: "row", style: "margin-top:10px; gap:10px" }, [
        h("button", { class: "btn secondary", type: "button", onclick: () => unitDetailModal(unit) }, ["Öffnen"])
      ])
    ]),
    h("div", { class: "time" }, [unit.plannedLabel || ""])
  ]);
}

function moduleTile(icon, title, lines, btnText, onClick) {
  return h("div", { class: "card" }, [
    h("div", { style: "display:flex;align-items:flex-start;gap:10px" }, [
      h("div", { class: "badge task", style: "width:38px;height:38px" }, [icon]),
      h("div", { style: "flex:1" }, [
        h("div", { style: "font-weight:900;font-size:16px" }, [title]),
        h("div", { class: "small", style: "margin-top:6px;white-space:pre-line" }, [lines])
      ])
    ]),
    h("div", { class: "hr" }, []),
    h("button", { class: "btn secondary", type: "button", onclick: onClick }, [btnText])
  ]);
}

function goalsSummaryText() {
  const goals = getGoalsNormalized().filter(g => g.aktiv);
  if (!goals.length) return "Aktiv: 0\nKeine aktiven Ziele.";
  const lines = goals.slice(0, 3).map(g => `${g.ziel_name} – Stufe ${g.aktuelle_stufe}/${g.max_stufe}`);
  return `Aktiv: ${goals.length}\n` + lines.join("\n");
}

function tasksSummaryText() {
  const inbox = getInbox();
  const neu = inbox.filter(x => x.status === "neu").length;
  const angen = inbox.filter(x => x.status === "angenommen").length;
  return `Inbox: ${inbox.length}\nNeu: ${neu} · Angenommen: ${angen}`;
}

/* ---------- Startauswahl / Nav ---------- */

function renderNav() {
  return h("div", { style: "display:flex;flex-direction:column;gap:12px" }, [
    h("div", { class: "card" }, [
      sectionTitle("🧭", "Start", null),
      h("div", { class: "small" }, ["Wähle, welchen Bereich du öffnen willst."]),
      h("div", { class: "hr" }, []),

      h("div", { class: "grid2" }, [
        moduleTile("🔱", "Trainer", "Ziele, Trainings, Aufgaben & Log.", "Öffnen", () => {
          location.hash = "#/home";
        }),
        moduleTile("👑", "Anja — Control Panel", "Aufgaben/Kleidung/Kombination erstellen.", "Öffnen", () => {
          location.hash = "#/anja";
        }),
      ]),
    ]),
  ]);
}

/* ---------- Anja view (iframe) ---------- */

function renderAnja() {
  const iframe = h("iframe", {
    src: "control_panel.html",
    "data-anja-frame": "1",
    style: "width:100%;height:75vh;border:0;border-radius:16px;background:transparent;",
    loading: "lazy",
  });

  const btnBack = h("button", {
    class: "btn secondary",
    type: "button",
    onclick: () => { location.hash = "#/nav"; }
  }, ["Zur Startauswahl"]);

  return h("div", { class: "card" }, [
    sectionTitle("👑", "Anja — Control Panel", btnBack),
    h("div", { class: "small" }, [
      "Neue Aufgaben werden bei dir in „Aufgaben“ als Inbox-Einträge sichtbar (Annehmen)."
    ]),
    h("div", { class: "hr" }, []),
    iframe,
  ]);
}

/* ---------- Home ---------- */

function renderHome() {
  regenIfNeeded(false);

  const schedule = getSchedule();
  const units = schedule?.units || [];
  const now = new Date();

  const due = units.filter(u => u.status === "geplant" && u.plannedAt && new Date(u.plannedAt) <= now);
  const planned = units.filter(u => u.status === "geplant" && u.plannedAt && new Date(u.plannedAt) > now);

  const filtered = (arr) => {
    if (state.filter === "all") return arr;
    if (state.filter === "goals") return arr.filter(x => x.typ === "ziel");
    if (state.filter === "tasks") return arr.filter(x => x.typ === "aufgabe");
    return arr;
  };

  const chips = h("div", { class: "chips" }, [
    chip("Alle", state.filter === "all", () => { state.filter = "all"; render(); }),
    chip("🎯 Ziele", state.filter === "goals", () => { state.filter = "goals"; render(); }),
    chip("🧩 Aufgaben", state.filter === "tasks", () => { state.filter = "tasks"; render(); }),
  ]);

  const dueList = h("div", { class: "list" }, filtered(due).map(listItemCard));
  const plannedList = h("div", { class: "list" }, filtered(planned).map(listItemCard));

  return h("div", { style: "display:flex;flex-direction:column;gap:12px" }, [
    h("div", { class: "card" }, [
      sectionTitle("🔔", "Jetzt fällig", chips),
      filtered(due).length ? dueList : h("div", { class: "small" }, ["Keine Einheiten fällig."])
    ]),
    h("div", { class: "card" }, [
      sectionTitle("📅", "Heute geplant", null),
      filtered(planned).length ? plannedList : h("div", { class: "small" }, ["Heute ist nichts weiter geplant."])
    ]),
    h("div", { class: "grid2" }, [
      moduleTile("🎯", "Ziele", goalsSummaryText(), "Ziele öffnen", () => { location.hash = "#/goals"; }),
      moduleTile("🧩", "Aufgaben", tasksSummaryText(), "Aufgaben öffnen", () => { location.hash = "#/tasks"; }),
    ])
  ]);
}

/* ---------- Goals ---------- */

function renderGoals() {
  const goals = getGoalsNormalized();

  const cards = goals.map(g => {
    const { period, min, max, done } = computeGoalQuota(g);
    const freq = period === "TAG"
      ? `Heute: ${done} / ${min}–${max || min}`
      : `Diese Woche: ${done} / ${min}–${max || min}`;
    const mod = (g.modus === "ritualisiert")
      ? `ritualisiert ${g.feste_zeit || "09:00"}`
      : `flexibel ${g.zeit_von || "14:00"}–${g.zeit_bis || "20:00"}`;

    return h("div", { class: "item" }, [
      h("div", { class: "badge goal" }, ["🎯"]),
      h("div", { class: "item-main" }, [
        h("div", { class: "item-title" }, [g.ziel_name]),
        h("div", { class: "item-sub" }, [`Stufe ${g.aktuelle_stufe} von ${g.max_stufe}\n${freq}\n${mod}`]),
        h("div", { class: "row", style: "margin-top:10px" }, [
          h("button", {
            class: "btn secondary",
            type: "button",
            onclick: () => toggleGoalActive(g.ziel_id)
          }, [g.aktiv ? "Pausieren" : "Aktivieren"]),
        ])
      ])
    ]);
  });

  return h("div", { class: "card" }, [
    sectionTitle("🎯", "Ziele", null),
    cards.length ? h("div", { class: "list" }, cards) : h("div", { class: "small" }, ["Keine Ziele in goals.csv gefunden."])
  ]);
}

function toggleGoalActive(goalId) {
  const gid = normId(goalId);
  const goal = getGoalsNormalized().find(g => normId(g.ziel_id) === gid);
  const current = goal ? !!goal.aktiv : false;

  setGoalOverride(gid, { aktiv: !current });
  regenIfNeeded(true);
  render();
}

/* ---------- Tasks ---------- */

function renderInboxList() {
  const inbox = getInbox();

  const open = inbox.filter(t => t.source === "anja" && (t.status === "neu" || t.status === "angenommen"));

  if (!open.length) {
    return h("div", { class: "small", style: "margin-top:10px" }, ["Keine offenen Aufgaben von Anja."]);
  }

  const items = open.map(t => {
    const st = (t.status === "neu") ? "Offen" : "Angenommen";
    const due = t.dueAt ? `\nFällig am: ${formatDueLabel(t.dueAt)}` : "";
    const note = t.note ? `\nBemerkung: ${t.note}` : "";

    return h("div", { class: "item" }, [
      h("div", { class: "badge task" }, ["👑"]),
      h("div", { class: "item-main" }, [
        h("div", { class: "item-title" }, [t.title]),
        h("div", { class: "item-sub" }, [`Status: ${st}${due}${note}`]),
        h("div", { class: "row", style: "margin-top:10px; gap:10px" }, [
          (t.status === "neu")
            ? h("button", { class: "btn secondary", type: "button", onclick: () => acceptInboxTask(t.id) }, ["Annehmen"])
            : h("button", { class: "btn secondary", type: "button", onclick: () => {
                // Öffne Unit falls existiert
                const schedule = getSchedule();
                const u = schedule?.units?.find(x => x.id === `taskunit-${t.id}`);
                if (u) unitDetailModal(u);
                else toast("Noch nicht im Plan.");
              } }, ["Öffnen"]),
        ])
      ]),
      h("div", { class: "time" }, [""])
    ]);
  });

  return h("div", { class: "list", style: "margin-top:10px" }, items);
}

function renderTasks() {
  const rubriken = [...new Set((state.tasksData || []).map(r => (r.rubrik || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "de"));

  const rubSel = h("select", { class: "select", id: "rubSel" }, [
    h("option", { value: "" }, ["Rubrik wählen"]),
    ...rubriken.map(r => h("option", { value: r }, [r]))
  ]);

  const taskSel = h("select", { class: "select", id: "taskSel", disabled: "true" }, [
    h("option", { value: "" }, ["Aufgabe wählen"])
  ]);

  const out = h("div", { id: "taskOut", style: "white-space:pre-line; font-weight:800; margin-top:10px" }, [""]);

  const btnRandom = h("button", { class: "btn secondary", type: "button" }, ["Zufallsaufgabe"]);
  const btnPush = h("button", { class: "btn secondary", type: "button" }, ["Push senden (Aufgabe)"]);

  function getItemsForRubrik(rub) {
    return (state.tasksData || [])
      .map(r => ({
        rubrik: (r.rubrik || "").trim(),
        titel: (r.titel || "").trim(),
        klasse: (r.klasse || "").trim()
      }))
      .filter(x => x.rubrik === rub && x.titel);
  }

  function setOutFromItem(it) {
    out.textContent = `🧩 Aufgabe\nRubrik: ${it.rubrik}\n\n${it.titel}${it.klasse ? "\n\nKlasse: " + it.klasse : ""}`;
    out.dataset.payload = JSON.stringify(it);
  }

  function rebuildTaskSelect() {
    const rub = rubSel.value;
    taskSel.innerHTML = "";
    taskSel.appendChild(h("option", { value: "" }, ["Aufgabe wählen"]));

    if (!rub) {
      taskSel.disabled = true;
      return;
    }

    const items = getItemsForRubrik(rub);
    items.forEach((it, idx) => {
      taskSel.appendChild(h("option", { value: String(idx) }, [`${it.titel}${it.klasse ? " [" + it.klasse + "]" : ""}`]));
    });
    taskSel.disabled = items.length ? false : true;
  }

  rubSel.onchange = () => {
    rebuildTaskSelect();
    out.textContent = "";
    delete out.dataset.payload;
  };

  taskSel.onchange = () => {
    const rub = rubSel.value;
    const items = getItemsForRubrik(rub);
    const idx = parseInt(taskSel.value || "-1", 10);
    if (idx >= 0 && items[idx]) setOutFromItem(items[idx]);
  };

  btnRandom.onclick = () => {
    const rub = rubSel.value;
    if (!rub) { toast("Bitte Rubrik wählen."); return; }
    const items = getItemsForRubrik(rub);
    if (!items.length) { toast("Keine Aufgaben in dieser Rubrik."); return; }
    const it = items[Math.floor(Math.random() * items.length)];
    setOutFromItem(it);
    toast("Zufallsaufgabe gewählt.");
  };

  btnPush.onclick = async () => {
    const payload = out.dataset.payload ? JSON.parse(out.dataset.payload) : null;
    if (!payload) { toast("Erst eine Aufgabe wählen."); return; }
    const s = state.settings;
    try {
      await sendNtfy(s.ntfyTasksTopic, s.ntfyToken, `Aufgabe\nRubrik: ${payload.rubrik}\n\n${payload.titel}`, "Aufgabe");
      toast("Push gesendet.");
    } catch (e) {
      console.warn(e);
      toast("Push fehlgeschlagen.");
    }
  };

  return h("div", { class: "card" }, [
    sectionTitle("🧩", "Aufgaben", null),
    h("div", { class: "small" }, ["Aufgaben sind optional (Lust / Anja). Keine Progression, keine Strafen."]),
    h("div", { class: "hr" }, []),
    rubSel,
    taskSel,
    h("div", { class: "row" }, [btnRandom, btnPush]),
    out,

    h("div", { class: "hr", style: "margin-top:14px" }, []),
    h("div", { class: "small" }, ["👑 Aufgaben von Anja (Inbox):"]),
    renderInboxList(),
  ]);
}

/* ---------- Log ---------- */

function renderLog() {
  const log = getLog();
  const filterCh = h("div", { class: "chips" }, [
    chip("Alle", state.filter === "all", () => { state.filter = "all"; render(); }),
    chip("🎯 Ziele", state.filter === "goals", () => { state.filter = "goals"; render(); }),
    chip("🧩 Aufgaben", state.filter === "tasks", () => { state.filter = "tasks"; render(); }),
  ]);

  const filtered = log.filter(e => {
    if (state.filter === "all") return true;
    if (state.filter === "goals") return e.typ === "ziel";
    if (state.filter === "tasks") return e.typ === "aufgabe";
    return true;
  });

  const list = filtered.map(e => {
    const badge = e.typ === "ziel" ? "🎯" : "🧩";
    const title = e.typ === "ziel"
      ? `${e.ziel_name} – Stufe ${e.stufe}`
      : (e.title || "Aufgabe");

    const subLines = [];
    if (e.typ === "ziel") {
      if (e.uebung) subLines.push(`Übung: ${e.uebung}`);
      if (e.rueckmeldung) subLines.push(`Rückmeldung: ${e.rueckmeldung}`);
      if (e.gern) subLines.push(`Gern: ${e.gern}/5`);
    }
    if (e.dueAt) subLines.push(`Fällig am: ${formatDueLabel(e.dueAt)}`);
    if (e.status) subLines.push(`Status: ${e.status}`);
    if (e.notiz) subLines.push(`Notiz: ${e.notiz}`);
    if (e.source) subLines.push(`Quelle: ${e.source}`);

    return h("div", { class: "item" }, [
      h("div", { class: "badge " + (e.typ === "ziel" ? "goal" : "task") }, [badge]),
      h("div", { class: "item-main" }, [
        h("div", { class: "item-title" }, [title]),
        h("div", { class: "item-sub" }, [`${new Date(e.createdAt).toLocaleString("de-DE")}\n${subLines.join("\n")}`])
      ])
    ]);
  });

  return h("div", { class: "card" }, [
    sectionTitle("📓", "Log", filterCh),
    filtered.length ? h("div", { class: "list" }, list) : h("div", { class: "small" }, ["Noch keine Einträge."])
  ]);
}

/* ---------- Settings ---------- */

function renderSettings() {
  const s = state.settings;

  const topicGoals = h("input", { class: "input", type: "text", value: s.ntfyGoalsTopic, placeholder: "Topic Ziele (ntfy)" });
  const topicTasks = h("input", { class: "input", type: "text", value: s.ntfyTasksTopic, placeholder: "Topic Aufgaben (ntfy)" });
  const token = h("input", { class: "input", type: "text", value: s.ntfyToken, placeholder: "ntfy Token (optional)" });

  const gapGoals = h("input", { class: "input", type: "number", min: "0", step: "1", value: String(s.minGapGoalsMin) });
  const maxBundle = h("input", { class: "input", type: "number", min: "1", step: "1", value: String(s.maxUnitsPerBundle) });

  const btnSave = h("button", { class: "btn", type: "button" }, ["Speichern"]);
  const btnTestGoals = h("button", { class: "btn secondary", type: "button" }, ["Push testen (Ziele)"]);
  const btnReload = h("button", { class: "btn secondary", type: "button" }, ["CSV neu laden"]);

  btnSave.onclick = () => {
    s.ntfyGoalsTopic = topicGoals.value.trim();
    s.ntfyTasksTopic = topicTasks.value.trim();
    s.ntfyToken = token.value.trim();
    s.minGapGoalsMin = parseInt(gapGoals.value || "0", 10) || 0;
    s.maxUnitsPerBundle = parseInt(maxBundle.value || "5", 10) || 5;
    persistSettings();
    toast("Gespeichert.");
  };

  btnTestGoals.onclick = async () => {
    try { await sendNtfy(s.ntfyGoalsTopic, s.ntfyToken, "Test vom Glam Trainer (Ziele)", "Push-Test"); toast("Gesendet."); }
    catch (e) { console.warn(e); toast("Fehler."); }
  };

  btnReload.onclick = async () => {
    try {
      await loadAllCSV();
      toast("CSV geladen.");
      regenIfNeeded(true);
      render();
    } catch (e) {
      console.warn(e);
      toast("CSV Fehler.");
    }
  };

  return h("div", { class: "card" }, [
    sectionTitle("⚙️", "Einstellungen", null),
    h("div", { class: "small" }, ["Hinweis: Push/Erinnerungen funktionieren zuverlässig, solange die App gelegentlich geöffnet ist."]),
    h("div", { class: "hr" }, []),
    h("div", { class: "small" }, ["ntfy Topics"]),
    topicGoals, topicTasks, token,
    h("div", { class: "hr" }, []),
    h("div", { class: "small" }, ["Push Abstand & Bündelung"]),
    gapGoals, maxBundle,
    h("div", { class: "row", style: "margin-top:10px" }, [btnSave, btnReload, btnTestGoals]),
  ]);
}

/* ---------- Render ---------- */

function render() {
  const dm = $("dayMode");
  if (dm) dm.value = state.settings.dayMode;

  setActiveNav(state.route);

  const view = $("view");
  if (!view) return;
  view.innerHTML = "";

  if (state.route.startsWith("#/nav")) view.appendChild(renderNav());
  else if (state.route.startsWith("#/anja")) view.appendChild(renderAnja());
  else if (state.route.startsWith("#/home")) view.appendChild(renderHome());
  else if (state.route.startsWith("#/goals")) view.appendChild(renderGoals());
  else if (state.route.startsWith("#/tasks")) view.appendChild(renderTasks());
  else if (state.route.startsWith("#/log")) view.appendChild(renderLog());
  else if (state.route.startsWith("#/settings")) view.appendChild(renderSettings());
  else view.appendChild(renderNav());
}

/* ---------- Routing + init ---------- */

function onRoute() {
  state.route = location.hash || "#/nav";
  setActiveNav(state.route);
  render();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const candidates = ["./sw.js", "./service-worker.js"];
  for (const url of candidates) {
    try {
      await navigator.serviceWorker.register(url, { scope: "./" });
      return;
    } catch {}
  }
}

/* ---------- Anja Bridge: receive tasks ---------- */

function setupAnjaBridge() {
  window.addEventListener("message", (ev) => {
    const msg = ev?.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "GT_NEW_TASK") {
      const res = addInboxTaskFromAnja(msg.payload || {});
      toast("Neue Aufgabe von Anja erhalten.");
      render();

      // ACK zurück an iframe (damit Anja "Offen" anzeigen kann)
      try {
        ev.source?.postMessage({ type: "GT_TASK_ACK", id: res.id, status: res.status }, "*");
      } catch {}
      return;
    }

    if (msg.type === "GT_TASK_QUERY_STATUS") {
      const inbox = getInbox();
      const t = inbox.find(x => x.id === msg.id);
      const status = t?.status || "unbekannt";
      try {
        ev.source?.postMessage({ type: "GT_TASK_STATUS", id: msg.id, status }, "*");
      } catch {}
      return;
    }
  });
}

async function init() {
  const label = $("todayLabel");
  if (label) {
    const d = new Date();
    label.textContent = d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const dm = $("dayMode");
  if (dm) dm.addEventListener("change", (e) => setDayMode(e.target.value));

  const btnSync = $("btnSync");
  if (btnSync) btnSync.addEventListener("click", async () => {
    try {
      await loadAllCSV();
      toast("CSV geladen.");
      regenIfNeeded(true);
      render();
    } catch (e) {
      console.warn(e);
      toast("CSV Fehler.");
    }
  });

  document.querySelectorAll(".navbtn").forEach(b => {
    b.addEventListener("click", () => { location.hash = b.getAttribute("data-route"); });
  });

  window.addEventListener("hashchange", onRoute);

  setupAnjaBridge();
  await registerServiceWorker();

  try { await loadAllCSV(); } catch (e) { console.warn(e); }

  regenIfNeeded(true);
  setInterval(() => { maybeDispatchPushes(); }, state.settings.tickSeconds * 1000);

  if (!location.hash) location.hash = "#/nav";
  onRoute();
}

init();
