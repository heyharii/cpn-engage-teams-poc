/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { PassportSummary, StreakSummary, PersonaSummary } from "@cpn-engage/shared";

/**
 * The personal progress passport, read live from shared state. Mirrors the
 * Passport panel in the Employee App tab.
 */
export function PassportCard(opts: {
  passport: PassportSummary;
  streak: StreakSummary;
  persona: PersonaSummary;
}) {
  const { passport, streak, persona } = opts;
  const bar = renderBar(passport.modulesCompleted, passport.modulesTotal);

  return (
    <Card title="📒 Your Progress Passport" subtitle={`${persona.title} · Level ${persona.level}`}>
      <Section>
        <Fields>
          <Field label="SCORE" value={`${passport.score}`} />
          <Field label="COMPLETION" value={`${passport.completion}%`} />
          <Field label="BADGES" value={`${passport.badges}`} />
        </Fields>
      </Section>
      <Divider />
      <Section>
        <CardText style="bold">STREAK</CardText>
        <CardText>{`${streak.current} days · best ${streak.best} · ${streak.daysLeft} to next milestone`}</CardText>
      </Section>
      <Divider />
      <Section>
        <CardText style="bold">MODULES</CardText>
        <CardText>{`${passport.modulesCompleted} of ${passport.modulesTotal} complete`}</CardText>
        <CardText>{bar}</CardText>
      </Section>
      {passport.recentEntries.length ? (
        <>
          <Divider />
          <Section>
            <CardText style="bold">RECENT</CardText>
            {passport.recentEntries.slice(0, 3).map((e) => (
              <CardText key={e.id}>{`• ${e.title} · +${e.points} (${e.behavior})`}</CardText>
            ))}
          </Section>
        </>
      ) : null}
      <Actions>
        <Button id="intent" value="daily_challenge" style="primary">
          Daily drop
        </Button>
        <Button id="intent" value="leaderboard">Leaderboard</Button>
        <Button id="intent" value="help">Back to menu</Button>
      </Actions>
    </Card>
  );
}

function renderBar(done: number, total: number): string {
  const width = 16;
  if (total <= 0) return "";
  const filled = Math.min(width, Math.max(0, Math.round((done / total) * width)));
  return `${"▰".repeat(filled)}${"▱".repeat(width - filled)}`;
}
