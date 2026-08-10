/**
 * Teams host access for the tabs — one place that knows whether we are actually
 * running inside Teams.
 *
 * Outside Teams (plain browser preview) `authentication.getAuthToken()` never
 * settles: there is no host to answer the message, so a caller that awaits it
 * hangs forever. Every call here is therefore guarded by a cached initialize()
 * probe AND a timeout, so callers always get an answer — a token, or null.
 *
 * When there is no token the REASON is kept, because the failures look
 * identical on screen but have opposite fixes: a tab served from a domain the
 * Entra app does not cover, versus admin consent that was never granted.
 */
import { app as teamsApp, authentication } from "@microsoft/teams-js";

// Teams can be slow on the first token of a session (consent, cold host), so
// this is generous — the point is to never hang, not to answer fast.
const HOST_TIMEOUT_MS = 10_000;

type Timed<T> = { value: T | null; error: string | null };

async function withTimeout<T>(promise: Promise<T>, ms = HOST_TIMEOUT_MS): Promise<Timed<T>> {
  return Promise.race([
    promise.then((value) => ({ value, error: null })).catch((err: unknown) => ({
      value: null,
      error: err instanceof Error ? err.message : String(err)
    })),
    new Promise<Timed<T>>((resolve) =>
      setTimeout(() => resolve({ value: null, error: `no answer from the Teams host after ${ms / 1000}s` }), ms)
    )
  ]);
}

let hostProbe: Promise<boolean> | null = null;

/** True only when a Teams host answered initialize() (cached per page load). */
export function inTeams(): Promise<boolean> {
  hostProbe ??= withTimeout(teamsApp.initialize().then(() => true)).then((r) => r.value === true);
  return hostProbe;
}

export type TokenResult = {
  token: string | null;
  /** Where the page is served from — the domain Teams matches against Entra. */
  host: string;
  inTeams: boolean;
  /** Raw reason from the Teams host when no token was issued. */
  error: string | null;
};

/** Silent SSO token plus why it was refused, when it was. */
export async function teamsAuthTokenResult(): Promise<TokenResult> {
  const host = typeof location === "undefined" ? "" : location.host;
  if (!(await inTeams())) {
    return { token: null, host, inTeams: false, error: "not running inside Teams" };
  }
  const res = await withTimeout(authentication.getAuthToken());
  return { token: res.value, host, inTeams: true, error: res.value ? null : res.error };
}

/** Convenience wrapper for callers that only need the token. */
export async function teamsAuthToken(): Promise<string | null> {
  return (await teamsAuthTokenResult()).token;
}

/**
 * Display name from the Teams context. Available even without an SSO token, so
 * a recognition posted from the tab is attributed to a person rather than to
 * "A colleague". It is a label only — the API never treats it as identity.
 */
export async function teamsDisplayName(): Promise<string | null> {
  if (!(await inTeams())) return null;
  const ctx = await withTimeout(teamsApp.getContext());
  return ctx.value?.user?.displayName ?? ctx.value?.user?.userPrincipalName ?? null;
}
