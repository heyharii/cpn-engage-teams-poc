/**
 * Given an intent, run the matching flow. Single source of truth for routing.
 */

import type { Thread } from "chat";
import type { Intent } from "./intent-router.ts";
import { showMenu } from "../flows/menu.ts";
import { showModuleIntro, showDailyDrop } from "../flows/module.ts";
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
      await showModuleIntro(thread);
      return;
    case "daily_challenge":
      await showDailyDrop(thread);
      return;
    case "leaderboard":
      await showLeaderboard(thread);
      return;
    case "recognise":
      await startRecognise(thread, ctx.rawText, ctx.displayName);
      return;
    case "help":
    case "unknown":
    default:
      await showMenu(thread, ctx.displayName);
      return;
  }
}
