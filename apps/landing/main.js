import { initLang, onLang, speechLang, t } from "./i18n.js?v=12";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const narrowQuery = window.matchMedia("(max-width: 760px)");

const BASE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, fold: 0, lens: 0, shadow: 0 };
const WIDE = [
  { y: 0.42, rx: 0.14, ry: -0.5, s: 1.3, shadow: 1 },
  { x: 1.95, y: 0.1, z: 1.4, rx: 0.14, ry: 0.85, rz: -0.03, s: 0.9 },
  { x: 0.2, y: -1.5, rx: 0.3, ry: -0.35, rz: 0.04, s: 0.72 },
  { x: 1.95, y: -0.05, z: 0.4, rx: 0.5, ry: -0.4, rz: 0.1, s: 0.85 },
  { x: -1.75, y: 0.05, z: 0.3, rx: 0.08, ry: 0.55, rz: -0.03, s: 0.95 },
  { x: 1.2, y: 0, z: 2.6, ry: -0.08, s: 0.98, lens: 1 },
  { x: -0.55, y: 0.05, z: 0.8, rx: 0.1, ry: 1.2, s: 0.85 },
  { x: 2.65, y: -0.15, rx: 0.95, ry: -0.5, rz: 0.25, s: 0.75, fold: 1 },
  { y: 0.9, rx: 0.1, ry: -0.3, s: 1, shadow: 1 },
  { y: 2.4, s: 0.35, shadow: 0 },
];
const NARROW = [
  { x: -0.08, y: 1.15, rx: 0.14, ry: -0.18, s: 0.54, shadow: 1 },
  { x: 0.4, y: 0.95, rx: 0.14, ry: 0.85, s: 0.46 },
  { y: 1.35, rx: 0.3, ry: -0.35, rz: 0.04, s: 0.5 },
  { x: -0.12, y: 1.0, rx: 0.5, ry: -0.4, rz: 0.1, s: 0.47 },
  { x: 0.28, y: 1.0, rx: 0.08, ry: 0.55, s: 0.48 },
  { y: 0.85, z: 2, ry: -0.08, s: 0.5, lens: 1 },
  { x: 0.8, y: 1.0, rx: 0.1, ry: 1.1, s: 0.42 },
  { y: 1.05, rx: 0.95, ry: -0.5, rz: 0.25, s: 0.5, fold: 1 },
  { y: 1.62, rx: 0.1, ry: -0.15, s: 0.5, shadow: 1 },
  { y: 2.2, s: 0.28, shadow: 0 },
].map((k) => ({ ...BASE, ...k }));
const WIDE_FULL = WIDE.map((k) => ({ ...BASE, ...k }));

const chapters = $$(".chapter");
const progress = $("#progress");
chapters.forEach(() => progress.append(document.createElement("li")));
const dots = $$("li", progress);

let glasses = null;
let chapterT = 0;
let layout = [];

function measure() {
  layout = chapters.map((el) => ({ top: el.offsetTop, h: el.offsetHeight }));
}

function smooth(t) {
  const e = Math.min(1, Math.max(0, (t - 0.2) / 0.6));
  return e * e * (3 - 2 * e);
}

function computeT() {
  const center = window.scrollY + window.innerHeight * 0.5;
  for (let i = 0; i < layout.length; i++) {
    const { top, h } = layout[i];
    if (center < top + h || i === layout.length - 1) {
      return Math.min(layout.length - 1, Math.max(0, i + (center - top) / h - 0.5));
    }
  }
  return 0;
}

function poseAt(t) {
  const frames = narrowQuery.matches ? NARROW : WIDE_FULL;
  const i = Math.floor(t);
  const a = frames[i];
  const b = frames[Math.min(i + 1, frames.length - 1)];
  const f = smooth(t - i);
  const out = {};
  for (const k of Object.keys(BASE)) out[k] = a[k] + (b[k] - a[k]) * f;
  return out;
}

function onScroll(snap = false) {
  chapterT = computeT();
  const active = Math.round(chapterT);
  document.body.dataset.chapter = String(active);
  dots.forEach((d, i) => d.classList.toggle("on", i === active));
  glasses?.setTarget(poseAt(chapterT), { snap });
  revealSentence();
  if (active === 3) startTerminal();
  replyPulse(active === 6);
}

