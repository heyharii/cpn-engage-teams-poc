/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { DailyDrop, DailyDropOption } from "@cpn-engage/shared";

/**
 * Shown after the user answers the daily drop. Green for the best answer,
 * amber otherwise — but always coaching, never punishing. Points and streak
 * reflect the value written back to the shared passport.
 */
export function AnswerResultCard(opts: {
  drop: DailyDrop;
  chosen: DailyDropOption;
  best: DailyDropOption;
  pointsEarned: number;
  newScore: number | null;
  newStreak: number | null;
}) {
  const { drop, chosen, best, pointsEarned, newScore, newStreak } = opts;
  const isBest = chosen.isBest === true;
  const title = isBest
    ? `✅ Strong call · +${pointsEarned} pts`
    : `💡 Good attempt · +${pointsEarned} pts`;

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
            <CardText style="bold">STRONGEST MOVE</CardText>
            <CardText>{best.label}</CardText>
          </Section>
        </>
      ) : null}
      <Divider />
      <Section>
        <CardText style="bold">WHY IT MATTERS</CardText>
        <CardText>
          {`Leading with ${drop.behavior} means understanding the customer's real need first, then aligning the team on the fastest recovery. Every drop you complete keeps your streak alive.`}
        </CardText>
      </Section>
      <Divider />
      <Section>
        <Fields>
          <Field label="PASSPORT SCORE" value={newScore != null ? `${newScore}` : "updated"} />
          <Field label="STREAK" value={newStreak != null ? `${newStreak} days` : "kept alive"} />
        </Fields>
      </Section>
      <Actions>
        <Button id="intent" value="leaderboard" style="primary">
          View leaderboard
        </Button>
        <Button id="intent" value="passport">My passport</Button>
        <Button id="intent" value="help">Back to menu</Button>
      </Actions>
    </Card>
  );
}
