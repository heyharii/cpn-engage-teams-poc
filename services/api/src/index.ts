import cors from "@fastify/cors";
import Fastify from "fastify";
import { ssoConfigured, ssoConfigSummary, verifyTeamsToken } from "./sso.js";
import { initScores, recordScore, computeLeaderboard, userScore, clearScores, scoreRefsSummary } from "./scores.js";
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
  setPostHidden,
  listPending,
  approvePost,
  rejectPost,
  recordModeration,
  listModeration
} from "./feed.js";
import { runMigrations, dbPing, dbEnabled, sql } from "./db.js";
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
import { resolveIdentity, resolveIdentityDetailed } from "./identity.js";
import { resolveWriteActor } from "./request-actor.js";
import {
  businessDate,
  scoreChallengeAnswer,
  validateDailyDrop,
  validateModuleContent,
  validateRecognitionInput
} from "./domain.js";
import { requireAdmin } from "./authz.js";
import { buildDebugBundle, recordClientError } from "./debug.js";
import { getAnalytics } from "./analytics.js";
import { getRecognitionPoints, getAllSettings, updateSettings, type AppSettings } from "./settings.js";
import {
  initBeliefs,
  listBeliefs,
  listBehaviors,
  upsertBelief,
  deleteBelief,
  beliefsEnabled,
  type Belief
} from "./beliefs.js";
import {
  touchProfile,
  completeModuleForUser,
  recordChallengeRun,
  getMyState,
  searchPeople,
  getPerson,
  profileName,
  clearUserProgress
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
const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const productionOrigins = [
  "https://cpn-engage-home-teams-poc.onrender.com",
  "https://cpn-engage-community-teams-poc.onrender.com",
  "https://cpn-engage-feed-teams-poc.onrender.com",
  "https://cpn-engage-admin-teams-poc.onrender.com"
];
const allowedOrigins = configuredOrigins.length > 0
  ? configuredOrigins
  : process.env.NODE_ENV === "production"
    ? productionOrigins
    : [];
await app.register(cors, {
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key", "x-cpn-guest", "x-cpn-guest-name"]
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
    targetKey: item.targetKey,
    belief: item.behavior,
    message: item.message,
    createdAt: new Date().toISOString(),
    reactions: [] as { emoji: string; count: number }[]
  };
}

// Per-user reaction tracking (emoji → set of user oids) so a user can toggle
// their own reaction. Kept beside the feed item; counts mirror into the item.
const reactionUsers = new Map<string, Map<string, Set<string>>>();
const demoChallengeAnswers = new Map<string, Map<string, number>>();

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
  const adminKey = process.env.ADMIN_KEY?.trim();
  const pushToken = process.env.PUSH_TOKEN?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (adminKey) headers["x-admin-key"] = adminKey;
  if (pushToken) headers["x-push-token"] = pushToken;

  try {
    // /internal/notify — NOT /api/messages (that is now the Teams Bot Framework
    // webhook and would reject plain notification JSON).
    const response = await fetch(`${botBaseUrl}/internal/notify`, {
      method: "POST",
      headers,
      body: JSON.stringify(notification)
    });
    if (!response.ok) {
      app.log.warn({ status: response.status, notificationId: notification.id }, "Bot rejected notification relay");
    }
    if (sql) {
      await sql`update notification_logs set status = ${response.ok ? "accepted" : "failed"}, updated_at = now() where id = ${notification.id}`;
    }
  } catch (error) {
    app.log.warn({ error }, "Unable to relay notification to bot preview service");
    if (sql) {
      await sql`update notification_logs set status = 'failed', updated_at = now() where id = ${notification.id}`;
    }
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
    template: input.template,
    data: input.data
  };

  state.notifications = [notification, ...state.notifications];
  let persisted: Promise<unknown> = Promise.resolve();
  if (sql) {
    persisted = sql`
      insert into notification_logs (id, type, title, summary, audience, payload)
      values (${notification.id}, ${notification.type}, ${notification.title}, ${notification.summary},
              ${notification.audience}, ${sql.json(notification.data ?? {})})
      on conflict (id) do nothing
    `.catch((error) => app.log.warn({ error }, "Unable to persist notification log"));
  }
  void persisted.then(() => relayNotificationToBot(notification));
  return notification;
}

