import cors from "@fastify/cors";
import Fastify from "fastify";
import { ssoConfigured, verifyTeamsToken } from "./sso.js";
import { initScores, recordScore, computeLeaderboard, userScore, clearScores } from "./scores.js";
import { initModules, listModules, upsertModule, deleteModule } from "./modules.js";
import {
  initFeed,
  listFeed,
  listFeedPage,
  addFeedPost,
  toggleReactionDb,
  listComments,
  addComment,
  clearFeed,
  feedPersistent,
  setPostHidden
} from "./feed.js";
import { runMigrations, dbPing } from "./db.js";
import {
  initDrops,
  getActiveDrop,
  getDrop,
  listDrops,
  upsertDrop,
  activateDrop,
  deleteDrop,
  dropsEnabled
} from "./drops.js";
import { resolveIdentity } from "./identity.js";
import { requireAdmin } from "./authz.js";
import {
  touchProfile,
  completeModuleForUser,
  recordChallengeRun,
  getMyState
} from "./users.js";
import type { ModuleContent, DailyDrop } from "@cpn-engage/shared";
import {
  demoBootstrap,
  demoScenarios,
  type BootstrapResponse,
  type DemoScenarioName,
  type NotificationItem,
  type NotificationRequest,
  type RecognitionQueueItem,
  type RecognitionSubmissionInput
} from "@cpn-engage/shared";

const app = Fastify({ logger: true });
let notificationSequence = 0;

// CORS: exact-origin allowlist in production (ALLOWED_ORIGINS, comma-separated);
// reflect any origin in dev so local tabs on various ports just work.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
await app.register(cors, {
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key", "x-cpn-guest"]
});

// Gate every /api/admin/* route behind the admin key (fail-closed in prod).
app.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/api/admin/")) {
    if (!requireAdmin(request, reply)) return reply; // reply already sent
  }
});

let state: BootstrapResponse = structuredClone(demoBootstrap);

function cloneDemoState() {
  return structuredClone(demoBootstrap);
}

function buildRecognitionFeedItem(item: RecognitionQueueItem) {
  return {
    id: `feed-${item.id}`,
    kind: "recognition" as const,
    title: `${item.behavior} recognition`,
    summary: `${item.employee} recognized ${item.target} for living ${item.behavior}.`,
    author: item.employee,
    target: item.target,
    belief: item.behavior,
    message: item.message,
    createdAt: new Date().toISOString(),
    reactions: [] as { emoji: string; count: number }[]
  };
}

// Per-user reaction tracking (emoji → set of user oids) so a user can toggle
// their own reaction. Kept beside the feed item; counts mirror into the item.
const reactionUsers = new Map<string, Map<string, Set<string>>>();

function toggleReaction(feedId: string, emoji: string, oid: string): void {
  const item = state.feed.find((f) => f.id === feedId);
  if (!item) return;
  let byEmoji = reactionUsers.get(feedId);
  if (!byEmoji) {
    byEmoji = new Map();
    reactionUsers.set(feedId, byEmoji);
  }
  let users = byEmoji.get(emoji);
  if (!users) {
    users = new Set();
    byEmoji.set(emoji, users);
  }
  if (users.has(oid)) users.delete(oid);
  else users.add(oid);
  // Rebuild the item's reaction counts from the tracking map.
  item.reactions = [...byEmoji.entries()]
    .map(([e, set]) => ({ emoji: e, count: set.size }))
    .filter((r) => r.count > 0);
}

function appendPassportEntry(entry: {
  title: string;
  behavior: string;
  points: number;
  status: "recorded" | "completed";
}) {
  state.passport.recentEntries = [
    {
      id: `passport-${Date.now()}`,
      date: new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      }),
      ...entry
    },
    ...state.passport.recentEntries
  ].slice(0, 6);
}

