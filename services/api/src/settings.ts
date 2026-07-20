/**
 * App-wide settings (key/value) — configurable values that aren't tied to a
 * single module/drop. Today: recognition_points (the award for sending a
 * recognition, previously hardcoded to 75).
 */
import { sql } from "./db.js";

export async function getSetting(key: string, fallback: string): Promise<string> {
  if (!sql) return fallback;
  try {
    const rows = await sql<{ value: string }[]>`select value from app_settings where key = ${key} limit 1`;
    return rows[0]?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      insert into app_settings (key, value, updated_at) values (${key}, ${value}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
  } catch (err) {
    console.warn("[settings] setSetting failed:", err instanceof Error ? err.message : err);
  }
}

export async function getRecognitionPoints(): Promise<number> {
  const v = await getSetting("recognition_points", "75");
  const n = Number(v);
  return Number.isFinite(n) ? n : 75;
}

/** All settings as a typed object for the admin UI. */
export async function getAllSettings(): Promise<{ recognitionPoints: number }> {
  return { recognitionPoints: await getRecognitionPoints() };
}