async function submitRecognitionForActor(
  actor: { userKey: string; userName: string | null },
  raw: Partial<RecognitionSubmissionInput>
): Promise<{ recognition: RecognitionQueueItem; pending: boolean; feedItem: ReturnType<typeof buildRecognitionFeedItem> }> {
  const submission = validateRecognitionInput({
    target: raw.target,
    behavior: raw.behavior,
    message: raw.message
  });
  const behaviors = await listBehaviors();
  if (!behaviors.some((b) => b.name === submission.behavior)) {
    throw new Error("belief is not active");
  }
  const requestedTargetKey = typeof raw.targetKey === "string" ? raw.targetKey.trim().slice(0, 128) : "";
  const resolvedTarget = requestedTargetKey ? await getPerson(requestedTargetKey) : null;
  if (requestedTargetKey && !resolvedTarget) throw new Error("selected colleague is no longer available");
  const recognition: RecognitionQueueItem = {
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employee: actor.userName ?? "A colleague",
    targetKey: resolvedTarget?.oid,
    ...submission,
    target: resolvedTarget?.name ?? submission.target
  };
  const { recognitionRequiresApproval } = await getAllSettings();
  const feedItem = buildRecognitionFeedItem(recognition);

  if (feedPersistent) {
    await addFeedPost(feedItem, { authorKey: actor.userKey, pending: recognitionRequiresApproval });
    state.feed = await listFeed();
  } else if (recognitionRequiresApproval) {
    state.recognitionQueue = [recognition, ...state.recognitionQueue];
  } else {
    state.feed = [feedItem, ...state.feed];
  }

  if (!recognitionRequiresApproval) {
    await recordScore({
      userKey: actor.userKey,
      userName: actor.userName,
      points: await getRecognitionPoints(),
      reason: `Recognised ${recognition.target}`,
      ref: `recognition:${feedItem.id}`,
      belief: recognition.behavior
    });
    queueNotification({
      type: "recognition-approved",
      title: "New recognition posted",
      summary: `${recognition.employee} recognised ${recognition.target} for ${recognition.behavior}.`,
      audience: recognition.targetKey ?? recognition.target,
      data: {
        author: recognition.employee,
        behavior: recognition.behavior,
        message: recognition.message
      }
    });
  }

  return { recognition, pending: recognitionRequiresApproval, feedItem };
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

/**
 * Who performed an admin action. Admin auth is a shared key, so the console may
 * name the operator with `x-admin-actor`; unnamed actions are still logged.
 */
function adminActor(request: { headers: Record<string, unknown> }): string | null {
  const raw = request.headers["x-admin-actor"];
  const v = String(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim();
  return v ? v.slice(0, 80) : null;
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
  const { identity: id, sso } = await resolveIdentityDetailed(request);
  if (!id) {
    return reply.code(401).send({ ok: false, error: "no identity (SSO token or guest id required)", sso });
  }
  await touchProfile({ oid: id.oid, name: id.name, email: id.email });
  const liveModules = await listModules({ liveOnly: true });
  if (feedPersistent) state.feed = await listFeed();
  if (dropsEnabled) state.dailyDrop = await getActiveDrop();
  const settings = await getAllSettings();
  const today = businessDate(new Date(), settings.dailyDropTz);
  const me = await getMyState(
    { oid: id.oid, name: id.name, email: id.email },
    liveModules.map((m) => m.id),
    {
      activeDropId: state.dailyDrop.id,
      businessDay: today,
      modulePoints: new Map(liveModules.map((m) => [m.id, m.points ?? 75]))
    }
  );
  return {
    ok: true,
    verified: id.verified,
    // Why this request is (un)verified — the tabs render it as an SSO badge so
    // a misconfigured app registration is visible instead of silent.
    sso,
    me,
    org: {
      modules: liveModules,
      dailyDrop: state.dailyDrop,
      feed: state.feed,
      capstone: state.capstone
    }
  };
});

/**
 * Deployment self-check for Teams SSO — no secrets, safe to call from anywhere.
 * `curl $API/api/sso/status` tells an operator whether the API can validate
 * tokens at all, which origins its CORS allowlist accepts (the other thing that
 * silently breaks tabs), and whether unverified guests are permitted.
 */
app.get("/api/sso/status", async () => ({
  ok: true,
  sso: ssoConfigSummary(),
  allowGuest: process.env.ALLOW_GUEST === "true" || (process.env.NODE_ENV !== "production" && process.env.ALLOW_GUEST !== "false"),
  allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : "any (dev)"
}));

app.get("/api/bootstrap", async () => {
  if (feedPersistent) state.feed = await listFeed();
  if (dropsEnabled) state.dailyDrop = await getActiveDrop();
  if (beliefsEnabled) state.behaviors = await listBehaviors();
  return state;
});

// Public list of Beliefs — the single source for the module/drop editors'
// belief pickers and the employee "four behaviours" panel.
app.get("/api/beliefs", async () => listBeliefs());
app.get<{ Querystring: { query?: string } }>("/api/people", async (request, reply) => {
  const identity = await resolveIdentity(request);
  if (!identity) return reply.code(401).send({ ok: false, error: "identity required" });
  return { ok: true, people: await searchPeople(request.query.query ?? "") };
});
app.get("/api/users/me", async () => state.currentUser);
app.get("/api/modules", async () => state.modules);
app.get("/api/challenges", async () => state.challenges);
app.get("/api/feed", async () => (feedPersistent ? listFeed() : state.feed));
app.get("/api/leaderboard", async () => {
  const { leaderboardPeriod } = await getAllSettings();
  const rows = await computeLeaderboard(20, leaderboardPeriod);
  // Real per-user standings once anyone has earned points; demo data until then.
  if (rows.length === 0) return state.leaderboard;
  return rows.map((r) => ({ name: r.name, points: r.points, department: r.department ?? undefined }));
});
// Expose the current period so the Feeds label can say Weekly/Monthly/All-time.
app.get("/api/leaderboard/period", async () => ({ period: (await getAllSettings()).leaderboardPeriod }));
app.get("/api/recognitions/pending", async (request, reply) => {
  if (!requireAdmin(request, reply)) return reply;
  return state.recognitionQueue;
});
app.get("/api/notifications", async (request, reply) => {
  if (!requireAdmin(request, reply)) return reply;
  return state.notifications;
});
app.get("/api/admin/demo/scenarios", async () => ({
  ok: true,
  scenarios: demoScenarios
}));

app.post<{
  Params: { id: string };
  Body: { userKey?: string; userName?: string };
}>("/api/modules/:id/complete", async (request, reply) => {
  const { id } = request.params;
  // Prefer the authored module (from the table); fall back to demo state.
  const authored = (await listModules()).find((m) => m.id === id);
  const target = authored ?? state.modules.find((item) => item.id === id);

  if (!target) {
    return reply.code(404).send({ ok: false, message: "Module not found" });
  }

  const modulePoints = (target as { points?: number }).points ?? 75;
  const actor = await resolveWriteActor(request, request.body ?? {});
  if (!actor) return reply.code(401).send({ ok: false, error: "verified employee or bot identity required" });
  await touchProfile({ oid: actor.userKey, name: actor.userName });
  const awarded = await recordScore({
    userKey: actor.userKey,
    userName: actor.userName,
    points: modulePoints,
    reason: `Completed ${target.title}`,
    ref: `module:${id}:${actor.userKey}`,
    belief: (target as { track?: string }).track ?? null
  });
  await completeModuleForUser(actor.userKey, id);

  if (!dbEnabled && (target as { status?: string }).status !== "completed") {
    state.modules = state.modules.map((item) =>
      item.id === id ? { ...item, status: "completed" } : item
    );
    state.passport.modulesCompleted = Math.min(
      state.passport.modulesTotal,
      state.passport.modulesCompleted + 1
    );
    state.passport.score += modulePoints;
    state.persona.points += modulePoints;
    appendPassportEntry({
      title: `${target.title} completed`,
      behavior: state.behaviors[0]?.name ?? "Learning journey",
      points: modulePoints,
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
    awarded,
    score: await userScore(actor.userKey),
    bootstrap: state
  };
});

app.post<{
  Params: { id: string };
  Body: { userKey?: string; userName?: string; questionId?: string; optionId?: string; last?: boolean };
}>("/api/challenges/:id/submit", async (request, reply) => {
  const { id } = request.params;
  // Accept either a demo challenge OR an admin-authored daily drop with this id.
  const stateChallenge = state.challenges.find((item) => item.id === id);
  const drop = (await getDrop(id)) ?? (state.dailyDrop.id === id ? state.dailyDrop : null);
  const target = stateChallenge ?? (drop ? { title: drop.title, behavior: drop.behavior, status: "pending" as const } : null);

  if (!target) {
    return reply.code(404).send({ ok: false, message: "Challenge not found" });
  }

  const actor = await resolveWriteActor(request, request.body ?? {});
  if (!actor) return reply.code(401).send({ ok: false, error: "verified employee or bot identity required" });
  if (!drop) return reply.code(409).send({ ok: false, error: "challenge has no scoreable daily-drop content" });
  const questionId = (request.body?.questionId ?? "").trim();
  const optionId = (request.body?.optionId ?? "").trim();
  const result = scoreChallengeAnswer(drop, questionId, optionId);
  if (!result) return reply.code(400).send({ ok: false, error: "question or option is not part of this challenge" });
  await touchProfile({ oid: actor.userKey, name: actor.userName });
  const ref = `challenge:${id}:${questionId}:${actor.userKey}`;
  let awarded = await recordScore({
    userKey: actor.userKey,
    userName: actor.userName,
    points: result.points,
    reason: `Challenge: ${target.title}`,
    ref,
    belief: target.behavior ?? null
  });
  const expectedRefs = drop.questions.map((q) => `challenge:${id}:${q.id}:${actor.userKey}`);
  let answerSummary = await scoreRefsSummary(actor.userKey, expectedRefs);
  if (!dbEnabled) {
    const key = `${actor.userKey}:${id}`;
    const answers = demoChallengeAnswers.get(key) ?? new Map<string, number>();
    awarded = !answers.has(questionId);
    if (awarded) answers.set(questionId, result.points);
    demoChallengeAnswers.set(key, answers);
    answerSummary = { count: answers.size, points: [...answers.values()].reduce((sum, points) => sum + points, 0) };
  }
  const completed = answerSummary.count === drop.questions.length;
  let completionRecorded = false;
  if (completed) {
    const { dailyDropTz } = await getAllSettings();
    completionRecorded = await recordChallengeRun(
      actor.userKey,
      id,
      answerSummary.points === (drop.bestPoints ?? 50) * drop.questions.length,
      answerSummary.points,
      businessDate(new Date(), dailyDropTz)
    );
    if (!dbEnabled) completionRecorded = awarded;
  }

  if (!dbEnabled && completionRecorded && target.status !== "completed") {
    state.challenges = state.challenges.map((item) =>
      item.id === id ? { ...item, status: "completed" } : item
    );
    state.dailyDrop.status = state.dailyDrop.id === id ? "completed" : state.dailyDrop.status;
    state.passport.score += answerSummary.points;
    state.persona.points += answerSummary.points;
    state.streakSummary.current += 1;
    state.streakSummary.daysLeft = Math.max(
      state.streakSummary.nextMilestone - state.streakSummary.current,
      0
    );
    state.streakSummary.best = Math.max(state.streakSummary.best, state.streakSummary.current);
    appendPassportEntry({
      title: `${target.title} completed`,
      behavior: target.behavior,
      points: answerSummary.points,
      status: "recorded"
    });
  }

  recalcStats();
  updateMetric("Challenge participation", () => ({
    note: "Updated from challenge submission"
  }));

  if (completionRecorded) {
    queueNotification({
      type: "leaderboard-summary",
      title: "Challenge completed",
      summary: `${actor.userName ?? "An employee"} completed ${target.title}.`,
      audience: "admins"
    });
  }

  return {
    ok: true,
    challengeId: id,
    awarded,
    completed,
    score: await userScore(actor.userKey),
    bootstrap: state
  };
});

app.post<{
  Body: RecognitionSubmissionInput & { userKey?: string; userName?: string };
}>("/api/recognitions", async (request, reply) => {
  const actor = await resolveWriteActor(request, request.body ?? {});
  if (!actor) return reply.code(401).send({ ok: false, error: "verified employee or bot identity required" });
  try {
    const result = await submitRecognitionForActor(actor, request.body ?? {});
    return { ok: true, recognition: result.recognition, pending: result.pending, bootstrap: state };
  } catch (error) {
    return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : "invalid recognition" });
  }
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
  const allowedReactions = new Set(["👍", "🎉", "❤️", "👏", "🔥"]);
  if (!allowedReactions.has(emoji)) {
    return reply.code(400).send({ ok: false, error: "unsupported reaction" });
  }
  // A reaction earns no points and reveals nothing, so it must never be blocked
  // by an identity problem: inside Teams a tab whose SSO token fails to verify
  // (consent not granted, audience mismatch) would otherwise get a silent 401 on
  // every tap. Fall back to the tab's own stable per-user id, which is only ever
  // used as the reaction owner key for toggling.
  const identity = await resolveIdentity(request);
  const claimed = String(request.headers["x-cpn-guest"] ?? request.body?.reactor ?? "").trim();
  const reactor = identity?.oid ?? (claimed ? `anon:${claimed.slice(0, 64)}` : "");
  if (!reactor) return reply.code(401).send({ ok: false, error: "identity required to react" });

  if (feedPersistent) {
    try {
      const reactions = await toggleReactionDb(request.params.id, emoji, reactor);
      const item = state.feed.find((f) => f.id === request.params.id);
      if (item) item.reactions = reactions;
      return { ok: true, reactions };
    } catch {
      return reply.code(404).send({ ok: false, error: "feed item not found" });
    }
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
    // A request without a name still gets the name we already know for this
    // user, so comments read as a person instead of "Someone".
    const author = id.name ?? (await profileName(id.oid));
    const comment = await addComment(request.params.id, id.oid, author, body);
    if (!comment) return reply.code(404).send({ ok: false, error: "feed item not found" });
    return { ok: true, comment };
  }
);

/**
 * Compose a recognition FROM the Feeds tab. The author is the signed-in user
 * (derived from the verified identity, never the request body), so nobody can
 * post as someone else. Posts to the public feed + awards the author — the same
 * pipeline the bot uses, now available in the web tab.
 */
app.post<{ Body: { target?: string; targetKey?: string | null; belief?: string; message?: string } }>(
  "/api/feed/compose",
  async (request, reply) => {
    const id = await resolveIdentity(request);
    if (!id) return reply.code(401).send({ ok: false, error: "sign-in required to post" });
    await touchProfile({ oid: id.oid, name: id.name, email: id.email });
    try {
      const result = await submitRecognitionForActor(
        { userKey: id.oid, userName: id.name ?? (await profileName(id.oid)) },
        {
          target: request.body?.target ?? "",
          targetKey: request.body?.targetKey ?? undefined,
          behavior: request.body?.belief ?? "",
          message: request.body?.message ?? ""
        }
      );
      return { ok: true, post: result.pending ? null : result.feedItem, pending: result.pending };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : "invalid recognition" });
    }
  }
);

