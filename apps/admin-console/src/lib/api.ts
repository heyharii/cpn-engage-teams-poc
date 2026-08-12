/** Admin data layer — talks to the CPN Engage API (state) and the bot (ops). */
import type { BootstrapResponse, ModuleContent } from "@cpn-engage/shared";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4175";
const BOT = import.meta.env.VITE_BOT_BASE_URL ?? "http://127.0.0.1:4177";

const ADMIN_KEY_STORAGE = "cpn-admin-key";

/** The admin key: from the login gate (localStorage), or a dev default. */
export function getAdminKey(): string {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) ?? (import.meta.env.VITE_ADMIN_KEY as string) ?? "";
  } catch {
    return (import.meta.env.VITE_ADMIN_KEY as string) ?? "";
  }
}
export function setAdminKey(key: string): void {
  try {
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
  } catch {
    /* ignore */
  }
}

/** Verify a candidate key against the API (used by the login gate). */
export async function verifyAdminKey(key: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}/api/admin/modules`, { headers: { "x-admin-key": key } });
    return r.ok;
  } catch {
    return false;
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "x-admin-key": getAdminKey(), ...extra };
}

async function get<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: authHeaders() });
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
      headers: authHeaders(body ? { "Content-Type": "application/json" } : {}),
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
export type RosterUser = {
  oid: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  enabled: boolean;
  reachable: boolean;
};

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
export const getUsers = () =>
  get<{ ok: boolean; directoryCount: number; reachableCount: number; users: RosterUser[] }>(
    `${BOT}/internal/users`
  );
export const pushBroadcast = (type: "challenge" | "module", moduleId?: string) =>
  post<{ ok: boolean; sent: number; total: number }>(
    `${BOT}/internal/push?type=${type}${moduleId ? `&moduleId=${encodeURIComponent(moduleId)}` : ""}`
  );
export const scheduleTest = (seconds: number) =>
  post<{ ok: boolean; scheduledInSeconds: number | null }>(`${BOT}/internal/schedule-test?seconds=${seconds}`);

// --- Beliefs authoring (single source for belief pickers) ---
export type Belief = { id: string; name: string; tagline: string; orderIdx: number };
export const getBeliefs = () => get<Belief[]>(`${API}/api/beliefs`);
export const getAdminBeliefs = () => get<Belief[]>(`${API}/api/admin/beliefs`);
export const saveBelief = (b: Belief) => post<{ ok: boolean; belief: Belief }>(`${API}/api/admin/beliefs`, b);
export async function deleteBeliefApi(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}/api/admin/beliefs/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    return r.ok;
  } catch {
    return false;
  }
}

// --- Analytics + broadcast history ---
export type Analytics = {
  totals: { users: number; points: number; recognitions: number; modulesCompleted: number };
  participationByDay: { day: string; users: number }[];
  recognitionsByDay: { day: string; count: number }[];
  departmentLeague: { department: string; points: number; people: number }[];
  topLearners: { name: string; completed: number }[];
};
export const getAnalytics = () => get<Analytics>(`${API}/api/admin/analytics`);
export type BroadcastRow = { kind: string; label: string | null; sent: number; total: number; created_at: string };
export const getBroadcasts = () =>
  get<{ ok: boolean; broadcasts: BroadcastRow[] }>(`${BOT}/internal/broadcasts`);

export type ScheduledRow = { id: string; kind: string; label: string | null; runAt: string; status: string };
export const getScheduled = () => get<{ ok: boolean; scheduled: ScheduledRow[] }>(`${BOT}/internal/scheduled`);
export const scheduleBroadcastApi = (body: { type: "challenge" | "module"; moduleId?: string; label?: string; at: string }) =>
  post<{ ok: boolean; id?: string; error?: string }>(`${BOT}/internal/schedule`, body);
export const cancelScheduledApi = (id: string) =>
  post<{ ok: boolean }>(`${BOT}/internal/scheduled/${encodeURIComponent(id)}/cancel`);

// --- System / debug ---
export const getDebugBundle = () => get<Record<string, unknown>>(`${API}/api/admin/debug-bundle`);
export function debugBundleUrl(): string {
  return `${API}/api/admin/debug-bundle`;
}

// --- Settings (all configurable values) ---
export type AppSettings = {
  recognitionPoints: number;
  appName: string;
  accentColor: string;
  dailyDropTime: string;
  dailyDropTz: string;
  leaderboardPeriod: "week" | "month" | "all";
  recognitionRequiresApproval: boolean;
};
export const getSettings = () => get<AppSettings>(`${API}/api/admin/settings`);
export const saveSettings = (s: Partial<AppSettings>) => post<AppSettings & { ok: boolean }>(`${API}/api/admin/settings`, s);

// Recognition approval queue.
export type PendingRecognition = {
  id: string;
  author?: string;
  target?: string;
  belief?: string;
  message?: string;
  authorKey: string | null;
};
export const getPendingRecognitions = () =>
  get<{ pending: PendingRecognition[] }>(`${API}/api/admin/recognitions/pending`);
export const approveRecognition = (id: string) =>
  post<{ ok: boolean }>(`${API}/api/admin/recognitions/${encodeURIComponent(id)}/approve`);
export const rejectRecognition = (id: string) =>
  post<{ ok: boolean }>(`${API}/api/admin/recognitions/${encodeURIComponent(id)}/reject`);

// --- Announcements + moderation ---
export const postAnnouncement = (title: string, message: string) =>
  post<{ ok: boolean }>(`${API}/api/admin/announce`, { title, message });
export const hideFeedPost = (id: string, hidden = true, note?: string) =>
  post<{ ok: boolean }>(`${API}/api/admin/feed/${encodeURIComponent(id)}/hide`, { hidden, note });

export const flagFeedPost = (id: string, note?: string) =>
  post<{ ok: boolean }>(`${API}/api/admin/feed/${encodeURIComponent(id)}/flag`, { note });

export type ModerationEntry = {
  id: string;
  feedId: string;
  action: "hide" | "unhide" | "flag" | "reject" | "approve";
  actor: string | null;
  note: string | null;
  createdAt: string;
  post: {
    author: string | null;
    target: string | null;
    belief: string | null;
    title: string | null;
    summary: string | null;
    message: string | null;
    hidden: boolean;
  } | null;
};

export const getModerationLog = () =>
  get<{ ok: boolean; entries: ModerationEntry[] }>(`${API}/api/admin/feed/moderation`);

// --- Daily-drop (challenge) authoring ---
export type DropOption = { id: string; label: string; isBest?: boolean };
export type DropQuestion = { id: string; question: string; options: DropOption[] };
export type AdminDrop = {
  id: string;
  title: string;
  behavior: string;
  question: string;
  rewardLabel?: string;
  options: DropOption[];
  questions?: DropQuestion[];
  bestPoints?: number;
  status?: string;
  isActive?: boolean;
  scheduledDate?: string | null;
};
export const getAdminDrops = () => get<AdminDrop[]>(`${API}/api/admin/drops`);
export const saveDrop = (d: AdminDrop) => post<{ ok: boolean; drop: AdminDrop }>(`${API}/api/admin/drops`, d);
export const activateDrop = (id: string) =>
  post<{ ok: boolean }>(`${API}/api/admin/drops/${encodeURIComponent(id)}/activate`);
export async function deleteDropApi(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}/api/admin/drops/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    return r.ok;
  } catch {
    return false;
  }
}

// --- Learning Journey content authoring ---
export const getAdminModules = () => get<ModuleContent[]>(`${API}/api/admin/modules`);
export const saveModule = (m: ModuleContent) =>
  post<{ ok: boolean; module: ModuleContent }>(`${API}/api/admin/modules`, m);
export async function deleteModuleApi(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}/api/admin/modules/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    return r.ok;
  } catch {
    return false;
  }
}
export const reorderModules = (order: { id: string; orderIdx: number }[]) =>
  post<{ ok: boolean }>(`${API}/api/admin/modules/reorder`, { order });
