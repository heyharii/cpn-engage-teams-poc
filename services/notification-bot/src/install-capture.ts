/**
 * Capture a user's conversation reference at INSTALL time — before they ever
 * chat. When the CPN Engage app is installed/added for a user, Teams sends a
 * `conversationUpdate` (bot added) or `installationUpdate` (action: add)
 * activity to the webhook. We parse it and store the ref so the bot can DM
 * that user proactively even if they've never opened the app.
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

  const isInstall = a.type === "installationUpdate" && (a.action === "add" || a.action == null);
  const botAdded =
    a.type === "conversationUpdate" &&
    Array.isArray(a.membersAdded) &&
    a.membersAdded.some((m) => m.id && m.id === a.recipient?.id);
  if (!isInstall && !botAdded) return;

  const serviceUrl = a.serviceUrl;
  const conversationId = a.conversation?.id;
  if (!serviceUrl || !conversationId) return;

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
    console.log(`[install-capture] ${a.type} captured for ${a.from?.name ?? conversationId}`);
  } catch (err) {
    console.warn("[install-capture] failed:", err instanceof Error ? err.message : err);
  }
}
