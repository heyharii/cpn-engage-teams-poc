/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { LearningModule } from "@cpn-engage/shared";

/**
 * Learning Journey — module intro (PRD Feature 1). A module mixes video, text,
 * and a quiz; completing the quiz gives a score (not points).
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
          <Field label="🎯 Belief" value={behavior} />
          <Field label="📦 Format" value="Video · guide · quiz" />
        </Fields>
      </Section>
      <Actions>
        <Button id="start_module" value={m.id} style="primary">
          Start module
        </Button>
        <Button id="intent" value="help">Maybe later</Button>
      </Actions>
    </Card>
  );
}
