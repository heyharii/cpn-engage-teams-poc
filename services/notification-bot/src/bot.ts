/**
 * Bot wiring: chat SDK + Teams adapter + the conversation state machine.
 *
 * Three robustness guarantees for this no-AI, button-driven bot:
 *  1. Free text  → intent router → closest flow, or the menu (never ignored).
 *  2. Wrong/unknown button → catch-all → menu (never silent).
 *  3. Stale button (an old card the user scrolled back to) → each flow checks
 *     the thread state and replies "let's pick up where you are" instead of
 *     corrupting progress. Button values are self-contained so order doesn't
 *     matter, and scoring is idempotent.
 */

import { Chat, type Author, type Message, type Thread } from "chat";
import { createTeamsAdapter, decodeThreadId } from "@chat-adapter/teams";
import { config } from "./config.ts";
import { state, getState } from "./state.ts";
import { getConversationByThreadId, rememberConversation } from "./db.ts";
import { classifyIntent } from "./handlers/intent-router.ts";
import { dispatchIntent, type DispatchCtx } from "./handlers/dispatch.ts";
import { guardAction, guardMessage } from "./handlers/safe.ts";
import {
  beginModule,
  pickModule,
  onWatchedVideo,
  onLessonDone,
  onQuizAnswer,
  resumeModule
} from "./flows/module.ts";
import { onSubmitAnswer, resumeChallenge } from "./flows/challenge.ts";
import {
  onRecogniseText,
  onColleaguePick,
  onBeliefSelect,
  onRecogniseSend,
  resumeRecognise
} from "./flows/recognise.ts";
import { onRecogniseSendV2, startRecogniseV2 } from "./flows/v2/recognise.ts";
import { showHub, pauseFlow } from "./flows/hub.ts";

export const bot = new Chat({
  userName: "CPN Engage",
  adapters: { teams: createTeamsAdapter({ appType: config.teams.appType }) },
  state
});

function ctx(author?: Author, rawText?: string): DispatchCtx {
  return { displayName: author?.fullName, teamsUserId: author?.userId, rawText };
}

/** Capture the conversation reference so we can DM this user proactively later. */
async function capture(thread: Thread<unknown, unknown>, author?: Author) {
  try {
    const d = decodeThreadId(thread.id);
    const existing = await getConversationByThreadId(thread.id);
    await rememberConversation({
      threadId: thread.id,
      serviceUrl: d.serviceUrl,
      conversationId: d.conversationId,
      // Raw Bot Framework activities carry aadObjectId and are captured before
      // this handler. Preserve that stable directory oid instead of replacing it
      // with Teams' transient 29:... participant id.
      userId: existing?.userId ?? author?.userId ?? null,
      userName: author?.fullName ?? null,
      tenantId: config.teams.tenantId || null
    });
  } catch {
    /* non-fatal — proactive push just skips users we couldn't capture */
  }
}

/** Shared text handler. Mid-flow text input is consumed by the active flow. */
async function handleText(thread: Parameters<typeof dispatchIntent>[0], message: Message) {
  const text = message.text ?? "";
  await capture(thread, message.author);

  // If we're mid-recognition on a text step, the reply IS the answer.
  const st = await getState(thread.id);
  if (st.kind === "recognise" && (st.step === "colleague" || st.step === "description")) {
    const intent = classifyIntent(text);
    // An explicit command (e.g. "leaderboard") still escapes the flow.
    if (intent === "unknown" || intent === "recognise") {
      if (await onRecogniseText(thread, text)) return;
    }
  }

  await dispatchIntent(thread, classifyIntent(text), ctx(message.author, text));
}

bot.onDirectMessage(
  guardMessage<Message>("dm", async (thread, message) => {
    console.log(`[dm] "${message.text}" from ${message.author?.fullName}`);
    await handleText(thread, message);
  })
);

bot.onNewMention(
  guardMessage<Message>("mention", async (thread, message) => {
    await thread.subscribe();
    await handleText(thread, message);
  })
);

bot.onSubscribedMessage(
  guardMessage<Message>("subscribed", async (thread, message) => {
    const intent = classifyIntent(message.text);
    if (thread.isDM !== true && message.isMention !== true && intent === "unknown") return;
    await handleText(thread, message);
  })
);

// ── Action handlers ──────────────────────────────────────────────────────────

bot.onAction(
  "intent",
  guardAction("intent", async (event) => {
    if (!event.thread) return;
    await dispatchIntent(event.thread, (event.value ?? "help") as string, ctx(event.user));
  })
);

// The user has seen the conflict card and chosen to discard their progress.
bot.onAction(
  "force_intent",
  guardAction("force_intent", async (event) => {
    if (!event.thread) return;
    await dispatchIntent(event.thread, (event.value ?? "help") as string, {
      ...ctx(event.user),
      force: true
    });
  })
);

