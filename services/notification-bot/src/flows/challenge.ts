/**
 * Challenge flow (PRD Feature 2): a daily drop of 1..n MCQs. Each question is
 * scored (best answer = bestPoints, else basePoints), points are awarded once
 * per question (idempotent via ref), and re-answering an old card is stale.
 *
 * Like every flow here: the answered card becomes a buttonless result, and the
 * next question is posted below it.
 */

import type { Thread } from "chat";
import { normalizeDrop } from "@cpn-engage/shared";
import { getBootstrap, submitChallenge, scoreIdentity } from "../api.ts";
import { getState, setState, type ThreadState } from "../state.ts";
import { advanceStep, editCard, postCard } from "../edit.ts";
import { DailyDropCard, AnswerResultCard, StalePromptCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;
type Author = { userId?: string; fullName?: string };

/**
 * Intent "daily_challenge" — start the drop, or pick it back up.
 *
 * Restarting used to be unconditional, so a tap on any old "Today's challenge"
 * button reset a half-finished drop to question 1 with a zeroed score. Now an
 * unforced re-entry resumes instead.
 */
export async function showChallenge(thread: AnyThread, force = false) {
  const boot = await getBootstrap();
  const drop = normalizeDrop(boot.dailyDrop);
  const st = await getState(thread.id);

  if (!force && st.kind === "challenge" && st.dropId === drop.id && st.qIndex > 0) {
    return resumeChallenge(thread, st);
  }

  await setState(thread.id, { kind: "challenge", dropId: drop.id, qIndex: 0, score: 0, answeredQ: [] });
  await postCard(thread, DailyDropCard({ drop, question: drop.questions[0], qNum: 1, total: drop.questions.length }));
}

/** Action "submit_answer" — value "dropId|questionId|optionId". */
export async function onSubmitAnswer(
  thread: AnyThread,
  payload: { dropId: string; questionId: string; optionId: string },
  author?: Author,
  /** Message that was tapped — becomes the result, so it stops asking. */
  messageId?: string
) {
  const st = await getState(thread.id);
  const boot = await getBootstrap();
  const drop = normalizeDrop(boot.dailyDrop);

  // Stale / out-of-order (e.g. pressed an old challenge card).
  const question = drop.questions.find((q) => q.id === payload.questionId);
  if (
    st.kind !== "challenge" ||
    st.dropId !== payload.dropId ||
    !question ||
    st.answeredQ.includes(payload.questionId)
  ) {
    await thread.post(
      StalePromptCard({
        hint: "That question is already answered. Come back tomorrow for the next daily drop.",
        canContinue: st.kind === "challenge"
      })
    );
    return;
  }

  const chosen = question.options.find((o) => o.id === payload.optionId) ?? question.options[0]!;
  const pointsEarned = chosen.isBest ? drop.bestPoints ?? 50 : drop.basePoints ?? 20;

  // Award this question's points (idempotent per drop+question+user).
  const id = await scoreIdentity(thread.id, author?.userId, author?.fullName);
  const isLast = st.qIndex + 1 >= drop.questions.length;
  const updated = await submitChallenge(drop.id, {
    ...id,
    questionId: payload.questionId,
    optionId: payload.optionId,
    last: isLast
  });
  const newScore = updated?.points ?? null;

  await setState(thread.id, {
    kind: "challenge",
    dropId: drop.id,
    qIndex: st.qIndex + 1,
    score: st.score + pointsEarned,
    answeredQ: [...st.answeredQ, payload.questionId]
  });

  const result = AnswerResultCard({
    drop,
    question,
    qNum: st.qIndex + 1,
    total: drop.questions.length,
    chosenId: chosen.id,
    pointsEarned,
    newScore: isLast ? newScore : null,
    isLast
  });
  if (isLast) {
    // Nothing follows, so the answered card simply becomes the result.
    if (!(await editCard(thread, messageId, result))) await postCard(thread, result);
    return;
  }
  const next = drop.questions[st.qIndex + 1];
  await advanceStep(
    thread,
    messageId,
    result,
    DailyDropCard({ drop, question: next, qNum: st.qIndex + 2, total: drop.questions.length })
  );
}

/** Re-post the question the user is on (Continue / resume). */
export async function resumeChallenge(thread: AnyThread, st: ThreadState) {
  if (st.kind !== "challenge") return;
  const boot = await getBootstrap();
  const drop = normalizeDrop(boot.dailyDrop);
  const question = drop.questions[st.qIndex];
  if (!question) {
    // The drop rotated under them — nothing sensible left to resume.
    await thread.post(
      StalePromptCard({ hint: "That daily drop has closed. A new one lands tomorrow.", canContinue: false })
    );
    return;
  }
  await postCard(
    thread,
    DailyDropCard({ drop, question, qNum: st.qIndex + 1, total: drop.questions.length })
  );
}
