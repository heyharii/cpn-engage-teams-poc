/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { Behavior } from "@cpn-engage/shared";

/** Step 2 — which Belief did the colleague demonstrate? */
export function BeliefSelectCard(opts: { colleague: string; behaviors: Behavior[] }) {
  return (
    <Card title="🌟 Recognise a colleague" subtitle={`Step 2 of 3 · ${opts.colleague}`}>
      <Section>
        <CardText>{`Which Belief did **${opts.colleague}** demonstrate?`}</CardText>
      </Section>
      <Actions>
        {opts.behaviors.map((b) => (
          <Button key={b.name} id="recognise_belief" value={b.name} style="primary">
            {b.name}
          </Button>
        ))}
      </Actions>
    </Card>
  );
}

/** Step 2b — ask what happened (free-text description). */
export function DescriptionPromptCard(opts: { colleague: string; behavior: string }) {
  return (
    <Card title="✍️ What happened?" subtitle={`${opts.colleague} · ${opts.behavior}`}>
      <Section>
        <CardText>{`Reply with a short note about what **${opts.colleague}** did to show **${opts.behavior}**.`}</CardText>
      </Section>
    </Card>
  );
}

/** Step 2c — optionally attach a photo or video (PRD Feature 3 #4). */
export function MediaPromptCard(opts: { colleague: string }) {
  return (
    <Card title="📷 Add a photo or video?" subtitle="Optional">
      <Section>
        <CardText>
          {`Attach a photo or video of ${opts.colleague} in action using the Teams attachment (📎) below, or skip.`}
        </CardText>
      </Section>
      <Actions>
        <Button id="recognise_skip_media" value="skip" style="primary">
          Skip — no media
        </Button>
      </Actions>
    </Card>
  );
}

/** Step 3 — confirm before it goes to the moderation queue. */
export function RecognitionConfirmCard(opts: { colleague: string; behavior: string; description: string }) {
  return (
    <Card title="📝 Confirm recognition" subtitle="Step 3 of 3">
      <Section>
        <Fields>
          <Field label="COLLEAGUE" value={opts.colleague} />
          <Field label="BELIEF" value={opts.behavior} />
        </Fields>
      </Section>
      <Divider />
      <Section>
        <CardText style="bold">WHAT HAPPENED</CardText>
        <CardText>{opts.description}</CardText>
      </Section>
      <Actions>
        <Button id="recognise_send" value="send" style="primary">
          Send for approval
        </Button>
        <Button id="intent" value="recognise">Start over</Button>
      </Actions>
    </Card>
  );
}

/** Notification to the recognised colleague. */
export function RecognitionReceivedCard(opts: { fromName: string; behavior: string; message: string }) {
  return (
    <Card title="🎉 You've been recognised!" subtitle={`For living ${opts.behavior}`}>
      <Section>
        <CardText>{`${opts.fromName} recognised you:`}</CardText>
        <CardText style="bold">{`“${opts.message}”`}</CardText>
      </Section>
      <Actions>
        <Button id="intent" value="leaderboard" style="primary">
          See the feed
        </Button>
      </Actions>
    </Card>
  );
}
