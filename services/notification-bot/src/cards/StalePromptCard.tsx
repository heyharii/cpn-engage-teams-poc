/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button } from "chat";

/**
 * Shown when the user presses a button on an OLD card (scrolled back up) that
 * no longer matches where they are — or an action that's already been handled.
 * We never error or silently re-run; we point them to where they actually are.
 */
export function StalePromptCard(opts: { hint: string; canContinue: boolean }) {
  return (
    <Card title="↪️ Let's pick up where you are" subtitle="That step is already done">
      <Section>
        <CardText>{opts.hint}</CardText>
      </Section>
      <Actions>
        {opts.canContinue ? (
          <Button id="resume" value="resume" style="primary">
            Continue
          </Button>
        ) : null}
        <Button id="intent" value="help">Main menu</Button>
      </Actions>
    </Card>
  );
}
