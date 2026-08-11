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
import { isJSX, toCardElement, type Thread } from "chat";

type AnyThread = Thread<unknown, unknown>;

/**
 * `thread.post()` converts a JSX card before handing it to the adapter; the
 * adapter's own editMessage does not. Passing the raw element there produces an
 * attachment-less activity that Teams rejects with a 400, so convert first.
 */
function toPayload(card: unknown): unknown {
  if (!isJSX(card as never)) return card;
  const el = toCardElement(card as never);
  if (!el) throw new Error("not a Card element");
  return el;
}

/** Replaces one message's card. Returns false when the host refused the edit. */
export async function editCard(thread: AnyThread, messageId: string | undefined, card: unknown): Promise<boolean> {
  if (!messageId) return false;
  try {
    await thread.adapter.editMessage(thread.id, messageId, toPayload(card) as never);
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
 * Advance one step of any flow. Two operations, always paired:
 *
 *   1. the card the user just answered is replaced by a buttonless record of
 *      what they chose — it keeps its place in the history and can never be
 *      tapped again;
 *   2. the next step is posted BELOW as a new message.
 *
 * Never edit a card into the *next* step: an edit raises no Teams notification,
 * so a user who stepped away would never learn the flow had moved on, and a
 * card edited above a reply the user typed reads backwards.
 *
 * Returns the id of the new message, so a step answered by typing knows which
 * card to summarise when its own answer arrives.
 */
export async function advanceStep(
  thread: AnyThread,
  answeredCardId: string | undefined,
  record: unknown,
  next: unknown
): Promise<string | undefined> {
  await editCard(thread, answeredCardId, record);
  return postCard(thread, next);
}
