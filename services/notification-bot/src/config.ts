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

export const config = {
  port: Number(optional("PORT", "4177")),

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
  apiBaseUrl: optional("API_BASE_URL", "https://cpn-engage-api-teams-poc.onrender.com")
} as const;

export type Config = typeof config;
