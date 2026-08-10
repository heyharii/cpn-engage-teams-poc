import type { FastifyRequest } from "fastify";
import { resolveIdentity } from "./identity.js";
import type { Actor } from "./domain.js";

type ClaimedIdentity = { userKey?: string; userName?: string | null };

function header(request: FastifyRequest, name: string): string {
  const raw = request.headers[name];
  return String(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim();
}

/**
 * Resolve the actor for a point-earning write.
 * - Employee requests derive identity from verified SSO (or an allowed dev guest).
 * - Bot requests must present PUSH_TOKEN and may then supply the Teams oid.
 * - Tokenless claimed identities are accepted only in non-production local demos.
 */
export async function resolveWriteActor(
  request: FastifyRequest,
  claimed: ClaimedIdentity = {}
): Promise<Actor | null> {
  const serviceToken = process.env.PUSH_TOKEN?.trim() ?? "";
  const suppliedToken = header(request, "x-push-token");
  const adminKey = process.env.ADMIN_KEY?.trim() ?? "";
  const suppliedAdminKey = header(request, "x-admin-key");
  const serviceAuthorized =
    (serviceToken && suppliedToken === serviceToken) ||
    (adminKey && suppliedAdminKey === adminKey);
  if (serviceAuthorized && claimed.userKey?.trim()) {
    return {
      userKey: claimed.userKey.trim(),
      userName: claimed.userName?.trim() || null,
      verified: true,
      source: "bot"
    };
  }

  const identity = await resolveIdentity(request);
  if (identity) {
    return {
      userKey: identity.oid,
      userName: identity.name,
      verified: identity.verified,
      source: "employee"
    };
  }

  if (process.env.NODE_ENV !== "production" && !serviceToken && claimed.userKey?.trim()) {
    return {
      userKey: claimed.userKey.trim(),
      userName: claimed.userName?.trim() || null,
      verified: false,
      source: "development"
    };
  }
  return null;
}