function recalcStats() {
  const pendingChallenge = state.challenges.find((item) => item.status === "pending")?.title ?? "No pending challenge";

  state.passport.completion = Math.round(
    (state.passport.modulesCompleted / Math.max(state.passport.modulesTotal, 1)) * 100
  );

  state.stats = {
    ...state.stats,
    progress: state.passport.completion,
    streak: state.streakSummary.current,
    pendingChallenge
  };

  state.capstone.unlocked = state.passport.completion >= 80 || state.streakSummary.current >= 12;
}

function updateMetric(label: string, updater: (value: string, note: string) => { value?: string; note?: string }) {
  state.metrics = state.metrics.map((metric) => {
    if (metric.label !== label) {
      return metric;
    }

    const next = updater(metric.value, metric.note);
    return {
      ...metric,
      value: next.value ?? metric.value,
      note: next.note ?? metric.note
    };
  });
}

async function relayNotificationToBot(notification: NotificationItem) {
  const botBaseUrl = process.env.NOTIFICATION_BOT_URL || "http://127.0.0.1:4177";

  try {
    // /internal/notify — NOT /api/messages (that is now the Teams Bot Framework
    // webhook and would reject plain notification JSON).
    await fetch(`${botBaseUrl}/internal/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(notification)
    });
  } catch (error) {
    app.log.warn({ error }, "Unable to relay notification to bot preview service");
  }
}

function queueNotification(input: NotificationRequest): NotificationItem {
  notificationSequence += 1;
  const notification: NotificationItem = {
    id: `notif-${Date.now()}-${notificationSequence}`,
    type: input.type,
    title: input.title,
    summary: input.summary,
    audience: input.audience,
    template: input.template
  };

  state.notifications = [notification, ...state.notifications];
  void relayNotificationToBot(notification);
  return notification;
}

function triggerMorningActivation() {
  queueNotification({
    type: "module-assigned",
    title: "New learning module assigned",
    summary: `${state.modules[0]?.title ?? "Assigned module"} is ready to start today.`,
    audience: state.currentUser.id,
    template: "module-assigned"
  });

  queueNotification({
    type: "challenge-reminder",
    title: "Daily drop is ready",
    summary: `${state.dailyDrop.behavior} challenge is available for today's check-in.`,
    audience: state.currentUser.id,
    template: "daily-drop"
  });
}

function triggerRecognitionToFeed() {
  const recognition: RecognitionQueueItem = {
    id: `rec-${Date.now()}`,
    employee: "Patcharaporn K.",
    target: "Somruk T.",
    behavior: state.behaviors[3]?.name ?? "Communities",
    message: "Thank you for coordinating the tenant recovery and helping the team stay calm during a difficult handover."
  };

  state.recognitionQueue = [recognition, ...state.recognitionQueue];
  state.recognitionQueue = state.recognitionQueue.filter((item) => item.id !== recognition.id);
  state.feed = [buildRecognitionFeedItem(recognition), ...state.feed];

  updateMetric("Recognition posts", () => ({
    note: "Updated from demo recognition-to-feed scenario"
  }));

  appendPassportEntry({
    title: "Recognition contribution logged",
    behavior: recognition.behavior,
    points: 75,
    status: "recorded"
  });

  state.passport.score += 75;
  state.persona.points += 75;

  queueNotification({
    type: "recognition-approved",
    title: "Recognition approved",
    summary: `${recognition.target} is now featured in the public feed.`,
    audience: recognition.target,
    template: "recognition-approved"
  });
}

function triggerStreakRecovery() {
  queueNotification({
    type: "challenge-reminder",
    title: "Streak at risk",
    summary: `Complete today's action before midnight to protect your ${state.streakSummary.current}-day streak.`,
    audience: state.currentUser.id,
    template: "streak-risk"
  });

  if (state.dailyDrop.status !== "completed") {
    state.dailyDrop.status = "completed";
    state.challenges = state.challenges.map((item) =>
      item.id === state.dailyDrop.id
        ? {
            ...item,
            status: "completed"
          }
        : item
    );

    state.streakSummary.current += 1;
    state.streakSummary.best = Math.max(state.streakSummary.best, state.streakSummary.current);
    state.streakSummary.daysLeft = Math.max(
      state.streakSummary.nextMilestone - state.streakSummary.current,
      0
    );
    state.passport.score += 50;
    state.persona.points += 50;

    appendPassportEntry({
      title: `${state.dailyDrop.title} completed`,
      behavior: state.dailyDrop.behavior,
      points: 50,
      status: "recorded"
    });
  }

  queueNotification({
    type: "leaderboard-summary",
    title: "Passport updated",
    summary: "Today's streak recovery has been logged to the employee passport.",
    audience: state.currentUser.id,
    template: "passport-summary"
  });
}

