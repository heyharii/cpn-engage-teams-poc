/**
 * Generates an Excalidraw diagram of the on-premise architecture (the deploy
 * package shipped to CPN). Open / import at https://excalidraw.com.
 *
 *   node scripts/gen-architecture-excalidraw.mjs
 */
import fs from "node:fs";

let idc = 0;
const nid = (p) => `${p}-${++idc}`;
const els = [];
const BASE = {
  angle: 0, strokeColor: "#1e1e1e", fillStyle: "solid", strokeWidth: 2,
  strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null,
  roundness: { type: 3 }, seed: 1, version: 1, versionNonce: 1, isDeleted: false,
  boundElements: [], updated: 1, link: null, locked: false
};

function zone(x, y, w, h, label, color) {
  const id = nid("zone");
  els.push({ ...BASE, type: "rectangle", id, x, y, width: w, height: h,
    backgroundColor: "transparent", strokeColor: color, strokeStyle: "dashed", strokeWidth: 2,
    roundness: { type: 3 } });
  els.push({ ...BASE, type: "text", id: nid("zt"), x: x + 14, y: y + 10, width: w - 28, height: 24,
    backgroundColor: "transparent", roundness: null, strokeColor: color, text: label,
    fontSize: 18, fontFamily: 1, textAlign: "left", verticalAlign: "top",
    containerId: null, originalText: label, lineHeight: 1.25 });
}

function box(x, y, w, h, label, bg, sub = "") {
  const id = nid("rect");
  const tId = nid("text");
  const t = sub ? `${label}\n${sub}` : label;
  els.push({ ...BASE, type: "rectangle", id, x, y, width: w, height: h,
    backgroundColor: bg, boundElements: [{ type: "text", id: tId }] });
  els.push({ ...BASE, type: "text", id: tId, x: x + 6, y: y + h / 2 - 12, width: w - 12, height: 24,
    backgroundColor: "transparent", roundness: null, text: t, fontSize: 14, fontFamily: 1,
    textAlign: "center", verticalAlign: "middle", containerId: id, originalText: t, lineHeight: 1.2 });
  return { id, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function arrow(a, b, label = "", opts = {}) {
  const sx = opts.sx ?? a.cx, sy = opts.sy ?? a.y + a.h;
  const ex = opts.ex ?? b.cx, ey = opts.ey ?? b.y;
  const id = nid("arrow");
  els.push({ ...BASE, type: "arrow", id, x: sx, y: sy, width: ex - sx, height: ey - sy,
    backgroundColor: "transparent", roundness: { type: 2 }, strokeStyle: opts.dashed ? "dashed" : "solid",
    strokeColor: opts.color ?? "#1e1e1e",
    points: [[0, 0], [ex - sx, ey - sy]],
    startBinding: { elementId: a.id, focus: 0, gap: 4 }, endBinding: { elementId: b.id, focus: 0, gap: 4 },
    startArrowhead: opts.double ? "arrow" : null, endArrowhead: "arrow" });
  if (label) {
    els.push({ ...BASE, type: "text", id: nid("lbl"), x: (sx + ex) / 2 - label.length * 3.2,
      y: (sy + ey) / 2 - 9, width: label.length * 7, height: 18, backgroundColor: "#ffffff",
      roundness: null, strokeColor: opts.color ?? "#1971c2", text: label, fontSize: 12, fontFamily: 3,
      textAlign: "center", verticalAlign: "top", containerId: null, originalText: label, lineHeight: 1.25 });
  }
}

function title(x, y, text) {
  els.push({ ...BASE, type: "text", id: nid("h"), x, y, width: text.length * 11, height: 30,
    backgroundColor: "transparent", roundness: null, text, fontSize: 22, fontFamily: 1,
    textAlign: "left", verticalAlign: "top", containerId: null, originalText: text, lineHeight: 1.25 });
}

const BLUE = "#a5d8ff", GREEN = "#b2f2bb", YEL = "#ffec99", VIOLET = "#d0bfff";

title(40, 20, "CPN Engage — On-Premise Architecture");

// Zones (drawn first = behind)
zone(40, 70, 1120, 150, "Microsoft Cloud  (di luar kendali kita)", "#1971c2");
zone(40, 260, 1120, 430, "On-Premise  —  CPN datacenter  (1 docker-compose)", "#2f9e44");

// Cloud nodes
const teams = box(90, 110, 230, 80, "Microsoft Teams", BLUE, "karyawan: Chat + tab");
const aad = box(560, 110, 200, 80, "Azure AD", BLUE, "SSO / identity");
const graph = box(840, 110, 260, 80, "Microsoft Graph", BLUE, "department · email");

// On-prem: edge
const caddy = box(90, 320, 200, 80, "Caddy", VIOLET, "TLS · reverse proxy");

// On-prem: app tier
const bot = box(360, 300, 180, 64, "Bot", GREEN, "Bot Framework");
const api = box(360, 386, 180, 56, "API", GREEN);
const tabs = box(360, 462, 180, 64, "Tabs (static)", GREEN, "Profile · Feeds");
const admin = box(360, 548, 180, 56, "Admin web", GREEN);

// On-prem: data tier
const pg = box(640, 320, 280, 96, "PostgreSQL", YEL, "data + pg-boss\ncron · queue · retry · DLQ");
const minio = box(640, 470, 280, 76, "MinIO", YEL, "foto/video recognition");

// Edge wiring
arrow(teams, caddy, "HTTPS publik", { color: "#e8590c", double: true, sx: teams.cx, sy: teams.y + teams.h, ex: caddy.cx, ey: caddy.y });
arrow(caddy, bot, "", { sx: caddy.x + caddy.w, sy: caddy.cy, ex: bot.x, ey: bot.cy });
arrow(caddy, api, "", { sx: caddy.x + caddy.w, sy: caddy.cy + 10, ex: api.x, ey: api.cy });
arrow(caddy, tabs, "", { sx: caddy.x + caddy.w, sy: caddy.cy + 20, ex: tabs.x, ey: tabs.cy });
arrow(caddy, admin, "", { sx: caddy.x + caddy.w, sy: caddy.cy + 30, ex: admin.x, ey: admin.cy });

// App → data
arrow(api, pg, "", { sx: api.x + api.w, sy: api.cy, ex: pg.x, ey: pg.cy });
arrow(bot, pg, "", { sx: bot.x + bot.w, sy: bot.cy, ex: pg.x, ey: pg.y + 20 });
arrow(bot, minio, "media", { sx: bot.x + bot.w, sy: bot.cy + 20, ex: minio.x, ey: minio.cy });

// Scheduled push: pg-boss -> bot -> teams
arrow(pg, bot, "push terjadwal", { color: "#2f9e44", sx: pg.x, sy: pg.y + pg.h - 10, ex: bot.x + bot.w, ey: bot.y + bot.h });

// Identity: bot/api -> Azure AD + Graph (cloud)
arrow(bot, aad, "SSO validate", { dashed: true, color: "#1971c2", sx: bot.cx, sy: bot.y, ex: aad.cx, ey: aad.y + aad.h });
arrow(api, graph, "department", { dashed: true, color: "#1971c2", sx: api.cx + 30, sy: api.y, ex: graph.x, ey: graph.y + graph.h });

const doc = {
  type: "excalidraw", version: 2, source: "cpn-engage", elements: els,
  appState: { gridSize: null, viewBackgroundColor: "#ffffff" }, files: {}
};
const out = new URL("../docs/architecture-onprem.excalidraw", import.meta.url).pathname;
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`Wrote ${out} (${els.length} elements)`);
