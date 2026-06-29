/**
 * Teams SSO token validation.
 *
 * The Profile tab calls Teams `authentication.getAuthToken()` — a SILENT call
 * (no login screen, because the user is already signed into Teams) that returns
 * an AAD access token scoped to THIS app. The tab sends it as a Bearer token;
 * here we cryptographically verify it before trusting the identity:
 *   - signature  → against AAD's published JWKS
 *   - issuer     → our tenant's v2 issuer
 *   - audience   → our app (client id or Application ID URI)
 *
 * Only after this do we trust `oid` (the user's directory object id). This is
 * what makes the personal Profile safe: a caller cannot read someone else's
 * profile by guessing an id — the id comes from a verified token, not the body.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const tenantId = process.env.TEAMS_APP_TENANT_ID?.trim() ?? "";
const clientId = process.env.TEAMS_APP_ID?.trim() ?? "";
const appIdUri = process.env.APPLICATION_ID_URI?.trim() ?? (clientId ? `api://${clientId}` : "");

// AAD v2 JWKS for this tenant (jose caches + refreshes the keys).
const jwks = tenantId
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))
  : null;

export type VerifiedUser = {
  oid: string;
  name: string | null;
  email: string | null;
  tenantId: string | null;
};

export type SsoResult = { ok: true; user: VerifiedUser } | { ok: false; error: string };

export function ssoConfigured(): boolean {
  return Boolean(jwks && clientId && tenantId);
}

export async function verifyTeamsToken(authHeader: string | undefined): Promise<SsoResult> {
  if (!jwks) return { ok: false, error: "SSO not configured (set TEAMS_APP_TENANT_ID + TEAMS_APP_ID)" };
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, error: "missing bearer token" };

  // Accept either the client id or the Application ID URI as audience — Teams
  // SSO tokens use one or the other depending on how the API scope is exposed.
  const audiences = [clientId, appIdUri].filter(Boolean);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience: audiences
    });
    const p = payload as JWTPayload & { oid?: string; name?: string; preferred_username?: string; tid?: string };
    if (!p.oid) return { ok: false, error: "token has no oid" };
    return {
      ok: true,
      user: {
        oid: p.oid,
        name: p.name ?? null,
        email: p.preferred_username ?? null,
        tenantId: p.tid ?? null
      }
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "token verification failed" };
  }
}