app.post<{
  Body: NotificationRequest;
}>("/api/notifications", async (request, reply) => {
  // This compatibility endpoint is operational, not an employee write.
  // It remains at its old URL but is admin-gated explicitly.
  if (!requireAdmin(request, reply)) return reply;
  const notification = queueNotification(request.body);

  return {
    ok: true,
    notification,
    bootstrap: state
  };
});

app.post("/api/admin/demo/reset", async () => {
  state = cloneDemoState();
  demoChallengeAnswers.clear();
  reactionUsers.clear();
  await clearScores();
  // Per-user progress too — otherwise a re-run of the demo still shows the
  // previous run's completed modules and streak for returning users.
  await clearUserProgress();
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
app.post<{ Body: ModuleContent }>("/api/admin/modules", async (request, reply) => {
  try {
    const saved = await upsertModule(validateModuleContent(request.body));
    return { ok: true, module: saved };
  } catch (error) {
    return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : "invalid module" });
  }
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
app.post<{ Body: DailyDrop & { scheduledDate?: string | null } }>("/api/admin/drops", async (request, reply) => {
  const b = request.body;
  const drop = {
    ...b,
    id: b.id || `drop-${Date.now()}`,
    title: b.title || "Daily Drop",
    rewardLabel: b.rewardLabel || "Up to 50 points",
  };
  try {
    const saved = await upsertDrop(validateDailyDrop(drop));
    return { ok: true, drop: saved };
  } catch (error) {
    return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : "invalid drop" });
  }
});
app.post<{ Params: { id: string } }>("/api/admin/drops/:id/activate", async (request, reply) => {
  try {
    await activateDrop(request.params.id);
    return { ok: true };
  } catch {
    return reply.code(404).send({ ok: false, error: "drop not found" });
  }
});
app.delete<{ Params: { id: string } }>("/api/admin/drops/:id", async (request, reply) => {
  try {
    await deleteDrop(request.params.id);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to delete drop";
    return reply.code(message === "drop not found" ? 404 : 409).send({ ok: false, error: message });
  }
});

