import assert from "node:assert/strict";
import test from "node:test";
import { demoDailyDrop } from "@cpn-engage/shared";
import {
  businessDate,
  isValidTimeZone,
  scoreChallengeAnswer,
  validateDailyDrop,
  validateModuleContent,
  validateRecognitionInput
} from "./domain.js";

test("challenge points are computed from stored options, not caller claims", () => {
  const question = demoDailyDrop.questions[0]!;
  const best = question.options.find((o) => o.isBest)!;
  const other = question.options.find((o) => !o.isBest)!;
  assert.deepEqual(scoreChallengeAnswer(demoDailyDrop, question.id, best.id), {
    best: true,
    points: demoDailyDrop.bestPoints ?? 50
  });
  // A wrong answer earns nothing — it is still recorded so the drop counts as
  // played, but it must never add points.
  assert.deepEqual(scoreChallengeAnswer(demoDailyDrop, question.id, other.id), {
    best: false,
    points: 0
  });
  assert.equal(scoreChallengeAnswer(demoDailyDrop, question.id, "invented"), null);
});

test("recognition input is trimmed, bounded, and complete", () => {
  assert.deepEqual(
    validateRecognitionInput({ target: "  Somruk  ", behavior: " Customers ", message: " Great recovery " }),
    { target: "Somruk", behavior: "Customers", message: "Great recovery" }
  );
  assert.throws(() => validateRecognitionInput({ target: "", behavior: "Customers", message: "Hello" }));
});

test("business dates follow the configured timezone", () => {
  const instant = new Date("2026-08-10T18:30:00.000Z");
  assert.equal(businessDate(instant, "UTC"), "2026-08-10");
  assert.equal(businessDate(instant, "Asia/Bangkok"), "2026-08-11");
  assert.equal(isValidTimeZone("Asia/Bangkok"), true);
  assert.equal(isValidTimeZone("Not/AZone"), false);
});

test("admin-authored learning and drop content must be scoreable", () => {
  const module = {
    id: "m",
    title: "Module",
    summary: "",
    track: "Customers",
    deadline: null,
    lesson: { heading: "Lesson", body: "Body" },
    questions: [
      {
        id: "q",
        number: 1,
        question: "Question?",
        options: [
          { key: "A", text: "Yes", correct: true },
          { key: "B", text: "No" }
        ]
      }
    ]
  };
  assert.equal(validateModuleContent(module).id, "m");
  assert.throws(() =>
    validateModuleContent({
      ...module,
      questions: [{ ...module.questions[0]!, options: module.questions[0]!.options.map((o) => ({ ...o, correct: true })) }]
    })
  );
  assert.equal(validateDailyDrop(demoDailyDrop).id, demoDailyDrop.id);
  assert.throws(() =>
    validateDailyDrop({
      ...demoDailyDrop,
      questions: [{ ...demoDailyDrop.questions[0]!, options: demoDailyDrop.questions[0]!.options.map((o) => ({ ...o, isBest: false })) }]
    })
  );
});
