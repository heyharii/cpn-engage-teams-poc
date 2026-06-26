/**
 * Recognition flow (PRD Feature 3), 5 guided steps:
 *   who → belief → description → media → confirm → (send)
 *
 * Text steps (who, description) read the user's typed reply; button steps
 * (belief, media, confirm) read a tap. Out-of-order taps are handled as stale.
 */

import type { Thread } from "chat";
import { getBootstrap, submitRecognition } from "../api.ts";
import { getState, setState, clearState, type ThreadState } from "../state.ts";
import {
  RecognisePromptCard,
  BeliefSelectCard,
  DescriptionPromptCard,
  MediaPromptCard,
  RecognitionConfirmCard,
  RecognitionSentCard,
  StalePromptCard
} from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/** Pull a name out of "recognise Somruk T." style input, if present. */
function extractColleague(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.match(/\b(?:recogni[sz]e|praise|nominate|kudos to|thank)\b\s+(.+)/i);
  const name = m?.[1]?.trim();
  return name && name.length > 1 ? name.replace(/[.!?]+$/, "") : undefined;
}

/** Intent "recognise" — start the flow (optionally jump if a name was given). */
export async function startRecognise(thread: AnyThread, fromText?: string) {
  const colleague = extractColleague(fromText);
  const boot = await getBootstrap();
  if (colleague) {
    await setState(thread.id, { kind: "recognise", step: "belief", colleague });
    await thread.post(BeliefSelectCard({ colleague, behaviors: boot.behaviors }));
    return;
  }
  await setState(thread.id, { kind: "recognise", step: "colleague" });
  await thread.post(RecognisePromptCard({ behaviors: boot.behaviors }));
}

/**
 * Free-text reply while mid-recognise. Returns true if consumed (colleague /
 * description steps), false otherwise (so the caller routes it as a command).
 */
export async function onRecogniseText(thread: AnyThread, text: string): Promise<boolean> {
  const st = await getState(thread.id);
  if (st.kind !== "recognise") return false;
  const clean = text.trim().replace(/[.!?]+$/, "");

  if (st.step === "colleague") {
    await setState(thread.id, { ...st, step: "belief", colleague: clean });
    const boot = await getBootstrap();
    await thread.post(BeliefSelectCard({ colleague: clean, behaviors: boot.behaviors }));
    return true;
  }
  if (st.step === "description") {
    await setState(thread.id, { ...st, step: "media", description: text.trim() });
    await thread.post(MediaPromptCard({ colleague: st.colleague ?? "your colleague" }));
    return true;
  }
  return false;
}

/** Action "recognise_belief" — value is the Belief name. */
export async function onBeliefSelect(thread: AnyThread, behavior: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "belief") return stale(thread, st);
  await setState(thread.id, { ...st, step: "description", behavior });
  await thread.post(DescriptionPromptCard({ colleague: st.colleague ?? "your colleague", behavior }));
}

/** Action "recognise_skip_media" — skip the optional attachment. */
export async function onSkipMedia(thread: AnyThread) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "media") return stale(thread, st);
  await setState(thread.id, { ...st, step: "confirm" });
  await thread.post(
    RecognitionConfirmCard({
      colleague: st.colleague ?? "",
      behavior: st.behavior ?? "",
      description: st.description ?? ""
    })
  );
}

/** Action "recognise_send" — submit to the moderation queue. */
export async function onRecogniseSend(thread: AnyThread, displayName?: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "confirm") return stale(thread, st);
  const boot = await getBootstrap();
  await submitRecognition({
    employee: displayName ?? boot.currentUser.name,
    target: st.colleague ?? "",
    behavior: st.behavior ?? "",
    message: st.description ?? `Recognised for living ${st.behavior}.`
  });
  await clearState(thread.id);
  await thread.post(RecognitionSentCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "" }));
}

/** Re-render the current recognise step (for "Continue"). */
export async function resumeRecognise(thread: AnyThread, st: ThreadState) {
  if (st.kind !== "recognise") return;
  const boot = await getBootstrap();
  switch (st.step) {
    case "colleague":
      return void thread.post(RecognisePromptCard({ behaviors: boot.behaviors }));
    case "belief":
      return void thread.post(BeliefSelectCard({ colleague: st.colleague ?? "", behaviors: boot.behaviors }));
    case "description":
      return void thread.post(DescriptionPromptCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "" }));
    case "media":
      return void thread.post(MediaPromptCard({ colleague: st.colleague ?? "" }));
    case "confirm":
      return void thread.post(
        RecognitionConfirmCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "", description: st.description ?? "" })
      );
  }
}

async function stale(thread: AnyThread, st: ThreadState) {
  await thread.post(
    StalePromptCard({
      hint: "That recognition step has moved on. Tap Continue to pick up where you are, or start over from the menu.",
      canContinue: st.kind === "recognise"
    })
  );
}
