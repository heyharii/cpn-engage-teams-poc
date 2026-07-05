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
import { initDb, listConversations } from "./db.ts";
import { pushCardToAll } from "./proactive.ts";
import { getBootstrap } from "./api.ts";
import { firstAssignedModule } from "./content.ts";
import { ChallengeReminderCard, ModuleAssignedCard } from "./cards/index.ts";
import { captureFromRawActivity } from "./install-capture.ts";
import { installAppForUsers } from "./graph.ts";
import { enrichAll } from "./enrich.ts";
import { syncDirectory } from "./directory.ts";
import { startScheduler, scheduleTestPush } from "./scheduler.ts";

const app = express();

// Bot Framework sends JSON; the adapter needs the raw body for signature
// verification, so capture it raw for all content types.
app.use(express.raw({ type: "*/*", limit: "5mb" }));

app.get("/", (_req, res) => {
  res.json({ status: "ok", bot: "CPN Engage", webhook: "/api/messages" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "notification-bot" });
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
 *   POST /internal/push?type=challenge|module   (header x-push-token if PUSH_TOKEN set)
 * This is the manual "send now"; the scheduled (cron) path reuses pushCardToAll.
 */
app.post("/internal/push", async (req, res) => {
  const required = process.env.PUSH_TOKEN?.trim();
  if (required && req.headers["x-push-token"] !== required) {
    return res.status(401).json({ ok: false, error: "bad push token" });
  }
  const type = String(req.query.type ?? "challenge");
  const boot = await getBootstrap();
  const card =
    type === "module"
      ? (() => {
          const m = firstAssignedModule();
          return ModuleAssignedCard({ moduleId: m.id, title: m.title, track: m.track, durationMin: m.durationMin });
        })()
      : ChallengeReminderCard({
          behavior: boot.dailyDrop.behavior,
          reward: boot.dailyDrop.rewardLabel,
          timeLimit: boot.dailyDrop.timeLimit
        });
  const result = await pushCardToAll(card);
  console.log(`[push] type=${type} sent=${result.sent}/${result.total}`);
  res.json({ ok: true, type, ...result });
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
await startScheduler();

app.listen(config.port, () => {
  console.log(`✅ CPN Engage bot on http://localhost:${config.port}`);
  console.log(`   → Teams webhook: POST /api/messages  (appType=${config.teams.appType})`);
  console.log(`   → API base: ${config.apiBaseUrl}`);
});
