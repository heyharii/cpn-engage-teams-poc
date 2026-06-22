import type { Thread } from "chat";
import { getBootstrap, getLeaderboard } from "../api.ts";
import { LeaderboardCard, PassportCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

export async function showLeaderboard(thread: AnyThread) {
  const [entries, boot] = await Promise.all([getLeaderboard(), getBootstrap()]);
  await thread.post(LeaderboardCard({ entries, you: boot.currentUser.name }));
}

export async function showPassport(thread: AnyThread) {
  const boot = await getBootstrap();
  await thread.post(
    PassportCard({ passport: boot.passport, streak: boot.streakSummary, persona: boot.persona })
  );
}
