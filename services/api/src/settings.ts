/**
 * App-wide settings (key/value in app_settings) — everything an admin can
 * configure that isn't a single module/drop: points, branding, the daily send
 * schedule, leaderboard period, and the recognition approval flow.
 */
import { sql } from "./db.js";
import { isValidTimeZone } from "./domain.js";

export type AppSettings = {
  recognitionPoints: number;
  appName: string;
  accentColor: string; // hex, e.g. #E5007D
  dailyDropTime: string; // "HH:MM" 24h
  dailyDropTz: string; // IANA tz
  leaderboardPeriod: "week" | "month" | "all";
  recognitionRequiresApproval: boolean;
};

const DEFAULTS: AppSettings = {
  recognitionPoints: 75,
  appName: "CPN Engage",
  accentColor: "#E5007D",
  dailyDropTime: "09:00",
  dailyDropTz: "Asia/Bangkok",
  leaderboardPeriod: "all",
  recognitionRequiresApproval: false
};

// Storage key ↔ typed field mapping.
const KEYS: Record<keyof AppSettings, string> = {
  recognitionPoints: "recognition_points",
  appName: "app_name",
  accentColor: "accent_color",
  dailyDropTime: "daily_drop_time",
  dailyDropTz: "daily_drop_tz",
  leaderboardPeriod: "leaderboard_period",
  recognitionRequiresApproval: "recognition_requires_approval"
};

async function rawGet(key: string): Promise<string | null> {
  if (!sql) return null;
  try {
    const rows = await sql<{ value: string }[]>`select value from app_settings where key = ${key} limit 1`;
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function rawSet(key: string, value: string): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into app_settings (key, value, updated_at) values (${key}, ${value}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
  } catch (err) {
    console.warn("[settings] set failed:", err instanceof Error ? err.message : err);
  }
}

export async function getAllSettings(): Promise<AppSettings> {
  const out = { ...DEFAULTS };
  const rec = await rawGet(KEYS.recognitionPoints);
  if (rec != null && Number.isFinite(Number(rec))) out.recognitionPoints = Number(rec);
  out.appName = (await rawGet(KEYS.appName)) ?? DEFAULTS.appName;
  out.accentColor = (await rawGet(KEYS.accentColor)) ?? DEFAULTS.accentColor;
  out.dailyDropTime = (await rawGet(KEYS.dailyDropTime)) ?? DEFAULTS.dailyDropTime;
  out.dailyDropTz = (await rawGet(KEYS.dailyDropTz)) ?? DEFAULTS.dailyDropTz;
  const lp = await rawGet(KEYS.leaderboardPeriod);
  out.leaderboardPeriod = lp === "week" || lp === "month" || lp === "all" ? lp : DEFAULTS.leaderboardPeriod;
  out.recognitionRequiresApproval = (await rawGet(KEYS.recognitionRequiresApproval)) === "true";
  return out;
}

/** Update any subset of settings (validated + coerced). Returns the full set. */
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  if (typeof patch.recognitionPoints === "number")
    await rawSet(KEYS.recognitionPoints, String(Math.max(0, Math.round(patch.recognitionPoints))));
  if (typeof patch.appName === "string" && patch.appName.trim()) await rawSet(KEYS.appName, patch.appName.trim().slice(0, 40));
  if (typeof patch.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(patch.accentColor))
    await rawSet(KEYS.accentColor, patch.accentColor);
  if (typeof patch.dailyDropTime === "string") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(patch.dailyDropTime);
    if (match && Number(match[1]) <= 23 && Number(match[2]) <= 59) {
      await rawSet(KEYS.dailyDropTime, `${match[1].padStart(2, "0")}:${match[2]}`);
    }
  }
  if (typeof patch.dailyDropTz === "string" && isValidTimeZone(patch.dailyDropTz.trim()))
    await rawSet(KEYS.dailyDropTz, patch.dailyDropTz.trim());
  if (patch.leaderboardPeriod === "week" || patch.leaderboardPeriod === "month" || patch.leaderboardPeriod === "all")
    await rawSet(KEYS.leaderboardPeriod, patch.leaderboardPeriod);
  if (typeof patch.recognitionRequiresApproval === "boolean")
    await rawSet(KEYS.recognitionRequiresApproval, String(patch.recognitionRequiresApproval));
  return getAllSettings();
}

export async function getRecognitionPoints(): Promise<number> {
  return (await getAllSettings()).recognitionPoints;
}
