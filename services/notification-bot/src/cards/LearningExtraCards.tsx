/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, LinkButton, Divider } from "chat";
import type { ModuleContent } from "./types.ts";

/**
 * Text-based lesson step (PRD Feature 1: content includes "text-based guides").
 * Shown between the intro and the quiz for reading content.
 */
export function TextLessonCard(opts: { module: ModuleContent; heading: string; body: string }) {
  return (
    <Card title="📄 Lesson" subtitle={`${opts.module.title} · ${opts.module.track}`}>
      <Section>
        <CardText style="bold">{opts.heading}</CardText>
        <CardText>{opts.body}</CardText>
      </Section>
      <Divider />
      <Actions>
        <Button id="lesson_done" value={opts.module.id} style="primary">
          Continue to quiz
        </Button>
        <Button id="pause" value="pause">Finish later</Button>
      </Actions>
    </Card>
  );
}

/**
 * Closed / expired indicator — PRD Feature 1 #8 (module expired) and
 * Feature 2 #5 (challenge closed): can no longer access, with a clear notice.
 */
export function ClosedCard(opts: { kind: "module" | "challenge"; title: string }) {
  const noun = opts.kind === "module" ? "module" : "challenge";
  return (
    <Card title={`🔒 This ${noun} has closed`} subtitle={opts.title}>
      <Section>
        <CardText>
          {`This ${noun} has passed its deadline and can no longer be ${opts.kind === "module" ? "opened" : "answered"}. No points are awarded for closed ${noun}s.`}
        </CardText>
      </Section>
      <Divider />
      <Actions>
        <Button id="intent" value="help" style="primary">
          See what's still open
        </Button>
      </Actions>
    </Card>
  );
}

/**
 * A finished step, shown in place of the card that had the buttons. Keeps the
 * outcome readable in the chat history and carries NO controls at all — the
 * message is a record, and a record can't rewind a flow years later.
 */
export function StepDoneCard(opts: { title: string; subtitle?: string; lines: string[] }) {
  return (
    <Card title={opts.title} subtitle={opts.subtitle}>
      <Section>
        {opts.lines.map((line, i) => (
          <CardText key={String(i)}>{line}</CardText>
        ))}
      </Section>
    </Card>
  );
}
