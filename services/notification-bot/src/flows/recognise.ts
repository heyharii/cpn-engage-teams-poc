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
import { searchDirectory, getDirectoryUser, getConversationByUserId } from "../db.ts";
import { pushCardTo } from "../proactive.ts";
import {
  RecognisePromptCard,
  ColleaguePickCard,
  BeliefSelectCard,
  DescriptionPromptCard,
  MediaPromptCard,
  RecognitionConfirmCard,
  RecognitionReceivedCard,
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
async function resolveColleague(thread: AnyThread, name: string): Promise<void> {
  const matches = await searchDirectory(name, 6);
  const boot = await getBootstrap();

  if (matches.length === 1) {
    const m = matches[0];
    await setState(thread.id, {
      kind: "recognise",
      step: "belief",
      colleague: m.displayName ?? name,
      colleagueOid: m.oid
    });
    await thread.post(BeliefSelectCard({ colleague: m.displayName ?? name, behaviors: boot.behaviors }));
    return;
  }

  if (matches.length > 1) {
    await setState(thread.id, { kind: "recognise", step: "colleague" });
    await thread.post(
      ColleaguePickCard({
        candidates: matches.map((m) => ({
          oid: m.oid,
          label: m.department ? `${m.displayName} · ${m.department}` : (m.displayName ?? m.oid)
        }))
      })
    );
    return;
  }

  // No directory match — don't block; proceed with the typed name.
  await setState(thread.id, { kind: "recognise", step: "belief", colleague: name });
  await thread.post(BeliefSelectCard({ colleague: name, behaviors: boot.behaviors }));
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
  await setState(thread.id, { kind: "recognise", step: "colleague" });
  await thread.post(RecognisePromptCard({ behaviors: boot.behaviors }));
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
    await resolveColleague(thread, name);
    return true;
  }
  if (st.step === "description") {
    await setState(thread.id, { ...st, step: "media", description: text.trim() });
    await thread.post(MediaPromptCard({ colleague: st.colleague ?? "your colleague" }));
    return true;
  }
  return false;
}

/** Action "recognise_pick" — value is the chosen colleague's oid. */
export async function onColleaguePick(thread: AnyThread, oid: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "colleague") return stale(thread, st);
  const user = await getDirectoryUser(oid);
  const colleague = user?.displayName ?? "your colleague";
  await setState(thread.id, { kind: "recognise", step: "belief", colleague, colleagueOid: oid });
  const boot = await getBootstrap();
  await thread.post(BeliefSelectCard({ colleague, behaviors: boot.behaviors }));
}

/** Action "recognise_belief" — value is the Belief name. */
export async function onBeliefSelect(thread: AnyThread, behavior: string) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "belief") return stale(thread, st);
  await setState(thread.id, { ...st, step: "description", behavior });
  await thread.post(DescriptionPromptCard({ colleague: st.colleague ?? "your colleague", behavior }));
}

/** Action "recognise_skip_media" — skip the optional attachment. */
export async function onSkipMedia(thread: AnyThread) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "media") return stale(thread, st);
  await setState(thread.id, { ...st, step: "confirm" });
  await thread.post(
    RecognitionConfirmCard({
      colleague: st.colleague ?? "",
      behavior: st.behavior ?? "",
      description: st.description ?? ""
    })
  );
}

/** Action "recognise_send" — post the recognition to the public feed. */
export async function onRecogniseSend(thread: AnyThread, author?: { userId?: string; fullName?: string }) {
  const st = await getState(thread.id);
  if (st.kind !== "recognise" || st.step !== "confirm") return stale(thread, st);
  const boot = await getBootstrap();
  const fromName = author?.fullName ?? boot.currentUser.name;
  const message = st.description ?? `Recognised for living ${st.behavior}.`;
  const id = await scoreIdentity(thread.id, author?.userId, author?.fullName);
  await submitRecognition({
    employee: fromName,
    target: st.colleague ?? "",
    behavior: st.behavior ?? "",
    message,
    ...id
  });

  // Notify the recognised colleague directly, if we resolved their identity and
  // they have a captured conversation (installed the app / chatted before).
  if (st.colleagueOid) {
    const ref = await getConversationByUserId(st.colleagueOid);
    if (ref) {
      await pushCardTo(
        ref,
        RecognitionReceivedCard({ fromName, behavior: st.behavior ?? "", message })
      );
      console.log(`[recognise] notified ${st.colleague} (${st.colleagueOid})`);
    }
  }

  await clearState(thread.id);
  await thread.post(RecognitionSentCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "" }));
}

/** Re-render the current recognise step (for "Continue"). */
export async function resumeRecognise(thread: AnyThread, st: ThreadState) {
  if (st.kind !== "recognise") return;
  const boot = await getBootstrap();
  switch (st.step) {
    case "colleague":
      return void thread.post(RecognisePromptCard({ behaviors: boot.behaviors }));
    case "belief":
      return void thread.post(BeliefSelectCard({ colleague: st.colleague ?? "", behaviors: boot.behaviors }));
    case "description":
      return void thread.post(DescriptionPromptCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "" }));
    case "media":
      return void thread.post(MediaPromptCard({ colleague: st.colleague ?? "" }));
    case "confirm":
      return void thread.post(
        RecognitionConfirmCard({ colleague: st.colleague ?? "", behavior: st.behavior ?? "", description: st.description ?? "" })
      );
  }
}

async function stale(thread: AnyThread, st: ThreadState) {
  await thread.post(
    StalePromptCard({
      hint: "That recognition step has moved on. Tap Continue to pick up where you are, or start over from the menu.",
      canContinue: st.kind === "recognise"
    })
  );
}
