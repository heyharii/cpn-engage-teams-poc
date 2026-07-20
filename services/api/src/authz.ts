/**
 * Admin authorization for /api/admin/* (content CRUD, demo reset, scenarios).
 *
 * The console sends a shared admin key as `x-admin-key`; the installer generates
 * a random ADMIN_KEY per deployment and shows it once. When ADMIN_KEY is unset:
 *   - production (NODE_ENV=production) → deny (fail closed), so an unconfigured
 *     box is never wide open.
 *   - dev → allow (so local review needs no key).
 */
import type { FastifyReply, FastifyRequest } from "fastify";

const adminKey = process.env.ADMIN_KEY?.trim() ?? "";
const isProd = process.env.NODE_ENV === "production";

export function adminConfigured(): boolean {
  return Boolean(adminKey);
}

/** Fastify preHandler — returns true if allowed, else sends 401/403 and false. */
export function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!adminKey) {
    if (isProd) {
      reply.code(403).send({ ok: false, error: "admin key not configured on server" });
      return false;
    }
    return true; // dev convenience
  }
  const raw = request.headers["x-admin-key"];
  const provided = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (provided && provided === adminKey) return true;
  reply.code(401).send({ ok: false, error: "missing or invalid admin key" });
  return false;
}
