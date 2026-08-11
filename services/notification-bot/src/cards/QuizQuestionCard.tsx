/** @jsxImportSource chat */
import { Card, CardText, Section, Divider } from "chat";
import type { ModuleContent, QuizQuestion } from "./types.ts";
import type { RawCard } from "../raw-card.ts";

const QUIZ_CARD = {
  type: "AdaptiveCard",
  $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.5"
} as const;

/**
 * One quiz question. The compact pause icon lives in a right-aligned ActionSet
 * at the top; option copy remains wrapping text with compact answer controls.
 */
export function QuizQuestionCard(opts: { module: ModuleContent; quiz: QuizQuestion; total: number }): RawCard {
  const { module: m, quiz, total } = opts;
  return (
    {
      ...QUIZ_CARD,
      body: [
        {
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
              items: [
                {
                  type: "ActionSet",
                  actions: [{ type: "Action.Submit", title: "×", tooltip: "Save & exit", data: { actionId: "pause", value: "pause" } }]
                }
              ]
            }
          ]
        },
        { type: "TextBlock", text: `${m.title} · ${m.track}`, isSubtle: true, wrap: true, spacing: "None" },
        { type: "TextBlock", text: quiz.question, wrap: true },
        ...quiz.options.map((o) => ({ type: "TextBlock", text: `**${o.key}.** ${o.text}`, wrap: true, spacing: "Small" })),
        { type: "TextBlock", text: "Tap your answer:", isSubtle: true, wrap: true }
      ],
      actions: quiz.options.map((o) => ({
        type: "Action.Submit",
        title: o.key,
        data: { actionId: "quiz_answer", value: `${m.id}|${quiz.id}|${o.key}` }
      }))
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
}) {
  const { module: m, quiz, total, chosenKey } = opts;
  const chosen = quiz.options.find((o) => o.key === chosenKey);
  const correct = chosen?.correct === true;

  return (
    <Card
      title={correct ? "✅ Correct" : "❌ Not quite"}
      subtitle={`${m.title} · question ${quiz.number} of ${total}`}
    >
      <Section>
        <CardText>{quiz.question}</CardText>
      </Section>
      <Divider />
      <Section>
        {quiz.options.map((o) => {
          const isChosen = o.key === chosenKey;
          const marker = o.correct ? "✅" : isChosen ? "❌" : "▫️";
          const note = o.correct && isChosen ? " — Your answer · Best answer" : o.correct ? " — Best answer" : isChosen ? " — Your answer" : "";
          return <CardText key={o.key}>{`${marker} **${o.key}. ${o.text}**${note}`}</CardText>;
        })}
      </Section>
      {chosen?.explanation ? (
        <>
          <Divider />
          <Section>
            <CardText style="bold">WHY</CardText>
            <CardText>{chosen.explanation}</CardText>
          </Section>
        </>
      ) : null}
    </Card>
  );
}
