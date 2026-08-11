/**
 * Recognition v2 — one card, one submit.
 *
 * v1 (`flows/recognise.ts`) is untouched and still the default. The two live
 * side by side, and they can't collide: v2 keeps its own thread-state kind
 * (`recognise2`) and its own `v2_`-prefixed action ids, so a v1 handler reading
 * v2 state falls through its step check to the stale card, and vice versa. The
 * guards added for stale cards do the version isolation for free.
 *
 * Pick the version with BOT_FLOWS_V2 (see config.flowsV2).
 */

import type { Thread } from "chat";
import type { ActionEvent } from "chat";
import { getBootstrap, submitRecognition, scoreIdentity } from "../../api.ts";
import { getState, setState, clearState } from "../../state.ts";
import { getDirectoryUser } from "../../db.ts";
import { postRawCard, editRawCard, readInputs } from "../../raw-card.ts";
import { recogniseFormCard, recogniseRecordCard, RECOGNISE_INPUTS } from "../../cards/v2/recognise.ts";
import { RecognitionSentCard, StalePromptCard } from "../../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/** Intent "recognise" when v2 is on — post the form. */
export async function startRecogniseV2(thread: AnyThread) {
  const boot = await getBootstrap();
  const cardId = await postRawCard(thread.id, recogniseFormCard(boot.behaviors));
  if (!cardId) {
    // No bot credentials, or the connector refused. Say so rather than leaving
    // the user with nothing; v1 remains available by turning the flag off.
    await thread.post(
      StalePromptCard({ hint: "The recognition form couldn't be opened just now. Try again shortly.", canContinue: false })
    );
    return;
  }
  await setState(thread.id, { kind: "recognise2", cardId });
}

/**
 * Action "v2_recognise_send". Every field arrives in one invoke, already
 * validated by the client — `isRequired` means the bot can't be handed a blank
 * colleague, Belief or story.
 */
export async function onRecogniseSendV2(event: ActionEvent<unknown>) {
  const thread = event.thread;
  if (!thread) return;
  const st = await getState(thread.id);
  if (st.kind !== "recognise2") {
    // The form was already sent, or belongs to an older conversation.
    await thread.post(
      StalePromptCard({ hint: "That recognition was already sent — start a new one from the main menu.", canContinue: false })
    );
    return;
  }

  const inputs = readInputs(event.raw);
  // The People Picker returns Microsoft Entra object ids — the same key we
  // store as colleagueOid and notify against.
  const oid = inputs[RECOGNISE_INPUTS.colleague]?.split(",")[0]?.trim() ?? "";
  const behavior = inputs[RECOGNISE_INPUTS.belief] ?? "";
  const story = inputs[RECOGNISE_INPUTS.story]?.trim() ?? "";
  if (!oid || !behavior || !story) throw new Error("recognition form came back incomplete");

  // The picker gives an id, not a name. The directory sync supplies the
  // display name; without it the recognition still posts and still notifies
  // the right person, it just reads less warmly.
  const colleague = (await getDirectoryUser(oid))?.displayName ?? "your colleague";

  const boot = await getBootstrap();
  const identity = await scoreIdentity(thread.id, event.user?.userId, event.user?.fullName);
  const submitted = await submitRecognition({
    employee: event.user?.fullName ?? boot.currentUser.name,
    target: colleague,
    targetKey: oid,
    behavior,
    message: story,
    ...identity
  });
  if (!submitted?.ok) throw new Error("Recognition could not be submitted");

  await clearState(thread.id);
  // Same rule as every other flow: the answered card becomes a record, and the
  // outcome is posted below so it raises a notification.
  await editRawCard(thread.id, event.messageId ?? st.cardId, recogniseRecordCard({ colleague, behavior, story }));
  await thread.post(RecognitionSentCard({ colleague, behavior, pending: submitted.pending }));
}
