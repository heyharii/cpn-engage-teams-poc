/**
 * Post-distribution debugging support.
 *
 * On a client's box we have no SSH. The support flow is: the admin opens the
 * System page and clicks "Download debug bundle" — one JSON with versions, DB
 * health + row counts, config presence (values redacted), and the most recent
 * client-side errors captured from inside Teams (where the client can't open
 * devtools). They send us that file; we diagnose from it.
 */
import { createHash } from "node:crypto";
import { sql, dbPing } from "./db.js";

/** Presence + a short checksum of a secret, so we can confirm config without leaking it. */
function configFingerprint() {
  const keys = [
    "DATABASE_URL",
    "ADMIN_KEY",
    "TEAMS_APP_ID",
    "TEAMS_APP_TENANT_ID",
    "APPLICATION_ID_URI",
    "TEAMS_APP_PASSWORD",
    "ALLOWED_ORIGINS",
    "ALLOW_GUEST",
    "NODE_ENV"
  ];
  const out: Record<string, { set: boolean; sha8?: string; value?: string }> = {};
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (!v) {
      out[k] = { set: false };
      continue;
    }
    // Non-secret config is shown in the clear; secrets only as an 8-char hash.
    const nonSecret = ["ALLOWED_ORIGINS", "ALLOW_GUEST", "NODE_ENV"].includes(k);
    out[k] = nonSecret
      ? { set: true, value: v }
      : { set: true, sha8: createHash("sha256").update(v).digest("hex").slice(0, 8) };
  }
  return out;
}

async function rowCounts(): Promise<Record<string, number | string>> {
  if (!sql) return { _note: "no database" };
  const tables = [
    "user_profiles",
    "user_module_progress",
    "user_challenge_runs",
    "score_events",
    "modules",
    "daily_drops",
    "feed_posts",
    "feed_comments",
    "feed_reactions",
    "client_errors"
  ];
  const counts: Record<string, number | string> = {};
  for (const t of tables) {
    try {
      const r = await sql.unsafe(`select count(*)::int as n from ${t}`);
      counts[t] = (r[0] as unknown as { n: number }).n;
    } catch {
      counts[t] = "missing";
    }
  }
  return counts;
}

async function appliedMigrations(): Promise<{ id: string; name: string; applied_at: string }[]> {
  if (!sql) return [];
  try {
    return [
      ...(await sql<{ id: string; name: string; applied_at: string }[]>`
        select id, name, applied_at from schema_migrations order by id
      `)
    ];
  } catch {
    return [];
  }
}

async function recentClientErrors(limit = 50) {
  if (!sql) return [];
  try {
    return [
      ...(await sql`
        select surface, message, detail, url, created_at
        from client_errors order by created_at desc limit ${limit}
      `)
    ];
  } catch {
    return [];
  }
}

/** Record a client-side error (ring-buffered — keeps the newest 500). */
export async function recordClientError(e: {
  surface?: string;
  message?: string;
  detail?: string;
  url?: string;
}): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into client_errors (surface, message, detail, url)
      values (${e.surface ?? null}, ${(e.message ?? "").slice(0, 500)}, ${(e.detail ?? "").slice(0, 2000)}, ${e.url ?? null})
    `;
    await sql`
      delete from client_errors where id not in (
        select id from client_errors order by created_at desc limit 500
      )
    `;
  } catch {
    /* best-effort */
  }
}

export async function buildDebugBundle() {
  return {
    generatedAt: new Date().toISOString(),
    service: "api",
    version: process.env.APP_VERSION ?? "dev",
    commit: process.env.GIT_SHA ?? null,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    db: { reachable: await dbPing(), rowCounts: await rowCounts(), migrations: await appliedMigrations() },
    config: configFingerprint(),
    recentClientErrors: await recentClientErrors(50)
  };
}