window.addEventListener("scroll", () => onScroll(), { passive: true });
window.addEventListener("resize", () => {
  measure();
  onScroll();
});
narrowQuery.addEventListener("change", () => {
  measure();
  onScroll(true);
});

/* Legendas técnicas presas às peças do modelo */
const leaders = $("#leaders");
const callouts = $$(".callout");
const OFFSETS = { camera: [40, -84], led: [48, -64], mic: [-24, 76], speaker: [-40, 60] };
const NARROW_OFFSETS = { camera: [16, -60], led: [20, -44], mic: [-10, 46], speaker: [10, -40] };
leaders.innerHTML = callouts.map(() => '<line/><circle r="3.5"/>').join("");
const lines = $$("line", leaders);
const circles = $$("circle", leaders);

function drawCallouts() {
  const vis = Math.max(0, 1 - Math.abs(chapterT - 1) * 2.6);
  leaders.style.opacity = callouts[0].parentElement.style.opacity = String(vis);
  if (!glasses || vis === 0) return;
  const offsets = narrowQuery.matches ? NARROW_OFFSETS : OFFSETS;
  callouts.forEach((el, i) => {
    const name = el.dataset.anchor;
    const p = glasses.project(name);
    if (!p) return;
    const [dx, dy] = offsets[name];
    const w = el.offsetWidth + 8;
    const lx = dx < 0 ? Math.max(w, p.x + dx) : Math.min(window.innerWidth - w, p.x + dx);
    const ly = p.y + dy;
    lines[i].setAttribute("x1", p.x);
    lines[i].setAttribute("y1", p.y);
    lines[i].setAttribute("x2", lx);
    lines[i].setAttribute("y2", ly);
    circles[i].setAttribute("cx", p.x);
    circles[i].setAttribute("cy", p.y);
    const shift = dx < 0 ? "-100%" : "0%";
    const pad = dx < 0 ? -6 : 6;
    el.style.transform = `translate(${lx + pad}px, ${ly}px) translate(${shift}, -50%)`;
  });
}

const earWaves = $("#ear-waves");
function drawEarWaves() {
  const vis = Math.max(0, 1 - Math.abs(chapterT - 6) * 2.6);
  earWaves.style.opacity = String(vis);
  if (!glasses || vis === 0) return;
  const p = glasses.project("speaker");
  if (p) earWaves.style.transform = `translate(${p.x}px, ${p.y}px)`;
}

function calloutLoop() {
  drawCallouts();
  drawEarWaves();
  requestAnimationFrame(calloutLoop);
}

/* Frase dita, palavra por palavra */
const said = $("#said");
let words = [];
function mountSaid() {
  said.replaceChildren();
  t("said").forEach((item, i) => {
    if (i) said.append(" ");
    const span = document.createElement("span");
    span.textContent = item.text;
    if (item.agent) span.classList.add("agent");
    said.append(span);
  });
  words = $$("span", said);
}
function revealSentence() {
  const i = 2;
  if (!layout[i]) return;
  const { top, h } = layout[i];
  const p = (window.scrollY + window.innerHeight * 0.6 - top) / h;
  const n = Math.round(Math.min(1, Math.max(0, (p - 0.15) / 0.5)) * words.length);
  words.forEach((w, j) => w.classList.toggle("on", j < n));
}

/* Terminal por agente, com o estado verdadeiro de cada um */
const AGENT_KIND = { codex: "ok", claude: "wip", grok: "ok" };
function agentConfig(agent) {
  const cfg = t(`agents.${agent}`);
  return { path: cfg.path, state: [AGENT_KIND[agent], cfg.state], lines: cfg.lines };
}
const termBody = $("#term-body");
const termPath = $("#term-path");
const termState = $("#term-state");
let termAgent = "codex";
let termStarted = false;
let termToken = 0;

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

