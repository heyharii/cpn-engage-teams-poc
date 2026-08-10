/**
 * Durable Community Feed — persists recognition posts and emoji reactions to
 * Postgres so they survive API restarts (previously in-memory only). Same shared
 * DATABASE_URL as scores/directory/modules. Falls back to in-memory when unset.
 */
import { demoFeed, type FeedItem } from "@cpn-engage/shared";
import { sql } from "./db.js";

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
      target_key text,
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
  await sql`
    create table if not exists feed_comments (
      id bigserial primary key,
      feed_id text not null,
      author_key text not null,
      author_name text,
      body text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists feed_comments_feed_idx on feed_comments (feed_id, created_at)`;
  // Columns added after the original feed_posts shipped — ALTER so fresh AND
  // existing databases converge (a plain CREATE would skip an existing table).
  await sql`alter table feed_posts add column if not exists author_key text`;
  await sql`alter table feed_posts add column if not exists pending boolean not null default false`;
  // Moderation: soft-hide a post instead of hard-deleting (keeps an audit trail).
  await sql`alter table feed_posts add column if not exists hidden boolean not null default false`;
  await sql`alter table feed_posts add column if not exists target_key text`;
  await sql`
    create index if not exists feed_posts_visible_created_idx
    on feed_posts (created_at desc) where hidden = false and pending = false
  `;
  await sql`
    create index if not exists feed_posts_pending_created_idx
    on feed_posts (created_at desc) where pending = true
  `;
  await sql`delete from feed_reactions r where not exists (select 1 from feed_posts p where p.id = r.feed_id)`;
  await sql`delete from feed_comments c where not exists (select 1 from feed_posts p where p.id = c.feed_id)`;
  // Cascade removes interaction rows when demo/reset maintenance removes posts.
  await sql`alter table feed_reactions drop constraint if exists feed_reactions_feed_id_fkey`;
  await sql`alter table feed_reactions add constraint feed_reactions_feed_id_fkey foreign key (feed_id) references feed_posts(id) on delete cascade`;
  await sql`alter table feed_comments drop constraint if exists feed_comments_feed_id_fkey`;
  await sql`alter table feed_comments add constraint feed_comments_feed_id_fkey foreign key (feed_id) references feed_posts(id) on delete cascade`;
  const n = await sql`select count(*)::int as n from feed_posts`;
  if (n[0].n === 0) {
    for (const f of demoFeed.filter((f) => f.kind !== "leaderboard")) await insertPost(f);
    console.log("[feed] seeded starter feed posts");
  }
  console.log("[feed] connected + feed tables ready");
}

async function insertPost(f: FeedItem, opts?: { authorKey?: string | null; pending?: boolean }): Promise<void> {
  if (!sql) return;
  await sql`
    insert into feed_posts (id, kind, title, summary, author, target, target_key, belief, message, created_at, author_key, pending)
    values (${f.id}, ${f.kind}, ${f.title ?? null}, ${f.summary ?? null}, ${f.author ?? null},
            ${f.target ?? null}, ${f.targetKey ?? null}, ${f.belief ?? null}, ${f.message ?? null}, coalesce(${f.createdAt ?? null}, now()),
            ${opts?.authorKey ?? null}, ${opts?.pending ?? false})
    on conflict (id) do nothing
  `;
}

export async function addFeedPost(f: FeedItem, opts?: { authorKey?: string | null; pending?: boolean }): Promise<void> {
  await insertPost(f, opts);
}

/** Recognition posts awaiting approval (for the admin queue). */
export async function listPending(): Promise<(FeedItem & { authorKey: string | null })[]> {
  if (!sql) return [];
  const rows = await sql`select * from feed_posts where pending = true order by created_at desc`;
  return rows.map((p) => {
    const r = p as Record<string, unknown>;
    return {
      id: r.id as string,
      kind: r.kind as FeedItem["kind"],
      title: (r.title as string) ?? "",
      summary: (r.summary as string) ?? "",
      author: (r.author as string) ?? undefined,
      target: (r.target as string) ?? undefined,
      targetKey: (r.target_key as string) ?? undefined,
      belief: (r.belief as string) ?? undefined,
      message: (r.message as string) ?? undefined,
      authorKey: (r.author_key as string) ?? null
    };
  });
}

