/**
 * Daily-drop authoring — the daily challenge used to be hardcoded demo content;
 * admins can now create/edit drops and mark ONE active. One row per drop; the
 * options array lives in jsonb so the whole DailyDrop round-trips to the bot.
 * Shares the app Postgres. Seeds the demo drop on first run.
 */
import { demoDailyDrop, normalizeDrop, type DailyDrop, type DropQuestion } from "@cpn-engage/shared";
import { sql } from "./db.js";

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
      options jsonb not null default '[]',
      is_active boolean not null default false,
      scheduled_date date,
      updated_at timestamptz not null default now()
    )
  `;
  // Editable point value (default 50 for the best answer; incorrect is zero).
  await sql`alter table daily_drops add column if not exists best_points integer not null default 50`;
  // Multi-question support: the full questions array (jsonb).
  await sql`alter table daily_drops add column if not exists questions jsonb`;
  const n = await sql`select count(*)::int as n from daily_drops`;
  if (n[0].n === 0) {
    await upsertDrop({ ...demoDailyDrop });
    await activateDrop(demoDailyDrop.id);
    console.log("[drops] seeded starter daily drop");
  }
  console.log("[drops] connected + daily_drops table ready");
}

/** jsonb sometimes round-trips as a string (double-encoded legacy rows) — normalize. */
function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToDrop(r: Record<string, unknown>): DailyDrop & { isActive: boolean; scheduledDate: string | null } {
  const questions = asArray<DropQuestion>(r.questions);
  const legacyOptions = asArray<DailyDrop["options"][number]>(r.options);
  const base = normalizeDrop({
    id: r.id as string,
    title: r.title as string,
    behavior: r.behavior as string,
    question: (r.question as string) ?? "",
    rewardLabel: (r.reward_label as string) ?? "Up to 50 points",
    questions: questions.length > 0 ? questions : [{ id: "q1", question: (r.question as string) ?? "", options: legacyOptions }],
    options: legacyOptions,
    bestPoints: (r.best_points as number) ?? 50,
    status: "pending"
  });
  return {
    ...base,
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
  const { isActive: _a, scheduledDate: _s, ...d } = rowToDrop(rows[0] as Record<string, unknown>);
  return d;
}

/** Look up one drop by id (for scoring an authored drop the demo state lacks). */
export async function getDrop(id: string): Promise<DailyDrop | null> {
  if (!sql) return demoDailyDrop.id === id ? { ...demoDailyDrop } : null;
  const rows = await sql`select * from daily_drops where id = ${id} limit 1`;
  if (rows.length === 0) return null;
  const d = rowToDrop(rows[0] as Record<string, unknown>);
  return { ...d, status: "pending" };
}

export async function upsertDrop(input: DailyDrop & { scheduledDate?: string | null }): Promise<DailyDrop> {
  if (!sql) return input;
  const drop = normalizeDrop(input); // guarantees questions[] + mirrored question/options
  await sql`
    insert into daily_drops (id, title, behavior, question, reward_label, options, questions, best_points, scheduled_date, updated_at)
    values (${drop.id}, ${drop.title}, ${drop.behavior}, ${drop.question}, ${drop.rewardLabel ?? null},
            ${sql.json(drop.options ?? [])}, ${sql.json(drop.questions ?? [])},
            ${drop.bestPoints ?? 50}, ${input.scheduledDate ?? null}, now())
    on conflict (id) do update set
      title = excluded.title, behavior = excluded.behavior, question = excluded.question,
      reward_label = excluded.reward_label,
      options = excluded.options, questions = excluded.questions, best_points = excluded.best_points,
      scheduled_date = excluded.scheduled_date, updated_at = now()
  `;
  return drop;
}

/** Make one drop the single active one (deactivates the rest). */
export async function activateDrop(id: string): Promise<void> {
  if (!sql) return;
  await sql.begin(async (tx) => {
    const exists = await tx`select 1 from daily_drops where id = ${id} for update`;
    if (exists.length === 0) throw new Error("drop not found");
    await tx`update daily_drops set is_active = false where is_active = true`;
    await tx`update daily_drops set is_active = true, updated_at = now() where id = ${id}`;
  });
}

export async function deleteDrop(id: string): Promise<void> {
  if (!sql) return;
  const rows = await sql<{ is_active: boolean }[]>`select is_active from daily_drops where id = ${id}`;
  if (rows.length === 0) throw new Error("drop not found");
  if (rows[0]!.is_active) throw new Error("activate another drop before deleting the active drop");
  await sql`delete from daily_drops where id = ${id}`;
}
