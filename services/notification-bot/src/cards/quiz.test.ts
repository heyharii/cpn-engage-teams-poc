import assert from "node:assert/strict";
import { test } from "node:test";
import { QuizAnswerResultCard, QuizQuestionCard } from "./QuizQuestionCard.js";
import type { ModuleContent, QuizQuestion } from "./types.js";

const module = {
  id: "m1",
  title: "Serve with heart",
  track: "Customers"
} as ModuleContent;

const quiz = {
  id: "q1",
  number: 1,
  question: "What do you do first?",
  options: [
    { key: "A", text: "Clarify the need", correct: true },
    { key: "B", text: "Wait and see", correct: false }
  ]
} as QuizQuestion;

function optionRows(card: { body?: unknown[] }) {
  return (card.body as { type?: string; style?: string; items?: { text?: string; wrap?: boolean }[]; selectAction?: unknown }[]).filter(
    (item) => item.type === "Container"
  );
}

test("v1 answered quiz keeps the question layout and only changes option state", () => {
  const question = optionRows(QuizQuestionCard({ module, quiz, total: 2 }));
  const answer = optionRows(QuizAnswerResultCard({ module, quiz, total: 2, chosenKey: "B" }));

  assert.equal(question.length, answer.length);
  assert.equal(question[0]?.items?.[0]?.wrap, true);
  assert.equal(question[0]?.selectAction !== undefined, true);
  assert.equal(answer[0]?.style, "good");
  assert.match(String(answer[0]?.items?.[0]?.text), /✅ A\. Clarify the need/);
  assert.equal(answer[1]?.style, "attention");
  assert.match(String(answer[1]?.items?.[0]?.text), /❌ B\. Wait and see/);
  assert.equal(answer[0]?.selectAction, undefined);
  assert.equal(answer[1]?.selectAction, undefined);
});
