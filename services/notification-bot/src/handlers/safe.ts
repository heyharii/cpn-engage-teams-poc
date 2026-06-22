/**
 * Safety wrappers. Every message and action handler is wrapped so a thrown
 * error always produces a visible ErrorCard — the bot never goes silent.
 */

import type { ActionEvent, Thread } from "chat";
import { ErrorCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

export function guardAction(
  label: string,
  handler: (event: ActionEvent<unknown>) => Promise<void>
): (event: ActionEvent<unknown>) => Promise<void> {
  return async (event) => {
    try {
      await handler(event);
    } catch (err) {
      console.error(`[action/${label}] threw:`, err instanceof Error ? err.message : err);
      if (event.thread) {
        try {
          await event.thread.post(ErrorCard());
        } catch (postErr) {
          console.error(`[action/${label}] error-card post failed:`, postErr);
        }
      }
    }
  };
}

export function guardMessage<M>(
  label: string,
  handler: (thread: AnyThread, message: M) => Promise<void>
): (thread: AnyThread, message: M) => Promise<void> {
  return async (thread, message) => {
    try {
      await handler(thread, message);
    } catch (err) {
      console.error(`[msg/${label}] threw:`, err instanceof Error ? err.message : err);
      try {
        await thread.post(ErrorCard());
      } catch (postErr) {
        console.error(`[msg/${label}] error-card post failed:`, postErr);
      }
    }
  };
}
