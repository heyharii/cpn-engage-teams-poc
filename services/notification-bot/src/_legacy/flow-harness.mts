/**
 * Simulates real conversations through the state machine — including the three
 * hard edge cases (free text mid-flow, wrong button, stale button on an old
 * card) — to prove the bot stays robust without any AI.
 *
 *   API_BASE_URL=http://localhost:4175 npx tsx src/_legacy/flow-harness.mts
 */
import { state, getState } from "../state.ts";
import { classifyIntent } from "../handlers/intent-router.ts";
import { dispatchIntent } from "../handlers/dispatch.ts";
import { beginModule, onWatchedVideo, onLessonDone, onQuizAnswer, resumeModule } from "../flows/module.ts";
import { onSubmitAnswer } from "../flows/challenge.ts";
import { onRecogniseText, onBeliefSelect, onSkipMedia, onRecogniseSend, resumeRecognise } from "../flows/recognise.ts";
import { showMenu } from "../flows/menu.ts";

let lastCard = "";
function thread(id: string) {
  return {
    id,
    isDM: true,
    async post(node: any) {
      lastCard = node?.props?.title ?? "(card)";
      console.log(`      ↳ bot posts:  ${lastCard}`);
    },
    async subscribe() {}
  } as any;
}

const KNOWN = new Set([
  "intent", "begin_module", "watched_video", "lesson_done", "quiz_answer",
  "submit_answer", "recognise_belief", "recognise_skip_media", "recognise_send",
  "remind_later", "resume"
]);

// Mimic bot.ts onAction routing exactly.
async function tap(t: any, id: string, value = "") {
  console.log(`  [TAP] ${id}${value ? " = " + value : ""}`);
  if (!KNOWN.has(id)) return showMenu(t, "Narin"); // catch-all
  switch (id) {
    case "intent": return dispatchIntent(t, value || "help", { displayName: "Narin" });
    case "begin_module": return beginModule(t, value);
    case "watched_video": return onWatchedVideo(t, value);
    case "lesson_done": return onLessonDone(t, value);
    case "quiz_answer": { const [m, q, o] = value.split("|"); return onQuizAnswer(t, { moduleId: m!, quizId: q!, optionKey: o! }); }
    case "submit_answer": { const [d, o] = value.split("|"); return onSubmitAnswer(t, { dropId: d!, optionId: o! }); }
    case "recognise_belief": return onBeliefSelect(t, value);
    case "recognise_skip_media": return onSkipMedia(t);
    case "recognise_send": return onRecogniseSend(t, "Narin");
    case "remind_later": return showMenu(t, "Narin");
    case "resume": {
      const st = await getState(t.id);
      if (st.kind === "module") return resumeModule(t, st);
      if (st.kind === "recognise") return resumeRecognise(t, st);
      return showMenu(t, "Narin");
    }
  }
}

// Mimic bot.ts handleText routing exactly.
async function say(t: any, text: string) {
  console.log(`  [CHAT] "${text}"`);
  const st = await getState(t.id);
  if (st.kind === "recognise" && (st.step === "colleague" || st.step === "description")) {
    const intent = classifyIntent(text);
    if (intent === "unknown" || intent === "recognise") {
      if (await onRecogniseText(t, text)) return;
    }
  }
  return dispatchIntent(t, classifyIntent(text), { rawText: text, displayName: "Narin" });
}

async function run() {
  await state.connect();

  console.log("\n##### 1. Normal module flow #####");
  let t = thread("u1");
  await tap(t, "intent", "start_module");
  await tap(t, "begin_module", "module-1");
  await tap(t, "watched_video", "module-1");
  await tap(t, "lesson_done", "module-1");
  await tap(t, "quiz_answer", "module-1|m1q1|A");
  await tap(t, "quiz_answer", "module-1|m1q2|B");
  await tap(t, "quiz_answer", "module-1|m1q3|A");
  console.log(`   state → ${(await getState(t.id)).kind}`);

  console.log("\n##### 2. STALE BUTTON — answer Q1 again after moving on #####");
  t = thread("u2");
  await tap(t, "begin_module", "module-1");
  await tap(t, "watched_video", "module-1");
  await tap(t, "lesson_done", "module-1");
  await tap(t, "quiz_answer", "module-1|m1q1|A"); // now on Q2
  await tap(t, "quiz_answer", "module-1|m1q1|B"); // OLD Q1 button → should be STALE
  await tap(t, "resume");                          // Continue → re-render Q2
  await tap(t, "quiz_answer", "module-1|m1q2|A");  // answers Q2 → Q3 (idempotent, not corrupted)

  console.log("\n##### 3. FREE TEXT mid-module #####");
  t = thread("u3");
  await tap(t, "begin_module", "module-1");        // on video
  await say(t, "hello there");                       // → menu, state preserved
  console.log(`   state still → ${(await getState(t.id)).kind}`);
  await tap(t, "watched_video", "module-1");        // still works → text lesson

  console.log("\n##### 4. WRONG / UNKNOWN button #####");
  t = thread("u4");
  await tap(t, "frobnicate_xyz", "stale");           // unknown id → catch-all → menu

  console.log("\n##### 5. CHALLENGE + double answer #####");
  t = thread("u5");
  await tap(t, "intent", "daily_challenge");
  await tap(t, "submit_answer", "challenge-1|option-1");
  await tap(t, "submit_answer", "challenge-1|option-2"); // already answered → STALE

  console.log("\n##### 6. RECOGNITION 5-step (text + buttons) #####");
  t = thread("u6");
  await tap(t, "intent", "recognise");
  await say(t, "Somruk T.");
  await tap(t, "recognise_belief", "Collaboration");
  await say(t, "Stayed late to help another store recover a tough handover.");
  await tap(t, "recognise_skip_media");
  await tap(t, "recognise_send");
  console.log(`   state → ${(await getState(t.id)).kind}`);

  console.log("\n##### 7. RECOGNITION stale — tap an old step button after finishing #####");
  await tap(t, "recognise_belief", "Customers"); // flow already done → STALE

  console.log("\n✅ harness complete");
}

run().catch((e) => { console.error("HARNESS ERROR", e); process.exit(1); });
