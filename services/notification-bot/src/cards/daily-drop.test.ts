import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyDrop, DropQuestion } from "@cpn-engage/shared";
import { DailyDropCard, dailyDropResultCard } from "./DailyDropCard.js";

const drop = {
  id: "drop-1",
  title: "Solving With Impact",
  behavior: "Dynamism",
  rewardLabel: "Up to 50 points",
  status: "pending",
  questions: [],
  question: "",
  options: []
} as unknown as DailyDrop;

const question = {
  id: "q1",
  question: "What should you do first?",
  options: [
    { id: "a", label: "Clarify the need", isBest: true },
    { id: "b", label: "Wait and see", isBest: false }
  ]
} as DropQuestion;

function optionRows(card: { body?: unknown[] }) {
  return (card.body as { type?: string; style?: string; items?: { text?: string; wrap?: boolean }[]; selectAction?: unknown }[]).filter(
    (item) => item.type === "Container"
  );
}

test("daily challenge keeps option rows in place and highlights the answer in the edited card", () => {
  const questionCard = DailyDropCard({ drop, question, qNum: 1, total: 1 });
  const resultCard = dailyDropResultCard({
    drop,
    question,
    qNum: 1,
    total: 1,
    chosenId: "b",
    pointsEarned: 0,
    newScore: null,
    isLast: true
  });
  const before = optionRows(questionCard);
  const after = optionRows(resultCard);

  assert.equal(before.length, 2);
  assert.equal(after.length, 2);
  assert.equal(before[0]?.items?.[0]?.wrap, true);
  assert.equal(before[0]?.selectAction !== undefined, true);
  assert.equal(after[0]?.style, "good");
  assert.match(String(after[0]?.items?.[0]?.text), /✅ 1\. Clarify the need/);
  assert.equal(after[1]?.style, "attention");
  assert.match(String(after[1]?.items?.[0]?.text), /❌ 2\. Wait and see/);
  assert.equal(after[0]?.selectAction, undefined);
  assert.equal(after[1]?.selectAction, undefined);
});
