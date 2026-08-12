import type { RawCard } from "../raw-card.ts";
import { adaptiveCard, cardHeader, submitAction, textBlock } from "./rawLayout.ts";

/** Paused state, edited into the active card so its old controls disappear. */
export function PausedCard(opts: { label: string; detail: string }): RawCard {
  return adaptiveCard(
    [
      ...cardHeader("⏸️ Paused", opts.label, "done"),
      textBlock(`Saved at: ${opts.detail}. Come back any time and tap Continue — nothing is lost.`, { spacing: "Medium" })
    ],
    // The source marker lets the bot close only this paused card on resume;
    // hub/conflict cards are permanent navigation cards and stay untouched.
    [submitAction("resume", "paused", "Continue now", "positive"), submitAction("intent", "help", "Main menu")]
  );
}
