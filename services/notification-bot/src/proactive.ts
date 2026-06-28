/**
 * Proactive (push) messaging via the raw Bot Connector REST API:
 *   1. get a bot access token (client-credentials)
 *   2. render a card → Adaptive Card JSON
 *   3. POST it to a stored conversation reference
 *
 * This lets the bot DM users FIRST (scheduled drops, reminders) using the
 * conversation refs captured in Postgres — no user message required.
 */
import { toCardElement } from "chat";
import { cardToAdaptiveCard } from "@chat-adapter/teams";
import { config } from "./config.ts";
import { listConversations, type ConversationRef } from "./db.ts";

let cachedToken: { value: string; exp: number } | null = null;

async function getBotToken(): Promise<string | null> {
  if (!config.teams.appId || !config.teams.appPassword) return null;
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;

  // Single-tenant → the app's tenant; multitenant → the Bot Framework tenant.
  const tenant = config.teams.appType === "SingleTenant" && config.teams.tenantId
    ? config.teams.tenantId
    : "botframework.com";
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.teams.appId,
    client_secret: config.teams.appPassword,
    scope: "https://api.botframework.com/.default"
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) {
    console.warn(`[proactive] token failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

function renderCard(cardElement: unknown): unknown {
  const el = toCardElement(cardElement as never);
  const ac = cardToAdaptiveCard(el as never) as { toJSON?: () => unknown };
  return typeof ac?.toJSON === "function" ? ac.toJSON() : ac;
}

/** Push one card to one stored conversation. Returns true on success. */
export async function pushCardTo(ref: ConversationRef, cardElement: unknown): Promise<boolean> {
  const token = await getBotToken();
  if (!token) return false;
  const activity = {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: renderCard(cardElement) }]
  };
  const url = `${ref.serviceUrl.replace(/\/$/, "")}/v3/conversations/${encodeURIComponent(ref.conversationId)}/activities`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(activity)
    });
    if (!res.ok) {
      console.warn(`[proactive] send ${ref.conversationId} → ${res.status} ${(await res.text()).slice(0, 160)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[proactive] send error:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/** Fan a card out to every stored conversation. Returns {sent, total}. */
export async function pushCardToAll(cardElement: unknown): Promise<{ sent: number; total: number }> {
  const refs = await listConversations();
  let sent = 0;
  for (const ref of refs) {
    if (await pushCardTo(ref, cardElement)) sent += 1;
  }
  return { sent, total: refs.length };
}
