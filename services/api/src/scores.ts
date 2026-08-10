/**
 * Per-user scoring — the real backbone of Challenges & Leaderboard (PRD #2) and
 * the passport (PRD #1). Every point-earning event (challenge answered, module
 * completed, recognition sent) is appended to `score_events`, keyed by the
 * user's AAD oid so it lines up with SSO on the Profile tab and the directory
 * for names/departments.
 *
 * Shares the same Postgres as the bot (directory_users / conversations), so the
 * leaderboard can join names + departments. Fails soft without DATABASE_URL.
 */
import { sql } from "./db.js";

export const scoringEnabled = Boolean(sql);
const leaderboardCache = new Map<string, { expiresAt: number; rows: LeaderRow[] }>();
const LEADERBOARD_CACHE_MS = 30_000;

function invalidateLeaderboardCache(): void {
  leaderboardCache.clear();
}

export async function initScores(): Promise<void> {
  if (!sql) {
    console.log("[scores] no DATABASE_URL — scoring disabled (demo leaderboard only)");
    return;
  }
  await sql`
    create table if not exists score_events (
      id bigserial primary key,
      user_key text not null,
      user_name text,
      points integer not null,
      reason text,
      ref text,
      belief text,
      created_at timestamptz not null default now()
      )
  `;
  // Keep existing databases compatible when the column was created after the
  // original score_events table.
  await sql`alter table score_events add column if not exists belief text`;
  await sql`create index if not exists score_events_user_idx on score_events (user_key)`;
  // Enforce idempotency in the database. The old select-then-insert approach
  // raced under concurrent requests.
  await sql`
    delete from score_events a using score_events b
    where a.id > b.id and a.ref is not null and a.user_key = b.user_key and a.ref = b.ref
  `;
  await sql`create unique index if not exists score_events_user_ref_uq on score_events (user_key, ref) where ref is not null`;
  console.log("[scores] connected + score_events ready");
}

/** Append a point-earning event. Idempotent per ref (skips duplicates). */
export async function recordScore(e: {
  userKey: string;
  userName?: string | null;
  points: number;
  reason: string;
  ref?: string | null;
  belief?: string | null;
}): Promise<boolean> {
  if (!sql || !e.userKey || e.points === 0) return false;
  try {
    const rows = await sql`
      insert into score_events (user_key, user_name, points, reason, ref, belief)
      values (${e.userKey}, ${e.userName ?? null}, ${e.points}, ${e.reason}, ${e.ref ?? null}, ${e.belief ?? null})
      on conflict (user_key, ref) where ref is not null do nothing
      returning id
    `;
    if (rows.length > 0) invalidateLeaderboardCache();
    return rows.length > 0;
  } catch (err) {
    console.warn("[scores] recordScore failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export type LeaderRow = { userKey: string; name: string; department: string | null; points: number };

/** Real leaderboard: total points per user, newest name + department joined.
 *  `period` limits to this week/month (rolling) or all-time. */
export async function computeLeaderboard(limit = 20, period: "week" | "month" | "all" = "all"): Promise<LeaderRow[]> {
  if (!sql) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const cacheKey = `${period}:${safeLimit}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rows.map((row) => ({ ...row }));
  try {
    const rows = period === "all"
      ? await sql<LeaderRow[]>`
          select s.user_key as "userKey", coalesce(d.display_name, s.user_name, s.user_key) as name,
                 d.department as department, s.points::int as points
          from user_score_totals s
          left join directory_users d on d.oid = s.user_key
          where s.points > 0 order by s.points desc, s.user_key asc limit ${safeLimit}
        `
      : await sql<LeaderRow[]>`
          with totals as (
            select user_key, max(user_name) as user_name, sum(points) as points
            from daily_score_totals
            where business_day >= current_date - ${period === "week" ? 6 : 29}
            group by user_key
          )
          select s.user_key as "userKey", coalesce(d.display_name, s.user_name, s.user_key) as name,
                 d.department as department, s.points::int as points
          from totals s
          left join directory_users d on d.oid = s.user_key
          where s.points > 0 order by s.points desc, s.user_key asc limit ${safeLimit}
        `;
    const result = [...rows];
    leaderboardCache.set(cacheKey, { expiresAt: Date.now() + LEADERBOARD_CACHE_MS, rows: result });
    return result.map((row) => ({ ...row }));
  } catch (err) {
    console.warn("[scores] computeLeaderboard failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Clear all score events (used by the demo reset). */
export async function clearScores(): Promise<void> {
  if (!sql) return;
  try {
    await sql.begin(async (tx) => {
      await tx`truncate table score_events`;
      await tx`truncate table user_score_totals`;
      await tx`truncate table daily_score_totals`;
    });
    invalidateLeaderboardCache();
  } catch (err) {
    console.warn("[scores] clearScores failed:", err instanceof Error ? err.message : err);
  }
}

/** One user's total (for the Profile tab), matched on their oid. */
export async function userScore(userKey: string): Promise<{ points: number; rank: number | null }> {
  if (!sql || !userKey) return { points: 0, rank: null };
  try {
    const rows = await sql<{ points: number; rank: number }[]>`
      select mine.points::int as points,
             (1 + (select count(*) from user_score_totals higher where higher.points > mine.points))::int as rank
      from user_score_totals mine where mine.user_key = ${userKey}
    `;
    return rows[0] ?? { points: 0, rank: null };
  } catch {
    return { points: 0, rank: null };
  }
}

/** Aggregate a known set of idempotency refs for server-side flow completion. */
export async function scoreRefsSummary(
  userKey: string,
  refs: string[]
): Promise<{ count: number; points: number }> {
  if (!sql || !userKey || refs.length === 0) return { count: 0, points: 0 };
  try {
    const rows = await sql<{ count: number; points: number }[]>`
      select count(*)::int as count, coalesce(sum(points), 0)::int as points
      from score_events where user_key = ${userKey} and ref in ${sql(refs)}
    `;
    return rows[0] ?? { count: 0, points: 0 };
  } catch {
    return { count: 0, points: 0 };
  }
}