async function typeTerminal(agent) {
  const token = ++termToken;
  const cfg = agentConfig(agent);
  termPath.textContent = cfg.path;
  termState.dataset.s = cfg.state[0];
  termState.textContent = cfg.state[1];
  termBody.innerHTML = "";
  const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));
  for (const [kind, text] of cfg.lines) {
    if (token !== termToken) return;
    const span = document.createElement("span");
    span.className = kind;
    termBody.append(span, "\n");
    if (reducedMotion) {
      span.textContent = text;
      continue;
    }
    for (let c = 1; c <= text.length; c++) {
      if (token !== termToken) return;
      span.innerHTML = escapeHtml(text.slice(0, c));
      await wait(kind === "you" ? 22 : 9);
    }
    await wait(420);
  }
}

function startTerminal() {
  if (termStarted) return;
  termStarted = true;
  typeTerminal(termAgent);
}

$$(".segmented button").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".segmented button").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    termAgent = btn.dataset.agent;
    termStarted = true;
    typeTerminal(termAgent);
    glasses?.react("perk");
  });
});

/* Aprovação: os óculos concordam ou negam com a cabeça */
const ICONS = {
  needsApproval: '<path d="M8 11V5a1.5 1.5 0 0 1 3 0v5V3.5a1.5 1.5 0 0 1 3 0V10V5a1.5 1.5 0 0 1 3 0v8c0 4.4-3 8-7.5 8C6 21 4 18 3.4 16L2 12.5a1.5 1.5 0 0 1 2.7-1.3L6 13.5V7a1 1 0 0 1 2 0z"/>',
  completed: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z"/>',
  cancelled: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM9 9h6v6H9z"/>',
};
const task = $("#task");
const taskLabel = $("#task-status-label");
const taskIcon = $("#task-status svg");
const taskDetail = $("#task-detail");
const taskActions = $("#task-actions");
const taskReset = $("#task-reset");

function setTask(status) {
  task.dataset.status = status;
  taskIcon.innerHTML = ICONS[status];
  const copy = t(`task.${status}`);
  taskLabel.textContent = copy[0];
  taskDetail.textContent = copy[1];
  taskActions.hidden = status !== "needsApproval";
  taskReset.hidden = status === "needsApproval";
}

taskActions.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-answer]");
  if (!btn) return;
  const yes = btn.dataset.answer === "yes";
  setTask(yes ? "completed" : "cancelled");
  glasses?.react(yes ? "nod" : "shake");
  taskReset.focus();
});
taskReset.addEventListener("click", () => {
  setTask("needsApproval");
  $("[data-answer='yes']", taskActions).focus();
});

/* Anéis de fala estáticos do capítulo 6 */
const replyRings = $(".reply .rings");
let replyTimer = 0;
function replyPulse(on) {
  if (reducedMotion) return;
  if (on && !replyTimer) {
    replyTimer = setInterval(() => {
      replyRings.classList.add("pulse");
      setTimeout(() => replyRings.classList.remove("pulse"), 130);
    }, 280);
  } else if (!on && replyTimer) {
    clearInterval(replyTimer);
    replyTimer = 0;
  }
}

/* Voz: a mesma máquina de estados e os mesmos textos do app */
const voiceEl = $("#voice");
const voiceTitle = $("#voice-title");
const voiceSub = $("#voice-sub");
const voiceBtn = $("#voice-btn");
const voiceLabel = $("#voice-label");
const voiceRings = $("#rings");
const wave = $("#wave");
const bars = Array.from({ length: 17 }, (_, i) => {
  const b = document.createElement("i");
  b.style.opacity = String(0.45 + 0.55 * (1 - Math.abs(i - 8) / 9));
  wave.append(b);
  return b;
});
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const WAKE = /\b(jarvis|jarves|jarbas|djarvis|jarvi)\b/i;

const voice = {
  state: "idle",
  simulated: !SpeechRecognition,
  rec: null,
  stream: null,
  ctx: null,
  analyser: null,
  data: null,
  level: 0,
  timers: [],
  pulseTimer: 0,
};

const voiceCopy = (state) => t(`voice.${state}`);

