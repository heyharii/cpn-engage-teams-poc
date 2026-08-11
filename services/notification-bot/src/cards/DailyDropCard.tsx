import type { DailyDrop, DropQuestion } from "@cpn-engage/shared";
import type { RawCard } from "../raw-card.ts";

const DAILY_CARD = {
  type: "AdaptiveCard",
  $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.5"
} as const;

function dailyHeader(title: string, answered: boolean) {
  return {
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "stretch",
        items: [{ type: "TextBlock", text: title, size: "Large", weight: "Bolder", wrap: true }]
      },
      {
        type: "Column",
        width: "auto",
        verticalContentAlignment: "Center",
        items: answered
          ? [{ type: "TextBlock", text: "✓", color: "Good", size: "Medium", weight: "Bolder", horizontalAlignment: "Right" }]
          : [
              {
                type: "ActionSet",
                actions: [{ type: "Action.Submit", title: "×", tooltip: "Save & exit", data: { actionId: "pause", value: "pause" } }]
              }
            ]
      }
    ]
  };
}

function dailyOptionRows(drop: DailyDrop, question: DropQuestion, chosenId?: string) {
  const answered = chosenId !== undefined;

  return question.options.map((o, i) => {
    const isChosen = o.id === chosenId;
    const isBest = o.isBest === true;
    const marker = answered ? (isBest ? "✅ " : isChosen ? "❌ " : "") : "";
    const note = answered
      ? isBest && isChosen
        ? " — Your answer · Best answer"
        : isBest
          ? " — Best answer"
          : isChosen
            ? " — Your answer"
            : ""
      : "";

    return {
      type: "Container",
      style: answered ? (isBest ? "good" : isChosen ? "attention" : "emphasis") : "emphasis",
      spacing: "Small",
      bleed: true,
      ...(answered
        ? {}
        : {
            selectAction: {
              type: "Action.Submit",
              data: { actionId: "submit_answer", value: `${drop.id}|${question.id}|${o.id}` }
            }
          }),
      items: [{ type: "TextBlock", text: `${marker}${i + 1}. ${o.label}${note}`, wrap: true }]
    };
  });
}

function subtitleBlock(text: string) {
  return { type: "TextBlock", text, isSubtle: true, wrap: true, spacing: "None" };
}

/** Daily challenge question. Full option rows stay clickable and wrap long copy. */
export function DailyDropCard(opts: { drop: DailyDrop; question: DropQuestion; qNum: number; total: number }): RawCard {
  const { drop, question, qNum, total } = opts;
  const progress = total > 1 ? ` · Question ${qNum} of ${total}` : "";
  const subtitle = `${drop.behavior} · ${drop.rewardLabel}${progress}`;

  return {
    ...DAILY_CARD,
    body: [
      dailyHeader(`⚡ ${drop.title}`, false),
      subtitleBlock(subtitle),
      { type: "TextBlock", text: question.question, wrap: true },
      { type: "TextBlock", text: "Choose an answer:", isSubtle: true, wrap: true },
      ...dailyOptionRows(drop, question)
    ]
  };
}

export function dailyDropResultCard(opts: {
  drop: DailyDrop;
  question: DropQuestion;
  qNum: number;
  total: number;
  chosenId: string;
  pointsEarned: number;
  newScore: number | null;
  isLast: boolean;
}): RawCard {
  const { drop, question, qNum, total, chosenId, pointsEarned, newScore, isLast } = opts;
  const chosen = question.options.find((o) => o.id === chosenId);
  const isBest = chosen?.isBest === true;
  const progress = total > 1 ? ` · Question ${qNum} of ${total}` : "";
  const subtitle = `${drop.behavior} · ${drop.rewardLabel}${progress}`;

  return {
    ...DAILY_CARD,
    body: [
      dailyHeader(`⚡ ${drop.title}`, true),
      subtitleBlock(subtitle),
      { type: "TextBlock", text: question.question, wrap: true },
      { type: "TextBlock", text: isBest ? "✅ Correct" : "❌ Not quite", isSubtle: true, wrap: true },
      ...dailyOptionRows(drop, question, chosenId),
      {
        type: "TextBlock",
        text: `Why: Leading with ${drop.behavior} means understanding the real need first, then aligning the team on the fastest recovery.`,
        isSubtle: true,
        wrap: true,
        spacing: "Medium"
      },
      { type: "TextBlock", text: `Points: +${pointsEarned}${newScore != null ? ` · Your total: ${newScore} pts` : ""}`, wrap: true }
    ],
    ...(isLast
      ? {
          actions: [
            { type: "Action.Submit", title: "Back to main menu", style: "positive", data: { actionId: "intent", value: "help" } }
          ]
        }
      : {})
  };
}
