/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { Behavior } from "@cpn-engage/shared";

/** Step 1 — ask who to recognise. */
export function RecognisePromptCard(opts: { behaviors: Behavior[] }) {
  return (
    <Card title="🌟 Recognise a colleague" subtitle="Send a moment of appreciation">
      <Section>
        <CardText>
          Reply with the name of the colleague you'd like to recognise, and I'll
          help you send it into the moderation queue.
        </CardText>
        <CardText style="bold">Tip</CardText>
        <CardText>You can type something like: "Recognise Somruk T."</CardText>
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

/** Step 2 — confirmation after the recognition lands in the queue. */
export function RecognitionSentCard(opts: { colleague: string; behavior: string }) {
  return (
    <Card title="✅ Recognition sent" subtitle="Now in the moderation queue">
      <Section>
        <CardText>
          {`Your recognition for ${opts.colleague} (${opts.behavior}) is in the Admin moderation queue. Once approved, it appears in the public Community Feed.`}
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
