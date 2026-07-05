/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { Behavior } from "@cpn-engage/shared";

/** Step 1 — ask who to recognise. */
export function RecognisePromptCard(opts: { behaviors: Behavior[] }) {
  return (
    <Card title="🌟 Recognise a colleague" subtitle="Send a moment of appreciation">
      <Section>
        <CardText>
          Type the name of the colleague you'd like to recognise. I'll look them
          up in the directory so they get notified.
        </CardText>
        <CardText style="bold">Tip</CardText>
        <CardText>Just their name works — e.g. "Somruk" or "Somruk T."</CardText>
      </Section>
      <Divider />
      <Section>
        <CardText style="bold">CPN BEHAVIOURS</CardText>
        {opts.behaviors.map((b) => (
          <CardText key={b.name}>{`• ${b.name} — ${b.tagline}`}</CardText>
        ))}
      </Section>
      <Actions>
        <Button id="intent" value="help">Cancel</Button>
      </Actions>
    </Card>
  );
}

/** Step 2 — confirmation after the recognition is posted. */
export function RecognitionSentCard(opts: { colleague: string; behavior: string }) {
  return (
    <Card title="✅ Recognition sent" subtitle="Posted to the Community Feed">
      <Section>
        <CardText>
          {`Your recognition for ${opts.colleague} (${opts.behavior}) is now live in the Community Feed, and ${opts.colleague} has been notified.`}
        </CardText>
      </Section>
      <Actions>
        <Button id="intent" value="leaderboard" style="primary">
          View leaderboard
        </Button>
        <Button id="intent" value="help">Back to menu</Button>
      </Actions>
    </Card>
  );
}