// "Finish later" — park the flow; state is untouched and the hub offers Continue.
bot.onAction("pause", guardAction("pause", async (e) => {
  if (e.thread) await pauseFlow(e.thread, e.user?.fullName);
}));

// Learning Journey
bot.onAction("pick_module", guardAction("pick_module", async (e) => {
  if (e.thread) await pickModule(e.thread, (e.value ?? "") as string);
}));
bot.onAction("begin_module", guardAction("begin_module", async (e) => {
  if (e.thread) await beginModule(e.thread, (e.value ?? "") as string, e.messageId);
}));
bot.onAction("force_begin_module", guardAction("force_begin_module", async (e) => {
  if (e.thread) await beginModule(e.thread, (e.value ?? "") as string, e.messageId, true);
}));
bot.onAction("watched_video", guardAction("watched_video", async (e) => {
  if (e.thread) await onWatchedVideo(e.thread, (e.value ?? "") as string, e.messageId);
}));
bot.onAction("lesson_done", guardAction("lesson_done", async (e) => {
  if (e.thread) await onLessonDone(e.thread, (e.value ?? "") as string, e.messageId);
}));
bot.onAction("quiz_answer", guardAction("quiz_answer", async (e) => {
  if (!e.thread) return;
  const [moduleId, quizId, optionKey] = ((e.value ?? "") as string).split("|");
  if (!moduleId || !quizId || !optionKey) throw new Error(`bad quiz_answer: "${e.value}"`);
  await onQuizAnswer(e.thread, { moduleId, quizId, optionKey }, { userId: e.user?.userId, fullName: e.user?.fullName }, e.messageId);
}));

// Challenge
bot.onAction("submit_answer", guardAction("submit_answer", async (e) => {
  if (!e.thread) return;
  // value = "dropId|questionId|optionId" (questionId added for multi-question drops).
  const parts = ((e.value ?? "") as string).split("|");
  const [dropId, questionId, optionId] = parts.length === 3 ? parts : [parts[0], "q1", parts[1]];
  if (!dropId || !optionId) throw new Error(`bad submit_answer: "${e.value}"`);
  await onSubmitAnswer(e.thread, { dropId, questionId, optionId }, { userId: e.user?.userId, fullName: e.user?.fullName }, e.messageId);
}));

// Recognition
bot.onAction("recognise_pick", guardAction("recognise_pick", async (e) => {
  if (e.thread) await onColleaguePick(e.thread, (e.value ?? "") as string, e.messageId);
}));
bot.onAction("recognise_belief", guardAction("recognise_belief", async (e) => {
  if (e.thread) await onBeliefSelect(e.thread, (e.value ?? "") as string, e.messageId);
}));
bot.onAction("recognise_send", guardAction("recognise_send", async (e) => {
  if (e.thread) await onRecogniseSend(e.thread, { userId: e.user?.userId, fullName: e.user?.fullName }, e.messageId);
}));

// Recognition v2 — the whole form arrives in this one submit.
bot.onAction("v2_recognise_send", guardAction("v2_recognise_send", onRecogniseSendV2));

// "Remind me later" — just acknowledge with the hub.
bot.onAction("remind_later", guardAction("remind_later", async (e) => {
  if (e.thread) await showHub(e.thread, e.user?.fullName);
}));

// "Continue" — re-post the card for wherever the user actually is. Every flow
// answers this, so a paused flow is never a dead end.
bot.onAction("resume", guardAction("resume", async (e) => {
  if (!e.thread) return;
  const st = await getState(e.thread.id);
  if (st.kind === "module") await resumeModule(e.thread, st);
  else if (st.kind === "challenge") await resumeChallenge(e.thread, st);
  else if (st.kind === "recognise") await resumeRecognise(e.thread, st);
  // v2 has no partial state — a fresh form IS the resume. The old form stays
  // valid until one of them is submitted; the first submit clears the state,
  // so the other one lands on the stale card.
  else if (st.kind === "recognise2") await startRecogniseV2(e.thread);
  else await showHub(e.thread, e.user?.fullName);
}));

// Catch-all — any unknown action id routes to the hub, never silent.
bot.onAction(
  guardAction("catchall", async (event) => {
    const known = new Set([
      "intent", "force_intent", "pause", "resume", "remind_later",
      "pick_module", "begin_module", "force_begin_module",
      "watched_video", "lesson_done", "quiz_answer",
      "submit_answer", "recognise_pick", "recognise_belief", "recognise_send",
      "v2_recognise_send"
    ]);
    if (known.has(event.actionId)) return;
    if (event.thread) await showHub(event.thread, event.user?.fullName);
  })
);
