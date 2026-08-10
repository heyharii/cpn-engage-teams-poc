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

export const sql = url ? postgres(url, { ssl: isLocalDb(url) ? false : "require", max: 12 }) : null;
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
  },
  {
    id: "0005",
    name: "scheduled_broadcasts",
    up: async (db) => {
      await db`
        create table if not exists scheduled_broadcasts (
          id text primary key,
          kind text not null,
          label text,
          module_id text,
          run_at timestamptz not null,
          status text not null default 'scheduled',
          created_at timestamptz not null default now()
        )
      `;
      await db`create index if not exists sched_bc_runat_idx on scheduled_broadcasts (run_at)`;
    }
  },
  {
    id: "0006",
    name: "app_settings (configurable points etc.)",
    up: async (db) => {
      await db`
        create table if not exists app_settings (
          key text primary key,
          value text not null,
          updated_at timestamptz not null default now()
        )
      `;
      await db`insert into app_settings (key, value) values ('recognition_points', '75') on conflict (key) do nothing`;
    }
  },
  {
    id: "0007",
    name: "feed_posts approval fields",
    up: async (db) => {
      await db`alter table if exists feed_posts add column if not exists author_key text`;
      await db`alter table if exists feed_posts add column if not exists pending boolean not null default false`;
    }
  },
  {
    id: "0008",
    name: "score events and directory compatibility",
    up: async (db) => {
      // 0002 could run before initScores created score_events on a fresh DB.
      // Repair that ordering for both new and already-initialized databases.
      await db`alter table if exists score_events add column if not exists belief text`;
      // The API joins this table for leaderboard/profile reads; the bot also
      // owns it for Graph directory sync, so both services can share one DB.
      await db`
        create table if not exists directory_users (
          oid text primary key,
          display_name text,
          email text,
          job_title text,
          department text,
          company text,
          office_location text,
          account_enabled boolean,
          user_type text,
          updated_at timestamptz not null default now()
        )
      `;
    }
  },
  {
    id: "0009",
    name: "business dates and persistent bot flow state",
    up: async (db) => {
      await db`alter table if exists user_challenge_runs add column if not exists business_day date`;
      await db`
        update user_challenge_runs
        set business_day = (answered_at at time zone 'Asia/Bangkok')::date
        where business_day is null
      `;
      await db`
        delete from user_challenge_runs a using user_challenge_runs b
        where a.id > b.id and a.oid = b.oid and a.drop_id = b.drop_id
          and a.business_day = b.business_day
      `;
      await db`
        create unique index if not exists user_challenge_run_day_uq
        on user_challenge_runs (oid, drop_id, business_day)
      `;
      await db`
        create table if not exists bot_flow_states (
          thread_id text primary key,
          state jsonb not null,
          updated_at timestamptz not null default now()
        )
      `;
      await db`alter table if exists feed_posts add column if not exists target_key text`;
      await db`
        create table if not exists notification_logs (
          id text primary key,
          type text not null,
          title text not null,
          summary text not null,
          audience text not null,
          payload jsonb,
          status text not null default 'queued',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
    }
  },
  {
    id: "0010",
    name: "scalable score aggregates and read-path indexes",
    up: applyScoreAggregates
  },
  {
    // 0010 gained the recognition/module aggregates AFTER it had already been
    // applied on running databases, so those never got the new tables and every
    // read of them 500s. Re-running the same body converges them; it is fully
    // idempotent (create-if-not-exists + rebuild-from-source), so a fresh
    // install that just ran 0010 is unaffected.
    id: "0011",
    name: "converge databases that applied an earlier 0010",
    up: convergeScoreAggregates
  },
  {
    id: "0012",
    name: "feed moderation log (audit trail for hidden/flagged posts)",
    up: async (db) => {
      await db`
        create table if not exists feed_moderation_log (
          id bigserial primary key,
          feed_id text not null,
          action text not null,
          actor text,
          note text,
          created_at timestamptz not null default now()
        )
      `;
      await db`create index if not exists feed_moderation_time_idx on feed_moderation_log (created_at desc)`;
      await db`create index if not exists feed_moderation_post_idx on feed_moderation_log (feed_id)`;
    }
  }
];

/**
 * Score/module/recognition aggregates, their maintenance triggers, and the
 * read-path indexes. Idempotent by construction: tables are created only when
 * absent, functions are replaced, and every total is rebuilt from its source
 * table — so this can safely run again on a database that already has it.
 */
async function applyScoreAggregates(db: NonNullable<typeof sql>): Promise<void> {
  // Migrations run before the feature initializers on a fresh install, so
  // establish the append-only event table here before backfilling totals.
  await db`
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
  await db`
    delete from score_events a using score_events b
    where a.id > b.id and a.ref is not null and a.user_key = b.user_key and a.ref = b.ref
  `;
  await db`create unique index if not exists score_events_user_ref_uq on score_events (user_key, ref) where ref is not null`;
  await db`create index if not exists score_events_created_idx on score_events (created_at desc)`;

  await db`
    create table if not exists user_score_totals (
      user_key text primary key,
      user_name text,
      points bigint not null default 0,
      updated_at timestamptz not null default now()
    )
  `;
  await db`
    create table if not exists daily_score_totals (
      business_day date not null,
      user_key text not null,
      user_name text,
      points bigint not null default 0,
      updated_at timestamptz not null default now(),
      primary key (business_day, user_key)
    )
  `;
  // Rebuild makes the migration correct even if a prior deployment was
  // interrupted between table creation and its initial backfill.
  await db`truncate table user_score_totals`;
  await db`truncate table daily_score_totals`;
  await db`
    insert into user_score_totals (user_key, user_name, points, updated_at)
    select user_key, (array_agg(user_name order by created_at desc) filter (where user_name is not null))[1],
           sum(points), max(created_at)
    from score_events group by user_key
  `;
  await db`
    insert into daily_score_totals (business_day, user_key, user_name, points, updated_at)
    select (created_at at time zone 'UTC')::date, user_key,
           (array_agg(user_name order by created_at desc) filter (where user_name is not null))[1],
           sum(points), max(created_at)
    from score_events group by 1, user_key
  `;
  await db`
    create index if not exists user_score_totals_leaderboard_idx
    on user_score_totals (points desc, user_key asc)
  `;
  await db`create index if not exists daily_score_totals_day_points_idx on daily_score_totals (business_day, points desc)`;
  await db`
    create or replace function cpn_update_score_totals() returns trigger as $$
    begin
      insert into user_score_totals (user_key, user_name, points, updated_at)
      values (new.user_key, new.user_name, new.points, new.created_at)
      on conflict (user_key) do update set
        points = user_score_totals.points + excluded.points,
        user_name = coalesce(excluded.user_name, user_score_totals.user_name),
        updated_at = greatest(user_score_totals.updated_at, excluded.updated_at);

      insert into daily_score_totals (business_day, user_key, user_name, points, updated_at)
      values ((new.created_at at time zone 'UTC')::date, new.user_key, new.user_name, new.points, new.created_at)
      on conflict (business_day, user_key) do update set
        points = daily_score_totals.points + excluded.points,
        user_name = coalesce(excluded.user_name, daily_score_totals.user_name),
        updated_at = greatest(daily_score_totals.updated_at, excluded.updated_at);
      return new;
    end
    $$ language plpgsql
  `;
  await db`drop trigger if exists score_events_aggregate_insert on score_events`;
  await db`
    create trigger score_events_aggregate_insert
    after insert on score_events for each row execute function cpn_update_score_totals()
  `;

  await db`create extension if not exists pg_trgm`;
  await db`
    create index if not exists directory_users_search_trgm_idx on directory_users
    using gin ((lower(coalesce(display_name, '') || ' ' || coalesce(email, ''))) gin_trgm_ops)
  `;
  await db`create index if not exists user_challenge_runs_answered_idx on user_challenge_runs (answered_at desc)`;
  await db`create index if not exists user_module_progress_completed_idx on user_module_progress (completed_at desc)`;

  await db`
    create table if not exists daily_challenge_participants (
      business_day date not null,
      user_key text not null,
      primary key (business_day, user_key)
    )
  `;
  await db`
    create table if not exists daily_challenge_totals (
      business_day date primary key,
      users integer not null default 0
    )
  `;
  await db`
    insert into daily_challenge_participants (business_day, user_key)
    select coalesce(business_day, (answered_at at time zone 'UTC')::date), oid
    from user_challenge_runs group by 1, oid on conflict do nothing
  `;
  await db`truncate table daily_challenge_totals`;
  await db`
    insert into daily_challenge_totals (business_day, users)
    select business_day, count(*)::int from daily_challenge_participants group by business_day
  `;
  await db`
    create or replace function cpn_update_daily_challenge_totals() returns trigger as $$
    declare inserted_rows integer;
    begin
      insert into daily_challenge_participants (business_day, user_key)
      values (coalesce(new.business_day, (new.answered_at at time zone 'UTC')::date), new.oid)
      on conflict do nothing;
      get diagnostics inserted_rows = row_count;
      if inserted_rows = 1 then
        insert into daily_challenge_totals (business_day, users)
        values (coalesce(new.business_day, (new.answered_at at time zone 'UTC')::date), 1)
        on conflict (business_day) do update set users = daily_challenge_totals.users + 1;
      end if;
      return new;
    end
    $$ language plpgsql
  `;
  await db`drop trigger if exists user_challenge_runs_daily_insert on user_challenge_runs`;
  await db`
    create trigger user_challenge_runs_daily_insert
    after insert on user_challenge_runs for each row execute function cpn_update_daily_challenge_totals()
  `;

  await db`
    create table if not exists user_module_totals (
      user_key text primary key,
      completed integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `;
  await db`truncate table user_module_totals`;
  await db`
    insert into user_module_totals (user_key, completed, updated_at)
    select oid, count(*)::int, max(completed_at) from user_module_progress group by oid
  `;
  await db`
    create or replace function cpn_update_user_module_totals() returns trigger as $$
    begin
      insert into user_module_totals (user_key, completed, updated_at)
      values (new.oid, 1, new.completed_at)
      on conflict (user_key) do update set
        completed = user_module_totals.completed + 1,
        updated_at = greatest(user_module_totals.updated_at, excluded.updated_at);
      return new;
    end
    $$ language plpgsql
  `;
  await db`drop trigger if exists user_module_progress_aggregate_insert on user_module_progress`;
  await db`
    create trigger user_module_progress_aggregate_insert
    after insert on user_module_progress for each row execute function cpn_update_user_module_totals()
  `;

  await db`
    create table if not exists feed_posts (
      id text primary key,
      kind text not null,
      title text,
      summary text,
      author text,
      target text,
      target_key text,
      belief text,
      message text,
      created_at timestamptz not null default now(),
      author_key text,
      pending boolean not null default false,
      hidden boolean not null default false
    )
  `;
  await db`
    create index if not exists feed_posts_visible_created_idx
    on feed_posts (created_at desc) where hidden = false and pending = false
  `;
  await db`
    create index if not exists feed_posts_pending_created_idx
    on feed_posts (created_at desc) where pending = true
  `;
  await db`
    create table if not exists daily_recognition_totals (
      business_day date primary key,
      recognitions integer not null default 0
    )
  `;
  await db`truncate table daily_recognition_totals`;
  await db`
    insert into daily_recognition_totals (business_day, recognitions)
    select (created_at at time zone 'UTC')::date, count(*)::int
    from feed_posts where kind = 'recognition' and hidden = false and pending = false group by 1
  `;
  await db`
    create or replace function cpn_update_daily_recognition_totals() returns trigger as $$
    declare old_visible boolean := false;
    declare new_visible boolean := false;
    declare old_day date;
    declare new_day date;
    begin
      if tg_op <> 'INSERT' then
        old_visible := old.kind = 'recognition' and old.hidden = false and old.pending = false;
        old_day := (old.created_at at time zone 'UTC')::date;
      end if;
      if tg_op <> 'DELETE' then
        new_visible := new.kind = 'recognition' and new.hidden = false and new.pending = false;
        new_day := (new.created_at at time zone 'UTC')::date;
      end if;
      if old_visible and (not new_visible or old_day <> new_day) then
        update daily_recognition_totals set recognitions = greatest(recognitions - 1, 0)
        where business_day = old_day;
      end if;
      if new_visible and (not old_visible or old_day <> new_day) then
        insert into daily_recognition_totals (business_day, recognitions) values (new_day, 1)
        on conflict (business_day) do update set recognitions = daily_recognition_totals.recognitions + 1;
      end if;
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end
    $$ language plpgsql
  `;
  await db`drop trigger if exists feed_posts_recognition_aggregate on feed_posts`;
  await db`
    create trigger feed_posts_recognition_aggregate
    after insert or update or delete on feed_posts
    for each row execute function cpn_update_daily_recognition_totals()
  `;
}

/** Avoid a second expensive score-event backfill on fresh installs where 0010
 * just created the complete aggregate schema. Older 0010 databases lack these
 * tables and run the convergence body once. */
async function convergeScoreAggregates(db: NonNullable<typeof sql>): Promise<void> {
  const rows = await db<{ complete: boolean }[]>`
    select to_regclass('public.daily_challenge_totals') is not null
       and to_regclass('public.user_module_totals') is not null
       and to_regclass('public.daily_recognition_totals') is not null as complete
  `;
  if (rows[0]?.complete) return;
  await applyScoreAggregates(db);
}

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