function triggerCapstoneLaunch() {
  state.passport.modulesCompleted = state.passport.modulesTotal;
  state.passport.completion = 100;
  state.stats.progress = 100;
  state.capstone.unlocked = true;
  state.spotlight = {
    title: "Final week unlocked",
    summary: "Capstone challenge is now ready to launch in private Teams and public campaign communications."
  };

  queueNotification({
    type: "leaderboard-summary",
    title: "Capstone unlocked",
    summary: "The final challenge is now available to employees who completed the journey.",
    audience: "all-employees",
    template: "capstone-unlocked"
  });
}

function runScenario(name: DemoScenarioName) {
  switch (name) {
    case "morning-activation":
      triggerMorningActivation();
      break;
    case "recognition-to-feed":
      triggerRecognitionToFeed();
      break;
    case "streak-recovery":
      triggerStreakRecovery();
      break;
    case "capstone-launch":
      triggerCapstoneLaunch();
      break;
  }

  recalcStats();
}

app.get("/health", async () => ({ ok: true }));
app.get("/version", async () => ({
  service: "api",
  version: process.env.APP_VERSION ?? "dev",
  commit: process.env.GIT_SHA ?? null
}));
// Readiness = DB reachable (or intentionally DB-less demo mode).
app.get("/readyz", async (_request, reply) => {
  const db = await dbPing();
  const ready = db || !process.env.DATABASE_URL;
  return reply.code(ready ? 200 : 503).send({ ok: ready, db });
});

/**
 * Personalized profile — SSO-protected. The Profile tab sends the silent Teams
 * SSO token as a Bearer; we verify it and return that user's profile. Identity
 * comes from the verified token (oid/name/email), never from the request body.
 */
app.get("/api/profile/me", async (request, reply) => {
  if (!ssoConfigured()) {
    // SSO not wired yet → don't 500; let the tab fall back to unverified mode.
    return reply.code(501).send({ ok: false, error: "sso-not-configured" });
  }
  const result = await verifyTeamsToken(request.headers.authorization);
  if (!result.ok) {
    return reply.code(401).send({ ok: false, error: result.error });
  }
  const { user } = result;
  // Identity is verified from the token; the score is this user's own total,
  // keyed on their oid (matches how the bot attributes points).
  const score = await userScore(user.oid);
  return {
    ok: true,
    verified: true,
    user: {
      id: user.oid,
      name: user.name ?? state.currentUser.name,
      email: user.email,
      businessUnit: state.currentUser.businessUnit
    },
    score,
    profile: state.currentUser,
    progress: {
      modules: state.modules,
      leaderboard: state.leaderboard
    }
  };
});

/**
 * The signed-in user's OWN state — the per-user replacement for the shared
 * passport/streak/progress that used to live on the global demo object. Identity
 * is a verified SSO oid (or a dev guest id); everything returned is assembled
 * from that user's rows, so two people see two different passports.
 *
 * `org` carries the shared content (modules, daily drop, feed) both users share.
 */
app.get("/api/me", async (request, reply) => {
  const id = await resolveIdentity(request);
  if (!id) {
    return reply.code(401).send({ ok: false, error: "no identity (SSO token or guest id required)" });
  }
  await touchProfile({ oid: id.oid, name: id.name, email: id.email });
  const liveModules = await listModules({ liveOnly: true });
  const me = await getMyState({ oid: id.oid, name: id.name, email: id.email }, liveModules.map((m) => m.id));
  if (feedPersistent) state.feed = await listFeed();
  if (dropsEnabled) state.dailyDrop = await getActiveDrop();
  return {
    ok: true,
    verified: id.verified,
    me,
    org: {
      modules: liveModules,
      dailyDrop: state.dailyDrop,
      feed: state.feed,
      capstone: state.capstone
    }
  };
});

