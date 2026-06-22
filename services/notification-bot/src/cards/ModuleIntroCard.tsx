/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { LearningModule } from "@cpn-engage/shared";

/**
 * "Start today's module" intro. Leads into the daily drop quiz so the bot
 * always has an interactive next step.
 */
export function ModuleIntroCard(opts: { module: LearningModule; behavior: string }) {
  const { module: m, behavior } = opts;
  return (
    <Card title={`📘 Today's Module · ${behavior}`} subtitle={m.title}>
      <Section>
        <CardText>{m.summary}</CardText>
      </Section>
      <Divider />
      <Section>
        <CardText style="bold">WHAT'S INSIDE</CardText>
        <Fields>
          <Field label="⏱️ Time" value={m.duration} />
          <Field label="🎯 Behaviour" value={behavior} />
          <Field label="⚡ Drop" value="1 scenario · up to +50 pts" />
        </Fields>
      </Section>
      <Actions>
        <Button id="start_module" value={m.id} style="primary">
          Start the drop
        </Button>
        <Button id="intent" value="help">Maybe later</Button>
      </Actions>
    </Card>
  );
}
