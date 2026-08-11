/**
 * Runtime configuration for the CPN Engage Teams bot.
 *
 * The bot is a real Bot Framework conversational bot (chat SDK) — it replies
 * to messages with Adaptive Cards. Live content (leaderboard, passport, daily
 * drop) is pulled from the CPN Engage API so the bot shares the same cross-app
 * state as the three tabs.
 */

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() ?? fallback;
}

const appType = optional("TEAMS_APP_TYPE", "MultiTenant");
const apiBaseUrl = optional("API_BASE_URL", process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:4175");
if (process.env.NODE_ENV === "production" && !apiBaseUrl) {
  throw new Error("API_BASE_URL is required in production");
}

/**
 * v2 flows to EXPOSE, comma-separated (e.g. BOT_FLOWS_V2=recognise, or "all").
 *
 * This switches an entry point on; it never switches v1 off. Both versions stay
 * reachable at the same time so they can be compared side by side in one
 * conversation — and so a v2 that misbehaves in a real tenant costs nothing,
 * because the v1 route was never taken away. As more v2 flows arrive they each
 * add an entry here rather than competing for one either/or setting.
 */
/** How each v2 flow names itself on the hub, next to its v1 button. */
const V2_LABELS = { recognise: "Recognise — new form" } as const;

const exposedV2 = new Set(
  optional("BOT_FLOWS_V2")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const v2 = { recognise: exposedV2.has("recognise") || exposedV2.has("all") };

export const config = {
  port: Number(optional("PORT", "4177")),

  /** Which v2 flows the hub offers alongside their v1 counterparts. */
  v2,
  /** The v2 flows on offer, for rendering the hub's buttons. */
  v2Entries: (Object.entries(v2) as [keyof typeof v2, boolean][])
    .filter(([, on]) => on)
    .map(([id]) => ({ intent: `${id}_v2`, label: V2_LABELS[id] })),

  teams: {
    // Microsoft App ID of the Azure Bot (= Entra app registration client id).
    appId: optional("TEAMS_APP_ID"),
    // Client secret for that app registration.
    appPassword: optional("TEAMS_APP_PASSWORD"),
    // Home tenant of the app registration (only used for SingleTenant).
    tenantId: optional("TEAMS_APP_TENANT_ID"),
    // "MultiTenant" so a bot registered in one tenant can serve Teams in
    // another (our Azure subscription tenant differs from the M365 tenant).
    appType: appType === "SingleTenant" ? "SingleTenant" : "MultiTenant",
    // The Teams app PACKAGE id (manifest id) — used as externalId to find the
    // app in the org catalog for Graph proactive-install.
    manifestAppId: optional("TEAMS_MANIFEST_APP_ID", "11e326e7-3dfe-49ac-9202-1857b18d6383")
  },

  // Base URL of the deployed CPN Engage API (shared cross-app state).
  apiBaseUrl
} as const;

export type Config = typeof config;
