/**
 * Learning Journey flow (PRD Feature 1) as a state machine:
 *   intro → video → text → quiz(0..n) → complete(score)
 *
 * Every step guards against stale/out-of-order button presses (an old card the
 * user scrolled back to) and is idempotent — re-pressing never double-counts.
 */

import type { Thread } from "chat";
import { getModule, firstAssignedModule, nextModuleAfter } from "../content.ts";
import { getState, setState, clearState, type ThreadState } from "../state.ts";
import { submitModuleComplete, scoreIdentity } from "../api.ts";
import {
  ModuleIntroCard,
  VideoLessonCard,
  TextLessonCard,
  QuizQuestionCard,
  ModuleCompleteCard,
  StalePromptCard
} from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/** Intent "start_module" — present the intro (no state change yet). */
export async function showModuleIntro(thread: AnyThread) {
  await thread.post(ModuleIntroCard({ module: firstAssignedModule() }));
}

/** Action "begin_module" — actually start it. */
export async function beginModule(thread: AnyThread, moduleId: string) {
  const m = getModule(moduleId) ?? firstAssignedModule();
  await setState(thread.id, {
    kind: "module",
    moduleId: m.id,
    step: "video",
    quizIdx: 0,
    correct: 0,
    answered: []
  });
  await thread.post(VideoLessonCard({ module: m }));
}

/** Action "watched_video" — video → text. */
export async function onWatchedVideo(thread: AnyThread, moduleId: string) {
  const st = await getState(thread.id);
  const m = getModule(moduleId);
  if (st.kind !== "module" || st.moduleId !== moduleId || !m) return stale(thread, st);
  await setState(thread.id, { ...st, step: "text" });
  await thread.post(TextLessonCard({ module: m, heading: m.lesson.heading, body: m.lesson.body }));
}

/** Action "lesson_done" — text → first quiz question. */
export async function onLessonDone(thread: AnyThread, moduleId: string) {
  const st = await getState(thread.id);
  const m = getModule(moduleId);
  if (st.kind !== "module" || st.moduleId !== moduleId || !m) return stale(thread, st);
  await setState(thread.id, { ...st, step: "quiz", quizIdx: 0 });
  await thread.post(QuizQuestionCard({ module: m, quiz: m.questions[0]!, total: m.questions.length }));
}

/** Action "quiz_answer" — value "moduleId|quizId|optionKey". */
export async function onQuizAnswer(
  thread: AnyThread,
  payload: { moduleId: string; quizId: string; optionKey: string },
  author?: { userId?: string; fullName?: string }
) {
  const st = await getState(thread.id);
  const m = getModule(payload.moduleId);
  if (st.kind !== "module" || st.moduleId !== payload.moduleId || !m) return stale(thread, st);

  const expected = m.questions[st.quizIdx];
  // Stale / out-of-order: an old question's button, or one already answered.
  if (!expected || expected.id !== payload.quizId || st.answered.includes(payload.quizId)) {
    return stale(thread, st);
  }

  const chosen = expected.options.find((o) => o.key === payload.optionKey);
  const correct = chosen?.correct === true;
  const newCorrect = st.correct + (correct ? 1 : 0);
  const answered = [...st.answered, payload.quizId];
  const nextIdx = st.quizIdx + 1;

  if (nextIdx < m.questions.length) {
    await setState(thread.id, { ...st, quizIdx: nextIdx, correct: newCorrect, answered });
    await thread.post(QuizQuestionCard({ module: m, quiz: m.questions[nextIdx]!, total: m.questions.length }));
  } else {
    await clearState(thread.id);
    // Award module-completion points to the learner (idempotent per module+user).
    const id = await scoreIdentity(thread.id, author?.userId, author?.fullName);
    await submitModuleComplete(payload.moduleId, id);
    const next = nextModuleAfter(payload.moduleId);
    await thread.post(
      ModuleCompleteCard({
        module: m,
        score: newCorrect,
        total: m.questions.length,
        next: next ? { id: next.id, title: next.title } : null
      })
    );
  }
}

/** Re-render the card for the user's current module step (for "Continue"). */
export async function resumeModule(thread: AnyThread, st: ThreadState) {
  if (st.kind !== "module") return;
  const m = getModule(st.moduleId);
  if (!m) return;
  if (st.step === "video") await thread.post(VideoLessonCard({ module: m }));
  else if (st.step === "text") await thread.post(TextLessonCard({ module: m, heading: m.lesson.heading, body: m.lesson.body }));
  else await thread.post(QuizQuestionCard({ module: m, quiz: m.questions[st.quizIdx]!, total: m.questions.length }));
}

async function stale(thread: AnyThread, st: ThreadState) {
  const inModule = st.kind === "module";
  await thread.post(
    StalePromptCard({
      hint: inModule
        ? `You're partway through a module (question ${st.quizIdx + 1}). Tap Continue to go back to it.`
        : "That module step is already done — here's the menu.",
      canContinue: inModule
    })
  );
}