app.get("/api/bootstrap", async () => {
  if (feedPersistent) state.feed = await listFeed();
  if (dropsEnabled) state.dailyDrop = await getActiveDrop();
  return state;
});
app.get("/api/users/me", async () => state.currentUser);
app.get("/api/modules", async () => state.modules);
app.get("/api/challenges", async () => state.challenges);
app.get("/api/feed", async () => (feedPersistent ? listFeed() : state.feed));
app.get("/api/leaderboard", async () => {
  const rows = await computeLeaderboard(20);
  // Real per-user standings once anyone has earned points; demo data until then.
  if (rows.length === 0) return state.leaderboard;
  return rows.map((r) => ({ name: r.name, points: r.points, department: r.department ?? undefined }));
});
app.get("/api/recognitions/pending", async () => state.recognitionQueue);
app.get("/api/notifications", async () => state.notifications);
app.get("/api/admin/demo/scenarios", async () => ({
  ok: true,
  scenarios: demoScenarios
}));

app.post<{
  Params: { id: string };
  Body: { userKey?: string; userName?: string };
}>("/api/modules/:id/complete", async (request, reply) => {
  const { id } = request.params;
  const target = state.modules.find((item) => item.id === id);

  if (!target) {
    return reply.code(404).send({ ok: false, message: "Module not found" });
  }

  if (request.body?.userKey) {
    await recordScore({
      userKey: request.body.userKey,
      userName: request.body.userName,
      points: 75,
      reason: `Completed ${target.title}`,
      ref: `module:${id}:${request.body.userKey}`,
      belief: (target as { track?: string }).track ?? null
    });
    // Per-user progress — the source of truth for THIS user's passport.
    await completeModuleForUser(request.body.userKey, id);
  }

  state.modules = state.modules.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "completed"
        }
      : item
  );

  if (target.status !== "completed") {
    state.passport.modulesCompleted = Math.min(
      state.passport.modulesTotal,
      state.passport.modulesCompleted + 1
    );
    state.passport.score += 75;
    state.persona.points += 75;
    appendPassportEntry({
      title: `${target.title} completed`,
      behavior: state.behaviors[0]?.name ?? "Learning journey",
      points: 75,
      status: "completed"
    });
  }

  recalcStats();
  updateMetric("Module completion", () => ({
    note: "Updated from employee completion event"
  }));

  return {
    ok: true,
    moduleId: id,
    bootstrap: state
  };
});

app.post<{
  Params: { id: string };
  Body: { userKey?: string; userName?: string; best?: boolean };
}>("/api/challenges/:id/submit", async (request, reply) => {
  const { id } = request.params;
  // Accept either a demo challenge OR an admin-authored daily drop with this id.
  const stateChallenge = state.challenges.find((item) => item.id === id);
  const drop = stateChallenge ? null : await getDrop(id);
  const target = stateChallenge ?? (drop ? { title: drop.title, behavior: drop.behavior, status: "pending" as const } : null);

  if (!target) {
    return reply.code(404).send({ ok: false, message: "Challenge not found" });
  }

  if (request.body?.userKey) {
    const pts = request.body.best ? 50 : 20;
    await recordScore({
      userKey: request.body.userKey,
      userName: request.body.userName,
      points: pts,
      reason: `Challenge: ${target.title}`,
      ref: `challenge:${id}:${request.body.userKey}`,
      belief: target.behavior ?? null
    });
    // Per-user challenge run — drives THIS user's streak + "answered today".
    await recordChallengeRun(request.body.userKey, id, Boolean(request.body.best), pts);
  }

  state.challenges = state.challenges.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "completed"
        }
      : item
  );

  if (target.status !== "completed") {
    state.dailyDrop.status = state.dailyDrop.id === id ? "completed" : state.dailyDrop.status;
    state.passport.score += 50;
    state.persona.points += 50;
    state.streakSummary.current += 1;
    state.streakSummary.daysLeft = Math.max(
      state.streakSummary.nextMilestone - state.streakSummary.current,
      0
    );
    state.streakSummary.best = Math.max(state.streakSummary.best, state.streakSummary.current);
    appendPassportEntry({
      title: `${target.title} completed`,
      behavior: target.behavior,
      points: 50,
      status: "recorded"
    });
  }

  recalcStats();
  updateMetric("Challenge participation", () => ({
    note: "Updated from challenge submission"
  }));

  queueNotification({
    type: "leaderboard-summary",
    title: "Challenge completed",
    summary: `${state.currentUser.name} completed ${target.title}.`,
    audience: "admins"
  });

  return {
    ok: true,
    challengeId: id,
    bootstrap: state
  };
});

