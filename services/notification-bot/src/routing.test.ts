import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyIntent } from "./handlers/intent-router.js";
import { describeFlow } from "./state.js";

test("browsing beats starting when the ask is ambiguous", () => {
  // "all modules" contains "module": without ordering, these would start one.
  for (const text of ["show me all modules", "list modules", "my modules", "what modules are available"]) {
    assert.equal(classifyIntent(text), "browse_modules", text);
  }
  // A bare ask still starts today's module.
  for (const text of ["start today's module", "lesson", "ready"]) {
    assert.equal(classifyIntent(text), "start_module", text);
  }
});

test("a colleague's name never escapes the recognition flow as a command", () => {
  // The router only escapes on a real command; these must stay "unknown" so
  // mid-flow text is consumed as the answer rather than routed away.
  for (const name of ["Somruk T.", "Mark Lister", "Anong"]) {
    assert.equal(classifyIntent(name), "unknown", name);
  }
});

test("describeFlow reports the flow kind so a conflict can be detected", () => {
  assert.equal(describeFlow({ kind: "idle" }), null);

  const challenge = describeFlow({
    kind: "challenge",
    dropId: "d1",
    qIndex: 1,
    score: 20,
    answeredQ: ["q1"]
  });
  assert.equal(challenge?.kind, "challenge");
  assert.equal(challenge?.detail, "Question 2");

  const recognise = describeFlow({ kind: "recognise", step: "belief", colleague: "Somruk T." });
  assert.equal(recognise?.kind, "recognise");
  assert.match(recognise?.label ?? "", /Somruk T\./);

  const module = describeFlow({
    kind: "module",
    moduleId: "unknown-module",
    step: "quiz",
    quizIdx: 2,
    correct: 1,
    answered: ["q1", "q2"]
  });
  assert.equal(module?.kind, "module");
  assert.equal(module?.detail, "Question 3");
});
