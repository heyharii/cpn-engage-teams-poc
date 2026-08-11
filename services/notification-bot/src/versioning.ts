/**
 * Two kinds of versioning, because two kinds of change.
 *
 * FLOW versions are for a different shape of interaction — recognition v1 walks
 * through four cards, v2 collects everything in one. Those are separate modules
 * under `flows/v2/`, and they CO-EXIST: switching one on adds a hub button next
 * to its v1 counterpart, so both can be tried in the same conversation and a v2
 * that misbehaves in a tenant costs nothing.
 *
 * CARD versions are for the same flow rendered differently — a progress bar on
 * a quiz question, badges on the module list, a localized date on a reminder.
 * Duplicating a flow for those would copy hundreds of lines of logic to change
 * a few lines of markup, so instead the flow stays single-source and only the
 * card is swapped. These replace rather than co-exist: a question card is one
 * design or the other, and the env var is the way back.
 *
 * Both are off by default, so a fresh deployment behaves exactly as before.
 */

function envSet(name: string): Set<string> {
  return new Set(
    (process.env[name]?.trim() ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Flows with an alternate version, and how each names itself on the hub. */
const FLOW_V2 = { recognise: "Recognise — new form" } as const;

/** Card sets that have a v2 rendering. */
const CARD_SETS = ["modules", "quiz"] as const;

export type FlowName = keyof typeof FLOW_V2;
export type CardSet = (typeof CARD_SETS)[number];

const flows = envSet("BOT_FLOWS_V2");
const cards = envSet("BOT_CARDS_V2");

const on = (set: Set<string>, key: string) => set.has(key) || set.has("all");

/** Is this flow's v2 entry point offered alongside v1? */
export function flowV2(name: FlowName): boolean {
  return on(flows, name);
}

/** Should this card set render in its v2 form? */
export function cardV2(set: CardSet): boolean {
  return on(cards, set);
}

/** The v2 flows on offer, for the hub's extra buttons. */
export function v2Entries(): { intent: string; label: string }[] {
  return (Object.entries(FLOW_V2) as [FlowName, string][])
    .filter(([name]) => flowV2(name))
    .map(([name, label]) => ({ intent: `${name}_v2`, label }));
}
