import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleListCardV2, quizQuestionCardV2 } from "./learning.js";
import type { ModuleContent } from "../types.js";

const modules = [
  { id: "m1", title: "Serve with heart", track: "Customers", durationMin: 12, questions: [{}, {}] },
  { id: "m2", title: "Speak up safely", track: "Integrity", durationMin: 8, questions: [{}] }
] as unknown as ModuleContent[];

const quiz = {
  id: "q2",
  number: 2,
  question: "What do you do first?",
  options: [
    { key: "A", text: "Escalate" },
    { key: "B", text: "Ask what they need" }
  ]
} as never;

test("each module is one tappable button carrying its own detail", () => {
  const buttons = (moduleListCardV2({ modules }).body as Record<string, unknown>[]).filter(
    (e) => e.type === "CompoundButton"
  );
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0]?.title, "Serve with heart");
  assert.match(String(buttons[0]?.description), /Customers · 12 min/);
  // pick_module only opens an intro — the destructive step stays behind the
  // intro's guarded Start button, exactly as in v1.
  assert.deepEqual(buttons[0]?.selectAction, {
    type: "Action.Submit",
    data: { actionId: "pick_module", value: "m1" }
  });
});

test("only the module in progress gets a badge", () => {
  const buttons = (moduleListCardV2({ modules, activeId: "m2" }).body as Record<string, unknown>[]).filter(
    (e) => e.type === "CompoundButton"
  );
  assert.equal(buttons[0]?.badge, undefined);
  assert.equal(buttons[1]?.badge, "In progress");
});

test("the progress bar reflects questions already answered, not the current one", () => {
  const bar = (card: number) =>
    (quizQuestionCardV2({ module: modules[0]!, quiz, total: 4, answered: card }).body as Record<string, unknown>[]).find(
      (e) => e.type === "ProgressBar"
    );
  assert.equal(bar(0)?.value, 0);
  assert.equal(bar(1)?.value, 25);
  assert.equal(bar(3)?.value, 75);
  assert.equal(bar(0)?.max, 100);
});

test("answer buttons keep v1's action id and payload, so the flow is unchanged", () => {
  const card = quizQuestionCardV2({ module: modules[0]!, quiz, total: 2, answered: 1 });
  const actions = card.actions as { title: string; data: { actionId: string; value: string } }[];
  assert.deepEqual(actions.map((a) => a.title), ["A", "B"]);
  assert.equal(actions[0]?.data.actionId, "quiz_answer");
  assert.equal(actions[0]?.data.value, "m1|q2|A");
});
