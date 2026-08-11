/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";

/**
 * Shown when a flow-starting action fires while a different flow is still open
 * — whether the user asked for it, or tapped a button on a card from last week.
 *
 * This is what makes every permanent card safe: a stale tap can no longer wipe
 * progress, it can only raise this question. Going ahead is an explicit second
 * tap on a `force_*` action, which skips the check.
 */
export function ConflictCard(opts: {
  current: { label: string; detail: string };
  action: { id: string; value: string; label: string };
}) {
  return (
    <Card title="⏸️ You're in the middle of something" subtitle={opts.current.label}>
      <Section>
        <CardText>{`You're at: ${opts.current.detail}.`}</CardText>
        <CardText>
          {`Starting ${opts.action.label} now would discard that progress.`}
        </CardText>
      </Section>
      <Divider />
      <Actions>
        <Button id="resume" value="resume" style="primary">
          Continue where I was
        </Button>
        <Button id={opts.action.id} value={opts.action.value}>
          {`Start ${opts.action.label}`}
        </Button>
      </Actions>
    </Card>
  );
}
