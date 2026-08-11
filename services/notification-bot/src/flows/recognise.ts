/**
 * Recognition flow (PRD Feature 3), 4 guided steps:
 *   who → belief → description → confirm → (send)
 *
 * This flow used to live inside a single message that each step overwrote. It
 * no longer does: like the other flows, the answered card becomes a buttonless
 * record and the next step is posted below it. An edit raises no Teams
 * notification, so a one-message wizard silently stalls for anyone who steps
 * away — which is precisely the user we want to be able to come back.
 *
 * Steps answered by TYPING (who, description) work the same way; the only
 * difference is that the card to summarise comes from `st.cardId` rather than
 * from the tapped message.
 */

import type { Thread } from "chat";
import { getBootstrap, submitRecognition, scoreIdentity } from "../api.ts";
import { getState, setState, clearState, describeFlow, type ThreadState } from "../state.ts";
import { advanceStep, postCard } from "../edit.ts";
import { searchDirectory, getDirectoryUser } from "../db.ts";
import {
  RecognisePromptCard,
  ColleaguePickCard,
  BeliefSelectCard,
  DescriptionPromptCard,
  RecognitionConfirmCard,
  RecognitionSentCard,
  StalePromptCard,
  StepDoneCard
} from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/**
 * Resolve a typed name to a real directory person:
 *   1 match  → straight to the Belief step with the resolved identity (+ oid)
 *   several  → a pick card to disambiguate
 *   none     → carry on with the typed name; the directory may be un-synced
 */
async function resolveColleague(thread: AnyThread, name: string, cardId?: string): Promise<void> {
  const matches = await searchDirectory(name, 6);
  const boot = await getBootstrap();

  if (matches.length > 1) {
    const id = await advanceStep(
      thread,
      cardId,
      StepDoneCard({ title: "🔍 Several matches", subtitle: name, lines: ["Pick the right person below."] }),
      ColleaguePickCard({
        candidates: matches.map((m) => ({
          oid: m.oid,
          label: m.department ? `${m.displayName} · ${m.department}` : (m.displayName ?? m.oid)
        }))
      })
    );
    await setState(thread.id, { kind: "recognise", step: "colleague", cardId: id });
    return;
  }

  const match = matches[0];
  const colleague = match?.displayName ?? name;
  const id = await advanceStep(
    thread,
    cardId,
    StepDoneCard({ title: "✅ Colleague", subtitle: colleague, lines: ["Now pick the Belief they showed."] }),
    BeliefSelectCard({ colleague, behaviors: boot.behaviors })
  );
  await setState(thread.id, {
    kind: "recognise",
    step: "belief",
    colleague,
    colleagueOid: match?.oid,
    cardId: id
  });
}

/**
 * Turn free text into just the colleague's name. Handles both a bare name
 * ("Somruk T.") and a sentence ("I want to recognise Somruk T.") by stripping
 * leading filler and any recognise/praise verb before the name.
 */
const RECOGNISE_VERBS = /\b(?:recogni[sz]e|recogni[sz]ing|praise|nominate|kudos( to)?|thank|shout ?out( to)?|appreciate)\b/i;

