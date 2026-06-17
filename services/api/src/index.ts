import cors from "@fastify/cors";
import Fastify from "fastify";
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

await app.register(cors, {
  origin: true
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
    summary: `${item.employee} recognized ${item.target} for behavior aligned to ${item.behavior}.`
  };
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
    await fetch(`${botBaseUrl}/api/messages`, {
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
    behavior: state.behaviors[3]?.name ?? "Grow Together",
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

app.get("/api/bootstrap", async () => state);
app.get("/api/users/me", async () => state.currentUser);
app.get("/api/modules", async () => state.modules);
app.get("/api/challenges", async () => state.challenges);
app.get("/api/feed", async () => state.feed);
app.get("/api/leaderboard", async () => state.leaderboard);
app.get("/api/recognitions/pending", async () => state.recognitionQueue);
app.get("/api/notifications", async () => state.notifications);
app.get("/api/admin/demo/scenarios", async () => ({
  ok: true,
  scenarios: demoScenarios
}));

app.post<{
  Params: { id: string };
}>("/api/modules/:id/complete", async (request, reply) => {
  const { id } = request.params;
  const target = state.modules.find((item) => item.id === id);

  if (!target) {
    return reply.code(404).send({ ok: false, message: "Module not found" });
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
}>("/api/challenges/:id/submit", async (request, reply) => {
  const { id } = request.params;
  const target = state.challenges.find((item) => item.id === id);

  if (!target) {
    return reply.code(404).send({ ok: false, message: "Challenge not found" });
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
  Body: RecognitionSubmissionInput;
}>("/api/recognitions", async (request) => {
  const id = `rec-${Date.now()}`;
  const recognition: RecognitionQueueItem = {
    id,
    ...request.body
  };

  state.recognitionQueue = [recognition, ...state.recognitionQueue];

  queueNotification({
    type: "recognition-approved",
    title: "Recognition awaiting approval",
    summary: `${recognition.employee} submitted recognition for ${recognition.target}.`,
    audience: "admins"
  });

  return {
    ok: true,
    recognition,
    bootstrap: state
  };
});

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

const port = Number(process.env.PORT || 4175);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