const BUTTON_ICONS = {
  idle: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  armed: '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>',
  speaking: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
};
BUTTON_ICONS.awake = BUTTON_ICONS.armed;
const voiceIcon = $("svg", voiceBtn);

function setVoice(state, sub) {
  voice.state = state;
  voiceEl.dataset.state = state;
  document.body.dataset.voice = state;
  const [title, fallback, button] = voiceCopy(state);
  voiceTitle.textContent = title;
  voiceSub.textContent = sub ?? fallback;
  voiceLabel.textContent = button;
  voiceIcon.innerHTML = BUTTON_ICONS[state];
  glasses?.setLed(state === "awake" || state === "speaking");
  if (state === "awake") glasses?.react("perk");
}

function later(fn, ms) {
  voice.timers.push(setTimeout(fn, ms));
}
function clearTimers() {
  voice.timers.forEach(clearTimeout);
  voice.timers = [];
  clearInterval(voice.pulseTimer);
  voice.pulseTimer = 0;
}

async function openMic() {
  try {
    const ask = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    let timedOut = false;
    const timeout = new Promise((_, reject) => setTimeout(() => {
      timedOut = true;
      reject(new Error("timeout"));
    }, 8000));
    ask.then((s) => timedOut && s.getTracks().forEach((t) => t.stop()), () => {});
    voice.stream = await Promise.race([ask, timeout]);
    voice.ctx = new AudioContext();
    const src = voice.ctx.createMediaStreamSource(voice.stream);
    voice.analyser = voice.ctx.createAnalyser();
    voice.analyser.fftSize = 1024;
    voice.data = new Float32Array(voice.analyser.fftSize);
    src.connect(voice.analyser);
    return true;
  } catch {
    return false;
  }
}

function closeMic() {
  voice.stream?.getTracks().forEach((t) => t.stop());
  voice.ctx?.close();
  voice.stream = voice.ctx = voice.analyser = null;
}

function startRecognition() {
  const rec = new SpeechRecognition();
  rec.lang = speechLang();
  rec.continuous = true;
  rec.interimResults = true;
  let commandTimer = 0;
  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = final || e.results[i].isFinal;
    }
    if (voice.state === "armed" && WAKE.test(text)) {
      setVoice("awake");
      text = text.split(WAKE).pop();
    }
    if (voice.state !== "awake") return;
    const command = text.replace(WAKE, "").replace(/^[\s,.]+/, "").trim();
    if (command) voiceSub.textContent = command;
    clearTimeout(commandTimer);
    commandTimer = setTimeout(() => respond(command), final ? 700 : 2200);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted" || voice.rec !== rec) return;
    voice.rec = null;
    voice.simulated = true;
    if (voice.state === "armed") {
      voiceSub.textContent = t("voice.noSpeech");
      simulate();
    }
  };
  rec.onend = () => {
    if (voice.rec === rec && (voice.state === "armed" || voice.state === "awake")) {
      try { rec.start(); } catch { /* já reiniciado */ }
    }
  };
  rec.start();
  voice.rec = rec;
}

function respond(command) {
  if (voice.state !== "awake") return;
  const reply = command
    ? t("voice.understood").replace("{command}", command)
    : t("voice.yes");
  setVoice("speaking", reply);
  const words = reply.split(/\s+/).length;
  if (!reducedMotion) {
    voice.pulseTimer = setInterval(() => {
      voiceRings.classList.add("pulse");
      setTimeout(() => voiceRings.classList.remove("pulse"), 120);
    }, 260);
  }
  later(() => {
    clearInterval(voice.pulseTimer);
    voice.pulseTimer = 0;
    if (voice.state === "speaking") setVoice("armed");
    if (voice.simulated) later(() => voice.state === "armed" && stopVoice(), 2400);
  }, Math.max(2200, words * 330));
}

function simulate() {
  later(() => voiceSub.textContent = t("voice.wake"), 1300);
  later(() => setVoice("awake"), 1800);
  const cmd = t("voice.demo");
  cmd.split(" ").forEach((_, i, arr) => later(() => {
    if (voice.state === "awake") voiceSub.textContent = arr.slice(0, i + 1).join(" ");
  }, 2600 + i * 240));
  later(() => respond(cmd), 2600 + cmd.split(" ").length * 240 + 700);
}