/** Approve a pending post → it becomes visible. Returns its author_key (to award). */
export async function approvePost(id: string): Promise<{
  authorKey: string | null;
  author: string | null;
  belief: string | null;
  target: string | null;
  targetKey: string | null;
  message: string | null;
} | null> {
  if (!sql) return null;
  const rows = await sql`
    update feed_posts set pending = false
    where id = ${id} and pending = true
    returning author_key, author, belief, target, target_key, message
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    authorKey: (r.author_key as string) ?? null,
    author: (r.author as string) ?? null,
    belief: (r.belief as string) ?? null,
    target: (r.target as string) ?? null,
    targetKey: (r.target_key as string) ?? null,
    message: (r.message as string) ?? null
  };
}

/** Reject a pending recognition without awarding points or publishing it. */
export async function rejectPost(id: string): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql`
    update feed_posts set pending = false, hidden = true
    where id = ${id} and pending = true
    returning id
  `;
  return rows.length > 0;
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
  const posts = await sql`select * from feed_posts where hidden = false and pending = false order by created_at desc`;
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
      targetKey: (row.target_key as string) ?? undefined,
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
  const post = await sql`select 1 from feed_posts where id = ${feedId} and hidden = false and pending = false`;
  if (post.length === 0) throw new Error("feed item not found");
  const existing = await sql`select 1 from feed_reactions where feed_id = ${feedId} and emoji = ${emoji} and reactor = ${reactor} limit 1`;
  if (existing.length > 0) {
    await sql`delete from feed_reactions where feed_id = ${feedId} and emoji = ${emoji} and reactor = ${reactor}`;
  } else {
    await sql`insert into feed_reactions (feed_id, emoji, reactor) values (${feedId}, ${emoji}, ${reactor}) on conflict do nothing`;
  }
  return reactionsFor(feedId);
}

export type FeedComment = {
  id: string;
  feedId: string;
  authorKey: string;
  author: string | null;
  body: string;
  createdAt: string;
};

/** All comments for a post, oldest first. */
export async function listComments(feedId: string): Promise<FeedComment[]> {
  if (!sql) return [];
  const rows = await sql<
    { id: string; feed_id: string; author_key: string; author_name: string | null; body: string; created_at: Date }[]
  >`
    select id, feed_id, author_key, author_name, body, created_at
    from feed_comments where feed_id = ${feedId} order by created_at asc
  `;
  return rows.map((r) => ({
    id: String(r.id),
    feedId: r.feed_id,
    authorKey: r.author_key,
    author: r.author_name,
    body: r.body,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
  }));
}

/** Append a comment; returns the created row. */
export async function addComment(
  feedId: string,
  authorKey: string,
  authorName: string | null,
  body: string
): Promise<FeedComment | null> {
  if (!sql) return null;
  const post = await sql`select 1 from feed_posts where id = ${feedId} and hidden = false and pending = false`;
  if (post.length === 0) return null;
  const rows = await sql<{ id: string; created_at: Date }[]>`
    insert into feed_comments (feed_id, author_key, author_name, body)
    values (${feedId}, ${authorKey}, ${authorName}, ${body})
    returning id, created_at
  `;
  const r = rows[0];
  return {
    id: String(r.id),
    feedId,
    authorKey,
    author: authorName,
    body,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
  };
}

/** Comment counts for a set of posts (single query). */
export async function commentCounts(feedIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!sql || feedIds.length === 0) return map;
  const rows = await sql<{ feed_id: string; count: number }[]>`
    select feed_id, count(*)::int as count from feed_comments
    where feed_id in ${sql(feedIds)} group by feed_id
  `;
  for (const r of rows) map.set(r.feed_id, r.count);
  return map;
}

/**
 * Keyset-paginated feed: posts strictly older than `before` (an ISO createdAt),
 * newest first, with reactions + comment counts attached. `limit` caps the page.
 */
export async function listFeedPage(
  limit = 20,
  before?: string
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  if (!sql) {
    const items = demoFeed.filter((f) => f.kind !== "leaderboard").slice(0, limit);
    return { items, nextCursor: null };
  }
  const posts = before
    ? await sql`select * from feed_posts where hidden = false and pending = false and created_at < ${before} order by created_at desc limit ${limit + 1}`
    : await sql`select * from feed_posts where hidden = false and pending = false order by created_at desc limit ${limit + 1}`;

  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;
  const ids = page.map((p) => (p as Record<string, unknown>).id as string);

  const reacts = ids.length
    ? await sql<{ feed_id: string; emoji: string; count: number }[]>`
        select feed_id, emoji, count(*)::int as count from feed_reactions
        where feed_id in ${sql(ids)} group by feed_id, emoji
      `
    : [];
  const byFeed = new Map<string, { emoji: string; count: number }[]>();
  for (const r of reacts) {
    const list = byFeed.get(r.feed_id) ?? [];
    list.push({ emoji: r.emoji, count: r.count });
    byFeed.set(r.feed_id, list);
  }
  const counts = await commentCounts(ids);

  const items: FeedItem[] = page.map((p) => {
    const row = p as Record<string, unknown>;
    const created = row.created_at as Date | string;
    return {
      id: row.id as string,
      kind: row.kind as FeedItem["kind"],
      title: (row.title as string) ?? "",
      summary: (row.summary as string) ?? "",
      author: (row.author as string) ?? undefined,
      target: (row.target as string) ?? undefined,
      targetKey: (row.target_key as string) ?? undefined,
      belief: (row.belief as string) ?? undefined,
      message: (row.message as string) ?? undefined,
      createdAt: created instanceof Date ? created.toISOString() : String(created),
      reactions: byFeed.get(row.id as string) ?? [],
      commentCount: counts.get(row.id as string) ?? 0
    } as FeedItem & { commentCount: number };
  });

  const nextCursor = hasMore ? items[items.length - 1]?.createdAt ?? null : null;
  return { items, nextCursor };
}

/** Moderation: soft-hide (or unhide) a post so it drops out of the feed. */
export async function setPostHidden(feedId: string, hidden: boolean): Promise<void> {
  if (!sql) return;
  await sql`update feed_posts set hidden = ${hidden} where id = ${feedId}`;
}

/** Clear all feed posts + reactions + comments (used by the demo reset). */
export async function clearFeed(): Promise<void> {
  if (!sql) return;
  // One statement: feed_posts is referenced by the reaction/comment foreign
  // keys, so truncating it on its own is rejected by Postgres.
  await sql`truncate table feed_posts, feed_reactions, feed_comments, daily_recognition_totals`;
}
