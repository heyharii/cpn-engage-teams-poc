import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql } from "./db.js";
import { clearState, getState, setState, state } from "./state.js";

after(async () => {
  await sql?.end();
  if (!sql) await state.disconnect();
});

test("conversation flow state survives its storage round trip", async () => {
  // Production startup connects the Chat SDK store. Mirror that lifecycle when
  // this test exercises the database-free development fallback.
  if (!sql) await state.connect();
  const threadId = `state-test-${Date.now()}-${Math.random()}`;
  const expected = {
    kind: "recognise" as const,
    step: "description" as const,
    colleague: "Test Person",
    colleagueOid: "00000000-0000-0000-0000-000000000099",
    behavior: "Customers"
  };
  await setState(threadId, expected);
  assert.deepEqual(await getState(threadId), expected);

  if (sql) {
    const rows = await sql<{ state: typeof expected }[]>`
      select state from bot_flow_states where thread_id = ${threadId}
    `;
    assert.deepEqual(rows[0]?.state, expected);
  }

  await clearState(threadId);
  assert.deepEqual(await getState(threadId), { kind: "idle" });
});
