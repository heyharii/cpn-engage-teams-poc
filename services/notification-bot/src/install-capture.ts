/**
 * Capture a user's conversation reference from ANY inbound Teams activity, so
 * the bot can DM that user proactively even if they never open the chat.
 *
 * Install events (`installationUpdate` action:add, or `conversationUpdate` with
 * the bot in membersAdded) are the ideal signal — they fire before the user
 * ever chats. But Teams does not always re-fire them (e.g. re-installing into an
 * existing 1:1 conversation), so we also capture from plain messages and every
 * other activity that carries a conversation ref. Capturing is idempotent
 * (upsert keyed on threadId), so doing it on every activity is safe.
 *
 * Uses the same encodeThreadId scheme as on-chat capture, so the two dedupe.
 */
import { encodeThreadId } from "@chat-adapter/teams";
import { rememberConversation } from "./db.ts";
import { config } from "./config.ts";

type RawActivity = {
  type?: string;
  action?: string;
  serviceUrl?: string;
  conversation?: { id?: string };
  recipient?: { id?: string };
  from?: { id?: string; name?: string; aadObjectId?: string };
  membersAdded?: { id?: string }[];
  channelData?: { tenant?: { id?: string } };
};

export async function captureFromRawActivity(rawBody: string): Promise<void> {
  let a: RawActivity;
  try {
    a = JSON.parse(rawBody) as RawActivity;
  } catch {
    return;
  }

  const serviceUrl = a.serviceUrl;
  const conversationId = a.conversation?.id;

  // Diagnostics: log EVERY inbound activity so we can see exactly what Teams
  // delivers (type/action + whether it carries a conversation ref).
  console.log(
    `[webhook] type=${a.type ?? "?"}${a.action ? ` action=${a.action}` : ""} ` +
      `from=${a.from?.name ?? a.from?.id ?? "-"} conv=${conversationId ? "yes" : "no"}`
  );

  // Any activity with a conversation ref is enough to DM that user later.
  if (!serviceUrl || !conversationId) return;

  const isInstall = a.type === "installationUpdate" && (a.action === "add" || a.action == null);
  const botAdded =
    a.type === "conversationUpdate" &&
    Array.isArray(a.membersAdded) &&
    a.membersAdded.some((m) => m.id && m.id === a.recipient?.id);
  const label = isInstall || botAdded ? "install" : a.type ?? "activity";

  try {
    const threadId = encodeThreadId({ serviceUrl, conversationId });
    await rememberConversation({
      threadId,
      serviceUrl,
      conversationId,
      userId: a.from?.aadObjectId ?? a.from?.id ?? null,
      userName: a.from?.name ?? null,
      tenantId: a.channelData?.tenant?.id ?? config.teams.tenantId ?? null
    });
    console.log(`[capture] (${label}) stored ref for ${a.from?.name ?? conversationId}`);
  } catch (err) {
    console.warn("[capture] failed:", err instanceof Error ? err.message : err);
  }
}
