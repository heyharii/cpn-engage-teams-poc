import type { ModuleContent } from "./types.ts";
import { adaptiveCard, cardHeader, openUrlAction, submitAction, textBlock } from "./rawLayout.ts";
import type { RawCard } from "../raw-card.ts";

/** Learning Journey — video step. The active card keeps pause in the header. */
export function VideoLessonCard(opts: { module: ModuleContent }): RawCard {
  const m = opts.module;
  return adaptiveCard(
    [
      ...cardHeader("🎬 Video Lesson", `${m.title} · ${m.track}`, "pause"),
      textBlock("What this looks like in practice", { bold: true, spacing: "Medium" }),
      textBlock(m.outcome ?? "A short lesson on living this Belief in everyday work.")
    ],
    [
      openUrlAction(m.videoUrl ?? "https://www.centralpattana.co.th", "Watch video"),
      submitAction("watched_video", m.id, "I've watched it", "positive")
    ]
  );
}
