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
          {hi} I help you grow the four CPN behaviours through a daily drop,
          short modules, peer recognition, and your personal progress passport.
        </CardText>
        <CardText style="bold">What would you like to do?</CardText>
      </Section>
      <Actions>
        <Button id="intent" value="start_module" style="primary">
          Start today's module
        </Button>
        <Button id="intent" value="daily_challenge">Daily drop challenge</Button>
        <Button id="intent" value="recognise">Recognise a colleague</Button>
        <Button id="intent" value="leaderboard">View leaderboard</Button>
        <Button id="intent" value="passport">My passport</Button>
      </Actions>
    </Card>
  );
}
