/**
 * Map free-text input to an intent. Keyword-based and deterministic — no LLM
 * cost. The fallback is "unknown", which routes to the welcome menu.
 */

export type Intent =
  | "help"
  | "start_module"
  | "daily_challenge"
  | "recognise"
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
  {
    intent: "start_module",
    patterns: [/\b(module|lesson|learn(ing)?|today'?s module|start today|start module)\b/i, /^ready$/i]
  },
  {
    intent: "daily_challenge",
    patterns: [/\b(daily|challenge|quiz|drop|scenario)\b/i]
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
