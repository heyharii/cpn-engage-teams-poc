/**
 * Scheduled proactive push (PRD: modules/challenges pushed on a schedule).
 * Uses pg-boss on the same Postgres — gives cron, retries, and a dead-letter
 * queue for free, and survives restarts. On-prem-ready (just DATABASE_URL).
 *
 * The recurring cron fires the daily drop; scheduleTestPush() fires a one-off
 * soon so the scheduler can be demoed without waiting for the real time.
 */
import { PgBoss } from "pg-boss";
import { getBootstrap } from "./api.ts";
import { pushCardToAll } from "./proactive.ts";
import { ChallengeReminderCard } from "./cards/index.ts";

const QUEUE = "proactive-push";
let boss: PgBoss | null = null;

async function runDailyDropPush() {
  const boot = await getBootstrap();
  const card = ChallengeReminderCard({
    behavior: boot.dailyDrop.behavior,
    reward: boot.dailyDrop.rewardLabel,
    timeLimit: boot.dailyDrop.timeLimit
  });
  const r = await pushCardToAll(card);
  console.log(`[scheduler] daily drop pushed → sent ${r.sent}/${r.total}`);
}

export async function startScheduler(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("[scheduler] no DATABASE_URL — scheduler disabled");
    return;
  }
  boss = new PgBoss({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false }
  });
  boss.on("error", (e: unknown) => console.warn("[scheduler] error:", e instanceof Error ? e.message : e));
  await boss.start();
  await boss.createQueue(QUEUE);

  // Worker: retries (built-in) then dead-letter after max attempts.
  await boss.work(QUEUE, async () => {
    await runDailyDropPush();
  });

  // Recurring cron — default 09:00 daily, Asia/Bangkok. Override via env.
  const cron = process.env.CRON_DAILY_DROP?.trim() || "0 9 * * *";
  const tz = process.env.CRON_TZ?.trim() || "Asia/Bangkok";
  await boss.schedule(QUEUE, cron, {}, { tz });
  console.log(`[scheduler] started · daily-drop cron="${cron}" tz=${tz}`);
}

/** Fire a one-off push after N seconds — for demoing the scheduler. */
export async function scheduleTestPush(seconds: number): Promise<boolean> {
  if (!boss) return false;
  await boss.send(QUEUE, {}, { startAfter: Math.max(1, seconds) });
  return true;
}
