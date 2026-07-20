/**
 * HTTP entry point for the CPN Engage Teams bot.
 *
 *   GET  /                  sanity check
 *   GET  /health            liveness probe (Render health check)
 *   POST /api/messages      Bot Framework webhook → chat SDK (Teams messaging
 *                           endpoint configured in the Azure Bot resource)
 *   POST /internal/notify   internal notification relay from the CPN API
 *                           (accepted + logged; proactive push is future work)
 *
 * The Teams webhook is a thin adapter between Express and the Fetch-style
 * request/response the chat SDK expects.
 */

import express from "express";
import { bot } from "./bot.ts";
import { config } from "./config.ts";
import { state } from "./state.ts";
import { initDb, listConversations, listDirectory, recordBroadcast } from "./db.ts";
import { pushCardToAll } from "./proactive.ts";
import { getBootstrap } from "./api.ts";
import { firstAssignedModule, getModule } from "./content.ts";
import { ChallengeReminderCard, ModuleAssignedCard } from "./cards/index.ts";
import { captureFromRawActivity } from "./install-capture.ts";
import { installAppForUsers } from "./graph.ts";
import { enrichAll } from "./enrich.ts";
import { syncDirectory } from "./directory.ts";
import { refreshModules } from "./content.ts";
import { startScheduler, scheduleTestPush, scheduleBroadcast, listScheduled, cancelScheduled, applyDailySchedule } from "./scheduler.ts";

const app = express();

// CORS — the Admin Console (a separate web origin) calls the /internal/* ops
// endpoints from the browser. Allow the configured admin origin (or * for POC).
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.ADMIN_ORIGIN?.trim() || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-push-token, x-admin-key");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

/**
 * Ops authorization for /internal/*. Accepts the admin key (from the console)
 * or the push token (server-to-server). Fail-closed in production when a key is
 * configured; open in dev when neither is set. Read endpoints and writes both
 * use this so the roster/sync/broadcast surface isn't world-readable.
 */
const ADMIN_KEY = process.env.ADMIN_KEY?.trim() ?? "";
const PUSH_TOKEN = process.env.PUSH_TOKEN?.trim() ?? "";
function opsAuthorized(req: express.Request): boolean {
  if (!ADMIN_KEY && !PUSH_TOKEN) return process.env.NODE_ENV !== "production";
  const adminHdr = String(req.headers["x-admin-key"] ?? "");
  const pushHdr = String(req.headers["x-push-token"] ?? "");
  return (Boolean(ADMIN_KEY) && adminHdr === ADMIN_KEY) || (Boolean(PUSH_TOKEN) && pushHdr === PUSH_TOKEN);
}
app.use((req, res, next) => {
  if (req.path.startsWith("/internal/") && !opsAuthorized(req)) {
    res.status(401).json({ ok: false, error: "unauthorized (x-admin-key or x-push-token required)" });
    return;
  }
  next();
});

// Bot Framework sends JSON; the adapter needs the raw body for signature
// verification, so capture it raw for all content types.
app.use(express.raw({ type: "*/*", limit: "5mb" }));

app.get("/", (_req, res) => {
  res.json({ status: "ok", bot: "CPN Engage", webhook: "/api/messages" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "notification-bot" });
});

app.get("/version", (_req, res) => {
  res.json({ service: "notification-bot", version: process.env.APP_VERSION ?? "dev", commit: process.env.GIT_SHA ?? null });
});

// Internal relay from the CPN API. Not a Bot Framework activity — just log it.
app.post("/internal/notify", (req, res) => {
  try {
    const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body ?? "");
    console.log("[notify]", body.slice(0, 500));
  } catch {
    /* ignore */
  }
  res.status(202).json({ ok: true });
});

// How many users we can proactively reach (+ resolved identity once enriched).
app.get("/internal/audience", async (_req, res) => {
  const refs = await listConversations();
  res.json({
    ok: true,
    count: refs.length,
    users: refs.map((r) => ({
      name: r.userName ?? r.userId,
      jobTitle: r.jobTitle ?? null,
      department: r.department ?? null
    }))
  });
});

/**
 * Full user roster for the admin Users view: every directory user (from the
 * Graph sync) merged with captured conversations, so admins can see who is
 * reachable vs not yet. Falls back to conversations-only when the directory
 * hasn't been synced (e.g. local demo without Graph credentials).
 */
