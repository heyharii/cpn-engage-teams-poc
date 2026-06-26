/**
 * Prop types for the Learning Journey cards. Kept local to the bot so the
 * cards are self-contained; the content/data layer (DB) can map onto these.
 */

export type QuizOption = {
  key: string; // "A" | "B" | "C" | "D"
  text: string;
  correct?: boolean;
  explanation?: string;
};

export type QuizQuestion = {
  id: string;
  number: number; // 1-based position
  question: string;
  options: QuizOption[];
};

export type ModuleContent = {
  id: string;
  title: string;
  summary: string;
  track: string; // the Belief this module sits under
  durationMin: number;
  videoUrl?: string;
  outcome?: string;
  lesson: { heading: string; body: string };
  questions: QuizQuestion[];
};
