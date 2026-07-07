/** Admin data layer — talks to the CPN Engage API (state) and the bot (ops). */
import type { BootstrapResponse } from "@cpn-engage/shared";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
const BOT = import.meta.env.VITE_BOT_BASE_URL ?? "http://127.0.0.1:4177";

async function get<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function post<T>(url: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export type AudienceUser = { name: string; jobTitle: string | null; department: string | null };
export type LeaderRow = { name: string; points: number; department?: string | null };

// --- API (shared state) ---
export const getBootstrap = () => get<BootstrapResponse>(`${API}/api/bootstrap`);
export const getLeaderboard = () => get<LeaderRow[]>(`${API}/api/leaderboard`);

// --- Bot (operations) ---
export const getAudience = () =>
  get<{ ok: boolean; count: number; users: AudienceUser[] }>(`${BOT}/internal/audience`);
export const syncDirectory = () =>
  post<{ ok: boolean; fetched: number; upserted: number; error?: string }>(`${BOT}/internal/sync-directory`);
export const enrichAudience = () =>
  post<{ ok: boolean; total: number; named: number; titled: number }>(`${BOT}/internal/enrich`);
export const pushBroadcast = (type: "challenge" | "module") =>
  post<{ ok: boolean; sent: number; total: number }>(`${BOT}/internal/push?type=${type}`);
export const scheduleTest = (seconds: number) =>
  post<{ ok: boolean; scheduledInSeconds: number | null }>(`${BOT}/internal/schedule-test?seconds=${seconds}`);
