/**
 * Challenge flow (PRD Feature 2): a daily drop that can have 1..n MCQs. Each
 * question is scored (best answer = bestPoints, else basePoints), points are
 * awarded once per question (idempotent via ref), and re-answering an old card
 * is guarded as stale. After the last question a summary card shows the total.
 */

import type { Thread } from "chat";
import { normalizeDrop } from "@cpn-engage/shared";
import { getBootstrap, submitChallenge, scoreIdentity } from "../api.ts";
import { getState, setState } from "../state.ts";
import { editCard } from "../edit.ts";
import { DailyDropCard, AnswerResultCard, StalePromptCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;
type Author = { userId?: string; fullName?: string };

/** Intent "daily_challenge" — present the first question. */
export async function showChallenge(thread: AnyThread) {
  const boot = await getBootstrap();
  const drop = normalizeDrop(boot.dailyDrop);
  await setState(thread.id, { kind: "challenge", dropId: drop.id, qIndex: 0, score: 0, answeredQ: [] });
  await thread.post(DailyDropCard({ drop, question: drop.questions[0], qNum: 1, total: drop.questions.length }));
}

/** Action "submit_answer" — value "dropId|questionId|optionId". */
export async function onSubmitAnswer(
  thread: AnyThread,
  payload: { dropId: string; questionId: string; optionId: string },
  author?: Author,
  /** Message that was tapped — replaced with the result, so it stops asking. */
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
        canContinue: false
      })
    );
    return;
  }

  const chosen = question.options.find((o) => o.id === payload.optionId) ?? question.options[0]!;
  const best = question.options.find((o) => o.isBest) ?? question.options[0]!;
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

  const runningScore = st.score + pointsEarned;
  await setState(thread.id, {
    kind: "challenge",
    dropId: drop.id,
    qIndex: st.qIndex + 1,
    score: runningScore,
    answeredQ: [...st.answeredQ, payload.questionId]
  });

  // The question card BECOMES the result: same message, no answer buttons left.
  const result = AnswerResultCard({ drop, chosen, best, pointsEarned, newScore: isLast ? newScore : null });
  if (!(await editCard(thread, messageId, result))) await thread.post(result);
  // …then the next question, or finish.
  if (!isLast) {
    const next = drop.questions[st.qIndex + 1];
    await thread.post(DailyDropCard({ drop, question: next, qNum: st.qIndex + 2, total: drop.questions.length }));
  }
}
