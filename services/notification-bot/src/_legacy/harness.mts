/**
 * Local conversation harness — exercises the real dispatch → flow → API → card
 * pipeline without Bot Framework transport. Captures every posted card so we
 * can see exactly what a user would receive in Teams.
 */
import { dispatchIntent } from "../handlers/dispatch.ts";
import { onSubmitAnswer } from "../flows/module.ts";
import { classifyIntent } from "../handlers/intent-router.ts";
import { state } from "../state.ts";

type Posted = { title?: string; subtitle?: string; buttons: string[]; lines: string[] };

function summarize(node: any): Posted {
  const out: Posted = { buttons: [], lines: [] };
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    const props = n.props ?? {};
    if (props.title && !out.title) out.title = props.title;
    if (props.subtitle && !out.subtitle) out.subtitle = props.subtitle;
    // Button
    const typeName = typeof n.type === "function" ? n.type.name : n.type;
    if (typeName === "Button" || props.id) {
      const label = childText(props.children);
      if (label) out.buttons.push(`[${props.id ?? "?"}=${props.value ?? ""}] ${label}`);
    }
    // Text
    const kids = props.children;
    if (typeof kids === "string") out.lines.push(kids);
    walkChildren(kids, walk);
  };
  walk(node);
  return out;
}
function childText(kids: any): string {
  if (typeof kids === "string") return kids;
  if (Array.isArray(kids)) return kids.map(childText).join("");
  if (kids && typeof kids === "object" && kids.props) return childText(kids.props.children);
  return "";
}
function walkChildren(kids: any, walk: (n: any) => void) {
  if (Array.isArray(kids)) kids.forEach(walk);
  else if (kids && typeof kids === "object") walk(kids);
}

function fakeThread(label: string) {
  return {
    id: `thread-${label}`,
    isDM: true,
    async post(node: any) {
      const s = summarize(node);
      console.log(`\n──── ${label} ▶ CARD ────`);
      console.log(`  title:    ${s.title ?? "(none)"}`);
      console.log(`  subtitle: ${s.subtitle ?? ""}`);
      s.lines.slice(0, 6).forEach((l) => console.log(`  · ${l.slice(0, 90)}`));
      if (s.buttons.length) console.log(`  buttons:  ${s.buttons.join("  |  ")}`);
    },
    async subscribe() {},
    async send() {}
  } as any;
}

async function run() {
  await state.connect();
  const ctx = { displayName: "Narin" };

  console.log("\n###### intent classification ######");
  for (const t of ["hi", "start today's module", "daily drop", "leaderboard", "my passport", "recognise Somruk T."]) {
    console.log(`  "${t}" → ${classifyIntent(t)}`);
  }

  console.log("\n###### help ######");
  await dispatchIntent(fakeThread("help"), "help", ctx);

  console.log("\n###### start_module ######");
  await dispatchIntent(fakeThread("module"), "start_module", ctx);

  console.log("\n###### daily_challenge ######");
  await dispatchIntent(fakeThread("drop"), "daily_challenge", ctx);

  console.log("\n###### submit_answer (best) ######");
  // dropId is challenge-1 per shared demo; pick option-1 (best)
  await onSubmitAnswer(fakeThread("answer"), { dropId: "challenge-1", optionId: "option-1" });

  console.log("\n###### leaderboard ######");
  await dispatchIntent(fakeThread("leader"), "leaderboard", ctx);

  console.log("\n###### passport ######");
  await dispatchIntent(fakeThread("passport"), "passport", ctx);

  console.log("\n###### recognise (one-shot) ######");
  await dispatchIntent(fakeThread("recognise"), "recognise", { ...ctx, rawText: "recognise Somruk T." });

  console.log("\n✅ harness complete");
}

run().catch((e) => {
  console.error("HARNESS ERROR", e);
  process.exit(1);
});
