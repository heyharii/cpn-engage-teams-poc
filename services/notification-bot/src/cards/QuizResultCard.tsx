/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { QuizOption, QuizQuestion } from "./types.ts";

/**
 * Feedback after a quiz answer. Learning Journey quizzes are scored (X/total)
 * but — per the PRD — do NOT award points (that's the Challenge feature).
 */
export function QuizResultCard(opts: {
  moduleId: string;
  quiz: QuizQuestion;
  chosen: QuizOption;
  correct: QuizOption;
  isCorrect: boolean;
  hasNext: boolean;
}) {
  const { moduleId, quiz, chosen, correct, isCorrect, hasNext } = opts;
  return (
    <Card
      title={isCorrect ? "✅ Correct" : "❌ Not quite"}
      subtitle={`Question ${quiz.number}`}
    >
      <Section>
        <CardText style="bold">Your answer</CardText>
        <CardText>{`${chosen.key}. ${chosen.text}`}</CardText>
      </Section>
      {!isCorrect ? (
        <>
          <Divider />
          <Section>
            <CardText style="bold">Correct answer</CardText>
            <CardText>{`${correct.key}. ${correct.text}`}</CardText>
          </Section>
        </>
      ) : null}
      <Divider />
      <Section>
        <CardText style="bold">WHY</CardText>
        <CardText>{correct.explanation ?? "This best reflects the Belief in this scenario."}</CardText>
      </Section>
      <Actions>
        <Button id={hasNext ? "quiz_next" : "quiz_finish"} value={moduleId} style="primary">
          {hasNext ? "Next question" : "See my score"}
        </Button>
      </Actions>
    </Card>
  );
}
