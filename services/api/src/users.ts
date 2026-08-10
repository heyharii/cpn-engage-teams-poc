/**
 * Per-user state — the fix for the "everyone sees the same passport" bug.
 *
 * The old global `state` object (cloned from demoBootstrap) was served to every
 * caller, so one user's progress leaked to all. Here each fact is keyed to the
 * user's AAD oid and persisted:
 *   - user_profiles          who they are (upserted on first verified request)
 *   - user_module_progress   which modules THEY finished
 *   - user_challenge_runs    which daily drops THEY answered (drives streak)
 *   - score_events (scores)  their points, incl. per-Belief split
 *
 * `getMyState(oid)` assembles a personal passport from these — never the shared
 * demo object. Fails soft (returns nulls) without a database.
 */
import { sql } from "./db.js";
import { userScore } from "./scores.js";

export type UserIdentity = {
  oid: string;
  name?: string | null;
  email?: string | null;
  department?: string | null;
  jobTitle?: string | null;
};

export type PersonSearchResult = { oid: string; name: string; department: string | null };

export async function searchPeople(query: string, limit = 8): Promise<PersonSearchResult[]> {
  if (!sql || query.trim().length < 2) return [];
  const pattern = `%${query.trim().toLowerCase()}%`;
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  try {
    const rows = await sql<{ oid: string; name: string; department: string | null }[]>`
      select oid, coalesce(display_name, email, oid) as name, department
      from directory_users
      where account_enabled is not false and user_type is distinct from 'Guest'
        and lower(coalesce(display_name, '') || ' ' || coalesce(email, '')) like ${pattern}
      order by display_name asc nulls last limit ${safeLimit}
    `;
    return [...rows];
  } catch {
    return [];
  }
}

export async function getPerson(oid: string): Promise<PersonSearchResult | null> {
  if (!sql || !oid) return null;
  const rows = await sql<{ oid: string; name: string; department: string | null }[]>`
    select oid, coalesce(display_name, email, oid) as name, department
    from directory_users where oid = ${oid} and account_enabled is not false limit 1
  `;
  return rows[0] ?? null;
}

/** Upsert the profile + bump last_seen. Called on every verified request. */
export async function touchProfile(u: UserIdentity): Promise<void> {
  if (!sql || !u.oid) return;
  try {
    await sql`
      insert into user_profiles (oid, name, email, department, job_title, last_seen_at)
      values (${u.oid}, ${u.name ?? null}, ${u.email ?? null}, ${u.department ?? null}, ${u.jobTitle ?? null}, now())
      on conflict (oid) do update set
        name = coalesce(excluded.name, user_profiles.name),
        email = coalesce(excluded.email, user_profiles.email),
        department = coalesce(excluded.department, user_profiles.department),
        job_title = coalesce(excluded.job_title, user_profiles.job_title),
        last_seen_at = now()
    `;
  } catch (err) {
    console.warn("[users] touchProfile failed:", err instanceof Error ? err.message : err);
  }
}

