import type { Thread } from "chat";
import { WelcomeCard } from "../cards/index.ts";

type AnyThread = Thread<unknown, unknown>;

export async function showMenu(thread: AnyThread, displayName?: string) {
  await thread.post(WelcomeCard({ displayName }));
}
