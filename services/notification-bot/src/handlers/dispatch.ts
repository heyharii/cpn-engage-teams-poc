/**
 * Intent → flow routing. Each flow's start sets its own thread state, so
 * switching flows (e.g. asking for the leaderboard mid-module) is safe.
 */

import type { Thread } from "chat";
import type { Intent } from "./intent-router.ts";
import { showMenu } from "../flows/menu.ts";
import { showModuleIntro } from "../flows/module.ts";
import { showChallenge } from "../flows/challenge.ts";
import { showLeaderboard } from "../flows/leaderboard.ts";
import { startRecognise } from "../flows/recognise.ts";

type AnyThread = Thread<unknown, unknown>;

export type DispatchCtx = {
  displayName?: string;
  teamsUserId?: string;
  rawText?: string;
};

export async function dispatchIntent(thread: AnyThread, intent: Intent | string, ctx: DispatchCtx = {}) {
  switch (intent) {
    case "start_module":
      return showModuleIntro(thread);
    case "daily_challenge":
      return showChallenge(thread);
    case "leaderboard":
      return showLeaderboard(thread);
    case "recognise":
      return startRecognise(thread, ctx.rawText);
    case "help":
    case "unknown":
    default:
      return showMenu(thread, ctx.displayName);
  }
}
