import type { RawCard } from "../raw-card.ts";

export const CARD = {
  type: "AdaptiveCard",
  $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.5"
} as const;

type HeaderMode = "pause" | "done" | "none";

/** Shared title/subtitle geometry for active cards and their in-place records. */
export function cardHeader(title: string, subtitle?: string, mode: HeaderMode = "none"): RawCard[] {
  const right =
    mode === "pause"
      ? [
          {
            type: "ActionSet",
            actions: [{ type: "Action.Submit", title: "×", tooltip: "Save & exit", data: { actionId: "pause", value: "pause" } }]
          }
        ]
      : mode === "done"
        ? [{ type: "TextBlock", text: "✓", color: "Good", size: "Medium", weight: "Bolder", horizontalAlignment: "Right" }]
        : [];

  const columns: RawCard[] = [
    { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: title, size: "Large", weight: "Bolder", wrap: true }] }
  ];
  if (right.length) columns.push({ type: "Column", width: "auto", verticalContentAlignment: "Center", items: right });
  const body: RawCard[] = [{ type: "ColumnSet", columns }];
  if (subtitle) body.push({ type: "TextBlock", text: subtitle, isSubtle: true, wrap: true, spacing: "None" });
  return body;
}

export function adaptiveCard(body: RawCard[], actions?: RawCard[]): RawCard {
  return { ...CARD, body, ...(actions?.length ? { actions } : {}) };
}

export function submitAction(actionId: string, value: string, title: string, style?: "positive" | "destructive"): RawCard {
  return {
    type: "Action.Submit",
    title,
    ...(style ? { style } : {}),
    data: { actionId, value }
  };
}

export function openUrlAction(url: string, title: string): RawCard {
  return { type: "Action.OpenUrl", title, url };
}

export function textBlock(text: string, opts: { bold?: boolean; subtle?: boolean; spacing?: string } = {}): RawCard {
  return {
    type: "TextBlock",
    text,
    wrap: true,
    ...(opts.bold ? { weight: "Bolder" } : {}),
    ...(opts.subtle ? { isSubtle: true } : {}),
    ...(opts.spacing ? { spacing: opts.spacing } : {})
  };
}
