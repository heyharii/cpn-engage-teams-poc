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

app.post("/api/messages", async (req, res) => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
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

// Connect the per-thread state store up front (idempotent — the chat SDK also
// connects it during webhook handling).
await state.connect();

app.listen(config.port, () => {
  console.log(`✅ CPN Engage bot on http://localhost:${config.port}`);
  console.log(`   → Teams webhook: POST /api/messages  (appType=${config.teams.appType})`);
  console.log(`   → API base: ${config.apiBaseUrl}`);
});
