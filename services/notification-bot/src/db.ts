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
  // Directory mirror (synced from Microsoft Graph) — powers the people picker,
  // recognition targeting/notify, and department segmentation.
  await sql`
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
  initDone = true;
  console.log("[db] connected + conversations + directory tables ready");
}

export type DirectoryUser = {
  oid: string;
  displayName: string | null;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  officeLocation: string | null;
  accountEnabled: boolean | null;
  userType: string | null;
};

/** Upsert a batch of directory users (from a Graph sync). Returns count. */
export async function upsertDirectoryUsers(users: DirectoryUser[]): Promise<number> {
  if (!sql || users.length === 0) return 0;
  let n = 0;
  for (const u of users) {
    try {
      await sql`
        insert into directory_users
          (oid, display_name, email, job_title, department, company, office_location, account_enabled, user_type, updated_at)
        values
          (${u.oid}, ${u.displayName}, ${u.email}, ${u.jobTitle}, ${u.department}, ${u.company},
           ${u.officeLocation}, ${u.accountEnabled}, ${u.userType}, now())
        on conflict (oid) do update set
          display_name = excluded.display_name,
          email = excluded.email,
          job_title = excluded.job_title,
          department = excluded.department,
          company = excluded.company,
          office_location = excluded.office_location,
          account_enabled = excluded.account_enabled,
          user_type = excluded.user_type,
          updated_at = now()
      `;
      n += 1;
    } catch (err) {
      console.warn("[db] upsertDirectoryUsers failed:", err instanceof Error ? err.message : err);
    }
  }
  return n;
}

/** Typeahead search over the directory for the people picker. */
export async function searchDirectory(query: string, limit = 6): Promise<DirectoryUser[]> {
  if (!sql) return [];
  const q = `%${query.trim()}%`;
  try {
    const rows = await sql<DirectoryUser[]>`
      select oid, display_name as "displayName", email, job_title as "jobTitle",
             department, company, office_location as "officeLocation",
             account_enabled as "accountEnabled", user_type as "userType"
      from directory_users
      where account_enabled is not false
        and (display_name ilike ${q} or email ilike ${q})
      order by display_name asc
      limit ${limit}
    `;
    return [...rows];
  } catch (err) {
    console.warn("[db] searchDirectory failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Look up one directory user by oid (to resolve a picked candidate). */
export async function getDirectoryUser(oid: string): Promise<DirectoryUser | null> {
  if (!sql) return null;
  try {
    const rows = await sql<DirectoryUser[]>`
      select oid, display_name as "displayName", email, job_title as "jobTitle",
             department, company, office_location as "officeLocation",
             account_enabled as "accountEnabled", user_type as "userType"
      from directory_users where oid = ${oid} limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Look up a captured conversation by its threadId (to resolve the user's id). */
export async function getConversationByThreadId(threadId: string): Promise<ConversationRef | null> {
  if (!sql) return null;
  try {
    const rows = await sql<ConversationRef[]>`
      select thread_id as "threadId", service_url as "serviceUrl",
             conversation_id as "conversationId", user_id as "userId",
             user_name as "userName", tenant_id as "tenantId",
             job_title as "jobTitle", department as "department"
      from conversations where thread_id = ${threadId} limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Find a captured conversation for a user oid (so the bot can DM them). */
export async function getConversationByUserId(userId: string): Promise<ConversationRef | null> {
  if (!sql) return null;
  try {
    const rows = await sql<ConversationRef[]>`
      select thread_id as "threadId", service_url as "serviceUrl",
             conversation_id as "conversationId", user_id as "userId",
             user_name as "userName", tenant_id as "tenantId",
             job_title as "jobTitle", department as "department"
      from conversations where user_id = ${userId} order by updated_at desc limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
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
