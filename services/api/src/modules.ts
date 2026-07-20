/**
 * Learning Journey modules — persistence for content AUTHORED in the Admin.
 * One row per module; the nested lesson + quiz questions live in jsonb so the
 * whole ModuleContent round-trips unchanged to the bot. Shares the app Postgres
 * (same DATABASE_URL as scores/directory). Seeds the demo modules on first run.
 */
import postgres from "postgres";
import { demoModuleContent, type ModuleContent } from "@cpn-engage/shared";

const url = process.env.DATABASE_URL?.trim();
const isLocalDb = (u: string) => ["localhost", "127.0.0.1", "postgres"].includes(new URL(u).hostname);
const sql = url
  ? postgres(url, { ssl: isLocalDb(url) ? false : "require", max: 5 })
  : null;

export const modulesEnabled = Boolean(sql);

export async function initModules(): Promise<void> {
  if (!sql) {
    console.log("[modules] no DATABASE_URL — using in-memory demo modules");
    return;
  }
  await sql`
    create table if not exists modules (
      id text primary key,
      track text not null,
      title text not null,
      summary text,
      duration_min integer default 0,
      video_url text,
      outcome text,
      lesson jsonb,
      questions jsonb not null default '[]',
      is_live boolean not null default true,
      order_idx integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `;
  // Editable completion award (default 75).
  await sql`alter table modules add column if not exists points integer not null default 75`;
  const existing = await sql`select count(*)::int as n from modules`;
  if (existing[0].n === 0) {
    for (const m of demoModuleContent) await upsertModule(m);
    console.log(`[modules] seeded ${demoModuleContent.length} starter modules`);
  }
  console.log("[modules] connected + modules table ready");
}

function rowToModule(r: Record<string, unknown>): ModuleContent {
  return {
    id: r.id as string,
    track: r.track as string,
    title: r.title as string,
    summary: (r.summary as string) ?? "",
    durationMin: (r.duration_min as number) ?? 0,
    videoUrl: (r.video_url as string) ?? undefined,
    outcome: (r.outcome as string) ?? undefined,
    lesson: (r.lesson as { heading: string; body: string }) ?? { heading: "", body: "" },
    questions: (r.questions as ModuleContent["questions"]) ?? [],
    points: (r.points as number) ?? 75,
    isLive: (r.is_live as boolean) ?? true,
    orderIdx: (r.order_idx as number) ?? 0
  };
}

export async function listModules(opts?: { liveOnly?: boolean }): Promise<ModuleContent[]> {
  if (!sql) return opts?.liveOnly ? demoModuleContent : demoModuleContent;
  try {
    const rows = opts?.liveOnly
      ? await sql`select * from modules where is_live = true order by order_idx asc, updated_at asc`
      : await sql`select * from modules order by order_idx asc, updated_at asc`;
    return rows.map((r) => rowToModule(r as Record<string, unknown>));
  } catch (err) {
    console.warn("[modules] list failed:", err instanceof Error ? err.message : err);
    return demoModuleContent;
  }
}

export async function upsertModule(m: ModuleContent): Promise<ModuleContent> {
  if (!sql) return m;
  await sql`
    insert into modules (id, track, title, summary, duration_min, video_url, outcome, lesson, questions, points, is_live, order_idx, updated_at)
    values (
      ${m.id}, ${m.track}, ${m.title}, ${m.summary ?? ""}, ${m.durationMin ?? 0}, ${m.videoUrl ?? null},
      ${m.outcome ?? null}, ${sql.json(m.lesson ?? { heading: "", body: "" })},
      ${sql.json(m.questions ?? [])}, ${m.points ?? 75}, ${m.isLive ?? true}, ${m.orderIdx ?? 0}, now()
    )
    on conflict (id) do update set
      track = excluded.track, title = excluded.title, summary = excluded.summary,
      duration_min = excluded.duration_min, video_url = excluded.video_url, outcome = excluded.outcome,
      lesson = excluded.lesson, questions = excluded.questions, points = excluded.points, is_live = excluded.is_live,
      order_idx = excluded.order_idx, updated_at = now()
  `;
  return m;
}

export async function deleteModule(id: string): Promise<void> {
  if (!sql) return;
  await sql`delete from modules where id = ${id}`;
}
