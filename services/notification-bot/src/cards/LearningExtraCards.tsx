/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, Divider } from "chat";
import type { ModuleContent } from "./types.ts";
import type { RawCard } from "../raw-card.ts";
import { adaptiveCard, cardHeader, submitAction, textBlock } from "./rawLayout.ts";

/**
 * Text-based lesson step (PRD Feature 1: content includes "text-based guides").
 * Shown between the intro and the quiz for reading content.
 */
export function TextLessonCard(opts: { module: ModuleContent; heading: string; body: string }): RawCard {
  return adaptiveCard(
    [
      ...cardHeader("📄 Lesson", `${opts.module.title} · ${opts.module.track}`, "pause"),
      textBlock(opts.heading, { bold: true, spacing: "Medium" }),
      textBlock(opts.body)
    ],
    [submitAction("lesson_done", opts.module.id, "Continue to quiz", "positive")]
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
export function StepDoneCard(opts: { title: string; subtitle?: string; lines: string[] }): RawCard {
  return adaptiveCard([
    ...cardHeader(opts.title, opts.subtitle, "done"),
    ...opts.lines.map((line, i) => textBlock(line, { spacing: i === 0 ? "Medium" : "Small" }))
  ]);
}
