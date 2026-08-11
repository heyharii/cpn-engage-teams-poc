/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button } from "chat";

/**
 * Confirmation that a paused flow is safely parked. Nothing is cleared — the
 * thread state stays exactly where it was, and the hub keeps offering Continue
 * until the state expires.
 */
export function PausedCard(opts: { label: string; detail: string }) {
  return (
    <Card title="⏸️ Paused" subtitle={opts.label}>
      <Section>
        <CardText>{`Saved at: ${opts.detail}. Come back any time and tap Continue — nothing is lost.`}</CardText>
      </Section>
      <Actions>
        <Button id="resume" value="resume" style="primary">
          Continue now
        </Button>
        <Button id="intent" value="help">Main menu</Button>
      </Actions>
    </Card>
  );
}
