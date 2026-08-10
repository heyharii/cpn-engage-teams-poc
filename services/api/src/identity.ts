/**
 * Request identity for the employee tabs.
 *
 * Production: the Teams SSO Bearer token is verified (sso.ts) and the oid comes
 * from the signed token — a caller cannot impersonate another user.
 *
 * Dev/preview (no SSO configured, or plain browser): fall back to a stable
 * guest id derived from an `x-cpn-guest` header the tab sends (persisted in the
 * browser). This keeps local review working and STILL gives each browser its
 * own per-user state — it is clearly marked `verified: false` and only enabled
 * when ALLOW_GUEST !== "false".
 */
import type { FastifyRequest } from "fastify";
import { ssoConfigured, verifyTeamsToken } from "./sso.js";

const allowGuest =
  process.env.ALLOW_GUEST === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.ALLOW_GUEST !== "false");

export type ResolvedIdentity = {
  oid: string;
  name: string | null;
  email: string | null;
  verified: boolean;
};

/** Optional display label sent alongside a guest id (never an identity claim). */
function headerName(request: FastifyRequest): string | null {
  const raw = request.headers["x-cpn-guest-name"];
  const name = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return name ? name.slice(0, 60) : null;
}

/** Why a request ended up verified — or why it did not. Surfaced in the tabs. */
export type SsoDiagnostics = {
  /** Server has TEAMS_APP_ID + TEAMS_APP_TENANT_ID (otherwise no token can be checked). */
  serverConfigured: boolean;
  /** The tab sent an Authorization header. */
  tokenPresent: boolean;
  /** The token verified against AAD. */
  verified: boolean;
  /** Verification failure reason, when there was one. */
  error: string | null;
};

export async function resolveIdentity(request: FastifyRequest): Promise<ResolvedIdentity | null> {
  return (await resolveIdentityDetailed(request)).identity;
}

/** resolveIdentity + the reason behind the outcome (for the SSO status badge). */
export async function resolveIdentityDetailed(
  request: FastifyRequest
): Promise<{ identity: ResolvedIdentity | null; sso: SsoDiagnostics }> {
  const sso: SsoDiagnostics = {
    serverConfigured: ssoConfigured(),
    tokenPresent: Boolean(request.headers.authorization),
    verified: false,
    error: null
  };
  const identity = await resolve(request, sso);
  return { identity, sso };
}

async function resolve(request: FastifyRequest, sso: SsoDiagnostics): Promise<ResolvedIdentity | null> {
  // 1) Verified Teams SSO token wins.
  if (ssoConfigured()) {
    const result = await verifyTeamsToken(request.headers.authorization);
    if (result.ok) {
      sso.verified = true;
      return { oid: result.user.oid, name: result.user.name, email: result.user.email, verified: true };
    }
    sso.error = result.error;
    // Token present but invalid (consent missing, audience mismatch, expired).
    // Where guests are disallowed — the on-prem install — this is a hard stop:
    // an unverifiable token must never pass as an identity. Where guests ARE
    // allowed (demo/preview tenants), fall through to the unverified guest id
    // instead, so a half-wired SSO app registration doesn't brick every write
    // in the tab. The result is still marked `verified: false`.
    if (request.headers.authorization) {
      if (!allowGuest) return null;
      console.warn(`[identity] SSO token rejected (${result.error}) — continuing as unverified guest`);
    }
  }

  // 2) Dev/preview guest fallback.
  if (allowGuest) {
    const raw = request.headers["x-cpn-guest"];
    const guest = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (guest) {
      const oid = `guest:${guest.slice(0, 64)}`;
      // A display name may accompany the guest id (the Teams host knows who the
      // user is even before SSO consent). It labels posts/comments only —
      // identity stays the guest id and the request stays `verified: false`.
      return { oid, name: headerName(request), email: null, verified: false };
    }
  }

  return null;
}