async function startVoice() {
  setVoice("armed", t("voice.mic"));
  const mic = await openMic();
  if (!mic) voice.simulated = true;
  setVoice("armed", voice.simulated ? t("voice.sim") : undefined);
  if (voice.simulated) simulate();
  else startRecognition();
  requestAnimationFrame(waveLoop);
}

function stopVoice() {
  clearTimers();
  const rec = voice.rec;
  voice.rec = null;
  try { rec?.abort(); } catch { /* já parado */ }
  closeMic();
  setVoice("idle");
}

voiceBtn.addEventListener("click", () => {
  if (voice.state === "idle") startVoice();
  else if (voice.state === "speaking") {
    clearTimers();
    setVoice("armed");
    if (voice.simulated) stopVoice();
  } else stopVoice();
});

function readLevel(now) {
  let level = 0;
  if (voice.analyser) {
    voice.analyser.getFloatTimeDomainData(voice.data);
    let sum = 0;
    for (const v of voice.data) sum += v * v;
    const rms = Math.sqrt(sum / voice.data.length);
    level = Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-6) + 55) / 40));
  }
  if (voice.state === "awake" && voice.simulated) {
    level = Math.max(level, 0.35 + 0.4 * Math.abs(Math.sin(now / 130) * Math.sin(now / 370)));
  }
  return level;
}

function waveLoop(now) {
  const active = voice.state === "armed" || voice.state === "awake";
  const raw = active ? readLevel(now) : 0;
  voice.level += (raw - voice.level) * (raw > voice.level ? 0.6 : 0.15);
  bars.forEach((b, i) => {
    const d = Math.abs(i - 8) / 8;
    let h;
    if (!active) h = 5 + (1 - d) * 12;
    else if (reducedMotion) h = 5 + (1 - d) * 20;
    else h = 5 + 54 * voice.level * Math.exp(-Math.pow(d / 0.6, 2));
    b.style.height = `${h.toFixed(1)}px`;
  });
  if (active || voice.level > 0.01) requestAnimationFrame(waveLoop);
}
waveLoop(0);

/* 3D: carregado à parte para a página continuar funcionando se o CDN ou o WebGL falharem */
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function showFallback() {
  document.body.classList.add("no-3d");
  $("#stage").hidden = true;
  $("#stage-fallback").hidden = false;
}

function copyText(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

$$("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = t(`prompts.${btn.dataset.copy}`);
    const label = $("span", btn);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = copyText(text);
    }
    label.textContent = t(ok ? "prompts.copied" : "prompts.failed");
    btn.dataset.copied = ok ? "1" : "0";
    if (!ok) btn.closest(".prompt-card")?.querySelector("details")?.setAttribute("open", "");
    setTimeout(() => { label.textContent = t("prompts.copy"); }, 1600);
  });
});

function paintPrompts() {
  $$("[data-prompt-view]").forEach((el) => {
    el.textContent = t(`prompts.${el.dataset.promptView}`);
  });
}

initLang();
paintPrompts();
mountSaid();
setTask("needsApproval");
setVoice("idle");
onLang(() => {
  paintPrompts();
  mountSaid();
  revealSentence();
  if (termStarted) typeTerminal(termAgent);
  setTask(task.dataset.status || "needsApproval");
  const [title, fallback, button] = voiceCopy(voice.state);
  voiceTitle.textContent = title;
  voiceLabel.textContent = button;
  if (voice.state === "idle") voiceSub.textContent = fallback;
});

measure();
onScroll(true);

if (hasWebGL()) {
  import("./glasses.js?v=4")
    .then(({ createGlasses }) => {
      glasses = createGlasses($("#stage"), { reducedMotion });
      glasses.setTarget(poseAt(chapterT), { snap: true });
      glasses.start();
      requestAnimationFrame(calloutLoop);
    })
    .catch((err) => {
      console.warn("Jarvis: modelo 3D indisponível", err);
      showFallback();
    });
} else {
  showFallback();
}

window.addEventListener("load", () => {
  measure();
  onScroll();
});
