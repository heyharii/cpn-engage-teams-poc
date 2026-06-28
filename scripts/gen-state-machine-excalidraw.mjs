/**
 * Generates an Excalidraw (.excalidraw) diagram of the bot conversation state
 * machine. Open / import the output at https://excalidraw.com.
 *
 *   node scripts/gen-state-machine-excalidraw.mjs
 */
import fs from "node:fs";

let idc = 0;
const nid = (p) => `${p}-${++idc}`;
const els = [];

const BASE = {
  angle: 0,
  strokeColor: "#1e1e1e",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: { type: 3 },
  seed: 1,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  boundElements: [],
  updated: 1,
  link: null,
  locked: false
};

function box(x, y, w, h, label, bg, sub = "") {
  const id = nid("rect");
  const tId = nid("text");
  els.push({
    ...BASE,
    type: "rectangle",
    id,
    x,
    y,
    width: w,
    height: h,
    backgroundColor: bg,
    boundElements: [{ type: "text", id: tId }]
  });
  els.push({
    ...BASE,
    type: "text",
    id: tId,
    x: x + 6,
    y: y + h / 2 - 12,
    width: w - 12,
    height: 24,
    backgroundColor: "transparent",
    roundness: null,
    text: sub ? `${label}\n${sub}` : label,
    fontSize: 15,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: id,
    originalText: sub ? `${label}\n${sub}` : label,
    lineHeight: 1.25
  });
  return { id, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function arrow(a, b, label = "", opts = {}) {
  // connect right-edge of a → left-edge of b by default
  const sx = opts.sx ?? a.x + a.w;
  const sy = opts.sy ?? a.cy;
  const ex = opts.ex ?? b.x;
  const ey = opts.ey ?? b.cy;
  const id = nid("arrow");
  els.push({
    ...BASE,
    type: "arrow",
    id,
    x: sx,
    y: sy,
    width: ex - sx,
    height: ey - sy,
    backgroundColor: "transparent",
    roundness: { type: 2 },
    points: [
      [0, 0],
      [ex - sx, ey - sy]
    ],
    startBinding: { elementId: a.id, focus: 0, gap: 4 },
    endBinding: { elementId: b.id, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow"
  });
  if (label) {
    els.push({
      ...BASE,
      type: "text",
      id: nid("lbl"),
      x: (sx + ex) / 2 - label.length * 3.4,
      y: (sy + ey) / 2 - 22,
      width: label.length * 7,
      height: 18,
      backgroundColor: "transparent",
      roundness: null,
      strokeColor: "#1971c2",
      text: label,
      fontSize: 12,
      fontFamily: 3,
      textAlign: "center",
      verticalAlign: "top",
      containerId: null,
      originalText: label,
      lineHeight: 1.25
    });
  }
}

function title(x, y, text, color = "#1e1e1e") {
  els.push({
    ...BASE,
    type: "text",
    id: nid("h"),
    x,
    y,
    width: text.length * 10,
    height: 28,
    backgroundColor: "transparent",
    roundness: null,
    strokeColor: color,
    text,
    fontSize: 20,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: text,
    lineHeight: 1.25
  });
}

const BLUE = "#a5d8ff";
const YEL = "#ffec99";
const GREEN = "#b2f2bb";
const GRAY = "#e9ecef";
const RED = "#ffc9c9";

const W = 150;
const H = 60;

// ── Title ─────────────────────────────────────────────────────────────
title(40, 24, "CPN Engage — Bot Conversation State Machine");

// ── Idle / menu entry ─────────────────────────────────────────────────
const idle = box(40, 300, 120, 64, "idle", GRAY, "(menu)");

// ── Learning Journey lane (Feature 1) ────────────────────────────────
title(220, 90, "Feature 1 · Learning Journey", "#1971c2");
const intro = box(220, 120, W, H, "Module intro", BLUE);
const video = box(220 + 1 * 210, 120, W, H, "Video lesson", BLUE);
const text = box(220 + 2 * 210, 120, W, H, "Text lesson", BLUE);
const quiz = box(220 + 3 * 210, 120, W, H, "Quiz Q(i)", BLUE, "step quiz");
const complete = box(220 + 4 * 210, 120, W, H, "Module complete", BLUE, "score X/n");

arrow(idle, intro, "start_module");
arrow(intro, video, "begin_module");
arrow(video, text, "watched_video");
arrow(text, quiz, "lesson_done");
// quiz self-loop (next question)
arrow(quiz, quiz, "quiz_answer → next Q", {
  sx: quiz.x + quiz.w - 30,
  sy: quiz.y,
  ex: quiz.x + 30,
  ey: quiz.y
});
arrow(quiz, complete, "last Q");
arrow(complete, idle, "done", {
  sx: complete.cx,
  sy: complete.y + complete.h,
  ex: idle.cx,
  ey: idle.y
});

// ── Challenge lane (Feature 2) ───────────────────────────────────────
title(220, 250, "Feature 2 · Challenge", "#e8590c");
const chal = box(220, 280, W, H, "Challenge (MCQ)", YEL);
const result = box(220 + 210, 280, W, H, "Answer result", YEL, "+points");
arrow(idle, chal, "daily_challenge", { sx: idle.x + idle.w, sy: idle.cy, ex: chal.x, ey: chal.cy });
arrow(chal, result, "submit_answer");

// ── Recognition lane (Feature 3) ─────────────────────────────────────
title(220, 410, "Feature 3 · Recognition", "#2f9e44");
const who = box(220, 440, W, H, "Who?", GREEN, "text");
const belief = box(220 + 1 * 210, 440, W, H, "Pick Belief", GREEN, "button");
const desc = box(220 + 2 * 210, 440, W, H, "Describe", GREEN, "text");
const media = box(220 + 3 * 210, 440, W, H, "Add media?", GREEN, "skip / file");
const confirm = box(220 + 4 * 210, 440, W, H, "Confirm", GREEN);
const sent = box(220 + 5 * 210, 440, W, H, "Sent → queue", GREEN);
arrow(idle, who, "recognise", { sx: idle.cx, sy: idle.y + idle.h, ex: who.x, ey: who.cy });
arrow(who, belief, "name");
arrow(belief, desc, "recognise_belief");
arrow(desc, media, "description");
arrow(media, confirm, "skip_media");
arrow(confirm, sent, "recognise_send");
arrow(sent, idle, "clear", { sx: sent.cx, sy: sent.y + sent.h, ex: idle.cx, ey: idle.y + idle.h - 6 });

// ── Edge-case guards box ─────────────────────────────────────────────
title(220, 560, "Edge cases (no-AI robustness)", "#c92a2a");
const stale = box(220, 600, 330, 90,
  "STALE button (old card)",
  RED,
  "state guard → 'pick up where you are'\nresume re-renders current step · idempotent");
const free = box(580, 600, 300, 60, "FREE TEXT", RED, "intent router → flow or menu");
const wrong = box(900, 600, 300, 60, "UNKNOWN button", RED, "catch-all → menu (never silent)");
arrow(stale, intro, "resume", { sx: stale.cx, sy: stale.y, ex: quiz.cx, ey: quiz.y + quiz.h });

const doc = {
  type: "excalidraw",
  version: 2,
  source: "cpn-engage",
  elements: els,
  appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
  files: {}
};

const out = new URL("../docs/state-machine.excalidraw", import.meta.url).pathname;
fs.mkdirSync(new URL("../docs/", import.meta.url).pathname, { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`Wrote ${out} (${els.length} elements)`);
