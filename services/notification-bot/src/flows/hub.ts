/**
 * The hub — the only card that starts flows, and the only way back into a
 * paused one. Everything else either advances a flow or points here.
 */
import type { Thread } from "chat";
import { getState, describeFlow } from "../state.ts";
import { config } from "../config.ts";
import { HubCard, PausedCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

export async function showHub(thread: AnyThread, displayName?: string) {
  const st = await getState(thread.id);
  await thread.post(
    HubCard({ displayName, resume: describeFlow(st), v2: [...config.v2Entries] })
  );
}

/**
 * "Finish later" — park the flow without touching its state. The hub keeps
 * offering Continue until the state expires, so nothing here needs clearing.
 */
export async function pauseFlow(thread: AnyThread, displayName?: string) {
  const st = await getState(thread.id);
  const flow = describeFlow(st);
  if (!flow) return showHub(thread, displayName);
  await thread.post(PausedCard(flow));
}
