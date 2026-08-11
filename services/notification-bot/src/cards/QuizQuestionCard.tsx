import type { ModuleContent, QuizQuestion } from "./types.ts";
import type { RawCard } from "../raw-card.ts";

const QUIZ_CARD = {
  type: "AdaptiveCard",
  $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.5"
} as const;

function quizOptionRows(
  moduleId: string,
  quizId: string,
  options: QuizQuestion["options"],
  chosenKey?: string
) {
  const answered = chosenKey !== undefined;

  return options.map((o) => {
    const isChosen = o.key === chosenKey;
    const isBest = o.correct === true;
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
              data: { actionId: "quiz_answer", value: `${moduleId}|${quizId}|${o.key}` }
            }
          }),
      items: [{ type: "TextBlock", text: `${marker}${o.key}. ${o.text}${note}`, wrap: true }]
    };
  });
}

function quizHeader(quiz: QuizQuestion, total: number, answered: boolean) {
  return {
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "stretch",
        items: [{ type: "TextBlock", text: `Question ${quiz.number} of ${total}`, size: "Large", weight: "Bolder", wrap: true }]
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

/**
 * One quiz question. The compact pause icon lives in a right-aligned ActionSet
 * at the top; each full option is a clickable Container whose TextBlock wraps
 * naturally, so long copy never falls back to clipped letter-only controls.
 */
export function QuizQuestionCard(opts: { module: ModuleContent; quiz: QuizQuestion; total: number }): RawCard {
  const { module: m, quiz, total } = opts;
  return (
    {
      ...QUIZ_CARD,
      body: [
        quizHeader(quiz, total, false),
        { type: "TextBlock", text: `${m.title} · ${m.track}`, isSubtle: true, wrap: true, spacing: "None" },
        { type: "TextBlock", text: quiz.question, wrap: true },
        { type: "TextBlock", text: "Choose an option:", isSubtle: true, wrap: true },
        ...quizOptionRows(m.id, quiz.id, quiz.options)
      ]
    }
  );
}

/**
 * Buttonless record left in place after an answer. Keeping the question and
 * every option visible gives the learner context when they review the chat.
 */
export function QuizAnswerResultCard(opts: {
  module: ModuleContent;
  quiz: QuizQuestion;
  total: number;
  chosenKey: string;
}): RawCard {
  const { module: m, quiz, total, chosenKey } = opts;
  const chosen = quiz.options.find((o) => o.key === chosenKey);
  const correct = chosen?.correct === true;

  return (
    {
      ...QUIZ_CARD,
      body: [
        quizHeader(quiz, total, true),
        { type: "TextBlock", text: `${m.title} · ${m.track}`, isSubtle: true, wrap: true, spacing: "None" },
        { type: "TextBlock", text: quiz.question, wrap: true },
        { type: "TextBlock", text: correct ? "✅ Correct" : "❌ Not quite", isSubtle: true, wrap: true },
        ...quizOptionRows(m.id, quiz.id, quiz.options, chosenKey),
        ...(chosen?.explanation
          ? [{ type: "TextBlock", text: `Why: ${chosen.explanation}`, isSubtle: true, wrap: true, spacing: "Medium" }]
          : [])
      ]
    }
  );
}
