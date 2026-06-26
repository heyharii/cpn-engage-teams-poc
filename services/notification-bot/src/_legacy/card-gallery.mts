/**
 * Renders every bot Adaptive Card to a single HTML gallery so we can SEE them
 * exactly as Teams would. Converts each chat-SDK card to Adaptive Card JSON via
 * the Teams adapter, then writes an HTML page that renders them with the
 * official adaptivecards renderer (CDN).
 *
 *   npx tsx src/_legacy/card-gallery.mts   →   writes /tmp/cpn-cards.html
 */
import fs from "node:fs";
import { toCardElement } from "chat";
import { cardToAdaptiveCard } from "@chat-adapter/teams";
import { demoBootstrap } from "@cpn-engage/shared";
import * as C from "../cards/index.ts";
import type { ModuleContent, QuizQuestion } from "../cards/types.ts";

const boot = demoBootstrap;

const sampleQuiz: QuizQuestion = {
  id: "q1",
  number: 1,
  question: "A peak-hour tenant escalation is rising. What is the best next step?",
  options: [
    { key: "A", text: "Clarify the customer's most urgent need and align the team on recovery.", correct: true, explanation: "Leading with Customers means understanding the real need first, then aligning the team fast." },
    { key: "B", text: "Follow the standard queue and resolve it later." },
    { key: "C", text: "Escalate to senior leadership before understanding the issue." }
  ]
};
const sampleModule: ModuleContent = {
  id: "module-1",
  title: "Building Customer Empathy",
  track: "Customers",
  durationMin: 15,
  videoUrl: "https://www.centralpattana.co.th",
  outcome: "See how to stay focused on the customer's real need under pressure.",
  questions: [sampleQuiz]
};

const cards: { name: string; el: unknown }[] = [
  { name: "Welcome / Menu", el: C.WelcomeCard({ displayName: "Narin" }) },
  { name: "Module intro", el: C.ModuleIntroCard({ module: boot.modules[0]!, behavior: "Customers" }) },
  { name: "Video lesson", el: C.VideoLessonCard({ module: sampleModule }) },
  { name: "Quiz question", el: C.QuizQuestionCard({ module: sampleModule, quiz: sampleQuiz, total: 3 }) },
  { name: "Quiz result — correct", el: C.QuizResultCard({ moduleId: "module-1", quiz: sampleQuiz, chosen: sampleQuiz.options[0]!, correct: sampleQuiz.options[0]!, isCorrect: true, hasNext: true }) },
  { name: "Quiz result — wrong", el: C.QuizResultCard({ moduleId: "module-1", quiz: sampleQuiz, chosen: sampleQuiz.options[1]!, correct: sampleQuiz.options[0]!, isCorrect: false, hasNext: true }) },
  { name: "Module complete (score)", el: C.ModuleCompleteCard({ module: sampleModule, score: 8, total: 10, next: { id: "module-2", title: "Solving With Impact" } }) },
  { name: "Daily drop (challenge)", el: C.DailyDropCard({ drop: boot.dailyDrop }) },
  { name: "Answer result", el: C.AnswerResultCard({ drop: boot.dailyDrop, chosen: boot.dailyDrop.options[0]!, best: boot.dailyDrop.options[0]!, pointsEarned: 50, newScore: 925, newStreak: 13 }) },
  { name: "Leaderboard", el: C.LeaderboardCard({ entries: boot.leaderboard, you: boot.currentUser.name }) },
  { name: "Recognise — who", el: C.RecognisePromptCard({ behaviors: boot.behaviors }) },
  { name: "Recognise — pick Belief", el: C.BeliefSelectCard({ colleague: "Somruk T.", behaviors: boot.behaviors }) },
  { name: "Recognise — confirm", el: C.RecognitionConfirmCard({ colleague: "Somruk T.", behavior: "Collaboration", description: "Stayed late to help another store recover a difficult handover." }) },
  { name: "Recognise — sent", el: C.RecognitionSentCard({ colleague: "Somruk T.", behavior: "Collaboration" }) },
  { name: "Recognition received (notif)", el: C.RecognitionReceivedCard({ fromName: "Narin", behavior: "Collaboration", message: "Stayed late to help another store recover a difficult handover." }) },
  { name: "My progress", el: C.PassportCard({ passport: boot.passport, streak: boot.streakSummary, persona: boot.persona }) },
  { name: "Module assigned (notif)", el: C.ModuleAssignedCard({ moduleId: "module-1", title: "Building Customer Empathy", track: "Customers", durationMin: 15 }) },
  { name: "Challenge reminder (notif)", el: C.ChallengeReminderCard({ behavior: "Customers", reward: "Up to 50 points", timeLimit: "30 sec" }) },
  { name: "Deadline reminder (notif)", el: C.DeadlineReminderCard({ title: "Building Customer Empathy", daysLeft: 2, actionId: "start_module", actionValue: "module-1" }) }
];

const items = cards.map((c) => {
  let json: unknown;
  try {
    const el = toCardElement(c.el as never);
    const raw = cardToAdaptiveCard(el as never) as { toJSON?: () => unknown };
    json = typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
  } catch (e) {
    json = { type: "AdaptiveCard", body: [{ type: "TextBlock", text: `render error: ${(e as Error).message}` }] };
  }
  return { name: c.name, json };
});

console.log("SAMPLE JSON (first card):", JSON.stringify(items[0]?.json).slice(0, 400));

const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://unpkg.com/adaptivecards@3.0.6/dist/adaptivecards.min.js"></script>
<style>
  body { margin:0; background:#f3f2f1; font-family:'Segoe UI',sans-serif; padding:24px; }
  h1 { font-size:20px; color:#242424; }
  .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:18px; }
  .cell { background:transparent; }
  .label { font-size:12px; font-weight:700; color:#616161; margin:0 0 6px 2px; text-transform:uppercase; letter-spacing:.04em; }
  .host { background:#fff; border:1px solid #e1dfdd; border-radius:8px; padding:14px; box-shadow:0 1px 2px rgba(0,0,0,.08); }
</style></head><body>
<h1>CPN Engage — Adaptive Card Gallery (${items.length} cards)</h1>
<div class="grid" id="grid"></div>
<script>
  // Render **bold** like Teams does (the AC renderer leaves markdown raw by default).
  AdaptiveCards.AdaptiveCard.onProcessMarkdown = function(text, result){
    result.outputHtml = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
    result.didProcess = true;
  };
  const cards = ${JSON.stringify(items)};
  const grid = document.getElementById('grid');
  for (const c of cards) {
    const cell = document.createElement('div'); cell.className='cell';
    const label = document.createElement('p'); label.className='label'; label.textContent=c.name; cell.appendChild(label);
    const host = document.createElement('div'); host.className='host';
    try {
      const ac = new AdaptiveCards.AdaptiveCard();
      ac.parse(c.json);
      host.appendChild(ac.render());
    } catch(e){ host.textContent = 'render error: '+e.message; }
    cell.appendChild(host); grid.appendChild(cell);
  }
</script>
</body></html>`;

const outDir = new URL("../../_gallery/", import.meta.url).pathname;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}index.html`, html);
console.log(`Wrote ${outDir}index.html with ${items.length} cards`);
for (const it of items) {
  const body = (it.json as { body?: unknown[] })?.body?.length ?? 0;
  console.log(`  • ${it.name}  (${body} elements)`);
}
