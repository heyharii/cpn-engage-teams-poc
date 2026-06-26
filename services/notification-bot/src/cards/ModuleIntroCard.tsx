/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { ModuleContent } from "./types.ts";

/**
 * Learning Journey — module intro (PRD Feature 1). A module mixes video, text,
 * and a quiz; completing the quiz gives a score (not points).
 */
export function ModuleIntroCard(opts: { module: ModuleContent }) {
  const { module: m } = opts;
  return (
    <Card title={`📘 Today's Module · ${m.track}`} subtitle={m.title}>
      <Section>
        <CardText>{m.summary}</CardText>
      </Section>
      <Divider />
      <Section>
        <CardText style="bold">WHAT'S INSIDE</CardText>
        <Fields>
          <Field label="⏱️ Time" value={`${m.durationMin} min`} />
          <Field label="🎯 Belief" value={m.track} />
          <Field label="📦 Format" value={`Video · guide · ${m.questions.length}-question quiz`} />
        </Fields>
      </Section>
      <Actions>
        <Button id="begin_module" value={m.id} style="primary">
          Start module
        </Button>
        <Button id="intent" value="help">Maybe later</Button>
      </Actions>
    </Card>
  );
}
