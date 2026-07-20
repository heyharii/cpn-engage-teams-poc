/**
 * Thin client over the CPN Engage API. The bot reads live state (so the
 * leaderboard / passport / daily drop it shows match the tabs) and writes
 * events (completing the daily drop, submitting a recognition) back into the
 * same shared state — making the bot a true fourth surface, not a silo.
 *
 * Every call fails soft: if the API is cold-starting or unreachable, callers
 * fall back to the bundled demo content so the conversation never breaks.
 */

import {
  demoBootstrap,
  type BootstrapResponse,
  type LeaderboardEntry,
  type RecognitionSubmissionInput
} from "@cpn-engage/shared";
import { config } from "./config.ts";

const TIMEOUT_MS = 8000;

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const method = (init?.method ?? "GET").toUpperCase();
  // Fastify rejects an application/json POST with an empty body (400), so
  // bodyless mutations get a "{}" body.
  const body = init?.body ?? (method === "GET" ? undefined : "{}");
  try {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      body,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: controller.signal
    });
    if (!res.ok) {
      console.warn(`[api] ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[api] ${path} failed:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Full shared state. Falls back to bundled demo data when the API is down. */
export async function getBootstrap(): Promise<BootstrapResponse> {
  const data = await call<BootstrapResponse>("/api/bootstrap");
  return data ?? demoBootstrap;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const data = await call<LeaderboardEntry[]>("/api/leaderboard");
  return data ?? demoBootstrap.leaderboard;
}

/** Identity used to attribute points to the right person (oid keyed). */
export type ScoreIdentity = { userKey: string; userName?: string | null };

/** Answering one daily-drop question — awards that question's points. */
export async function submitChallenge(
  challengeId: string,
  identity?: ScoreIdentity & { best?: boolean; questionId?: string; last?: boolean }
): Promise<BootstrapResponse | null> {
  const data = await call<{ ok: boolean; bootstrap: BootstrapResponse }>(
    `/api/challenges/${challengeId}/submit`,
    { method: "POST", body: JSON.stringify(identity ?? {}) }
  );
  return data?.bootstrap ?? null;
}

/** Completing a learning module — awards module points to the user. */
export async function submitModuleComplete(
  moduleId: string,
  identity?: ScoreIdentity
): Promise<boolean> {
  const data = await call<{ ok: boolean }>(`/api/modules/${moduleId}/complete`, {
    method: "POST",
    body: JSON.stringify(identity ?? {})
  });
  return Boolean(data?.ok);
}

/** A recognition sent from the bot posts to the feed + awards the sender. */
export async function submitRecognition(
  input: RecognitionSubmissionInput & ScoreIdentity
): Promise<boolean> {
  const data = await call<{ ok: boolean }>("/api/recognitions", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return Boolean(data?.ok);
}

/** Resolve the point-attribution identity for a thread (oid when known). */
export async function scoreIdentity(
  threadId: string,
  fallbackId?: string,
  fallbackName?: string
): Promise<ScoreIdentity> {
  const { getConversationByThreadId } = await import("./db.ts");
  const conv = await getConversationByThreadId(threadId);
  return { userKey: conv?.userId ?? fallbackId ?? "", userName: conv?.userName ?? fallbackName ?? null };
}
