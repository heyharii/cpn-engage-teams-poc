/**
 * Visible SSO/connection status for the Teams tabs.
 *
 * Both failure modes that make a tab look "broken but silent" are named here:
 * the API being unreachable from this origin (CORS allowlist) and a Teams SSO
 * token the API refuses (app registration mismatch). Without this the tab just
 * shows stale data and dead buttons.
 */
export type SsoInfo = {
  serverConfigured: boolean;
  tokenPresent: boolean;
  verified: boolean;
  error: string | null;
};

export type SsoState =
  | { state: "checking" }
  | { state: "unreachable"; detail: string }
  | { state: "ok"; verified: boolean; name: string | null; sso?: SsoInfo };

const TONE = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-900",
  idle: "border-border bg-muted/50 text-muted-foreground"
} as const;

function describe(s: SsoState): { tone: keyof typeof TONE; label: string; hint?: string } {
  if (s.state === "checking") return { tone: "idle", label: "Checking sign-in…" };
  if (s.state === "unreachable") {
    return {
      tone: "error",
      label: "API unreachable from this tab",
      hint: `${s.detail} — usually the API's ALLOWED_ORIGINS does not include this tab's URL.`
    };
  }
  if (s.verified) return { tone: "ok", label: `Teams SSO connected${s.name ? ` · ${s.name}` : ""}` };

  const sso = s.sso;
  if (sso && !sso.serverConfigured) {
    return {
      tone: "warn",
      label: "Teams SSO not configured on the API",
      hint: "Set TEAMS_APP_ID + TEAMS_APP_TENANT_ID (and APPLICATION_ID_URI) on the API service."
    };
  }
  if (sso?.tokenPresent && sso.error) {
    return { tone: "warn", label: "Teams SSO token rejected", hint: sso.error };
  }
  return {
    tone: "warn",
    label: "Guest mode — no Teams SSO token",
    hint: "Browser preview, or the Teams app has no SSO consent yet."
  };
}

export function SsoBadge({ status, className }: { status: SsoState; className?: string }) {
  const { tone, label, hint } = describe(status);
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${TONE[tone]} ${className ?? ""}`}>
      <span className="font-semibold">{label}</span>
      {hint ? <span className="ml-1 opacity-80">{hint}</span> : null}
    </div>
  );
}
