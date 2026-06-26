/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button } from "chat";

/**
 * First card a user sees in a DM. Every button maps to an intent → flow.
 */
export function WelcomeCard(opts: { displayName?: string } = {}) {
  const hi = opts.displayName ? `Hi ${opts.displayName}!` : "Hi!";
  return (
    <Card title="👋 Welcome to CPN Engage" subtitle="Your Central Pattana culture companion">
      <Section>
        <CardText>
          {hi} I help you grow the four CPN Beliefs through short learning modules,
          quick challenges, and peer recognition.
        </CardText>
        <CardText style="bold">What would you like to do?</CardText>
      </Section>
      <Actions>
        <Button id="intent" value="start_module" style="primary">
          Start today's module
        </Button>
        <Button id="intent" value="daily_challenge">Today's challenge</Button>
        <Button id="intent" value="recognise">Recognise a colleague</Button>
        <Button id="intent" value="leaderboard">View leaderboard</Button>
      </Actions>
    </Card>
  );
}
