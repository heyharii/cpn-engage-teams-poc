/**
 * Engagement analytics — real aggregates over the per-user tables, so the admin
 * Overview answers "is engagement working?" instead of showing static demo
 * counts. All time-series are computed in SQL from actual events.
 */
import { sql } from "./db.js";

export type Analytics = {
  totals: { users: number; points: number; recognitions: number; modulesCompleted: number };
  participationByDay: { day: string; users: number }[]; // distinct users answering a drop
  recognitionsByDay: { day: string; count: number }[];
  departmentLeague: { department: string; points: number; people: number }[];
  topLearners: { name: string; completed: number }[];
};

const EMPTY: Analytics = {
  totals: { users: 0, points: 0, recognitions: 0, modulesCompleted: 0 },
  participationByDay: [],
  recognitionsByDay: [],
  departmentLeague: [],
  topLearners: []
};
const CACHE_MS = 30_000;
const analyticsCache = new Map<number, { expiresAt: number; value: Analytics }>();

/** Zero-fill a daily series for the last `days` so charts don't have gaps. */
function fillDays(rows: { day: string; n: number }[], days: number): { day: string; value: number }[] {
  const byDay = new Map(rows.map((r) => [String(r.day).slice(0, 10), Number(r.n)]));
  const out: { day: string; value: number }[] = [];
  const today = Math.floor(Date.now() / 86400000);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date((today - i) * 86400000).toISOString().slice(0, 10);
    out.push({ day: d, value: byDay.get(d) ?? 0 });
  }
  return out;
}

export async function getAnalytics(days = 14): Promise<Analytics> {
  if (!sql) return EMPTY;
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 90);
  const cached = analyticsCache.get(safeDays);
  if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.value);
  try {
    const [users, points, recognitions, modsDone, partRows, recRows, dept, learners] = await Promise.all([
      sql`select count(*)::int as n from user_profiles`,
      sql`select coalesce(sum(points),0)::int as n from user_score_totals`,
      sql`select coalesce(sum(recognitions),0)::int as n from daily_recognition_totals`,
      sql`select coalesce(sum(completed),0)::int as n from user_module_totals`,
      sql`
        select to_char(business_day, 'YYYY-MM-DD') as day, users::int as n
        from daily_challenge_totals
        where business_day >= current_date - (${safeDays} - 1)
        order by business_day
      `,
      sql`
        select to_char(business_day, 'YYYY-MM-DD') as day, recognitions::int as n
        from daily_recognition_totals
        where business_day >= current_date - (${safeDays} - 1)
        order by business_day
      `,
      sql`
        select coalesce(d.department, 'Unassigned') as department,
               sum(s.points)::int as points, count(distinct s.user_key)::int as people
        from user_score_totals s
        left join directory_users d on d.oid = s.user_key
        group by 1 order by points desc limit 8
      `,
      sql`
        select coalesce(d.display_name, p.name, p.oid) as name, ump.completed::int as completed
        from user_module_totals ump
        left join user_profiles p on p.oid = ump.user_key
        left join directory_users d on d.oid = ump.user_key
        order by ump.completed desc, ump.user_key asc limit 5
      `
    ]);

    const value: Analytics = {
      totals: {
        users: (users[0] as { n: number }).n,
        points: (points[0] as { n: number }).n,
        recognitions: (recognitions[0] as { n: number }).n,
        modulesCompleted: (modsDone[0] as { n: number }).n
      },
      participationByDay: fillDays(partRows as unknown as { day: string; n: number }[], safeDays).map((r) => ({
        day: r.day,
        users: r.value
      })),
      recognitionsByDay: fillDays(recRows as unknown as { day: string; n: number }[], safeDays).map((r) => ({
        day: r.day,
        count: r.value
      })),
      departmentLeague: (dept as unknown as { department: string; points: number; people: number }[]).map((r) => ({
        department: r.department,
        points: r.points,
        people: r.people
      })),
      topLearners: (learners as unknown as { name: string; completed: number }[]).map((r) => ({
        name: r.name,
        completed: r.completed
      }))
    };
    analyticsCache.set(safeDays, { expiresAt: Date.now() + CACHE_MS, value });
    return structuredClone(value);
  } catch (err) {
    console.warn("[analytics] failed:", err instanceof Error ? err.message : err);
    return EMPTY;
  }
}