/** Record that THIS user finished a module (idempotent per oid+module). */
export async function completeModuleForUser(oid: string, moduleId: string): Promise<boolean> {
  if (!sql || !oid) return false;
  try {
    const rows = await sql`
      insert into user_module_progress (oid, module_id, status, completed_at)
      values (${oid}, ${moduleId}, 'completed', now())
      on conflict (oid, module_id) do nothing
      returning module_id
    `;
    return rows.length > 0;
  } catch (err) {
    console.warn("[users] completeModuleForUser failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Record that THIS user answered a daily drop (drives the streak). */
export async function recordChallengeRun(
  oid: string,
  dropId: string,
  correct: boolean,
  points: number,
  businessDay: string
): Promise<boolean> {
  if (!sql || !oid) return false;
  try {
    const rows = await sql`
      insert into user_challenge_runs (oid, drop_id, correct, points, business_day)
      values (${oid}, ${dropId}, ${correct}, ${points}, ${businessDay})
      on conflict (oid, drop_id, business_day) do nothing
      returning id
    `;
    return rows.length > 0;
  } catch (err) {
    console.warn("[users] recordChallengeRun failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export type MyState = {
  profile: { oid: string; name: string | null; email: string | null; department: string | null };
  score: { points: number; rank: number | null };
  passport: {
    modulesCompleted: number;
    modulesTotal: number;
    completion: number;
    recentEntries: { id: string; date: string; title: string; points: number; status: string }[];
  };
  streak: { current: number; best: number };
  beliefs: { name: string; points: number }[];
  answeredDropToday: boolean;
  completedModuleIds: string[];
};

/**
 * Assemble the signed-in user's personal passport from their own rows.
 * `modulesTotal` is the count of live modules passed in (from the modules table)
 * so completion % is honest against current content.
 */
export async function getMyState(
  identity: UserIdentity,
  liveModuleIds: string[],
  opts?: { activeDropId?: string | null; businessDay?: string | null; modulePoints?: Map<string, number> }
): Promise<MyState> {
  const empty: MyState = {
    profile: { oid: identity.oid, name: identity.name ?? null, email: identity.email ?? null, department: identity.department ?? null },
    score: { points: 0, rank: null },
    passport: { modulesCompleted: 0, modulesTotal: liveModuleIds.length, completion: 0, recentEntries: [] },
    streak: { current: 0, best: 0 },
    beliefs: [],
    answeredDropToday: false,
    completedModuleIds: []
  };
  if (!sql || !identity.oid) return empty;

  try {
    const [score, progress, runs, beliefRows] = await Promise.all([
      userScore(identity.oid),
      sql<{ moduleId: string; completedAt: Date }[]>`
        select module_id as "moduleId", completed_at as "completedAt"
        from user_module_progress where oid = ${identity.oid} order by completed_at desc
      `,
      sql<{ dropId: string; correct: boolean; points: number; answeredAt: Date; businessDay: string | null }[]>`
        select drop_id as "dropId", correct, points, answered_at as "answeredAt", business_day::text as "businessDay"
        from user_challenge_runs where oid = ${identity.oid} order by answered_at desc
      `,
      sql<{ belief: string; points: number }[]>`
        select coalesce(belief, 'General') as belief, sum(points)::int as points
        from score_events where user_key = ${identity.oid} and belief is not null
        group by belief order by points desc
      `
    ]);

    const liveSet = new Set(liveModuleIds);
    const completedLive = progress.filter((p) => liveSet.has(p.moduleId));
    const modulesTotal = liveModuleIds.length;
    const modulesCompleted = completedLive.length;

    // Streak: trailing consecutive calendar days (local UTC) with a challenge run.
    const dayKeys = [...new Set(runs.map((r) => r.businessDay ?? new Date(r.answeredAt).toISOString().slice(0, 10)))].sort().reverse();
    const todayKey = opts?.businessDay ?? new Date().toISOString().slice(0, 10);
    const { current, best } = computeStreak(dayKeys, todayKey);
    const answeredDropToday = runs.some(
      (r) => (r.businessDay ?? new Date(r.answeredAt).toISOString().slice(0, 10)) === todayKey
        && (!opts?.activeDropId || r.dropId === opts.activeDropId)
    );

    // Recent passport entries — merge module completions + challenge runs.
    const entries = [
      ...completedLive.map((p) => ({
        id: `mod-${p.moduleId}`,
        date: new Date(p.completedAt).toISOString(),
        title: "Module completed",
        points: opts?.modulePoints?.get(p.moduleId) ?? 75,
        status: "completed" as const,
        ts: new Date(p.completedAt).getTime()
      })),
      ...runs.map((r) => ({
        id: `drop-${r.dropId}-${new Date(r.answeredAt).getTime()}`,
        date: new Date(r.answeredAt).toISOString(),
        title: r.correct ? "Daily challenge — correct" : "Daily challenge",
        points: r.points,
        status: "recorded" as const,
        ts: new Date(r.answeredAt).getTime()
      }))
    ]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8)
      .map(({ ts: _ts, ...e }) => e);

    return {
      profile: {
        oid: identity.oid,
        name: identity.name ?? null,
        email: identity.email ?? null,
        department: identity.department ?? null
      },
      score,
      passport: {
        modulesCompleted,
        modulesTotal,
        completion: modulesTotal ? Math.round((modulesCompleted / modulesTotal) * 100) : 0,
        recentEntries: entries
      },
      streak: { current, best },
      beliefs: beliefRows.map((b) => ({ name: b.belief, points: b.points })),
      answeredDropToday,
      completedModuleIds: completedLive.map((p) => p.moduleId)
    };
  } catch (err) {
    console.warn("[users] getMyState failed:", err instanceof Error ? err.message : err);
    return empty;
  }
}

/** Trailing consecutive-day streak from a descending-sorted list of YYYY-MM-DD. */
function computeStreak(descDays: string[], todayKey = new Date().toISOString().slice(0, 10)): { current: number; best: number } {
  if (descDays.length === 0) return { current: 0, best: 0 };
  const toNum = (d: string) => Math.floor(new Date(d + "T00:00:00Z").getTime() / 86400000);
  const days = descDays.map(toNum);

  // Current: starts today or yesterday, counts back while contiguous.
  const today = toNum(todayKey);
  let current = 0;
  if (days[0] === today || days[0] === today - 1) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] - 1) current++;
      else break;
    }
  }

  // Best: longest contiguous run anywhere.
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] - 1) run++;
    else run = 1;
    if (run > best) best = run;
  }
  return { current, best };
}
