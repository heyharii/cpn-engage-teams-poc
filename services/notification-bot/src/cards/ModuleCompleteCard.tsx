/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { ModuleContent } from "./types.ts";

/**
 * Module complete. Shows the quiz score (X/total) — a learning record, NOT
 * points (PRD: points are Challenges-only).
 */
export function ModuleCompleteCard(opts: {
  module: ModuleContent;
  score: number;
  total: number;
  next?: { id: string; title: string } | null;
}) {
  const { module: m, score, total, next } = opts;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return (
    <Card title="🏆 Module complete" subtitle={`${m.title} · ${m.track}`}>
      <Section>
        <Fields>
          <Field label="SCORE" value={`${score}/${total}`} />
          <Field label="ACCURACY" value={`${pct}%`} />
          <Field label="BELIEF" value={m.track} />
        </Fields>
      </Section>
      <Divider />
      <Section>
        <CardText>
          Nice work — your learning record is updated. You can revisit this module any time without
          losing your score.
        </CardText>
      </Section>
      {next ? (
        <>
          <Divider />
          <Section>
            <CardText style="bold">UP NEXT</CardText>
            <CardText>{next.title}</CardText>
          </Section>
        </>
      ) : null}
      <Actions>
        {next ? (
          <Button id="pick_module" value={next.id} style="primary">
            Open next module
          </Button>
        ) : null}
        <Button id="intent" value="browse_modules">Browse modules</Button>
        <Button id="intent" value="help">Back to main menu</Button>
      </Actions>
    </Card>
  );
}
