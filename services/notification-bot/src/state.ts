/**
 * Per-thread conversation state — the brain of this no-AI bot. Every flow
 * records exactly where the user is so we can: advance on the expected action,
 * gently redirect a stale/out-of-order action (e.g. a button on an old card
 * the user scrolled back to), and stay idempotent (re-pressing never corrupts
 * scores or state).
 */

import { createMemoryState } from "@chat-adapter/state-memory";

export type ThreadState =
  | { kind: "idle" }
  // Learning Journey: intro → video → text → quiz(0..n) → complete
  | {
      kind: "module";
      moduleId: string;
      step: "video" | "text" | "quiz";
      quizIdx: number; // index of the question we're waiting on
      correct: number; // running correct count (idempotent — never double-counts)
      answered: string[]; // quiz ids already answered, to guard stale presses
    }
  // Challenge: a mini-quiz of 1..n MCQs; tracks progress + running score
  | { kind: "challenge"; dropId: string; qIndex: number; score: number; answeredQ: string[] }
  // Recognition: who → belief → description → media → confirm → send
  | {
      kind: "recognise";
      step: "colleague" | "belief" | "description" | "media" | "confirm";
      colleague?: string;
      colleagueOid?: string; // resolved directory identity (for notify)
      behavior?: string;
      description?: string;
    };

export const state = createMemoryState();

export async function getState(threadId: string): Promise<ThreadState> {
  return (await state.get<ThreadState>(threadId)) ?? { kind: "idle" };
}

export async function setState(threadId: string, next: ThreadState): Promise<void> {
  await state.set<ThreadState>(threadId, next);
}

export async function clearState(threadId: string): Promise<void> {
  await state.set<ThreadState>(threadId, { kind: "idle" });
}
