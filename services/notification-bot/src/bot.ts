/**
 * Bot wiring: chat SDK + Teams adapter + message/action handlers.
 *
 * Inbound text is classified into an intent and dispatched to a flow. Adaptive
 * Card buttons fire actions (intent / start_module / submit_answer) handled
 * below. Every handler is guarded so the conversation never hangs silently.
 */

import { Chat, type Author, type Message } from "chat";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { config } from "./config.ts";
import { state, type ThreadState } from "./state.ts";
import { classifyIntent } from "./handlers/intent-router.ts";
import { dispatchIntent, type DispatchCtx } from "./handlers/dispatch.ts";
import { guardAction, guardMessage } from "./handlers/safe.ts";
import { onSubmitAnswer, showModuleIntro } from "./flows/module.ts";
import { continueRecognise } from "./flows/recognise.ts";

export const bot = new Chat({
  userName: "CPN Engage",
  adapters: {
    teams: createTeamsAdapter({ appType: config.teams.appType })
  },
  state
});

function ctxFromAuthor(author?: Author, rawText?: string): DispatchCtx {
  return { displayName: author?.fullName, teamsUserId: author?.userId, rawText };
}

/** Shared text handler for DM + mention + subscribed channel messages. */
async function handleText(thread: Parameters<typeof dispatchIntent>[0], message: Message) {
  const text = message.text ?? "";

  // If the user is mid-recognise and just typed a colleague name, capture it.
  const current = await state.get<ThreadState>(thread.id);
  if (current?.kind === "recognise" && current.step === "await_colleague") {
    const intent = classifyIntent(text);
    // An explicit different command escapes the recognise flow.
    if (intent === "unknown" || intent === "recognise") {
      await continueRecognise(thread, text, message.author?.fullName);
      return;
    }
  }

  const intent = classifyIntent(text);
  await dispatchIntent(thread, intent, ctxFromAuthor(message.author, text));
}

bot.onDirectMessage(
  guardMessage<Message>("dm", async (thread, message) => {
    console.log(`[dm] from="${message.author?.fullName}" text="${message.text}"`);
    await handleText(thread, message);
  })
);

bot.onNewMention(
  guardMessage<Message>("mention", async (thread, message) => {
    console.log(`[mention] from="${message.author?.fullName}" text="${message.text}"`);
    await thread.subscribe();
    await handleText(thread, message);
  })
);

bot.onSubscribedMessage(
  guardMessage<Message>("subscribed", async (thread, message) => {
    const isDm = thread.isDM === true;
    const isMention = message.isMention === true;
    const intent = classifyIntent(message.text);
    if (!isDm && !isMention && intent === "unknown") return;
    await handleText(thread, message);
  })
);

// ── Action handlers (Adaptive Card buttons) ──────────────────────────────────

bot.onAction(
  "intent",
  guardAction("intent", async (event) => {
    const value = (event.value ?? "help") as string;
    if (!event.thread) return;
    await dispatchIntent(event.thread, value, {
      displayName: event.user?.fullName,
      teamsUserId: event.user?.userId
    });
  })
);

bot.onAction(
  "start_module",
  guardAction("start_module", async (event) => {
    if (!event.thread) return;
    await showModuleIntro(event.thread);
  })
);

bot.onAction(
  "submit_answer",
  guardAction("submit_answer", async (event) => {
    if (!event.thread) return;
    const raw = (event.value ?? "") as string;
    const [dropId, optionId] = raw.split("|");
    if (!dropId || !optionId) throw new Error(`malformed submit_answer payload: "${raw}"`);
    await onSubmitAnswer(event.thread, { dropId, optionId });
  })
);

// Catch-all — unknown action ids route to the menu instead of going silent.
bot.onAction(
  guardAction("catchall", async (event) => {
    const known = new Set(["intent", "start_module", "submit_answer"]);
    if (known.has(event.actionId)) return;
    if (event.thread) {
      await dispatchIntent(event.thread, "help", { displayName: event.user?.fullName });
    }
  })
);
