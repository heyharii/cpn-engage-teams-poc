/**
 * Version-aware card builders.
 *
 * Flows import from here instead of picking a rendering themselves, so the
 * choice lives in exactly one place and a flow's logic never mentions a
 * version. Both shapes travel through `postCard`/`editCard`, which route JSX
 * and raw Adaptive Card JSON alike — so switching a variant on changes nothing
 * at the call site.
 */

import { cardV2 } from "../versioning.ts";
import type { ModuleContent, QuizQuestion } from "./types.ts";
import { ModuleListCard, QuizAnswerResultCard, QuizQuestionCard } from "./index.ts";
import { moduleListCardV2, quizAnswerResultCardV2, quizQuestionCardV2 } from "./v2/learning.ts";

export function moduleList(opts: { modules: ModuleContent[]; activeId?: string }): unknown {
  return cardV2("modules") ? moduleListCardV2(opts) : ModuleListCard(opts);
}

export function quizQuestion(opts: {
  module: ModuleContent;
  quiz: QuizQuestion;
  total: number;
  /** How many questions are already behind the user — the progress bar's value. */
  answered: number;
}): unknown {
  return cardV2("quiz")
    ? quizQuestionCardV2(opts)
    : QuizQuestionCard({ module: opts.module, quiz: opts.quiz, total: opts.total });
}

export function quizAnswerResult(opts: {
  module: ModuleContent;
  quiz: QuizQuestion;
  total: number;
  answered: number;
  chosenKey: string;
}): unknown {
  return cardV2("quiz")
    ? quizAnswerResultCardV2(opts)
    : QuizAnswerResultCard(opts);
}
