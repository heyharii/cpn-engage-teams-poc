/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { ModuleContent, QuizQuestion } from "./types.ts";

/** One quiz question with the full answer options as clickable actions. */
export function QuizQuestionCard(opts: { module: ModuleContent; quiz: QuizQuestion; total: number }) {
  const { module: m, quiz, total } = opts;
  return (
    <Card title={`Question ${quiz.number} of ${total}`} subtitle={`${m.title} · ${m.track}`}>
      <Section>
        <CardText>{quiz.question}</CardText>
      </Section>
      <Actions>
        {quiz.options.map((o) => (
          <Button key={o.key} id="quiz_answer" value={`${m.id}|${quiz.id}|${o.key}`}>
            {`${o.key}. ${o.text}`}
          </Button>
        ))}
      </Actions>
      <Divider />
      <Actions>
        <Button id="pause" value="pause" style="default">Save &amp; exit</Button>
      </Actions>
    </Card>
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
