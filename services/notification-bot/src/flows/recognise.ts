/**
 * Recognition flow (PRD Feature 3), 5 guided steps:
 *   who → belief → description → media → confirm → (send)
 *
 * Text steps (who, description) read the user's typed reply; button steps
 * (belief, media, confirm) read a tap. Out-of-order taps are handled as stale.
 */

import type { Thread } from "chat";
import { getBootstrap, submitRecognition, scoreIdentity } from "../api.ts";
import { getState, setState, clearState, type ThreadState } from "../state.ts";
import { replaceOrPost, postCard } from "../edit.ts";
import { searchDirectory, getDirectoryUser } from "../db.ts";
import {
  RecognisePromptCard,
  ColleaguePickCard,
  BeliefSelectCard,
  DescriptionPromptCard,
  MediaPromptCard,
  RecognitionConfirmCard,
  RecognitionSentCard,
  StalePromptCard
} from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

/**
 * Resolve a typed name to a real directory person via the people picker:
 *   1 match  → proceed to the Belief step with the resolved identity (+ oid)
 *   several  → show a pick card to disambiguate
 *   none     → proceed with the typed name (no oid); directory may be un-synced
 */
async function resolveColleague(thread: AnyThread, name: string, cardId?: string): Promise<void> {
  const matches = await searchDirectory(name, 6);
  const boot = await getBootstrap();

  if (matches.length === 1) {
    const m = matches[0];
    const id = await replaceOrPost(thread, cardId, BeliefSelectCard({ colleague: m.displayName ?? name, behaviors: boot.behaviors }));
    await setState(thread.id, {
      kind: "recognise",
      step: "belief",
      colleague: m.displayName ?? name,
      colleagueOid: m.oid,
      cardId: id
    });
    return;
  }

  if (matches.length > 1) {
    const id = await replaceOrPost(
      thread,
      cardId,
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

  // No directory match — don't block; proceed with the typed name.
  const id = await replaceOrPost(thread, cardId, BeliefSelectCard({ colleague: name, behaviors: boot.behaviors }));
  await setState(thread.id, { kind: "recognise", step: "belief", colleague: name, cardId: id });
}

/**
 * Turn free text into just the colleague's name. Handles both a bare name
 * ("Somruk T.") and a sentence ("I want to recognise Somruk T.") by stripping
 * leading filler and any recognise/praise verb before the name.
 */
function cleanColleagueName(text?: string): string | undefined {
  if (!text) return undefined;
  let s = text.trim();
  // If a recognise-style verb appears, keep only what's AFTER it.
  const verb = s.match(/\b(?:recogni[sz]e|praise|nominate|kudos to|thank|shout ?out to)\b\s+(.+)/i);
  if (verb?.[1]) s = verb[1];
  // Strip common lead-in phrases ("I want to", "please", "let's", "can you"…).
  s = s.replace(/^(?:i(?:'d| would| wanna| want)?\s+(?:like\s+)?to\s+|please\s+|can\s+you\s+|let'?s\s+|help\s+me\s+)+/i, "");
  // Drop a trailing "for ..." clause + surrounding punctuation.
  s = s.replace(/\s+for\s+.+$/i, "").replace(/[.!?,;:]+$/, "").trim();
  return s.length > 1 ? s : undefined;
}

/** Intent "recognise" — start the flow (optionally jump if a name was given). */
export async function startRecognise(thread: AnyThread, fromText?: string) {
  // Only jump ahead if the opener actually named someone after a verb.
  const colleague = /\b(?:recogni[sz]e|praise|nominate|kudos to|thank|shout ?out to)\b/i.test(fromText ?? "")
    ? cleanColleagueName(fromText)
    : undefined;
  if (colleague) {
    await setState(thread.id, { kind: "recognise", step: "colleague" });
    await resolveColleague(thread, colleague);
    return;
  }
  const boot = await getBootstrap();
  // The whole wizard lives in this one message from here on.
  const id = await replaceOrPost(thread, undefined, RecognisePromptCard({ behaviors: boot.behaviors }));
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
    const id = await replaceOrPost(thread, st.cardId, MediaPromptCard({ colleague: st.colleague ?? "your colleague" }));
    await setState(thread.id, { ...st, step: "media", description: text.trim(), cardId: id });
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
  const id = await replaceOrPost(thread, messageId ?? st.cardId, BeliefSelectCard({ colleague, behaviors: boot.behaviors }));
  await setState(thread.id, { kind: "recognise", step: "belief", colleague, colleagueOid: oid, cardId: id });
}

/** Action "recognise_belief" — value is the Belief name. */
export async function onBeliefSelect(thread: AnyThread, behavior: string, messageId?: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "belief") return stale(thread, st);
  const id = await replaceOrPost(
    thread,
    messageId ?? st.cardId,
    DescriptionPromptCard({ colleague: st.colleague ?? "your colleague", behavior })
  );
  await setState(thread.id, { ...st, step: "description", behavior, cardId: id });
}

/** Action "recognise_skip_media" — skip the optional attachment. */
export async function onSkipMedia(thread: AnyThread, messageId?: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "media") return stale(thread, st);
  const id = await replaceOrPost(
    thread,
    messageId ?? st.cardId,
    RecognitionConfirmCard({
      colleague: st.colleague ?? "",
      behavior: st.behavior ?? "",
      description: st.description ?? ""
    })
  );
  await setState(thread.id, { ...st, step: "confirm", cardId: id });
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
  await replaceOrPost(
    thread,
    messageId ?? st.cardId,
    RecognitionSentCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "", pending: submitted.pending })
  );
}

/** Re-render the current recognise step (for "Continue"). */
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
          : st.step === "media"
            ? MediaPromptCard({ colleague: st.colleague ?? "" })
            : RecognitionConfirmCard({
                colleague: st.colleague ?? "",
                behavior: st.behavior ?? "",
                description: st.description ?? ""
              });
  // Resume always posts a fresh card (the old one may be unreachable), and the
  // wizard follows it from here.
  const id = await postCard(thread, card);
  await setState(thread.id, { ...st, cardId: id });
}

async function stale(thread: AnyThread, st: ThreadState) {
  await thread.post(
    StalePromptCard({
      hint: "That recognition step has moved on. Tap Continue to pick up where you are, or start over from the menu.",
      canContinue: st.kind === "recognise"
    })
  );
}
