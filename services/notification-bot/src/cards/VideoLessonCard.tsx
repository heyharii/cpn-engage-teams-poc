/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button, LinkButton, Divider } from "chat";
import type { ModuleContent } from "./types.ts";

/**
 * Learning Journey — video step. Adaptive Cards can't reliably embed video,
 * so we link out and let "I've watched it" advance the flow.
 */
export function VideoLessonCard(opts: { module: ModuleContent }) {
  const m = opts.module;
  return (
    <Card title="🎬 Video Lesson" subtitle={`${m.title} · ${m.track}`}>
      <Section>
        <CardText style="bold">What this looks like in practice</CardText>
        <CardText>
          {m.outcome ?? "A short lesson on living this Belief in everyday work."}
        </CardText>
      </Section>
      <Divider />
      <Actions>
        <LinkButton url={m.videoUrl ?? "https://www.centralpattana.co.th"}>Watch video</LinkButton>
        <Button id="watched_video" value={m.id} style="primary">
          I've watched it
        </Button>
      </Actions>
    </Card>
  );
}
