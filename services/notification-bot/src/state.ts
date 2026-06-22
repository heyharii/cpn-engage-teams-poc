/**
 * Per-thread conversation state (in-memory). One state per DM/conversation.
 * Used to remember which daily-drop question a user is mid-answer on, and to
 * stage a peer recognition across two messages (who → why).
 */

import { createMemoryState } from "@chat-adapter/state-memory";

export type ThreadState =
  | { kind: "idle" }
  | { kind: "recognise"; step: "await_colleague" | "await_message"; colleague?: string };

export const state = createMemoryState();
