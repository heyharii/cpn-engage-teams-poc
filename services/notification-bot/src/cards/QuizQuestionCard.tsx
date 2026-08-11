/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { ModuleContent, QuizQuestion } from "./types.ts";

/**
 * One quiz question. Options are shown as full text in the body; letter-only
 * buttons sit at the bottom so long option text isn't truncated by Teams.
 */
export function QuizQuestionCard(opts: { module: ModuleContent; quiz: QuizQuestion; total: number }) {
  const { module: m, quiz, total } = opts;
  return (
    <Card title={`Question ${quiz.number} of ${total}`} subtitle={`${m.title} · ${m.track}`}>
      <Section>
        <CardText>{quiz.question}</CardText>
      </Section>
      <Divider />
      <Section>
        {quiz.options.map((o) => (
          <CardText key={o.key}>{`**${o.key}.** ${o.text}`}</CardText>
        ))}
      </Section>
      <Divider />
      <Section>
        <CardText>Tap your answer:</CardText>
      </Section>
      <Actions>
        {quiz.options.map((o) => (
          <Button key={o.key} id="quiz_answer" value={`${m.id}|${quiz.id}|${o.key}`}>
            {o.key}
          </Button>
        ))}
        <Button id="pause" value="pause">Finish later</Button>
      </Actions>
    </Card>
  );
}
