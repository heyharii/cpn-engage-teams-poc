/**
 * Posting hand-written Adaptive Card JSON into a live thread.
 *
 * The chat SDK's JSX cards cover buttons and text, but not `Input.*`,
 * `Data.Query` or the Teams People Picker — its `CardChild` union has no input
 * elements. Those are plain Adaptive Card features, so the shortest path is to
 * skip the JSX layer for the cards that need them and send the JSON ourselves.
 *
 * Nothing exotic: `proactive.ts` already builds Bot Connector activities by
 * hand for scheduled pushes, and the `content` of an adaptive-card attachment
 * is just an object. This module does the same thing aimed at the thread the
 * user is currently in.
 *
 * Inbound needs no new plumbing. The Teams adapter treats any activity whose
 * `value` carries an `actionId` as a card action, so an `Action.Submit` whose
 * `data` is `{ actionId: "..." }` lands in the same `bot.onAction` handlers as
 * every JSX button — with the card's input values merged in alongside.
 */

import { decodeThreadId } from "@chat-adapter/teams";
import { getBotToken } from "./proactive.ts";

/** A hand-written Adaptive Card payload. */
export type RawCard = Record<string, unknown>;

function attachment(card: RawCard) {
  return { contentType: "application/vnd.microsoft.card.adaptive", content: card };
}

async function connector(
  threadId: string,
  path: string,
  method: "POST" | "PUT",
  card: RawCard
): Promise<string | undefined> {
  const token = await getBotToken();
  if (!token) return undefined;
  const { serviceUrl, conversationId } = decodeThreadId(threadId);
  const base = `${serviceUrl.replace(/\/$/, "")}/v3/conversations/${encodeURIComponent(conversationId)}/activities`;
  try {
    const res = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "message", attachments: [attachment(card)] })
    });
    if (!res.ok) {
      console.warn(`[raw-card] ${method} → ${res.status} ${(await res.text()).slice(0, 160)}`);
      return undefined;
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    return body?.id;
  } catch (err) {
    console.warn(`[raw-card] ${method} failed:`, err instanceof Error ? err.message : err);
    return undefined;
  }
}

/** Post a raw card to the thread. Returns the new message id, when Teams gives one. */
export function postRawCard(threadId: string, card: RawCard): Promise<string | undefined> {
  return connector(threadId, "", "POST", card);
}

/** Replace a raw card in place. Best-effort, exactly like `editCard`. */
export async function editRawCard(threadId: string, messageId: string | undefined, card: RawCard): Promise<boolean> {
  if (!messageId) return false;
  const id = await connector(threadId, `/${encodeURIComponent(messageId)}`, "PUT", card);
  return id !== undefined;
}

/**
 * The values of a card's inputs. `ActionEvent.value` is typed as a string and
 * the adapter only lifts `actionId` out of it, so the inputs are read from the
 * raw activity — the documented shape for Action.Submit, which "gathers input
 * values, merges them with the data property".
 */
export function readInputs(raw: unknown): Record<string, string> {
  const value = (raw as { value?: unknown } | undefined)?.value;
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "actionId" || k === "msteams") continue;
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}
