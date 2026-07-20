/**
 * Shared Postgres access for the API service.
 *
 * One pool for the whole process (scores/feed/modules historically each opened
 * their own — that pattern still works but new code shares this one), plus a
 * numbered migration runner backed by a `schema_migrations` table. Migrations
 * are the on-prem upgrade path: an installer runs `runMigrations()` on boot and
 * only the not-yet-applied ones execute, in order, each in its own transaction.
 *
 * Fails soft without DATABASE_URL so local/browser demos still boot (the app
 * falls back to in-memory demo content elsewhere).
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
const isLocalDb = (u: string) => ["localhost", "127.0.0.1", "postgres"].includes(new URL(u).hostname);

export const sql = url ? postgres(url, { ssl: isLocalDb(url) ? false : "require", max: 8 }) : null;
export const dbEnabled = Boolean(sql);

/**
 * Ordered migrations. NEVER edit or reorder an already-shipped entry — append a
 * new one. `id` is a zero-padded sequence; `up` receives the pool.
 */
type Migration = { id: string; name: string; up: (db: NonNullable<typeof sql>) => Promise<void> };

const MIGRATIONS: Migration[] = [
  {
    id: "0001",
    name: "user_profiles + per-user progress",
    up: async (db) => {
      await db`
        create table if not exists user_profiles (
          oid text primary key,
          name text,
          email text,
          department text,
          job_title text,
          first_seen_at timestamptz not null default now(),
          last_seen_at timestamptz not null default now()
        )
      `;
      await db`
        create table if not exists user_module_progress (
          oid text not null,
          module_id text not null,
          status text not null default 'completed',
          completed_at timestamptz not null default now(),
          primary key (oid, module_id)
        )
      `;
      await db`
        create table if not exists user_challenge_runs (
          id bigserial primary key,
          oid text not null,
          drop_id text not null,
          answered_at timestamptz not null default now(),
          correct boolean,
          points integer not null default 0
        )
      `;
      await db`create index if not exists ucr_oid_idx on user_challenge_runs (oid)`;
      await db`create index if not exists ucr_drop_idx on user_challenge_runs (oid, drop_id)`;
    }
  },
  {
    id: "0002",
    name: "score_events belief column (per-Belief split)",
    up: async (db) => {
      await db`alter table if exists score_events add column if not exists belief text`;
    }
  },
  {
    id: "0003",
    name: "client_errors ring buffer (post-distribution debugging)",
    up: async (db) => {
      await db`
        create table if not exists client_errors (
          id bigserial primary key,
          surface text,
          message text,
          detail text,
          url text,
          created_at timestamptz not null default now()
        )
      `;
      await db`create index if not exists client_errors_time_idx on client_errors (created_at desc)`;
    }
  },
  {
    id: "0004",
    name: "broadcasts history",
    up: async (db) => {
      await db`
        create table if not exists broadcasts (
          id bigserial primary key,
          kind text not null,
          label text,
          sent integer not null default 0,
          total integer not null default 0,
          created_at timestamptz not null default now()
        )
      `;
      await db`create index if not exists broadcasts_time_idx on broadcasts (created_at desc)`;
    }
  }
];

/**
 * Apply any migrations not yet recorded in schema_migrations. Idempotent and
 * safe to call on every boot. Returns the ids that ran this time.
 */
export async function runMigrations(): Promise<string[]> {
  if (!sql) {
    console.log("[db] no DATABASE_URL — migrations skipped");
    return [];
  }
  await sql`
    create table if not exists schema_migrations (
      id text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )
  `;
  const done = new Set((await sql<{ id: string }[]>`select id from schema_migrations`).map((r) => r.id));
  const ran: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await sql.begin(async (tx) => {
      await m.up(tx as unknown as NonNullable<typeof sql>);
      await tx`insert into schema_migrations (id, name) values (${m.id}, ${m.name})`;
    });
    ran.push(m.id);
    console.log(`[db] migration ${m.id} applied: ${m.name}`);
  }
  if (ran.length === 0) console.log(`[db] schema up to date (${done.size} migrations)`);
  return ran;
}

/** Cheap round-trip for readiness checks. */
export async function dbPing(): Promise<boolean> {
  if (!sql) return false;
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