app.get("/internal/users", async (_req, res) => {
  const [dir, refs] = await Promise.all([listDirectory(), listConversations()]);
  const reachedOids = new Set(refs.map((r) => r.userId).filter(Boolean));
  const reachedNames = new Set(refs.map((r) => r.userName?.trim().toLowerCase()).filter(Boolean));

  const users = dir.map((u) => ({
    oid: u.oid,
    name: u.displayName ?? u.email ?? u.oid,
    email: u.email,
    jobTitle: u.jobTitle,
    department: u.department,
    enabled: u.accountEnabled !== false,
    reachable: reachedOids.has(u.oid) || reachedNames.has((u.displayName ?? "").trim().toLowerCase())
  }));

  // Conversations with no directory match (demo users, pre-sync captures).
  const dirOids = new Set(dir.map((u) => u.oid));
  const dirNames = new Set(dir.map((u) => (u.displayName ?? "").trim().toLowerCase()));
  for (const r of refs) {
    const matched =
      (r.userId && dirOids.has(r.userId)) ||
      (r.userName && dirNames.has(r.userName.trim().toLowerCase()));
    if (!matched) {
      users.push({
        oid: r.userId ?? r.threadId,
        name: r.userName ?? r.userId ?? "Unknown user",
        email: null,
        jobTitle: r.jobTitle ?? null,
        department: r.department ?? null,
        enabled: true,
        reachable: true
      });
    }
  }

  users.sort((a, b) => a.name.localeCompare(b.name));
  res.json({
    ok: true,
    directoryCount: dir.length,
    reachableCount: users.filter((u) => u.reachable).length,
    users
  });
});

// Sync the Microsoft directory into Postgres (people picker + segmentation).
app.post("/internal/sync-directory", async (req, res) => {
  const required = process.env.PUSH_TOKEN?.trim();
  if (required && req.headers["x-push-token"] !== required) {
    return res.status(401).json({ ok: false, error: "bad push token" });
  }
  const result = await syncDirectory();
  res.json({ ok: !result.error, ...result });
});

// Enrich captured conversations with name + job title + department.
app.post("/internal/enrich", async (req, res) => {
  const required = process.env.PUSH_TOKEN?.trim();
  if (required && req.headers["x-push-token"] !== required) {
    return res.status(401).json({ ok: false, error: "bad push token" });
  }
  const result = await enrichAll();
  res.json({ ok: true, ...result });
});

/**
 * Admin-triggered proactive PUSH. Sends a card to every captured conversation.
 *   POST /internal/push?type=challenge|module[&moduleId=…]
 *   (header x-push-token if PUSH_TOKEN set)
 * This is the manual "send now"; the scheduled (cron) path reuses pushCardToAll.
 */
app.post("/internal/push", async (req, res) => {
  const required = process.env.PUSH_TOKEN?.trim();
  if (required && req.headers["x-push-token"] !== required) {
    return res.status(401).json({ ok: false, error: "bad push token" });
  }
  const type = String(req.query.type ?? "challenge");
  const moduleId = typeof req.query.moduleId === "string" ? req.query.moduleId : null;
  const boot = await getBootstrap();
  if (type === "module") {
    // Refresh so a just-authored module is pushable immediately.
    await refreshModules();
  }
  const card =
    type === "module"
      ? (() => {
          const m = (moduleId ? getModule(moduleId) : null) ?? firstAssignedModule();
          return ModuleAssignedCard({ moduleId: m.id, title: m.title, track: m.track, durationMin: m.durationMin });
        })()
      : ChallengeReminderCard({
          behavior: boot.dailyDrop.behavior,
          reward: boot.dailyDrop.rewardLabel,
          timeLimit: boot.dailyDrop.timeLimit
        });
  const result = await pushCardToAll(card);
  const label =
    type === "module"
      ? (moduleId ? getModule(moduleId)?.title : firstAssignedModule().title) ?? "Module"
      : boot.dailyDrop.behavior;
  await recordBroadcast({ kind: type, label, sent: result.sent, total: result.total });
  console.log(`[push] type=${type}${moduleId ? ` moduleId=${moduleId}` : ""} sent=${result.sent}/${result.total}`);
  res.json({ ok: true, type, ...result });
});

