/**
 * Peer recognition. Two short steps held in thread state:
 *   1. "Recognise a colleague"  → ask who
 *   2. user types a name        → submit to the shared API moderation queue
 *
 * If the user types "Recognise Somruk T." in one go, we skip straight to step 2.
 */

import type { Thread } from "chat";
import { getBootstrap, submitRecognition } from "../api.ts";
import { RecognisePromptCard, RecognitionSentCard } from "../cards/index.ts";
import { state, type ThreadState } from "../state.ts";

type AnyThread = Thread<unknown, unknown>;

/** Pull a name out of "recognise Somruk T." style input, if present. */
function extractColleague(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.match(/\b(?:recogni[sz]e|praise|nominate|kudos to|thank)\b\s+(.+)/i);
  const name = m?.[1]?.trim();
  return name && name.length > 1 ? name.replace(/[.!?]+$/, "") : undefined;
}

export async function startRecognise(thread: AnyThread, fromText?: string, displayName?: string) {
  const colleague = extractColleague(fromText);
  if (colleague) {
    await completeRecognise(thread, colleague, displayName);
    return;
  }
  await state.set<ThreadState>(thread.id, { kind: "recognise", step: "await_colleague" });
  const boot = await getBootstrap();
  await thread.post(RecognisePromptCard({ behaviors: boot.behaviors }));
}

/** Called when we're mid-recognise and the user replies with a name. */
export async function continueRecognise(thread: AnyThread, text: string, displayName?: string) {
  const name = text.trim().replace(/[.!?]+$/, "");
  await completeRecognise(thread, name, displayName);
}

async function completeRecognise(thread: AnyThread, colleague: string, displayName?: string) {
  const boot = await getBootstrap();
  const behavior = boot.dailyDrop.behavior;
  await submitRecognition({
    employee: displayName ?? boot.currentUser.name,
    target: colleague,
    behavior,
    message: `${displayName ?? boot.currentUser.name} recognised ${colleague} for living ${behavior}.`
  });
  await state.set<ThreadState>(thread.id, { kind: "idle" });
  await thread.post(RecognitionSentCard({ colleague, behavior }));
}

export async function getRecogniseState(thread: AnyThread): Promise<ThreadState | null> {
  return state.get<ThreadState>(thread.id);
}
