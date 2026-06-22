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

/** Completing the daily drop in the bot updates the same passport/streak the tabs show. */
export async function submitChallenge(challengeId: string): Promise<BootstrapResponse | null> {
  const data = await call<{ ok: boolean; bootstrap: BootstrapResponse }>(
    `/api/challenges/${challengeId}/submit`,
    { method: "POST" }
  );
  return data?.bootstrap ?? null;
}

/** A recognition sent from the bot lands in the Admin moderation queue. */
export async function submitRecognition(
  input: RecognitionSubmissionInput
): Promise<boolean> {
  const data = await call<{ ok: boolean }>("/api/recognitions", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return Boolean(data?.ok);
}
