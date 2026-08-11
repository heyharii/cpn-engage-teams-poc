/**
 * Learning Journey (PRD Feature 1) as a state machine:
 *   browse → intro → video → text → quiz(0..n) → complete(score)
 *
 * Two rules hold every step together:
 *
 *  1. The card the user answered is edited into a buttonless record, and the
 *     next step is POSTED below (see `advanceStep`). An answered card can never
 *     be tapped again, and every step raises a Teams notification.
 *
 *  2. Every handler checks the exact step it belongs to — not just the module
 *     id. Identity alone is not enough: a duplicate video card (from Continue,
 *     or from a second intro) would otherwise drag a user in the quiz back to
 *     the lesson and strand them on an already-answered question.
 */

import type { Thread } from "chat";
import { getModule, firstAssignedModule, nextModuleAfter, allModules } from "../content.ts";
import { getState, setState, clearState, describeFlow, type ThreadState } from "../state.ts";
import { submitModuleComplete, scoreIdentity } from "../api.ts";
import { advanceStep, postCard } from "../edit.ts";
import { moduleList, quizAnswerResult, quizQuestion } from "../cards/resolve.ts";
import {
  ModuleIntroCard,
  VideoLessonCard,
  TextLessonCard,
  ModuleCompleteCard,
  StalePromptCard,
  ConflictCard,
  StepDoneCard
} from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/**
 * Intent "browse_modules" — the whole learning path, not just today's module.
 *
 * The list card is permanent, so its buttons stay live in the scrollback
 * forever. That is why `pick_module` only opens an intro: the destructive step
 * sits behind the intro's Start button, where it is guarded.
 */
export async function showModuleList(thread: AnyThread) {
  const st = await getState(thread.id);
  await postCard(
    thread,
    moduleList({ modules: allModules(), activeId: st.kind === "module" ? st.moduleId : undefined })
  );
}

/** Action "pick_module" — open one module's intro. Touches no state. */
export async function pickModule(thread: AnyThread, moduleId: string) {
  const m = getModule(moduleId);
  if (!m) return showModuleList(thread);
  await thread.post(ModuleIntroCard({ module: m }));
}

/** Intent "start_module" — present the default module's intro (no state change). */
export async function showModuleIntro(thread: AnyThread) {
  await thread.post(ModuleIntroCard({ module: firstAssignedModule() }));
}

/**
 * Action "begin_module" — the one destructive step of this flow, so it is the
 * one that must ask before overwriting. It is reachable from cards that are
 * never edited away (the intro, a daily push, "open next module"), which is
 * exactly how progress used to get wiped by a week-old tap.
 */
export async function beginModule(
  thread: AnyThread,
  moduleId: string,
  messageId?: string,
  force = false
) {
  const m = getModule(moduleId) ?? firstAssignedModule();
  const st = await getState(thread.id);

  if (!force) {
    // Already inside this module — re-starting would wipe the quiz progress.
    if (st.kind === "module" && st.moduleId === m.id) return stale(thread, st);
    const current = describeFlow(st);
    if (current) {
      await thread.post(
        ConflictCard({ current, action: { id: "force_begin_module", value: m.id, label: m.title } })
      );
      return;
    }
  }

  await setState(thread.id, {
    kind: "module",
    moduleId: m.id,
    step: "video",
    quizIdx: 0,
    correct: 0,
    answered: []
  });
  await advanceStep(
    thread,
    messageId,
    StepDoneCard({ title: "▶️ Module started", subtitle: m.title, lines: [m.summary] }),
    VideoLessonCard({ module: m })
  );
}

/** Action "watched_video" — video → text. */
export async function onWatchedVideo(thread: AnyThread, moduleId: string, messageId?: string) {
  const st = await getState(thread.id);
  const m = getModule(moduleId);
  if (st.kind !== "module" || st.moduleId !== moduleId || st.step !== "video" || !m) {
    return stale(thread, st);
  }
  await setState(thread.id, { ...st, step: "text" });
  await advanceStep(
    thread,
    messageId,
    StepDoneCard({ title: "✅ Video watched", subtitle: m.title, lines: ["On to the lesson."] }),
    TextLessonCard({ module: m, heading: m.lesson.heading, body: m.lesson.body })
  );
}

/** Action "lesson_done" — text → first quiz question. */
export async function onLessonDone(thread: AnyThread, moduleId: string, messageId?: string) {
  const st = await getState(thread.id);
  const m = getModule(moduleId);
  if (st.kind !== "module" || st.moduleId !== moduleId || st.step !== "text" || !m) {
    return stale(thread, st);
  }
  await setState(thread.id, { ...st, step: "quiz", quizIdx: 0 });
  await advanceStep(
    thread,
    messageId,
    StepDoneCard({
      title: "✅ Lesson read",
      subtitle: m.lesson.heading,
      lines: [`${m.questions.length} question(s) to go.`]
    }),
    quizQuestion({ module: m, quiz: m.questions[0]!, total: m.questions.length, answered: 0 })
  );
}

/** Action "quiz_answer" — value "moduleId|quizId|optionKey". */
export async function onQuizAnswer(
  thread: AnyThread,
  payload: { moduleId: string; quizId: string; optionKey: string },
  author?: { userId?: string; fullName?: string },
  messageId?: string
) {
  const st = await getState(thread.id);
  const m = getModule(payload.moduleId);
  if (st.kind !== "module" || st.moduleId !== payload.moduleId || st.step !== "quiz" || !m) {
    return stale(thread, st);
  }

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
  const record = quizAnswerResult({
    module: m,
    quiz: expected,
    total: m.questions.length,
    chosenKey: payload.optionKey,
    answered: nextIdx
  });

  if (nextIdx < m.questions.length) {
    await setState(thread.id, { ...st, quizIdx: nextIdx, correct: newCorrect, answered });
    await advanceStep(
      thread,
      messageId,
      record,
      quizQuestion({ module: m, quiz: m.questions[nextIdx]!, total: m.questions.length, answered: nextIdx })
    );
    return;
  }

  await clearState(thread.id);
  // Award module-completion points to the learner (idempotent per module+user).
  const id = await scoreIdentity(thread.id, author?.userId, author?.fullName);
  await submitModuleComplete(payload.moduleId, id);
  const next = nextModuleAfter(payload.moduleId);
  await advanceStep(
    thread,
    messageId,
    record,
    ModuleCompleteCard({
      module: m,
      score: newCorrect,
      total: m.questions.length,
      next: next ? { id: next.id, title: next.title } : null
    })
  );
}

/** Re-post the card for the user's current module step (Continue / resume). */
export async function resumeModule(thread: AnyThread, st: ThreadState) {
  if (st.kind !== "module") return;
  const m = getModule(st.moduleId);
  if (!m) return;
  const card =
    st.step === "video"
      ? VideoLessonCard({ module: m })
      : st.step === "text"
        ? TextLessonCard({ module: m, heading: m.lesson.heading, body: m.lesson.body })
        : quizQuestion({ module: m, quiz: m.questions[st.quizIdx]!, total: m.questions.length, answered: st.quizIdx });
  await postCard(thread, card);
}

async function stale(thread: AnyThread, st: ThreadState) {
  const flow = describeFlow(st);
  await thread.post(
    StalePromptCard({
      hint: flow
        ? `You're already at: ${flow.detail} of ${flow.label}. Tap Continue to go back to it.`
        : "That step is already done — here's the main menu.",
      canContinue: Boolean(flow)
    })
  );
}