app.post<{
  Body: RecognitionSubmissionInput & { userKey?: string; userName?: string };
}>("/api/recognitions", async (request) => {
  const id = `rec-${Date.now()}`;
  const { userKey, userName, ...submission } = request.body;
  const recognition: RecognitionQueueItem = {
    id,
    ...submission
  };

  if (userKey) {
    await recordScore({
      userKey,
      userName: userName ?? recognition.employee,
      points: 75,
      reason: `Recognised ${recognition.target}`,
      ref: `recognition:${id}`
    });
  }

  // New story: recognition does NOT require approval — publish straight to the
  // public feed so it appears immediately (the recognised colleague is notified
  // by the bot). Persisted to Postgres so it survives restarts.
  const feedItem = buildRecognitionFeedItem(recognition);
  if (feedPersistent) {
    await addFeedPost(feedItem);
    state.feed = await listFeed();
  } else {
    state.feed = [feedItem, ...state.feed];
  }

  updateMetric("Recognition posts", () => ({
    note: "Published to the public feed"
  }));

  queueNotification({
    type: "recognition-approved",
    title: "New recognition posted",
    summary: `${recognition.employee} recognised ${recognition.target} for ${recognition.behavior}.`,
    audience: recognition.target
  });

  return {
    ok: true,
    recognition,
    bootstrap: state
  };
});

// Toggle an emoji reaction on a feed post. Identity is best-effort: a verified
// SSO token wins; otherwise the Teams-context user id sent by the tab is used
// (reactions are low-stakes, so we don't hard-block on SSO here — this keeps
// the reaction buttons always usable).
app.post<{
  Params: { id: string };
  Body: { emoji?: string; reactor?: string };
}>("/api/feed/:id/react", async (request, reply) => {
  const emoji = (request.body?.emoji ?? "").trim();
  if (!emoji) {
    return reply.code(400).send({ ok: false, error: "emoji required" });
  }
  let reactor = (request.body?.reactor ?? "").trim();
  const sso = await verifyTeamsToken(request.headers.authorization);
  if (sso.ok) reactor = sso.user.oid;
  if (!reactor) reactor = "anon";

  if (feedPersistent) {
    const reactions = await toggleReactionDb(request.params.id, emoji, reactor);
    const item = state.feed.find((f) => f.id === request.params.id);
    if (item) item.reactions = reactions;
    return { ok: true, reactions };
  }

  const item = state.feed.find((f) => f.id === request.params.id);
  if (!item) {
    return reply.code(404).send({ ok: false, error: "feed item not found" });
  }
  toggleReaction(request.params.id, emoji, reactor);
  return { ok: true, reactions: item.reactions ?? [] };
});

/**
 * Keyset-paginated feed for infinite scroll. `?before=<ISO>` returns posts
 * older than that cursor; response carries the next cursor (null when done).
 */
app.get<{ Querystring: { before?: string; limit?: string } }>("/api/feed/page", async (request) => {
  if (!feedPersistent) {
    return { ok: true, items: state.feed.filter((f) => f.kind !== "leaderboard"), nextCursor: null };
  }
  const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 50);
  const page = await listFeedPage(limit, request.query.before);
  return { ok: true, ...page };
});

