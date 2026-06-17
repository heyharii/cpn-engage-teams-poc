import cors from "@fastify/cors";
import Fastify from "fastify";
import { type NotificationRequest } from "@cpn-engage/shared";
import { listNotifications, queueNotification, resetNotifications } from "./bot-store.js";
import {
  buildTemplateMessage,
  listCardTemplates,
  resolveTemplateFromNotification
} from "./adaptive-cards.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

app.get("/health", async () => ({
  ok: true,
  service: "notification-bot"
}));

app.get("/api/messages", async () => ({
  ok: true,
  notifications: listNotifications().map((notification) => ({
    ...notification,
    preview: buildTemplateMessage(resolveTemplateFromNotification(notification))
  }))
}));

app.get("/api/cards", async () => ({
  ok: true,
  templates: listCardTemplates()
}));

app.get<{
  Params: { template: string };
}>("/api/cards/:template", async (request, reply) => {
  const template = listCardTemplates().find((item) => item.template === request.params.template);

  if (!template) {
    return reply.code(404).send({
      ok: false,
      message: "Card template not found"
    });
  }

  return {
    ok: true,
    ...template,
    preview: buildTemplateMessage(template.template)
  };
});

app.post<{
  Body: NotificationRequest;
}>("/api/messages", async (request) => {
  const notification = queueNotification(request.body);
  const template = resolveTemplateFromNotification(notification);

  return {
    ok: true,
    notification,
    preview: buildTemplateMessage(template),
    note: "Bot queue accepted with Adaptive Card preview payload."
  };
});

app.post<{
  Params: { template: string };
}>("/api/messages/demo/:template", async (request, reply) => {
  const template = listCardTemplates().find((item) => item.template === request.params.template);

  if (!template) {
    return reply.code(404).send({
      ok: false,
      message: "Card template not found"
    });
  }

  const notification = queueNotification({
    type:
      template.template === "recognition-approved"
        ? "recognition-approved"
        : template.template === "module-assigned"
          ? "module-assigned"
          : template.template === "passport-summary" || template.template === "capstone-unlocked"
            ? "leaderboard-summary"
            : "challenge-reminder",
    title: template.title,
    summary: template.description,
    audience: "user-1",
    template: template.template
  });

  return {
    ok: true,
    notification,
    preview: buildTemplateMessage(template.template)
  };
});

app.post("/api/messages/reset", async () => ({
  ok: true,
  notifications: resetNotifications()
}));

app.post("/api/notifications/test", async () => ({
  ok: true,
  notification: queueNotification({
    type: "challenge-reminder",
    title: "Challenge reminder",
    summary: "Customer First Challenge is due in 2 days.",
    audience: "user-1"
  })
}));

const port = Number(process.env.PORT || 4177);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