// Engagement analytics for the admin Overview (real aggregates).
app.get("/api/admin/analytics", async () => getAnalytics(14));

// Configurable settings — points, branding, schedule, leaderboard, approval.
app.get("/api/admin/settings", async () => getAllSettings());
app.post<{ Body: Partial<AppSettings> }>("/api/admin/settings", async (request) => {
  const settings = await updateSettings(request.body ?? {});
  // Ask the bot to re-apply the daily-drop schedule if the time/tz changed.
  if (request.body?.dailyDropTime || request.body?.dailyDropTz) {
    try {
      await fetch(`${process.env.NOTIFICATION_BOT_URL ?? "http://127.0.0.1:4177"}/internal/reschedule`, {
        method: "POST",
        headers: {
          "x-admin-key": process.env.ADMIN_KEY ?? "",
          ...(process.env.PUSH_TOKEN ? { "x-push-token": process.env.PUSH_TOKEN } : {})
        }
      });
    } catch {
      /* bot may be down in dev — settings still saved */
    }
  }
  return { ok: true, ...settings };
});

// Public branding (name + accent color) so the tabs can theme themselves.
app.get("/api/branding", async () => {
  const s = await getAllSettings();
  return { appName: s.appName, accentColor: s.accentColor };
});

// One-file support bundle for post-distribution debugging (admin-gated).
app.get("/api/admin/debug-bundle", async () => buildDebugBundle());

