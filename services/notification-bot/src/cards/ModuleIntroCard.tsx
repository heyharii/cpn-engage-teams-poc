import type { ModuleContent } from "./types.ts";
import { adaptiveCard, cardHeader, submitAction, textBlock } from "./rawLayout.ts";
import type { RawCard } from "../raw-card.ts";

/** Learning Journey — the non-destructive intro before a module starts. */
export function ModuleIntroCard(opts: { module: ModuleContent }): RawCard {
  const { module: m } = opts;
  return adaptiveCard(
    [
      ...cardHeader(`📘 Today's Module · ${m.track}`, m.title),
      textBlock(m.summary, { spacing: "Medium" }),
      textBlock("WHAT'S INSIDE", { bold: true, spacing: "Medium" }),
      {
        type: "FactSet",
        facts: [
          { title: "⏱️ Time", value: `${m.durationMin} min` },
          { title: "🎯 Belief", value: m.track },
          { title: "📦 Format", value: `Video · guide · ${m.questions.length}-question quiz` }
        ]
      }
    ],
    [submitAction("begin_module", m.id, "Start module", "positive"), submitAction("intent", "help", "Maybe later")]
  );
}
