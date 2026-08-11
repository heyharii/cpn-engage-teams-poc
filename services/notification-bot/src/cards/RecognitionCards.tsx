/** @jsxImportSource chat */
import { Card, CardText, Section, Actions, Button } from "chat";
import type { Behavior } from "@cpn-engage/shared";
import type { RawCard } from "../raw-card.ts";
import { adaptiveCard, cardHeader, textBlock } from "./rawLayout.ts";

/** Step 1 — ask who to recognise. */
export function RecognisePromptCard(opts: { behaviors: Behavior[] }): RawCard {
  return adaptiveCard([
    ...cardHeader("🌟 Recognise a colleague", "Send a moment of appreciation", "pause"),
    textBlock("Type the name of the colleague you'd like to recognise. I'll look them up in the directory so they get notified.", {
      spacing: "Medium"
    }),
    textBlock("Tip", { bold: true, spacing: "Medium" }),
    textBlock('Just their name works — e.g. "Somruk" or "Somruk T."'),
    textBlock("CPN BEHAVIOURS", { bold: true, spacing: "Medium" }),
    ...opts.behaviors.map((b) => textBlock(`• ${b.name} — ${b.tagline}`))
  ]);
}

/** Step 2 — confirmation after the recognition is posted. */
export function RecognitionSentCard(opts: { colleague: string; behavior: string; pending?: boolean }) {
  return (
    <Card
      title={opts.pending ? "🕓 Recognition submitted" : "✅ Recognition sent"}
      subtitle={opts.pending ? "Waiting for admin approval" : "Posted to the Community Feed"}
    >
      <Section>
        <CardText>
          {opts.pending
            ? `Your recognition for ${opts.colleague} (${opts.behavior}) is waiting for approval. They will be notified after it is approved.`
            : `Your recognition for ${opts.colleague} (${opts.behavior}) is now live in the Community Feed. Their Teams notification has been queued.`}
        </CardText>
      </Section>
      <Actions>
        <Button id="intent" value="help" style="primary">
          Back to main menu
        </Button>
      </Actions>
    </Card>
  );
}
