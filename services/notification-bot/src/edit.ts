/**
 * Replacing a card in place.
 *
 * A posted Adaptive Card cannot disable its own buttons, so a card whose action
 * has been taken is REPLACED with a version that has none. `ActionEvent` carries
 * the id of the message that was tapped, so the handler always knows which one.
 *
 * Every call is best-effort: the message may be too old, the network may drop,
 * or the user's client may still be showing the previous version. Nothing here
 * guards correctness — the per-thread state checks and the idempotent score refs
 * do that. This is only about what the user sees.
 */
import type { Thread } from "chat";

type AnyThread = Thread<unknown, unknown>;

/** Replaces one message's card. Returns false when the host refused the edit. */
export async function editCard(thread: AnyThread, messageId: string | undefined, card: unknown): Promise<boolean> {
  if (!messageId) return false;
  try {
    await thread.adapter.editMessage(thread.id, messageId, card as never);
    return true;
  } catch (err) {
    console.warn("[edit] card update failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Post a card and return its message id, so a later step can edit it. Used by
 * the recognition wizard, which lives in a single message the whole way through.
 */
export async function postCard(thread: AnyThread, card: unknown): Promise<string | undefined> {
  const sent = (await thread.post(card as never)) as { id?: string } | undefined;
  return sent?.id;
}

/**
 * Show `card` in the message the user just acted on, or post it when there is
 * no message to edit (or the edit was refused). Returns the id now showing it.
 */
export async function replaceOrPost(
  thread: AnyThread,
  messageId: string | undefined,
  card: unknown
): Promise<string | undefined> {
  if (await editCard(thread, messageId, card)) return messageId;
  return postCard(thread, card);
}
