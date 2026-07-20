/**
 * Daily-drop authoring — the daily challenge used to be hardcoded demo content;
 * admins can now create/edit drops and mark ONE active. One row per drop; the
 * options array lives in jsonb so the whole DailyDrop round-trips to the bot.
 * Shares the app Postgres. Seeds the demo drop on first run.
 */
import postgres from "postgres";
import { demoDailyDrop, type DailyDrop } from "@cpn-engage/shared";

const url = process.env.DATABASE_URL?.trim();
const isLocalDb = (u: string) => ["localhost", "127.0.0.1", "postgres"].includes(new URL(u).hostname);
const sql = url ? postgres(url, { ssl: isLocalDb(url) ? false : "require", max: 4 }) : null;

export const dropsEnabled = Boolean(sql);

export async function initDrops(): Promise<void> {
  if (!sql) {
    console.log("[drops] no DATABASE_URL — using in-memory demo drop");
    return;
  }
  await sql`
    create table if not exists daily_drops (
      id text primary key,
      title text not null,
      behavior text not null,
      question text not null,
      reward_label text,
      time_limit text,
      options jsonb not null default '[]',
      is_active boolean not null default false,
      scheduled_date date,
      updated_at timestamptz not null default now()
    )
  `;
  const n = await sql`select count(*)::int as n from daily_drops`;
  if (n[0].n === 0) {
    await upsertDrop({ ...demoDailyDrop });
    await activateDrop(demoDailyDrop.id);
    console.log("[drops] seeded starter daily drop");
  }
  console.log("[drops] connected + daily_drops table ready");
}

function rowToDrop(r: Record<string, unknown>): DailyDrop & { isActive: boolean; scheduledDate: string | null } {
  return {
    id: r.id as string,
    title: r.title as string,
    behavior: r.behavior as string,
    question: r.question as string,
    rewardLabel: (r.reward_label as string) ?? "Up to 50 points",
    timeLimit: (r.time_limit as string) ?? "30 sec",
    options: (r.options as DailyDrop["options"]) ?? [],
    status: "pending",
    isActive: (r.is_active as boolean) ?? false,
    scheduledDate: (r.scheduled_date as string) ?? null
  };
}

export async function listDrops(): Promise<(DailyDrop & { isActive: boolean; scheduledDate: string | null })[]> {
  if (!sql) return [{ ...demoDailyDrop, isActive: true, scheduledDate: null }];
  const rows = await sql`select * from daily_drops order by updated_at desc`;
  return rows.map((r) => rowToDrop(r as Record<string, unknown>));
}

/** The drop the bot should serve now: the active one (demo fallback). */
export async function getActiveDrop(): Promise<DailyDrop> {
  if (!sql) return { ...demoDailyDrop };
  const rows = await sql`select * from daily_drops where is_active = true order by updated_at desc limit 1`;
  if (rows.length === 0) return { ...demoDailyDrop };
  const d = rowToDrop(rows[0] as Record<string, unknown>);
  return {
    id: d.id,
    title: d.title,
    behavior: d.behavior,
    question: d.question,
    rewardLabel: d.rewardLabel,
    timeLimit: d.timeLimit,
    options: d.options,
    status: "pending"
  };
}

/** Look up one drop by id (for scoring an authored drop the demo state lacks). */
export async function getDrop(id: string): Promise<DailyDrop | null> {
  if (!sql) return demoDailyDrop.id === id ? { ...demoDailyDrop } : null;
  const rows = await sql`select * from daily_drops where id = ${id} limit 1`;
  if (rows.length === 0) return null;
  const d = rowToDrop(rows[0] as Record<string, unknown>);
  return { ...d, status: "pending" };
}

export async function upsertDrop(drop: DailyDrop & { scheduledDate?: string | null }): Promise<DailyDrop> {
  if (!sql) return drop;
  await sql`
    insert into daily_drops (id, title, behavior, question, reward_label, time_limit, options, scheduled_date, updated_at)
    values (${drop.id}, ${drop.title}, ${drop.behavior}, ${drop.question}, ${drop.rewardLabel ?? null},
            ${drop.timeLimit ?? null}, ${JSON.stringify(drop.options)}::jsonb, ${drop.scheduledDate ?? null}, now())
    on conflict (id) do update set
      title = excluded.title, behavior = excluded.behavior, question = excluded.question,
      reward_label = excluded.reward_label, time_limit = excluded.time_limit,
      options = excluded.options, scheduled_date = excluded.scheduled_date, updated_at = now()
  `;
  return drop;
}

/** Make one drop the single active one (deactivates the rest). */
export async function activateDrop(id: string): Promise<void> {
  if (!sql) return;
  await sql.begin(async (tx) => {
    await tx`update daily_drops set is_active = false where is_active = true`;
    await tx`update daily_drops set is_active = true, updated_at = now() where id = ${id}`;
  });
}

export async function deleteDrop(id: string): Promise<void> {
  if (!sql) return;
  await sql`delete from daily_drops where id = ${id}`;
}
