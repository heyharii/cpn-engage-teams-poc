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

const allowGuest = process.env.ALLOW_GUEST !== "false";

export type ResolvedIdentity = {
  oid: string;
  name: string | null;
  email: string | null;
  verified: boolean;
};

export async function resolveIdentity(request: FastifyRequest): Promise<ResolvedIdentity | null> {
  // 1) Verified Teams SSO token wins.
  if (ssoConfigured()) {
    const result = await verifyTeamsToken(request.headers.authorization);
    if (result.ok) {
      return { oid: result.user.oid, name: result.user.name, email: result.user.email, verified: true };
    }
    // Token present but invalid → don't silently downgrade to guest.
    if (request.headers.authorization) return null;
  }

  // 2) Dev/preview guest fallback.
  if (allowGuest) {
    const raw = request.headers["x-cpn-guest"];
    const guest = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (guest) {
      const oid = `guest:${guest.slice(0, 64)}`;
      return { oid, name: null, email: null, verified: false };
    }
  }

  return null;
}
