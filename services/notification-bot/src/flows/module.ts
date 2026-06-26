/**
 * Module + daily-drop flow. "Start today's module" → intro card → the drop
 * question → answer result. Answering writes the completion back to the shared
 * API so the passport/streak/leaderboard the tabs show all move together.
 */

import type { Thread } from "chat";
import { getBootstrap, submitChallenge } from "../api.ts";
import { DailyDropCard, ModuleIntroCard, AnswerResultCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/** Intro card for the assigned module. */
export async function showModuleIntro(thread: AnyThread) {
  const boot = await getBootstrap();
  const assigned = boot.modules.find((m) => m.status === "assigned") ?? boot.modules[0];
  if (!assigned) {
    await showDailyDrop(thread);
    return;
  }
  await thread.post(ModuleIntroCard({ module: assigned, behavior: boot.dailyDrop.behavior }));
}

/** The daily drop question. */
export async function showDailyDrop(thread: AnyThread) {
  const boot = await getBootstrap();
  await thread.post(DailyDropCard({ drop: boot.dailyDrop }));
}

/**
 * Handle an answer. We award full points for the best option and partial for
 * the others (coaching, not punishing), then push the completion to the API.
 */
export async function onSubmitAnswer(thread: AnyThread, payload: { dropId: string; optionId: string }) {
  const boot = await getBootstrap();
  const drop = boot.dailyDrop;
  const chosen = drop.options.find((o) => o.id === payload.optionId) ?? drop.options[0]!;
  const best = drop.options.find((o) => o.isBest) ?? drop.options[0]!;
  const pointsEarned = chosen.isBest ? 50 : 20;

  // Write the challenge completion back to shared state (points).
  let newScore: number | null = null;
  const updated = await submitChallenge(drop.id);
  if (updated) {
    newScore = updated.passport.score;
  }

  await thread.post(AnswerResultCard({ drop, chosen, best, pointsEarned, newScore }));
}