// Ingest a client-side error from any tab (ring-buffered). Open (no admin key)
// so tabs can report crashes; surfaced only inside the admin debug bundle.
app.post<{ Body: { surface?: string; message?: string; detail?: string; url?: string } }>(
  "/api/client-errors",
  async (request) => {
    await recordClientError(request.body ?? {});
    return { ok: true };
  }
);

// Beliefs authoring — the CPN values, editable (no longer hardcoded).
app.get("/api/admin/beliefs", async () => listBeliefs());
app.post<{ Body: Belief }>("/api/admin/beliefs", async (request) => {
  const b = { ...request.body, id: request.body.id || `belief-${Date.now()}` };
  const saved = await upsertBelief(b);
  return { ok: true, belief: saved };
});
app.delete<{ Params: { id: string } }>("/api/admin/beliefs/:id", async (request) => {
  await deleteBelief(request.params.id);
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
app.post<{ Params: { id: string }; Body: { hidden?: boolean; note?: string } }>(
  "/api/admin/feed/:id/hide",
  async (request) => {
    const hidden = request.body?.hidden ?? true;
    await setPostHidden(request.params.id, hidden);
    // Taking a post down is never silent: the decision, who made it, and the
    // post's own content stay queryable afterwards.
    await recordModeration(
      request.params.id,
      hidden ? "hide" : "unhide",
      adminActor(request),
      request.body?.note ?? null
    );
    if (feedPersistent) state.feed = await listFeed();
    return { ok: true, hidden };
  }
);

/** Flag a post for review without taking it down. */
app.post<{ Params: { id: string }; Body: { note?: string } }>(
  "/api/admin/feed/:id/flag",
  async (request) => {
    await recordModeration(request.params.id, "flag", adminActor(request), request.body?.note ?? null);
    return { ok: true, flagged: true };
  }
);

/** Moderation history — every hide, unhide, flag, approval and rejection. */
app.get<{ Querystring: { limit?: string } }>("/api/admin/feed/moderation", async (request) => ({
  ok: true,
  entries: await listModeration(Number(request.query.limit) || 100)
}));

// Recognition approval queue (only used when recognitionRequiresApproval is on).
app.get("/api/admin/recognitions/pending", async () => ({ pending: await listPending() }));
app.post<{ Params: { id: string } }>("/api/admin/recognitions/:id/approve", async (request) => {
  const r = await approvePost(request.params.id);
  if (r) await recordModeration(request.params.id, "approve", adminActor(request), null);
  if (!r) return { ok: false, error: "not found or already approved" };
  // Award the held points to the sender now that it's approved.
  if (r.authorKey) {
    await recordScore({
      userKey: r.authorKey,
      userName: r.author,
      points: await getRecognitionPoints(),
      reason: `Recognised ${r.target ?? "a colleague"}`,
      ref: `recognition:${request.params.id}`,
      belief: r.belief
    });
  }
  queueNotification({
    type: "recognition-approved",
    title: "Recognition approved",
    summary: `${r.author ?? "A colleague"} recognised ${r.target ?? "a colleague"}${r.belief ? ` for ${r.belief}` : ""}.`,
    audience: r.targetKey ?? r.target ?? "",
    data: {
      author: r.author ?? "A colleague",
      behavior: r.belief ?? "Recognition",
      message: r.message ?? "You were recognised by a colleague."
    }
  });
  if (feedPersistent) state.feed = await listFeed();
  return { ok: true };
});
app.post<{ Params: { id: string } }>("/api/admin/recognitions/:id/reject", async (request, reply) => {
  const rejected = await rejectPost(request.params.id);
  if (!rejected) return reply.code(404).send({ ok: false, error: "not found or already moderated" });
  await recordModeration(request.params.id, "reject", adminActor(request), null);
  return { ok: true };
});

const port = Number(process.env.PORT || 4175);

await runMigrations(); // per-user tables + schema_migrations before anything reads them
await initScores();
await initModules();
await initDrops();
await initBeliefs();
await initFeed();
if (feedPersistent) state.feed = await listFeed();
if (dropsEnabled) state.dailyDrop = await getActiveDrop(); // serve the authored active drop
if (beliefsEnabled) state.behaviors = await listBehaviors(); // serve authored beliefs

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
