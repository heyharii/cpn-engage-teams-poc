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
import { syncDirectory } from "./directory.ts";
import { ChallengeReminderCard, ModuleAssignedCard } from "./cards/index.ts";
import { firstAssignedModule, getModule, refreshModules } from "./content.ts";
import { recordBroadcast, sql } from "./db.ts";

const QUEUE = "proactive-push";
const QUEUE_DIR = "directory-sync";
let boss: PgBoss | null = null;

type PushJob = { type?: "challenge" | "module"; moduleId?: string | null };

/** Run a push job: challenge (default) or a specific/first module. */
async function runPushJob(payload: PushJob, jobId?: string) {
  const type = payload?.type ?? "challenge";
  let label: string;
  let card;
  if (type === "module") {
    await refreshModules();
    const m = (payload.moduleId ? getModule(payload.moduleId) : null) ?? firstAssignedModule();
    label = m.title;
    card = ModuleAssignedCard({ moduleId: m.id, title: m.title, track: m.track, durationMin: m.durationMin });
  } else {
    const boot = await getBootstrap();
    label = boot.dailyDrop.behavior;
    card = ChallengeReminderCard({
      behavior: boot.dailyDrop.behavior,
      reward: boot.dailyDrop.rewardLabel
    });
  }
  const r = await pushCardToAll(card);
  await recordBroadcast({ kind: type, label, sent: r.sent, total: r.total });
  if (jobId && sql) {
    try {
      await sql`update scheduled_broadcasts set status = 'sent' where id = ${jobId}`;
    } catch {
      /* ignore */
    }
  }
  console.log(`[scheduler] ${type} pushed → sent ${r.sent}/${r.total}`);
}

export async function startScheduler(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("[scheduler] no DATABASE_URL — scheduler disabled");
    return;
  }
  const isLocalDb = ["localhost", "127.0.0.1", "postgres"].includes(new URL(url).hostname);
  boss = new PgBoss({
    connectionString: url,
    ssl: isLocalDb ? false : { rejectUnauthorized: false }
  });
  boss.on("error", (e: unknown) => console.warn("[scheduler] error:", e instanceof Error ? e.message : e));
  await boss.start();
  await boss.createQueue(QUEUE);

  // Worker: retries (built-in) then dead-letter after max attempts. Handles the
  // recurring cron (empty payload → challenge) and admin-scheduled one-offs.
  await boss.work(QUEUE, async (jobs: unknown) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    const data = (job as { data?: PushJob })?.data ?? {};
    const jobId = (job as { id?: string })?.id;
    await runPushJob(data, jobId);
  });

  // Recurring cron — from admin settings (daily_drop_time/tz), env fallback.
  await applyDailySchedule();

  // Directory sync — refresh the local mirror from Graph daily (default 03:00).
  await boss.createQueue(QUEUE_DIR);
  await boss.work(QUEUE_DIR, async () => {
    const r = await syncDirectory();
    console.log(`[scheduler] directory sync → fetched ${r.fetched}, upserted ${r.upserted}`);
  });
  const dirCron = process.env.CRON_DIRECTORY_SYNC?.trim() || "0 3 * * *";
  const dirTz = process.env.CRON_TZ?.trim() || "Asia/Bangkok";
  await boss.schedule(QUEUE_DIR, dirCron, {}, { tz: dirTz });

  console.log(`[scheduler] started · directory-sync="${dirCron}" tz=${dirTz}`);
}

/** Read the daily-drop time+tz from settings (env fallback) and (re)schedule. */
export async function applyDailySchedule(): Promise<{ cron: string; tz: string }> {
  const fallbackTime = process.env.CRON_DAILY_DROP_TIME?.trim() || "09:00";
  const fallbackTz = process.env.CRON_TZ?.trim() || "Asia/Bangkok";
  let time = fallbackTime;
  let tz = fallbackTz;
  // Pull the admin-configured time/tz from the shared settings table.
  if (sql) {
    try {
      const rows = await sql<{ key: string; value: string }[]>`
        select key, value from app_settings where key in ('daily_drop_time', 'daily_drop_tz')
      `;
      for (const r of rows) {
        if (r.key === "daily_drop_time" && /^\d{1,2}:\d{2}$/.test(r.value)) time = r.value;
        if (r.key === "daily_drop_tz" && r.value.trim()) tz = r.value.trim();
      }
    } catch {
      /* use fallback */
    }
  }
  const [hh, mm] = time.split(":");
  const cron = `${Number(mm)} ${Number(hh)} * * *`;
  if (boss) {
    try {
      await boss.schedule(QUEUE, cron, {}, { tz });
      console.log(`[scheduler] daily drop scheduled "${cron}" tz=${tz}`);
    } catch (err) {
      console.warn("[scheduler] applyDailySchedule failed:", err instanceof Error ? err.message : err);
    }
  }
  return { cron, tz };
}

/** Fire a one-off push after N seconds — for demoing the scheduler. */
export async function scheduleTestPush(seconds: number): Promise<boolean> {
  if (!boss) return false;
  await boss.send(QUEUE, {}, { startAfter: Math.max(1, seconds) });
  return true;
}

/**
 * Schedule a real broadcast for a future time. Returns the job id (also the row
 * id in scheduled_broadcasts). pg-boss handles the timing + retries.
 */
export async function scheduleBroadcast(opts: {
  type: "challenge" | "module";
  moduleId?: string | null;
  label?: string | null;
  at: string; // ISO timestamp
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!boss) return { ok: false, error: "scheduler not running" };
  const runAt = new Date(opts.at);
  const seconds = Math.round((runAt.getTime() - Date.now()) / 1000);
  if (Number.isNaN(seconds)) return { ok: false, error: "invalid time" };
  if (seconds < 1) return { ok: false, error: "time must be in the future" };

  // The worker uses the pg-boss job id to mark the row 'sent', so a single send
  // is enough — no need to embed the id in the payload.
  const id = await boss.send(QUEUE, { type: opts.type, moduleId: opts.moduleId ?? null }, { startAfter: seconds });
  if (!id) return { ok: false, error: "could not enqueue" };
  if (sql) {
    try {
      await sql`
        insert into scheduled_broadcasts (id, kind, label, module_id, run_at, status)
        values (${id}, ${opts.type}, ${opts.label ?? null}, ${opts.moduleId ?? null}, ${runAt.toISOString()}, 'scheduled')
      `;
    } catch (err) {
      console.warn("[scheduler] persist scheduled failed:", err instanceof Error ? err.message : err);
    }
  }
  return { ok: true, id };
}

export async function listScheduled(): Promise<
  { id: string; kind: string; label: string | null; runAt: string; status: string }[]
> {
  if (!sql) return [];
  try {
    const rows = await sql`
      select id, kind, label, run_at as "runAt", status
      from scheduled_broadcasts
      where status = 'scheduled' and run_at > now() - interval '1 day'
      order by run_at asc
    `;
    return rows as unknown as { id: string; kind: string; label: string | null; runAt: string; status: string }[];
  } catch {
    return [];
  }
}

export async function cancelScheduled(id: string): Promise<boolean> {
  if (!boss) return false;
  try {
    await boss.cancel(QUEUE, id);
  } catch {
    /* job may already have run */
  }
  if (sql) {
    try {
      await sql`update scheduled_broadcasts set status = 'canceled' where id = ${id}`;
    } catch {
      /* ignore */
    }
  }
  return true;
}
