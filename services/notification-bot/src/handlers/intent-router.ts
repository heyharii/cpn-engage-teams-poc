/**
 * Map free-text input to an intent. Keyword-based and deterministic — no LLM
 * cost. The fallback is "unknown", which routes to the welcome menu.
 */

export type Intent =
  | "help"
  | "browse_modules"
  | "start_module"
  | "daily_challenge"
  | "recognise"
  | "recognise_v2"
  | "leaderboard"
  | "unknown";

const MATCHERS: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: "help",
    patterns: [
      /^\s*(hi|hii+|hello|hey|help|menu|start|\?|❓)[\s!.,?]*$/i,
      /^what can (you|u) do[?!.]*$/i,
      /^\/?help$/i
    ]
  },
  // Ordered before start_module: "all modules" contains "module", and browsing
  // is the safe reading of an ambiguous ask (it starts nothing).
  {
    intent: "browse_modules",
    patterns: [
      /\b(all|every|my|other|more|list|browse|which|available)\s+(the\s+)?(module|lesson|course)s?\b/i,
      // The qualifier can also trail the noun: "what modules are available".
      /\b(module|lesson|course)s\b.{0,20}\b(available|open|left|there)\b/i,
      /\b(module|lesson|course)\s+(list|catalog(ue)?|library)\b/i,
      /\blearning\s+(path|journey|plan)\b/i
    ]
  },
  {
    intent: "start_module",
    patterns: [/\b(module|lesson|learn(ing)?|today'?s module|start today|start module)\b/i, /^ready$/i]
  },
  {
    intent: "daily_challenge",
    patterns: [/\b(daily|challenge|quiz|drop|scenario)\b/i]
  },
  // Ordered before `recognise`, which its patterns would otherwise match.
  {
    intent: "recognise_v2",
    patterns: [/\b(recogni[sz]e|kudos|praise)\b.{0,12}\b(v2|new form|new version)\b/i]
  },
  {
    intent: "recognise",
    patterns: [/\b(recogni[sz]e|recogni[sz]ing|nominate|praise|shout[- ]?out|kudos|appreciat\w+)\b/i]
  },
  {
    intent: "leaderboard",
    patterns: [/\b(leader\w*|rank\w*|top\s+\w+|standing\w*|my rank|points|score)\b/i]
  }
];

export function classifyIntent(text: string | undefined): Intent {
  if (!text) return "help";
  const t = text.trim();
  if (!t) return "help";
  for (const { intent, patterns } of MATCHERS) {
    if (patterns.some((p) => p.test(t))) return intent;
  }
  return "unknown";
}
