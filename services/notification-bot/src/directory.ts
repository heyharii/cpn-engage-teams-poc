/**
 * Directory sync: mirror the Microsoft Graph user directory into Postgres so the
 * bot can offer a people picker, target/notify a recognised colleague, and
 * segment by department — without hitting Graph on every interaction.
 *
 * Source of truth stays in Entra; this is a cache refreshed on demand
 * (/internal/sync-directory) or on a daily schedule.
 */
import { fetchDirectoryUsers } from "./graph.ts";
import { upsertDirectoryUsers, type DirectoryUser } from "./db.ts";

export async function syncDirectory(): Promise<{ fetched: number; upserted: number; error?: string }> {
  const users = await fetchDirectoryUsers();
  if (users.length === 0) {
    return { fetched: 0, upserted: 0, error: "no users (check User.Read.All consent + DATABASE_URL)" };
  }
  const mapped: DirectoryUser[] = users
    .filter((u) => u.id)
    .map((u) => ({
      oid: u.id,
      displayName: u.displayName ?? null,
      email: u.mail ?? u.userPrincipalName ?? null,
      jobTitle: u.jobTitle ?? null,
      department: u.department ?? null,
      company: u.companyName ?? null,
      officeLocation: u.officeLocation ?? null,
      accountEnabled: u.accountEnabled ?? null,
      userType: u.userType ?? null
    }));
  const upserted = await upsertDirectoryUsers(mapped);
  console.log(`[directory] sync: fetched ${users.length}, upserted ${upserted}`);
  return { fetched: users.length, upserted };
}
