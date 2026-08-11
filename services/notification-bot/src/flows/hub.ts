/**
 * The hub — the only card that starts flows, and the only way back into a
 * paused one. Everything else either advances a flow or points here.
 */
import type { Thread } from "chat";
import { getState, describeFlow } from "../state.ts";
import { v2Entries } from "../versioning.ts";
import { HubCard, PausedCard } from "../cards/index.ts";
import { editCard } from "../edit.ts";

type AnyThread = Thread<unknown, unknown>;

export async function showHub(thread: AnyThread, displayName?: string) {
  const st = await getState(thread.id);
  await thread.post(
    HubCard({ displayName, resume: describeFlow(st), v2: v2Entries() })
  );
}

/**
 * "Save & exit" — park the flow without touching its state. The hub keeps
 * offering Continue until the state expires, so nothing here needs clearing.
 */
export async function pauseFlow(thread: AnyThread, displayName?: string, messageId?: string) {
  const st = await getState(thread.id);
  const flow = describeFlow(st);
  if (!flow) return showHub(thread, displayName);
  const paused = PausedCard(flow);
  if (!(await editCard(thread, messageId, paused))) await thread.post(paused);
}
