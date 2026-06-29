/**
 * Postgres client for proactive messaging — stores one conversation reference
 * per user so the bot can DM them first (scheduled drops, reminders).
 *
 * Portable: works on Render (managed Postgres) now and on-prem later — only
 * DATABASE_URL changes. Fails soft when DATABASE_URL is unset (local dev): the
 * bot still replies, it just can't remember refs for proactive push.
 */
import postgres from "postgres";

export type ConversationRef = {
  threadId: string;
  serviceUrl: string;
  conversationId: string;
  userId: string | null;
  userName: string | null;
  tenantId: string | null;
  jobTitle: string | null;
  department: string | null;
};

const url = process.env.DATABASE_URL?.trim();
export const sql = url
  ? postgres(url, { ssl: url.includes("localhost") ? false : "require", max: 5 })
  : null;

let initDone = false;
export async function initDb(): Promise<void> {
  if (!sql || initDone) return;
  await sql`
    create table if not exists conversations (
      thread_id text primary key,
      service_url text not null,
      conversation_id text not null,
      user_id text,
      user_name text,
      tenant_id text,
      updated_at timestamptz not null default now()
    )
  `;
  // Enrichment columns (name/title/department resolved from Teams + Graph).
  await sql`alter table conversations add column if not exists job_title text`;
  await sql`alter table conversations add column if not exists department text`;
  initDone = true;
  console.log("[db] connected + conversations table ready");
}

export async function rememberConversation(
  ref: Omit<ConversationRef, "jobTitle" | "department">
): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into conversations (thread_id, service_url, conversation_id, user_id, user_name, tenant_id, updated_at)
      values (${ref.threadId}, ${ref.serviceUrl}, ${ref.conversationId}, ${ref.userId}, ${ref.userName}, ${ref.tenantId}, now())
      on conflict (thread_id) do update set
        service_url = excluded.service_url,
        conversation_id = excluded.conversation_id,
        user_id = excluded.user_id,
        user_name = excluded.user_name,
        tenant_id = excluded.tenant_id,
        updated_at = now()
    `;
  } catch (err) {
    console.warn("[db] rememberConversation failed:", err instanceof Error ? err.message : err);
  }
}

export async function listConversations(): Promise<ConversationRef[]> {
  if (!sql) return [];
  try {
    const rows = await sql<ConversationRef[]>`
      select thread_id as "threadId", service_url as "serviceUrl",
             conversation_id as "conversationId", user_id as "userId",
             user_name as "userName", tenant_id as "tenantId",
             job_title as "jobTitle", department as "department"
      from conversations order by updated_at desc
    `;
    return [...rows];
  } catch (err) {
    console.warn("[db] listConversations failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Update the resolved profile fields for one conversation (enrichment). */
export async function updateConversationProfile(
  threadId: string,
  p: { userId?: string | null; userName?: string | null; jobTitle?: string | null; department?: string | null }
): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      update conversations set
        user_id    = coalesce(${p.userId ?? null}, user_id),
        user_name  = coalesce(${p.userName ?? null}, user_name),
        job_title  = coalesce(${p.jobTitle ?? null}, job_title),
        department = coalesce(${p.department ?? null}, department)
      where thread_id = ${threadId}
    `;
  } catch (err) {
    console.warn("[db] updateConversationProfile failed:", err instanceof Error ? err.message : err);
  }
}
