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
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
const isLocalDb = (u: string) => ["localhost", "127.0.0.1", "postgres"].includes(new URL(u).hostname);
const sql = url
  ? postgres(url, { ssl: isLocalDb(url) ? false : "require", max: 5 })
  : null;

export const scoringEnabled = Boolean(sql);

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
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists score_events_user_idx on score_events (user_key)`;
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
}): Promise<void> {
  if (!sql || !e.userKey || e.points === 0) return;
  try {
    if (e.ref) {
      const dup = await sql`select 1 from score_events where user_key = ${e.userKey} and ref = ${e.ref} limit 1`;
      if (dup.length > 0) return; // already awarded for this ref (idempotent)
    }
    await sql`
      insert into score_events (user_key, user_name, points, reason, ref, belief)
      values (${e.userKey}, ${e.userName ?? null}, ${e.points}, ${e.reason}, ${e.ref ?? null}, ${e.belief ?? null})
    `;
  } catch (err) {
    console.warn("[scores] recordScore failed:", err instanceof Error ? err.message : err);
  }
}

export type LeaderRow = { userKey: string; name: string; department: string | null; points: number };

/** Real leaderboard: total points per user, newest name + department joined. */
export async function computeLeaderboard(limit = 20): Promise<LeaderRow[]> {
  if (!sql) return [];
  try {
    const rows = await sql<LeaderRow[]>`
      select s.user_key as "userKey",
             coalesce(d.display_name, max(s.user_name), s.user_key) as name,
             d.department as department,
             sum(s.points)::int as points
      from score_events s
      left join directory_users d on d.oid = s.user_key
      group by s.user_key, d.display_name, d.department
      having sum(s.points) > 0
      order by points desc
      limit ${limit}
    `;
    return [...rows];
  } catch (err) {
    console.warn("[scores] computeLeaderboard failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Clear all score events (used by the demo reset). */
export async function clearScores(): Promise<void> {
  if (!sql) return;
  try {
    await sql`truncate table score_events`;
  } catch (err) {
    console.warn("[scores] clearScores failed:", err instanceof Error ? err.message : err);
  }
}

/** One user's total (for the Profile tab), matched on their oid. */
export async function userScore(userKey: string): Promise<{ points: number; rank: number | null }> {
  if (!sql || !userKey) return { points: 0, rank: null };
  try {
    const totals = await sql<{ userKey: string; points: number }[]>`
      select user_key as "userKey", sum(points)::int as points
      from score_events group by user_key order by points desc
    `;
    const idx = totals.findIndex((t) => t.userKey === userKey);
    return {
      points: idx >= 0 ? totals[idx].points : 0,
      rank: idx >= 0 ? idx + 1 : null
    };
  } catch {
    return { points: 0, rank: null };
  }
}
