/**
 * Per-thread conversation state — the brain of this no-AI bot. Every flow
 * records exactly where the user is so we can: advance on the expected action,
 * gently redirect a stale/out-of-order action (e.g. a button on an old card
 * the user scrolled back to), and stay idempotent (re-pressing never corrupts
 * scores or state).
 */

import { createMemoryState } from "@chat-adapter/state-memory";
import { sql } from "./db.ts";
import { getModule } from "./content.ts";

export type ThreadState =
  | { kind: "idle"; completedModuleIds?: string[] }
  // Learning Journey: intro → video → text → quiz(0..n) → complete
  | {
      kind: "module";
      moduleId: string;
      step: "video" | "text" | "quiz";
      quizIdx: number; // index of the question we're waiting on
      correct: number; // running correct count (idempotent — never double-counts)
      answered: string[]; // quiz ids already answered, to guard stale presses
      /** Completed modules remain visible when the learner returns to the hub. */
      completedModuleIds?: string[];
    }
  // Challenge: a mini-quiz of 1..n MCQs; tracks progress + running score
  | {
      kind: "challenge";
      dropId: string;
      qIndex: number;
      score: number;
      answeredQ: string[];
      completedModuleIds?: string[];
    }
  // Recognition: who → belief → description → confirm → send
  | {
      kind: "recognise";
      step: "colleague" | "belief" | "description" | "confirm";
      colleague?: string;
      colleagueOid?: string; // resolved directory identity (for notify)
      behavior?: string;
      description?: string;
      /** The card holding the step we're waiting on — summarised when answered. */
      cardId?: string;
      completedModuleIds?: string[];
    }
  // Recognition v2: one card collects everything, so there are no steps to
  // track — only which message holds the open form.
  | { kind: "recognise2"; cardId?: string; completedModuleIds?: string[] };

/** A flow the user abandoned this long ago is no longer worth resuming. */
const STATE_TTL_DAYS = 7;

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
    // A stale row is treated as idle rather than deleted — the next setState
    // overwrites it anyway, and reads stay a single statement.
    const rows = await sql<{ state: ThreadState; updated_at: string }[]>`
      select state, updated_at from bot_flow_states where thread_id = ${threadId}
    `;
    const row = rows[0];
    if (!row) return { kind: "idle" };
    // Completed-module badges are a durable learning record. Only an active
    // in-progress flow expires after seven days; an idle record is retained so
    // replaying a module still reads as a replay months later.
    const stale = Date.now() - new Date(row.updated_at).getTime() > STATE_TTL_DAYS * 86_400_000;
    if (stale && row.state.kind !== "idle") {
      return { kind: "idle", completedModuleIds: row.state.completedModuleIds };
    }
    return row.state;
  }
  return (await state.get<ThreadState>(threadId)) ?? { kind: "idle" };
}

export async function setState(threadId: string, next: ThreadState): Promise<void> {
  // Keep the learner's completion markers while switching between flows. They
  // are intentionally orthogonal to the currently active state machine.
  // Callers that explicitly provide a marker list (including an empty list)
  // are authoritative, so a new conversation can intentionally start clean.
  if (next.completedModuleIds === undefined) {
    const previous = await getState(threadId);
    if (previous.completedModuleIds?.length) {
      next = { ...next, completedModuleIds: previous.completedModuleIds } as ThreadState;
    }
  }
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
  const current = await getState(threadId);
  const completedModuleIds = current.completedModuleIds;
  if (sql) {
    await ensureTable();
    await sql`delete from bot_flow_states where thread_id = ${threadId}`;
    if (completedModuleIds?.length) {
      await setState(threadId, { kind: "idle", completedModuleIds });
    }
    return;
  }
  await state.set<ThreadState>(threadId, completedModuleIds?.length ? { kind: "idle", completedModuleIds } : { kind: "idle" });
}

/**
 * One-line description of where the user is, used by the hub ("Continue…"),
 * the conflict card, and the paused card. Returns null when nothing is running,
 * which is also the signal that a flow-starting action is safe to run.
 */
export type FlowSummary = {
  /** v1 and v2 recognition share a kind here so either counts as "a recognition
   *  is open" for the conflict check and the hub's Continue row. */
  kind: "module" | "challenge" | "recognise";
  label: string;
  detail: string;
};

export function describeFlow(st: ThreadState): FlowSummary | null {
  switch (st.kind) {
    case "module": {
      const title = getModule(st.moduleId)?.title ?? "your module";
      const detail =
        st.step === "video"
          ? "Video step"
          : st.step === "text"
            ? "Lesson step"
            : `Question ${st.quizIdx + 1}`;
      return { kind: "module", label: title, detail };
    }
    case "challenge":
      return { kind: "challenge", label: "Today's challenge", detail: `Question ${st.qIndex + 1}` };
    case "recognise": {
      const who = st.colleague ? ` for ${st.colleague}` : "";
      const detail =
        st.step === "colleague"
          ? "Choosing a colleague"
          : st.step === "belief"
            ? "Choosing a Belief"
            : st.step === "description"
              ? "Describing what happened"
              : "Ready to send";
      return { kind: "recognise", label: `Recognition${who}`, detail };
    }
    case "recognise2":
      return { kind: "recognise", label: "Recognition", detail: "Filling in the form" };
    default:
      return null;
  }
}