// Recent broadcast history (from the shared broadcasts table).
app.get("/internal/broadcasts", async (_req, res) => {
  const { sql } = await import("./db.ts");
  if (!sql) return res.json({ ok: true, broadcasts: [] });
  try {
    const rows = await sql`select kind, label, sent, total, created_at from broadcasts order by created_at desc limit 20`;
    res.json({ ok: true, broadcasts: [...rows] });
  } catch {
    res.json({ ok: true, broadcasts: [] });
  }
});

/**
 * Graph proactive-install — install the app for employees so they get captured
 * (and can be DM'd) without ever opening it. Needs Graph app permissions +
 * admin consent on the bot's app registration.
 *   POST /internal/install   body { "userIds": ["<aadObjectId>", ...] }
 */
app.post("/internal/install", async (req, res) => {
  const required = process.env.PUSH_TOKEN?.trim();
  if (required && req.headers["x-push-token"] !== required) {
    return res.status(401).json({ ok: false, error: "bad push token" });
  }
  let userIds: string[] = [];
  try {
    const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
    userIds = Array.isArray(body?.userIds) ? body.userIds : [];
  } catch {
    /* ignore */
  }
  if (!userIds.length) return res.status(400).json({ ok: false, error: "provide userIds: [aadObjectId,...]" });
  const result = await installAppForUsers(userIds);
  console.log(`[install] ${JSON.stringify(result)}`);
  res.json({ ok: !result.error, ...result });
});

// Demo the scheduler: fire a one-off proactive push after N seconds (default 30).
app.post("/internal/schedule-test", async (req, res) => {
  const required = process.env.PUSH_TOKEN?.trim();
  if (required && req.headers["x-push-token"] !== required) {
    return res.status(401).json({ ok: false, error: "bad push token" });
  }
  const seconds = Number(req.query.seconds ?? 30);
  const ok = await scheduleTestPush(seconds);
  res.json({ ok, scheduledInSeconds: ok ? seconds : null, note: ok ? "watch your DM" : "scheduler not running (no DATABASE_URL)" });
});

// Schedule a real broadcast for a future time (challenge or a specific module).
app.post("/internal/schedule", async (req, res) => {
  let body: { type?: "challenge" | "module"; moduleId?: string; label?: string; at?: string } = {};
  try {
    body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
  } catch {
    /* ignore */
  }
  if (!body.at) return res.status(400).json({ ok: false, error: "at (ISO time) required" });
  const result = await scheduleBroadcast({
    type: body.type === "module" ? "module" : "challenge",
    moduleId: body.moduleId ?? null,
    label: body.label ?? null,
    at: body.at
  });
  res.status(result.ok ? 200 : 400).json(result);
});

// Re-apply the daily-drop schedule after the admin changed the time/tz.
app.post("/internal/reschedule", async (_req, res) => {
  const r = await applyDailySchedule();
  res.json({ ok: true, ...r });
});

// List upcoming scheduled broadcasts.
app.get("/internal/scheduled", async (_req, res) => {
  res.json({ ok: true, scheduled: await listScheduled() });
});

// Cancel a scheduled broadcast.
app.post("/internal/scheduled/:id/cancel", async (req, res) => {
  const ok = await cancelScheduled(req.params.id);
  res.json({ ok });
});

app.post("/api/messages", async (req, res) => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    // Capture conversation refs from install / bot-added events (before any chat).
    void captureFromRawActivity(buf.toString("utf8"));
    const url = `http://localhost:${config.port}${req.path}`;
    const body = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const request = new Request(url, { method: "POST", headers, body: body as unknown as BodyInit });

    const response = await bot.webhooks.teams(request);
    const text = await response.text();
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status).send(text || "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook/teams]", msg);
    res.status(500).json({ error: msg });
  }
});

// Connect the per-thread state store + the proactive DB + scheduler up front.
await state.connect();
await initDb();
await refreshModules();
await startScheduler();

app.listen(config.port, () => {
  console.log(`✅ CPN Engage bot on http://localhost:${config.port}`);
  console.log(`   → Teams webhook: POST /api/messages  (appType=${config.teams.appType})`);
  console.log(`   → API base: ${config.apiBaseUrl}`);
});