// Comments on a post — read is open, posting needs an identity (SSO or guest).
app.get<{ Params: { id: string } }>("/api/feed/:id/comments", async (request) => {
  const comments = feedPersistent ? await listComments(request.params.id) : [];
  return { ok: true, comments };
});

app.post<{ Params: { id: string }; Body: { body?: string } }>(
  "/api/feed/:id/comments",
  async (request, reply) => {
    const body = (request.body?.body ?? "").trim();
    if (!body) return reply.code(400).send({ ok: false, error: "comment body required" });
    if (body.length > 1000) return reply.code(400).send({ ok: false, error: "comment too long" });
    const id = await resolveIdentity(request);
    if (!id) return reply.code(401).send({ ok: false, error: "identity required to comment" });
    if (!feedPersistent) return reply.code(503).send({ ok: false, error: "comments need a database" });
    await touchProfile({ oid: id.oid, name: id.name, email: id.email });
    const comment = await addComment(request.params.id, id.oid, id.name, body);
    return { ok: true, comment };
  }
);

/**
 * Compose a recognition FROM the Feeds tab. The author is the signed-in user
 * (derived from the verified identity, never the request body), so nobody can
 * post as someone else. Posts to the public feed + awards the author — the same
 * pipeline the bot uses, now available in the web tab.
 */
app.post<{ Body: { target?: string; belief?: string; message?: string } }>(
  "/api/feed/compose",
  async (request, reply) => {
    const id = await resolveIdentity(request);
    if (!id) return reply.code(401).send({ ok: false, error: "sign-in required to post" });
    const target = (request.body?.target ?? "").trim();
    const belief = (request.body?.belief ?? "").trim();
    const message = (request.body?.message ?? "").trim();
    if (!target || !message) {
      return reply.code(400).send({ ok: false, error: "target and message are required" });
    }
    const author = id.name ?? "A colleague";
    const recId = `rec-${Date.now()}`;

    await touchProfile({ oid: id.oid, name: id.name, email: id.email });
    await recordScore({
      userKey: id.oid,
      userName: author,
      points: 75,
      reason: `Recognised ${target}`,
      ref: `recognition:${recId}`,
      belief: belief || null
    });

    const feedItem = buildRecognitionFeedItem({
      id: recId,
      employee: author,
      target,
      behavior: belief || "Recognition",
      message
    } as RecognitionQueueItem);

    if (feedPersistent) {
      await addFeedPost(feedItem);
      state.feed = await listFeed();
    } else {
      state.feed = [feedItem, ...state.feed];
    }

    queueNotification({
      type: "recognition-approved",
      title: "New recognition posted",
      summary: `${author} recognised ${target}${belief ? ` for ${belief}` : ""}.`,
      audience: target
    });

    return { ok: true, post: feedItem };
  }
);

app.post<{
  Params: { id: string };
}>("/api/admin/recognitions/:id/approve", async (request, reply) => {
  const { id } = request.params;
  const recognition = state.recognitionQueue.find((item) => item.id === id);

  if (!recognition) {
    return reply.code(404).send({ ok: false, message: "Recognition not found" });
  }

  state.recognitionQueue = state.recognitionQueue.filter((item) => item.id !== id);
  state.feed = [buildRecognitionFeedItem(recognition), ...state.feed];

  updateMetric("Recognition posts", () => ({
    note: "Updated from moderation approval flow"
  }));

  queueNotification({
    type: "recognition-approved",
    title: "Recognition approved",
    summary: `${recognition.target} is now featured in the public feed.`,
    audience: recognition.target
  });

  return {
    ok: true,
    recognitionId: id,
    bootstrap: state
  };
});

app.post<{
  Body: NotificationRequest;
}>("/api/notifications", async (request) => {
  const notification = queueNotification(request.body);

  return {
    ok: true,
    notification,
    bootstrap: state
  };
});

