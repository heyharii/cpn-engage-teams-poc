/**
 * Viva Engage (Yammer) API feasibility test — the "Native Communities spike".
 *
 * Verifies whether we can programmatically post into a Viva Engage community
 * using the legacy Yammer REST API. Run it with YOUR token (the script never
 * stores it):
 *
 *   YAMMER_TOKEN=xxxxx node scripts/yammer-test.mjs                 # identity + list communities
 *   YAMMER_TOKEN=xxxxx YAMMER_GROUP_ID=123456 node scripts/yammer-test.mjs   # also post a test message
 *
 * Outcome classification (per specs/native-communities-spike.md):
 *   PROVEN          — message posted (201) and visible in the community
 *   WORKS w/ CAVEAT — token/identity ok but posting restricted
 *   BLOCKED         — auth fails or API unavailable in this tenant
 */

const BASE = "https://www.yammer.com/api/v1";
const TOKEN = process.env.YAMMER_TOKEN;
const GROUP_ID = process.env.YAMMER_GROUP_ID;

if (!TOKEN) {
  console.error("✗ Missing YAMMER_TOKEN. See the 'how to get a token' steps.");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}` };

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body
      ? { ...auth, "Content-Type": "application/x-www-form-urlencoded" }
      : auth,
    body
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  console.log("=== Viva Engage / Yammer API spike ===\n");

  // 1. Identity — proves the token works and shows WHO posts will come from.
  console.log("1) Verifying token (GET /users/current)…");
  const me = await call("GET", "/users/current.json");
  if (!me.ok) {
    console.error(`   ✗ BLOCKED — token rejected (HTTP ${me.status}).`);
    console.error(`     ${typeof me.json === "string" ? me.json.slice(0, 200) : JSON.stringify(me.json).slice(0, 200)}`);
    process.exit(2);
  }
  console.log(`   ✓ Authenticated as: ${me.json.full_name} (${me.json.email ?? me.json.id})`);
  console.log(`     Network: ${me.json.network_name ?? "?"}\n`);

  // 2. List communities (groups) so we can grab a group_id to post into.
  console.log("2) Listing communities (GET /groups)…");
  const groups = await call("GET", "/groups.json");
  if (!groups.ok) {
    console.error(`   ✗ Could not list communities (HTTP ${groups.status}).`);
  } else {
    const list = Array.isArray(groups.json) ? groups.json : groups.json.groups ?? [];
    if (!list.length) {
      console.log("   (no communities found — create one in Viva Engage first)");
    }
    for (const g of list.slice(0, 15)) {
      console.log(`   • ${g.id}\t${g.full_name ?? g.name}`);
    }
    console.log("");
  }

  // 3. Post a test message — the actual feasibility question.
  if (!GROUP_ID) {
    console.log("3) Skipping post test (set YAMMER_GROUP_ID=<id> to try posting).");
    console.log("\n→ Token + listing work. Re-run with a group id to test posting.");
    return;
  }

  console.log(`3) Posting a test message to group ${GROUP_ID} (POST /messages)…`);
  const body = new URLSearchParams({
    body: "CPN Engage feasibility test — please ignore. (automated spike)",
    group_id: String(GROUP_ID)
  }).toString();
  const post = await call("POST", "/messages.json", body);

  if (post.status === 201 || post.ok) {
    console.log("   ✓ PROVEN — message posted successfully.");
    const msgs = post.json.messages ?? [];
    if (msgs[0]) console.log(`     Message id: ${msgs[0].id} · web_url: ${msgs[0].web_url ?? "n/a"}`);
    console.log("\n→ Verdict: PROVEN. Programmatic posting to Viva Engage works in this tenant.");
  } else if (post.status === 403 || post.status === 401) {
    console.log(`   ✗ WORKS-WITH-CAVEAT / BLOCKED — posting refused (HTTP ${post.status}).`);
    console.log(`     ${typeof post.json === "string" ? post.json.slice(0, 200) : JSON.stringify(post.json).slice(0, 200)}`);
    console.log("\n→ Verdict: posting blocked by permission/policy even though the token is valid.");
  } else {
    console.log(`   ✗ Unexpected response (HTTP ${post.status}).`);
    console.log(`     ${typeof post.json === "string" ? post.json.slice(0, 300) : JSON.stringify(post.json).slice(0, 300)}`);
    console.log("\n→ Verdict: inconclusive — capture this output for the spike report.");
  }
}

main().catch((err) => {
  console.error("✗ BLOCKED — request failed entirely:", err.message);
  console.error("  (Could mean the legacy Yammer API is disabled/retired in this tenant.)");
  process.exit(3);
});
