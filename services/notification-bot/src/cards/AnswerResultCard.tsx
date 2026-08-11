/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { DailyDrop, DailyDropOption } from "@cpn-engage/shared";

/**
 * Shown after the user answers the challenge (PRD Feature 2): immediate
 * correct/incorrect feedback + points. Points are the only score here
 * (Learning Journey quizzes are score-only, no points).
 */
export function AnswerResultCard(opts: {
  drop: DailyDrop;
  chosen: DailyDropOption;
  best: DailyDropOption;
  pointsEarned: number;
  newScore: number | null;
}) {
  const { drop, chosen, best, pointsEarned, newScore } = opts;
  const isBest = chosen.isBest === true;
  const title = isBest ? `✅ Correct · +${pointsEarned} pts` : `❌ Not quite · +${pointsEarned} pts`;

  return (
    <Card title={title} subtitle={`${drop.title} — ${drop.behavior}`}>
      <Section>
        <CardText style="bold">Your answer</CardText>
        <CardText>{chosen.label}</CardText>
      </Section>
      {!isBest ? (
        <>
          <Divider />
          <Section>
            <CardText style="bold">BEST ANSWER</CardText>
            <CardText>{best.label}</CardText>
          </Section>
        </>
      ) : null}
      <Divider />
      <Section>
        <CardText style="bold">WHY</CardText>
        <CardText>
          {`Leading with ${drop.behavior} means understanding the real need first, then aligning the team on the fastest recovery.`}
        </CardText>
      </Section>
      <Divider />
      <Section>
        <Fields>
          <Field label="POINTS" value={`+${pointsEarned}`} />
          <Field label="YOUR TOTAL" value={newScore != null ? `${newScore} pts` : "updated"} />
        </Fields>
      </Section>
      <Actions>
        <Button id="intent" value="help" style="primary">
          Back to hub
        </Button>
      </Actions>
    </Card>
  );
}