app.post("/api/admin/demo/reset", async () => {
  state = cloneDemoState();
  await clearScores();
  await clearFeed();
  await initFeed(); // re-seeds the starter feed posts
  if (feedPersistent) state.feed = await listFeed();
  return {
    ok: true,
    bootstrap: state
  };
});

app.post<{
  Params: { name: DemoScenarioName };
}>("/api/admin/demo/scenarios/:name", async (request, reply) => {
  const scenario = demoScenarios.find((item) => item.name === request.params.name);

  if (!scenario) {
    return reply.code(404).send({
      ok: false,
      message: "Scenario not found"
    });
  }

  runScenario(scenario.name);

  return {
    ok: true,
    scenario,
    bootstrap: state
  };
});

// Learning Journey content — authored in the Admin, consumed by the bot.
app.get("/api/learning/modules", async () => listModules({ liveOnly: true }));
app.get("/api/admin/modules", async () => listModules());
app.post<{ Body: ModuleContent }>("/api/admin/modules", async (request) => {
  const saved = await upsertModule(request.body);
  return { ok: true, module: saved };
});
// Persist a new module order after a drag-and-drop reorder in the Admin.
app.post<{ Body: { order: { id: string; orderIdx: number }[] } }>(
  "/api/admin/modules/reorder",
  async (request) => {
    const all = await listModules();
    const byId = new Map(all.map((m) => [m.id, m]));
    for (const { id, orderIdx } of request.body.order) {
      const m = byId.get(id);
      if (m) await upsertModule({ ...m, orderIdx });
    }
    return { ok: true };
  }
);

app.delete<{ Params: { id: string } }>("/api/admin/modules/:id", async (request) => {
  await deleteModule(request.params.id);
  return { ok: true };
});

// Daily-drop authoring — admins create/edit drops and mark ONE active. The bot
// serves the active drop; the employee tabs show it as "today's drop".
app.get("/api/admin/drops", async () => listDrops());
app.post<{ Body: DailyDrop & { scheduledDate?: string | null } }>("/api/admin/drops", async (request) => {
  const drop = { ...request.body, id: request.body.id || `drop-${Date.now()}` };
  const saved = await upsertDrop(drop);
  return { ok: true, drop: saved };
});
app.post<{ Params: { id: string } }>("/api/admin/drops/:id/activate", async (request) => {
  await activateDrop(request.params.id);
  return { ok: true };
});
app.delete<{ Params: { id: string } }>("/api/admin/drops/:id", async (request) => {
  await deleteDrop(request.params.id);
  return { ok: true };
});

// Announcements — admins post to the community feed (pinned announcement kind).
app.post<{ Body: { title?: string; message?: string } }>("/api/admin/announce", async (request, reply) => {
  const title = (request.body?.title ?? "").trim();
  const message = (request.body?.message ?? "").trim();
  if (!title || !message) {
    return reply.code(400).send({ ok: false, error: "title and message required" });
  }
  const item = {
    id: `feed-ann-${Date.now()}`,
    kind: "announcement" as const,
    title,
    summary: message,
    message,
    createdAt: new Date().toISOString(),
    reactions: [] as { emoji: string; count: number }[]
  };
  if (feedPersistent) {
    await addFeedPost(item);
    state.feed = await listFeed();
  } else {
    state.feed = [item, ...state.feed];
  }
  return { ok: true, announcement: item };
});

// Moderation — hide/unhide a feed post so it drops out of the community feed.
app.post<{ Params: { id: string }; Body: { hidden?: boolean } }>(
  "/api/admin/feed/:id/hide",
  async (request) => {
    const hidden = request.body?.hidden ?? true;
    await setPostHidden(request.params.id, hidden);
    if (feedPersistent) state.feed = await listFeed();
    return { ok: true, hidden };
  }
);

const port = Number(process.env.PORT || 4175);

await runMigrations(); // per-user tables + schema_migrations before anything reads them
await initScores();
await initModules();
await initDrops();
await initFeed();
if (feedPersistent) state.feed = await listFeed();
if (dropsEnabled) state.dailyDrop = await getActiveDrop(); // serve the authored active drop

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
