/**
 * Enrich captured conversations with real identity:
 *   1. Bot Connector "get members" → display name + AAD object id (works even
 *      for system-triggered Graph installs whose install event had no user).
 *   2. Graph /users/{id} → job title + department (needs User.Read.All).
 *
 * Idempotent and safe to run repeatedly (e.g. after a wave of installs).
 */
import { listConversations, updateConversationProfile } from "./db.ts";
import { getConversationMembers } from "./proactive.ts";
import { getUserProfile } from "./graph.ts";

export type EnrichResult = { total: number; named: number; titled: number; failed: number };

export async function enrichAll(): Promise<EnrichResult> {
  const refs = await listConversations();
  let named = 0, titled = 0, failed = 0;

  for (const ref of refs) {
    try {
      // 1) Resolve the human member of the 1:1 (skip the bot — it has no aadObjectId).
      const members = await getConversationMembers(ref.serviceUrl, ref.conversationId);
      const user = members.find((m) => m.aadObjectId) ?? members[0];
      const aad = user?.aadObjectId ?? null;
      const name = user?.name ?? user?.userPrincipalName ?? null;

      // 2) Directory profile for title + department (best-effort).
      let jobTitle: string | null = null;
      let department: string | null = null;
      let displayName = name;
      if (aad ?? user?.userPrincipalName) {
        const profile = await getUserProfile((aad ?? user?.userPrincipalName) as string);
        if (profile) {
          jobTitle = profile.jobTitle ?? null;
          department = profile.department ?? null;
          displayName = profile.displayName ?? displayName;
        }
      }

      await updateConversationProfile(ref.threadId, {
        userId: aad,
        userName: displayName,
        jobTitle,
        department
      });
      if (displayName) named += 1;
      if (jobTitle) titled += 1;
    } catch (err) {
      console.warn("[enrich] failed for", ref.threadId, err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  console.log(`[enrich] total=${refs.length} named=${named} titled=${titled} failed=${failed}`);
  return { total: refs.length, named, titled, failed };
}
