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
        <Button id="pause" value="pause" style="default">Save &amp; exit</Button>
      </Actions>
    </Card>
  );
}

/** Step 2 — confirmation after the recognition is posted. */
export function RecognitionSentCard(opts: { colleague: string; behavior: string; pending?: boolean }) {
  return (
    <Card
      title={opts.pending ? "🕓 Recognition submitted" : "✅ Recognition sent"}
      subtitle={opts.pending ? "Waiting for admin approval" : "Posted to the Community Feed"}
    >
      <Section>
        <CardText>
          {opts.pending
            ? `Your recognition for ${opts.colleague} (${opts.behavior}) is waiting for approval. They will be notified after it is approved.`
            : `Your recognition for ${opts.colleague} (${opts.behavior}) is now live in the Community Feed. Their Teams notification has been queued.`}
        </CardText>
      </Section>
      <Actions>
        <Button id="intent" value="help" style="primary">
          Back to main menu
        </Button>
      </Actions>
    </Card>
  );
}
