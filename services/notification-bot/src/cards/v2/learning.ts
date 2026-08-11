/**
 * v2 renderings of the Learning Journey cards. Same flow, same actions, same
 * state — only the markup differs, so `flows/module.ts` stays single-source and
 * picks a variant through `cards/resolve.ts`.
 *
 * These are hand-written Adaptive Card JSON because the elements they rely on
 * (`ProgressBar`, `Badge`, `CompoundButton`) have no equivalent in the SDK's
 * JSX layer. Every property here was read off the schema reference rather than
 * guessed; all three are Teams-supported and were introduced in 1.5.
 */

import type { ModuleContent, QuizQuestion } from "../types.ts";
import type { RawCard } from "../../raw-card.ts";

const CARD = { type: "AdaptiveCard", $schema: "https://adaptivecards.io/schemas/adaptive-card.json", version: "1.5" };

/**
 * The module list, as one tappable row per module instead of a text list with
 * a separate row of bare-title buttons. `CompoundButton` carries the title,
 * the detail line and a status badge in a single element, and its
 * `selectAction` is the same `pick_module` submit the v1 buttons used — so it
 * is just as non-destructive: it opens an intro, it doesn't start anything.
 */
export function moduleListCardV2(opts: { modules: ModuleContent[]; activeId?: string }): RawCard {
  return {
    ...CARD,
    body: [
      { type: "TextBlock", text: "Learning path", size: "Large", weight: "Bolder", wrap: true },
      {
        type: "TextBlock",
        text: `${opts.modules.length} module(s) — pick one to see what's inside.`,
        wrap: true,
        isSubtle: true,
        spacing: "None"
      },
      ...opts.modules.map((m) => ({
        type: "CompoundButton",
        title: m.title,
        description: `${m.track} · ${m.durationMin} min · ${m.questions.length} question(s)`,
        ...(m.id === opts.activeId ? { badge: "In progress" } : {}),
        selectAction: { type: "Action.Submit", data: { actionId: "pick_module", value: m.id } }
      }))
    ]
  };
}

/**
 * A quiz question with a progress bar. v1 puts "Question 2 of 3" in the
 * subtitle; a bar shows the same thing without being read, which is the point
 * of a learning streak.
 *
 * Each option is a CompoundButton in the body, so its full copy remains
 * clickable and can wrap instead of being truncated like an Action.Submit
 * title.
 */
export function quizQuestionCardV2(opts: {
  module: ModuleContent;
  quiz: QuizQuestion;
  total: number;
  answered: number;
}): RawCard {
  const { module: m, quiz, total, answered } = opts;
  return {
    ...CARD,
    body: [
      { type: "TextBlock", text: `${m.title} · ${m.track}`, isSubtle: true, wrap: true, spacing: "None" },
      { type: "ProgressBar", value: total > 0 ? (answered / total) * 100 : 0, max: 100, color: "Accent" },
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: `Question ${quiz.number} of ${total}`,
                weight: "Bolder",
                size: "Medium",
                wrap: true,
                spacing: "Small"
              }
            ]
          },
          {
            type: "Column",
            width: "auto",
            verticalContentAlignment: "Center",
            items: [
              {
                type: "ActionSet",
                actions: [{ type: "Action.Submit", title: "×", tooltip: "Save & exit", data: { actionId: "pause", value: "pause" } }]
              }
            ]
          }
        ]
      },
      { type: "TextBlock", text: quiz.question, wrap: true },
      { type: "TextBlock", text: "Choose an option:", isSubtle: true, wrap: true },
      ...quiz.options.map((o) => ({
        type: "CompoundButton",
        title: `${o.key}. ${o.text}`,
        selectAction: { type: "Action.Submit", data: { actionId: "quiz_answer", value: `${m.id}|${quiz.id}|${o.key}` } }
      }))
    ]
  };
}
