import type { RawCard } from "../raw-card.ts";
import { adaptiveCard, cardHeader, submitAction, textBlock } from "./rawLayout.ts";

/** Paused state, edited into the active card so its old controls disappear. */
export function PausedCard(opts: { label: string; detail: string }): RawCard {
  return adaptiveCard(
    [
      ...cardHeader("⏸️ Paused", opts.label, "done"),
      textBlock(`Saved at: ${opts.detail}. Come back any time and tap Continue — nothing is lost.`, { spacing: "Medium" })
    ],
    [submitAction("resume", "resume", "Continue now", "positive"), submitAction("intent", "help", "Main menu")]
  );
}
