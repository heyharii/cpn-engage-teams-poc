import assert from "node:assert/strict";
import { test } from "node:test";
import { recogniseFormCard, RECOGNISE_INPUTS } from "./recognise.js";
import { readInputs } from "../../raw-card.js";

const behaviors = [
  { name: "Integrity", tagline: "Do the right thing" },
  { name: "Customers", tagline: "Start with their need" }
] as never[];

function body(card: ReturnType<typeof recogniseFormCard>) {
  return card.body as Record<string, unknown>[];
}

test("the form card carries a Teams People Picker, not a free-text name", () => {
  const picker = body(recogniseFormCard(behaviors)).find((e) => e.id === RECOGNISE_INPUTS.colleague);
  assert.equal(picker?.type, "Input.ChoiceSet");
  // Teams resolves this dataset against Graph itself — the bot answers no query.
  assert.deepEqual(picker?.["choices.data"], {
    type: "Data.Query",
    dataset: "graph.microsoft.com/users"
  });
});

test("every field is required, so the bot can't receive a blank recognition", () => {
  const fields = body(recogniseFormCard(behaviors)).filter((e) => String(e.type).startsWith("Input."));
  assert.equal(fields.length, 3);
  for (const f of fields) {
    assert.equal(f.isRequired, true, `${f.id} must be required`);
    // Validation without a message leaves assistive tech with nothing to read.
    assert.ok(f.errorMessage, `${f.id} must have an errorMessage`);
    assert.ok(f.label, `${f.id} must have a label`);
    assert.ok(f.id, "every input must have an id or its value is never sent");
  }
});

test("the submit routes through the existing action pipeline", () => {
  const actions = recogniseFormCard(behaviors).actions as Record<string, unknown>[];
  const send = actions[0] as { type: string; data: Record<string, string> };
  // The adapter treats an activity as a card action purely because `value`
  // carries actionId — this is what puts a raw card on the same path as JSX.
  assert.equal(send.type, "Action.Submit");
  assert.equal(send.data.actionId, "v2_recognise_send");
});

test("readInputs lifts the field values and drops the routing keys", () => {
  const raw = {
    value: {
      actionId: "v2_recognise_send",
      msteams: { type: "task/fetch" },
      [RECOGNISE_INPUTS.colleague]: "49c4641c-ab91-4248-aebb-6a7de286397b",
      [RECOGNISE_INPUTS.belief]: "Integrity",
      [RECOGNISE_INPUTS.story]: "Stayed back to help a customer."
    }
  };
  assert.deepEqual(readInputs(raw), {
    colleague: "49c4641c-ab91-4248-aebb-6a7de286397b",
    belief: "Integrity",
    story: "Stayed back to help a customer."
  });
  assert.deepEqual(readInputs(undefined), {});
  assert.deepEqual(readInputs({ value: "plain text" }), {});
});
