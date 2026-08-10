/**
 * Teams host access for the tabs — one place that knows whether we are actually
 * running inside Teams.
 *
 * Outside Teams (plain browser preview) `authentication.getAuthToken()` never
 * settles: there is no host to answer the message, so a caller that awaits it
 * hangs forever. Every call here is therefore guarded by a cached initialize()
 * probe AND a timeout, so callers always get an answer — a token, or null.
 */
import { app as teamsApp, authentication } from "@microsoft/teams-js";

const HOST_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms = HOST_TIMEOUT_MS): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

let hostProbe: Promise<boolean> | null = null;

/** True only when a Teams host answered initialize() (cached per page load). */
export function inTeams(): Promise<boolean> {
  hostProbe ??= withTimeout(teamsApp.initialize().then(() => true)).then((ok) => ok === true);
  return hostProbe;
}

/** Silent SSO token, or null when there is no Teams host / consent is missing. */
export async function teamsAuthToken(): Promise<string | null> {
  if (!(await inTeams())) return null;
  return withTimeout(authentication.getAuthToken());
}

/**
 * Display name from the Teams context. Available even without an SSO token, so
 * a recognition posted from the tab is attributed to a person rather than to
 * "A colleague". It is a label only — the API never treats it as identity.
 */
export async function teamsDisplayName(): Promise<string | null> {
  if (!(await inTeams())) return null;
  const ctx = await withTimeout(teamsApp.getContext());
  return ctx?.user?.displayName ?? ctx?.user?.userPrincipalName ?? null;
}
