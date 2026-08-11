/**
 * Intent → flow routing, and the single place where a flow-starting action is
 * allowed to discard progress.
 *
 * Starting a flow resets thread state. That is what the user wants when they
 * asked for it — and destructive when the tap came from a card they scrolled
 * back to, or from yesterday's push notification. Those cards are permanent by
 * design (a hub or a reminder can't edit itself away), so the check lives here
 * instead: if a different flow is open, we ask rather than overwrite.
 *
 * `force: true` skips the check. It is only ever set by `force_intent` — the
 * second tap on the conflict card, or a deliberate "Start over".
 */

import type { Thread } from "chat";
import type { Intent } from "./intent-router.ts";
import { getState, describeFlow, type FlowSummary } from "../state.ts";
import { ConflictCard } from "../cards/index.ts";
import { showHub } from "../flows/hub.ts";
import { showModuleList, showModuleIntro } from "../flows/module.ts";
import { showChallenge } from "../flows/challenge.ts";
import { showLeaderboard } from "../flows/leaderboard.ts";
import { startRecognise } from "../flows/recognise.ts";
import { startRecogniseV2 } from "../flows/v2/recognise.ts";

type AnyThread = Thread<unknown, unknown>;

export type DispatchCtx = {
  displayName?: string;
  teamsUserId?: string;
  rawText?: string;
  /** Skip the in-progress check — the user has already chosen to discard. */
  force?: boolean;
};

/** Intents that reset thread state: the flow they'd enter, and how to name it. */
const DESTRUCTIVE: Record<string, { kind: FlowSummary["kind"]; label: string }> = {
  start_module: { kind: "module", label: "a module" },
  daily_challenge: { kind: "challenge", label: "today's challenge" },
  // Both recognition versions map to the same flow kind, so starting either one
  // while the other is open raises the conflict card rather than losing a draft.
  recognise: { kind: "recognise", label: "a recognition" },
  recognise_v2: { kind: "recognise", label: "a recognition" }
};

export async function dispatchIntent(thread: AnyThread, intent: Intent | string, ctx: DispatchCtx = {}) {
  const target = DESTRUCTIVE[intent];
  if (target && !ctx.force) {
    const current = describeFlow(await getState(thread.id));
    // Only a DIFFERENT flow is a conflict. Re-entering the flow you're already
    // in is handled by that flow, which resumes instead of restarting.
    if (current && current.kind !== target.kind) {
      await thread.post(
        ConflictCard({ current, action: { id: "force_intent", value: intent, label: target.label } })
      );
      return;
    }
  }

  switch (intent) {
    case "browse_modules":
      return showModuleList(thread);
    case "start_module":
      return showModuleIntro(thread);
    case "daily_challenge":
      return showChallenge(thread, ctx.force === true);
    case "leaderboard":
      return showLeaderboard(thread);
    case "recognise":
      return startRecognise(thread, ctx.rawText, ctx.force === true);
    case "recognise_v2":
      // One card, so there is no partial state to resume and no opener to
      // parse — the force/rawText arguments don't apply to it.
      return startRecogniseV2(thread);
    case "help":
    case "unknown":
    default:
      return showHub(thread, ctx.displayName);
  }
}
