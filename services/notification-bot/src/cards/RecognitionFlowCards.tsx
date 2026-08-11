/** @jsxImportSource chat */
import { Card, CardText, Section, Fields, Field, Actions, Button, Divider } from "chat";
import type { Behavior } from "@cpn-engage/shared";

/** Step 1b — disambiguate a typed name into a real directory person. */
export function ColleaguePickCard(opts: { candidates: { oid: string; label: string }[] }) {
  return (
    <Card title="👥 Who do you mean?" subtitle="Pick the colleague">
      <Section>
        <CardText>Select the right person so they get notified.</CardText>
      </Section>
      <Actions>
        {opts.candidates.map((c) => (
          <Button key={c.oid} id="recognise_pick" value={c.oid} style="primary">
            {c.label}
          </Button>
        ))}
        <Button id="pause" value="pause">Finish later</Button>
      </Actions>
    </Card>
  );
}

/** Step 2 — which Belief did the colleague demonstrate? */
export function BeliefSelectCard(opts: { colleague: string; behaviors: Behavior[] }) {
  return (
    <Card title="🌟 Recognise a colleague" subtitle={`Step 2 of 4 · ${opts.colleague}`}>
      <Section>
        <CardText>{`Which Belief did **${opts.colleague}** demonstrate?`}</CardText>
      </Section>
      <Actions>
        {opts.behaviors.map((b) => (
          <Button key={b.name} id="recognise_belief" value={b.name} style="primary">
            {b.name}
          </Button>
        ))}
        <Button id="pause" value="pause">Finish later</Button>
      </Actions>
    </Card>
  );
}

/** Step 3 — ask what happened (free-text description). */
export function DescriptionPromptCard(opts: { colleague: string; behavior: string }) {
  return (
    <Card title="✍️ What happened?" subtitle={`Step 3 of 4 · ${opts.colleague} · ${opts.behavior}`}>
      <Section>
        <CardText>{`Reply with a short note about what **${opts.colleague}** did to show **${opts.behavior}**.`}</CardText>
      </Section>
      <Actions>
        <Button id="pause" value="pause">Finish later</Button>
      </Actions>
    </Card>
  );
}

/** Step 4 — confirm before it posts to the public feed. */
export function RecognitionConfirmCard(opts: { colleague: string; behavior: string; description: string }) {
  return (
    <Card title="📝 Confirm recognition" subtitle="Step 4 of 4">
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
          Send recognition
        </Button>
        {/* Deliberate restart — skips the in-progress check that `intent` applies. */}
        <Button id="force_intent" value="recognise">Start over</Button>
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
        <Button id="intent" value="help" style="primary">
          Open CPN Engage
        </Button>
      </Actions>
    </Card>
  );
}
