/**
 * Challenge flow (PRD Feature 2): a single scored MCQ pushed regularly. Points
 * are awarded once — re-answering an old challenge card is guarded as stale.
 */

import type { Thread } from "chat";
import { getBootstrap, submitChallenge } from "../api.ts";
import { getState, setState } from "../state.ts";
import { DailyDropCard, AnswerResultCard, StalePromptCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/** Intent "daily_challenge" — present the challenge. */
export async function showChallenge(thread: AnyThread) {
  const boot = await getBootstrap();
  await setState(thread.id, { kind: "challenge", dropId: boot.dailyDrop.id, answered: false });
  await thread.post(DailyDropCard({ drop: boot.dailyDrop }));
}

/** Action "submit_answer" — value "dropId|optionId". */
export async function onSubmitAnswer(thread: AnyThread, payload: { dropId: string; optionId: string }) {
  const st = await getState(thread.id);
  const boot = await getBootstrap();
  const drop = boot.dailyDrop;

  // Stale / already answered (e.g. pressed an old challenge card again).
  if (st.kind !== "challenge" || st.dropId !== payload.dropId || st.answered) {
    await thread.post(
      StalePromptCard({
        hint: "You've already answered this challenge. Check the leaderboard, or come back for the next one.",
        canContinue: false
      })
    );
    return;
  }

  const chosen = drop.options.find((o) => o.id === payload.optionId) ?? drop.options[0]!;
  const best = drop.options.find((o) => o.isBest) ?? drop.options[0]!;
  const pointsEarned = chosen.isBest ? 50 : 20;

  let newScore: number | null = null;
  const updated = await submitChallenge(drop.id);
  if (updated) newScore = updated.passport.score;

  await setState(thread.id, { kind: "challenge", dropId: payload.dropId, answered: true });
  await thread.post(AnswerResultCard({ drop, chosen, best, pointsEarned, newScore }));
}
