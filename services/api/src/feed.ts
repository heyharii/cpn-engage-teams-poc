/**
 * Durable Community Feed — persists recognition posts and emoji reactions to
 * Postgres so they survive API restarts (previously in-memory only). Same shared
 * DATABASE_URL as scores/directory/modules. Falls back to in-memory when unset.
 */
import postgres from "postgres";
import { demoFeed, type FeedItem } from "@cpn-engage/shared";

const url = process.env.DATABASE_URL?.trim();
const isLocalDb = (u: string) => ["localhost", "127.0.0.1", "postgres"].includes(new URL(u).hostname);
const sql = url
  ? postgres(url, { ssl: isLocalDb(url) ? false : "require", max: 5 })
  : null;

export const feedPersistent = Boolean(sql);

export async function initFeed(): Promise<void> {
  if (!sql) {
    console.log("[feed] no DATABASE_URL — feed stays in-memory");
    return;
  }
  await sql`
    create table if not exists feed_posts (
      id text primary key,
      kind text not null,
      title text,
      summary text,
      author text,
      target text,
      belief text,
      message text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists feed_reactions (
      feed_id text not null,
      emoji text not null,
      reactor text not null,
      created_at timestamptz not null default now(),
      primary key (feed_id, emoji, reactor)
    )
  `;
  const n = await sql`select count(*)::int as n from feed_posts`;
  if (n[0].n === 0) {
    for (const f of demoFeed.filter((f) => f.kind !== "leaderboard")) await insertPost(f);
    console.log("[feed] seeded starter feed posts");
  }
  console.log("[feed] connected + feed tables ready");
}

async function insertPost(f: FeedItem): Promise<void> {
  if (!sql) return;
  await sql`
    insert into feed_posts (id, kind, title, summary, author, target, belief, message, created_at)
    values (${f.id}, ${f.kind}, ${f.title ?? null}, ${f.summary ?? null}, ${f.author ?? null},
            ${f.target ?? null}, ${f.belief ?? null}, ${f.message ?? null}, coalesce(${f.createdAt ?? null}, now()))
    on conflict (id) do nothing
  `;
}

export async function addFeedPost(f: FeedItem): Promise<void> {
  await insertPost(f);
}

async function reactionsFor(feedId: string): Promise<{ emoji: string; count: number }[]> {
  if (!sql) return [];
  const rows = await sql<{ emoji: string; count: number }[]>`
    select emoji, count(*)::int as count from feed_reactions where feed_id = ${feedId} group by emoji
  `;
  return [...rows];
}

export async function listFeed(): Promise<FeedItem[]> {
  if (!sql) return demoFeed;
  const posts = await sql`select * from feed_posts order by created_at desc`;
  const reacts = await sql<{ feed_id: string; emoji: string; count: number }[]>`
    select feed_id, emoji, count(*)::int as count from feed_reactions group by feed_id, emoji
  `;
  const byFeed = new Map<string, { emoji: string; count: number }[]>();
  for (const r of reacts) {
    const list = byFeed.get(r.feed_id) ?? [];
    list.push({ emoji: r.emoji, count: r.count });
    byFeed.set(r.feed_id, list);
  }
  return posts.map((p) => {
    const row = p as Record<string, unknown>;
    const created = row.created_at as Date | string;
    return {
      id: row.id as string,
      kind: row.kind as FeedItem["kind"],
      title: (row.title as string) ?? "",
      summary: (row.summary as string) ?? "",
      author: (row.author as string) ?? undefined,
      target: (row.target as string) ?? undefined,
      belief: (row.belief as string) ?? undefined,
      message: (row.message as string) ?? undefined,
      createdAt: created instanceof Date ? created.toISOString() : String(created),
      reactions: byFeed.get(row.id as string) ?? []
    };
  });
}

/** Toggle a reactor's emoji on a post; returns the post's aggregated reactions. */
export async function toggleReactionDb(
  feedId: string,
  emoji: string,
  reactor: string
): Promise<{ emoji: string; count: number }[]> {
  if (!sql) return [];
  const existing = await sql`select 1 from feed_reactions where feed_id = ${feedId} and emoji = ${emoji} and reactor = ${reactor} limit 1`;
  if (existing.length > 0) {
    await sql`delete from feed_reactions where feed_id = ${feedId} and emoji = ${emoji} and reactor = ${reactor}`;
  } else {
    await sql`insert into feed_reactions (feed_id, emoji, reactor) values (${feedId}, ${emoji}, ${reactor}) on conflict do nothing`;
  }
  return reactionsFor(feedId);
}

/** Clear all feed posts + reactions (used by the demo reset). */
export async function clearFeed(): Promise<void> {
  if (!sql) return;
  await sql`truncate table feed_reactions`;
  await sql`truncate table feed_posts`;
}
