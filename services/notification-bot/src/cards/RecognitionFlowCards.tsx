/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button } from "chat";
import type { Behavior } from "@cpn-engage/shared";
import type { RawCard } from "../raw-card.ts";
import { adaptiveCard, cardHeader, submitAction, textBlock } from "./rawLayout.ts";

/** Step 1b — disambiguate a typed name into a real directory person. */
export function ColleaguePickCard(opts: { candidates: { oid: string; label: string }[] }): RawCard {
  return adaptiveCard(
    [...cardHeader("👥 Who do you mean?", "Pick the colleague", "pause"), textBlock("Select the right person so they get notified.", { spacing: "Medium" })],
    opts.candidates.map((c) => submitAction("recognise_pick", c.oid, c.label, "positive"))
  );
}

/** Step 2 — which Belief did the colleague demonstrate? */
export function BeliefSelectCard(opts: { colleague: string; behaviors: Behavior[] }): RawCard {
  return adaptiveCard(
    [
      ...cardHeader("🌟 Recognise a colleague", `Step 2 of 4 · ${opts.colleague}`, "pause"),
      textBlock(`Which Belief did **${opts.colleague}** demonstrate?`, { spacing: "Medium" })
    ],
    opts.behaviors.map((b) => submitAction("recognise_belief", b.name, b.name, "positive"))
  );
}

/** Step 3 — ask what happened (free-text description). */
export function DescriptionPromptCard(opts: { colleague: string; behavior: string }): RawCard {
  return adaptiveCard([
    ...cardHeader("✍️ What happened?", `Step 3 of 4 · ${opts.colleague} · ${opts.behavior}`, "pause"),
    textBlock(`Reply with a short note about what **${opts.colleague}** did to show **${opts.behavior}**.`, { spacing: "Medium" })
  ]);
}

/** Step 4 — confirm before it posts to the public feed. */
export function RecognitionConfirmCard(opts: { colleague: string; behavior: string; description: string }): RawCard {
  return adaptiveCard(
    [
      ...cardHeader("📝 Confirm recognition", "Step 4 of 4", "pause"),
      {
        type: "FactSet",
        facts: [
          { title: "COLLEAGUE", value: opts.colleague },
          { title: "BELIEF", value: opts.behavior }
        ],
        spacing: "Medium"
      },
      textBlock("WHAT HAPPENED", { bold: true, spacing: "Medium" }),
      textBlock(opts.description)
    ],
    [
      submitAction("recognise_send", "send", "Send recognition", "positive"),
      // Deliberate restart — skips the in-progress check that `intent` applies.
      submitAction("force_intent", "recognise", "Start over")
    ]
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
