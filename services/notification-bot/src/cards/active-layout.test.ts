import assert from "node:assert/strict";
import { test } from "node:test";
import { ModuleIntroCard } from "./ModuleIntroCard.js";
import { VideoLessonCard } from "./VideoLessonCard.js";
import { TextLessonCard } from "./LearningExtraCards.js";
import { RecognisePromptCard } from "./RecognitionCards.js";
import { BeliefSelectCard, ColleaguePickCard, DescriptionPromptCard, RecognitionConfirmCard } from "./RecognitionFlowCards.js";
import { recogniseFormCard } from "./v2/recognise.js";
import type { ModuleContent } from "./types.js";

const module = {
  id: "m1",
  title: "Serve with heart",
  track: "Customers",
  summary: "A short module.",
  deadline: null,
  questions: [{}, {}],
  outcome: "Practice the belief.",
  lesson: { heading: "Guide", body: "Read this." }
} as unknown as ModuleContent;

const behaviors = [
  { name: "Customers", tagline: "Start with their need" },
  { name: "Dynamism", tagline: "Aim high" }
] as never[];

function pauseAction(card: { body?: unknown[] }) {
  const header = (card.body as { type?: string; columns?: { items?: { type?: string; actions?: { data?: { actionId?: string } }[] }[] }[] }[]).find(
    (item) => item.type === "ColumnSet"
  );
  return header?.columns?.[1]?.items?.[0]?.actions?.[0];
}

test("all active guided cards put Save & exit in the same top-right slot", () => {
  const cards = [
    VideoLessonCard({ module }),
    TextLessonCard({ module, heading: "Guide", body: "Read this." }),
    RecognisePromptCard({ behaviors }),
    ColleaguePickCard({ candidates: [{ oid: "u1", label: "A colleague" }] }),
    BeliefSelectCard({ colleague: "A colleague", behaviors }),
    DescriptionPromptCard({ colleague: "A colleague", behavior: "Customers" }),
    RecognitionConfirmCard({ colleague: "A colleague", behavior: "Customers", description: "Helped a customer." }),
    recogniseFormCard(behaviors)
  ];

  for (const card of cards) {
    assert.equal(pauseAction(card)?.data?.actionId, "pause");
  }
  assert.equal(pauseAction(ModuleIntroCard({ module })), undefined);
});
