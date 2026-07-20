/**
 * Stable per-browser guest id for dev/preview (no Teams SSO). Sent as the
 * `x-cpn-guest` header so each browser gets its own per-user state on the API,
 * and the API marks that state `verified: false`. In real Teams, the SSO token
 * supersedes this entirely.
 */
const KEY = "cpn-guest-id";

export function guestId(): string {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return "anon";
  }
}
