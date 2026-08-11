/**
 * Recognition v2 — the whole flow as one card.
 *
 * Hand-written Adaptive Card JSON rather than the SDK's JSX, because it needs
 * three things the JSX layer doesn't expose:
 *
 *  - the Teams People Picker: an `Input.ChoiceSet` whose `choices.data` points
 *    at the `graph.microsoft.com/users` dataset. Teams resolves it against
 *    Graph itself — the bot serves no query — and returns the selected user's
 *    Microsoft Entra object id, which is exactly the key we already store as
 *    `colleagueOid` and notify against;
 *  - `Input.Text` with `isMultiline`, so "what happened" is typed inside the
 *    card instead of as a chat message;
 *  - client-side validation (`isRequired` + `errorMessage`), so an empty
 *    recognition never reaches the bot.
 *
 * Between them, v1's name parsing, directory search and disambiguation step all
 * become unnecessary — along with the typed-in-chat step that forced the flow
 * to be spread across four cards.
 *
 * The submit is `Action.Submit`, not `Action.Execute`: its `data.actionId` is
 * what the Teams adapter looks for to route an activity into `bot.onAction`,
 * so it reuses the existing pipeline. Action.Execute would arrive as an
 * `adaptiveCard/action` invoke whose synchronous card response the SDK doesn't
 * expose — and we don't need it, since the next card is posted below anyway.
 */

import type { Behavior } from "@cpn-engage/shared";
import type { RawCard } from "../../raw-card.ts";
import { adaptiveCard, cardHeader } from "../rawLayout.ts";

export const RECOGNISE_INPUTS = { colleague: "colleague", belief: "belief", story: "story" } as const;

/**
 * `scope=currentContext` would narrow the picker to the members of this
 * conversation; the org-wide dataset is right for a 1:1 DM with the bot, where
 * the person being recognised is by definition not in the conversation.
 */
const PEOPLE_DATASET = "graph.microsoft.com/users";

export function recogniseFormCard(behaviors: Behavior[]): RawCard {
  return adaptiveCard(
    [
      ...cardHeader("🌟 Recognise a colleague", "Say thank you for a moment that showed one of the CPN Beliefs.", "pause"),
      {
        type: "Input.ChoiceSet",
        id: RECOGNISE_INPUTS.colleague,
        label: "Who do you want to recognise?",
        placeholder: "Search for a colleague",
        choices: [],
        "choices.data": { type: "Data.Query", dataset: PEOPLE_DATASET },
        isRequired: true,
        errorMessage: "Pick the colleague you're recognising."
      },
      {
        type: "Input.ChoiceSet",
        id: RECOGNISE_INPUTS.belief,
        label: "Which Belief did they show?",
        style: "expanded",
        choices: behaviors.map((b) => ({ title: `${b.name} — ${b.tagline}`, value: b.name })),
        isRequired: true,
        errorMessage: "Choose the Belief they demonstrated."
      },
      {
        type: "Input.Text",
        id: RECOGNISE_INPUTS.story,
        label: "What happened?",
        placeholder: "They stayed back to help a customer find a lost bag…",
        isMultiline: true,
        maxLength: 500,
        isRequired: true,
        errorMessage: "Add a short note so the recognition means something."
      }
    ],
    [{ type: "Action.Submit", title: "Send recognition", style: "positive", data: { actionId: "v2_recognise_send" } }]
  );
}

/**
 * The form card once it has been sent — same message, no inputs, no buttons.
 * The same rule as every other flow: an answered card becomes a record.
 */
export function recogniseRecordCard(opts: { colleague: string; behavior: string; story: string }): RawCard {
  return adaptiveCard([
      ...cardHeader("🌟 Recognise a colleague", "Recognition sent", "done"),
      {
        type: "FactSet",
        facts: [
          { title: "Colleague", value: opts.colleague },
          { title: "Belief", value: opts.behavior }
        ]
      },
      { type: "TextBlock", text: opts.story, wrap: true }
    ]);
}
