/**
 * Per-thread conversation state — the brain of this no-AI bot. Every flow
 * records exactly where the user is so we can: advance on the expected action,
 * gently redirect a stale/out-of-order action (e.g. a button on an old card
 * the user scrolled back to), and stay idempotent (re-pressing never corrupts
 * scores or state).
 */

import { createMemoryState } from "@chat-adapter/state-memory";
import { sql } from "./db.ts";

export type ThreadState =
  | { kind: "idle" }
  // Learning Journey: intro → video → text → quiz(0..n) → complete
  | {
      kind: "module";
      moduleId: string;
      step: "video" | "text" | "quiz";
      quizIdx: number; // index of the question we're waiting on
      correct: number; // running correct count (idempotent — never double-counts)
      answered: string[]; // quiz ids already answered, to guard stale presses
    }
  // Challenge: a mini-quiz of 1..n MCQs; tracks progress + running score
  | { kind: "challenge"; dropId: string; qIndex: number; score: number; answeredQ: string[] }
  // Recognition: who → belief → description → media → confirm → send
  | {
      kind: "recognise";
      step: "colleague" | "belief" | "description" | "media" | "confirm";
      colleague?: string;
      colleagueOid?: string; // resolved directory identity (for notify)
      behavior?: string;
      description?: string;
      /** The single message this wizard lives in — every step edits it. */
      cardId?: string;
    };

export const state = createMemoryState();

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!sql) return Promise.resolve();
  tableReady ??= sql`
    create table if not exists bot_flow_states (
      thread_id text primary key,
      state jsonb not null,
      updated_at timestamptz not null default now()
    )
  `.then(() => undefined);
  return tableReady;
}

export async function getState(threadId: string): Promise<ThreadState> {
  if (sql) {
    await ensureTable();
    const rows = await sql<{ state: ThreadState }[]>`select state from bot_flow_states where thread_id = ${threadId}`;
    return rows[0]?.state ?? { kind: "idle" };
  }
  return (await state.get<ThreadState>(threadId)) ?? { kind: "idle" };
}

export async function setState(threadId: string, next: ThreadState): Promise<void> {
  if (sql) {
    await ensureTable();
    await sql`
      insert into bot_flow_states (thread_id, state, updated_at)
      values (${threadId}, ${sql.json(next)}, now())
      on conflict (thread_id) do update set state = excluded.state, updated_at = now()
    `;
    return;
  }
  await state.set<ThreadState>(threadId, next);
}

export async function clearState(threadId: string): Promise<void> {
  if (sql) {
    await ensureTable();
    await sql`delete from bot_flow_states where thread_id = ${threadId}`;
    return;
  }
  await state.set<ThreadState>(threadId, { kind: "idle" });
}
