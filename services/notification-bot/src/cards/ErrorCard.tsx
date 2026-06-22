/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button } from "chat";

/**
 * Shown when a handler throws — keeps the conversation alive with a clear next
 * step instead of going silent. We never leak stack traces to the user.
 */
export function ErrorCard(opts: { hint?: string } = {}) {
  return (
    <Card title="⚠️ Something didn't go through">
      <Section>
        <CardText>
          {opts.hint ??
            "I hit a snag with that. Your progress is safe — try one of the options below."}
        </CardText>
      </Section>
      <Actions>
        <Button id="intent" value="help" style="primary">
          Open menu
        </Button>
        <Button id="intent" value="daily_challenge">Daily drop</Button>
      </Actions>
    </Card>
  );
}
