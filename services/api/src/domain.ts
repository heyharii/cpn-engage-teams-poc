import type { DailyDrop, ModuleContent } from "@cpn-engage/shared";

export type Actor = {
  userKey: string;
  userName: string | null;
  verified: boolean;
  source: "employee" | "bot" | "development";
};

export type RecognitionInput = {
  target: string;
  behavior: string;
  message: string;
};

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validateRecognitionInput(input: Partial<RecognitionInput>): RecognitionInput {
  const target = cleanText(input.target, 160);
  const behavior = cleanText(input.behavior, 80);
  const message = cleanText(input.message, 2000);
  if (!target) throw new Error("target is required");
  if (!behavior) throw new Error("belief is required");
  if (!message) throw new Error("message is required");
  return { target, behavior, message };
}

function requireText(value: unknown, field: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
}

function requireNonNegativeNumber(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
}

export function validateModuleContent(module: ModuleContent): ModuleContent {
  requireText(module.id, "module id");
  requireText(module.title, "module title");
  requireText(module.track, "module track");
  requireText(module.lesson?.heading, "lesson heading");
  requireText(module.lesson?.body, "lesson body");
  const deadline = typeof module.deadline === "string" ? module.deadline.trim() || null : module.deadline ?? null;
  if (deadline !== null && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    throw new Error("deadline must be YYYY-MM-DD");
  }
  requireNonNegativeNumber(module.points ?? 75, "points");
  if (!Array.isArray(module.questions) || module.questions.length === 0) {
    throw new Error("module needs at least one question");
  }
  const ids = new Set<string>();
  for (const question of module.questions) {
    requireText(question.id, "question id");
    requireText(question.question, "question text");
    if (ids.has(question.id)) throw new Error(`duplicate question id: ${question.id}`);
    ids.add(question.id);
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`question ${question.id} needs at least two options`);
    }
    if (question.options.filter((option) => option.correct === true).length !== 1) {
      throw new Error(`question ${question.id} must have exactly one correct option`);
    }
    for (const option of question.options) {
      requireText(option.key, `option key in ${question.id}`);
      requireText(option.text, `option text in ${question.id}`);
    }
  }
  return { ...module, deadline };
}

export function validateDailyDrop(drop: DailyDrop): DailyDrop {
  requireText(drop.id, "drop id");
  requireText(drop.title, "drop title");
  requireText(drop.behavior, "drop behavior");
  requireNonNegativeNumber(drop.bestPoints ?? 50, "bestPoints");
  if (!Array.isArray(drop.questions) || drop.questions.length === 0) {
    throw new Error("drop needs at least one question");
  }
  const ids = new Set<string>();
  for (const question of drop.questions) {
    requireText(question.id, "question id");
    requireText(question.question, "question text");
    if (ids.has(question.id)) throw new Error(`duplicate question id: ${question.id}`);
    ids.add(question.id);
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`question ${question.id} needs at least two options`);
    }
    if (question.options.filter((option) => option.isBest === true).length !== 1) {
      throw new Error(`question ${question.id} must have exactly one best option`);
    }
    for (const option of question.options) {
      requireText(option.id, `option id in ${question.id}`);
      requireText(option.label, `option label in ${question.id}`);
    }
  }
  return drop;
}

export function scoreChallengeAnswer(
  drop: DailyDrop,
  questionId: string,
  optionId: string
): { best: boolean; points: number } | null {
  const question = drop.questions.find((q) => q.id === questionId);
  const option = question?.options.find((o) => o.id === optionId);
  if (!question || !option) return null;
  const best = option.isBest === true;
  // Only the ⭐ answer earns. A wrong answer still RECORDS (so the drop counts as
  // played and the streak holds) but is worth nothing.
  return { best, points: best ? drop.bestPoints ?? 50 : 0 };
}

/** YYYY-MM-DD in the tenant's business timezone, independent of server locale. */
export function businessDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: "year" | "month" | "day") => parts.find((p) => p.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  if (!year || !month || !day) throw new Error(`unable to calculate date in timezone ${timeZone}`);
  return `${year}-${month}-${day}`;
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