function cleanColleagueName(text?: string): string | undefined {
  if (!text) return undefined;
  let s = text.trim();
  // If a recognise-style verb appears, keep only what's AFTER it.
  const verb = s.match(/\b(?:recogni[sz]e|praise|nominate|kudos to|thank|shout ?out to)\b\s+(.+)/i);
  if (verb?.[1]) s = verb[1];
  // "recognise" on its own is the command, not a person — otherwise the whole
  // flow addresses a colleague literally named "recognise".
  else if (RECOGNISE_VERBS.test(s) && s.replace(RECOGNISE_VERBS, "").trim().length < 2) return undefined;
  // Strip common lead-in phrases ("I want to", "please", "let's", "can you"…).
  s = s.replace(/^(?:i(?:'d| would| wanna| want)?\s+(?:like\s+)?to\s+|please\s+|can\s+you\s+|let'?s\s+|help\s+me\s+)+/i, "");
  // Drop a trailing "for ..." clause + surrounding punctuation.
  s = s.replace(/\s+for\s+.+$/i, "").replace(/[.!?,;:]+$/, "").trim();
  return s.length > 1 ? s : undefined;
}

/** Intent "recognise" — start the flow (optionally jump if a name was given). */
export async function startRecognise(thread: AnyThread, fromText?: string, force = false) {
  const st = await getState(thread.id);
  // Re-entering a recognition already under way resumes it rather than
  // discarding the draft — unless the user explicitly chose to start over.
  if (!force && st.kind === "recognise" && st.step !== "colleague") {
    return resumeRecognise(thread, st);
  }

  // Only jump ahead if the opener actually named someone after a verb.
  const colleague = RECOGNISE_VERBS.test(fromText ?? "") ? cleanColleagueName(fromText) : undefined;
  if (colleague) {
    await setState(thread.id, { kind: "recognise", step: "colleague" });
    await resolveColleague(thread, colleague);
    return;
  }
  const boot = await getBootstrap();
  const id = await postCard(thread, RecognisePromptCard({ behaviors: boot.behaviors }));
  await setState(thread.id, { kind: "recognise", step: "colleague", cardId: id });
}

/**
 * Free-text reply while mid-recognise. Returns true if consumed (colleague /
 * description steps), false otherwise (so the caller routes it as a command).
 */
export async function onRecogniseText(thread: AnyThread, text: string): Promise<boolean> {
  const st = await getState(thread.id);
  if (st.kind !== "recognise") return false;

  if (st.step === "colleague") {
    const name = cleanColleagueName(text) ?? text.trim();
    await resolveColleague(thread, name, st.cardId);
    return true;
  }
  if (st.step === "description") {
    const note = text.trim();
    const id = await advanceStep(
      thread,
      st.cardId,
      StepDoneCard({ title: "✅ What happened", subtitle: st.colleague ?? "", lines: [note] }),
      RecognitionConfirmCard({
        colleague: st.colleague ?? "",
        behavior: st.behavior ?? "",
        description: note
      })
    );
    await setState(thread.id, { ...st, step: "confirm", description: note, cardId: id });
    return true;
  }
  return false;
}

/** Action "recognise_pick" — value is the chosen colleague's oid. */
export async function onColleaguePick(thread: AnyThread, oid: string, messageId?: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "colleague") return stale(thread, st);
  const user = await getDirectoryUser(oid);
  const colleague = user?.displayName ?? "your colleague";
  const boot = await getBootstrap();
  const id = await advanceStep(
    thread,
    messageId ?? st.cardId,
    StepDoneCard({ title: "✅ Colleague", subtitle: colleague, lines: ["Now pick the Belief they showed."] }),
    BeliefSelectCard({ colleague, behaviors: boot.behaviors })
  );
  await setState(thread.id, { kind: "recognise", step: "belief", colleague, colleagueOid: oid, cardId: id });
}

/** Action "recognise_belief" — value is the Belief name. */
export async function onBeliefSelect(thread: AnyThread, behavior: string, messageId?: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "belief") return stale(thread, st);
  const colleague = st.colleague ?? "your colleague";
  const id = await advanceStep(
    thread,
    messageId ?? st.cardId,
    StepDoneCard({ title: "✅ Belief", subtitle: colleague, lines: [behavior] }),
    DescriptionPromptCard({ colleague, behavior })
  );
  await setState(thread.id, { ...st, step: "description", behavior, cardId: id });
}

/** Action "recognise_send" — post the recognition to the public feed. */
export async function onRecogniseSend(
  thread: AnyThread,
  author?: { userId?: string; fullName?: string },
  messageId?: string
) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "confirm") return stale(thread, st);
  const boot = await getBootstrap();
  const fromName = author?.fullName ?? boot.currentUser.name;
  const message = st.description ?? `Recognised for living ${st.behavior}.`;
  const id = await scoreIdentity(thread.id, author?.userId, author?.fullName);
  const submitted = await submitRecognition({
    employee: fromName,
    target: st.colleague ?? "",
    targetKey: st.colleagueOid,
    behavior: st.behavior ?? "",
    message,
    ...id
  });
  if (!submitted?.ok) throw new Error("Recognition could not be submitted");

  await clearState(thread.id);
  await advanceStep(
    thread,
    messageId ?? st.cardId,
    StepDoneCard({
      title: "✅ Sent",
      subtitle: st.colleague ?? "",
      lines: [st.behavior ?? "", message]
    }),
    RecognitionSentCard({
      colleague: st.colleague ?? "",
      behavior: st.behavior ?? "",
      pending: submitted.pending
    })
  );
}

/** Re-post the current recognise step (Continue / resume). */
export async function resumeRecognise(thread: AnyThread, st: ThreadState) {
  if (st.kind !== "recognise") return;
  const boot = await getBootstrap();
  const card =
    st.step === "colleague"
      ? RecognisePromptCard({ behaviors: boot.behaviors })
      : st.step === "belief"
        ? BeliefSelectCard({ colleague: st.colleague ?? "", behaviors: boot.behaviors })
        : st.step === "description"
          ? DescriptionPromptCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "" })
          : RecognitionConfirmCard({
              colleague: st.colleague ?? "",
              behavior: st.behavior ?? "",
              description: st.description ?? ""
            });
  // Resume always posts fresh (the old card may be unreachable) and the flow
  // follows the new message from here.
  const id = await postCard(thread, card);
  await setState(thread.id, { ...st, cardId: id });
}

async function stale(thread: AnyThread, st: ThreadState) {
  const flow = describeFlow(st);
  await thread.post(
    StalePromptCard({
      hint: flow
        ? `You're already at: ${flow.detail}. Tap Continue to pick up where you are.`
        : "That recognition has already been sent — start a new one from the main menu.",
      canContinue: Boolean(flow)
    })
  );
}
