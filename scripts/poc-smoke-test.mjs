const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4175";
const botBaseUrl = process.env.BOT_BASE_URL || "http://127.0.0.1:4177";

// The admin/ops endpoints on both services (/api/notifications, the bot's
// /internal/*) are key-gated, so every call carries the operator credentials
// when they are configured. Without them the smoke test 401s on any real
// deployment (docker-compose and the installer both set ADMIN_KEY).
const authHeaders = {
  ...(process.env.ADMIN_KEY ? { "x-admin-key": process.env.ADMIN_KEY } : {}),
  ...(process.env.PUSH_TOKEN ? { "x-push-token": process.env.PUSH_TOKEN } : {})
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders, ...(options.headers ?? {}) } });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

async function main() {
  const checks = [];

  const apiHealth = await requestJson(`${apiBaseUrl}/health`);
  checks.push(["API health", apiHealth.ok === true]);

  const botHealth = await requestJson(`${botBaseUrl}/health`);
  checks.push(["Bot health", botHealth.ok === true]);

  const botRoot = await requestJson(`${botBaseUrl}/`);
  checks.push(["Bot root available", botRoot.status === "ok" && botRoot.webhook === "/api/messages"]);

  const botAudience = await requestJson(`${botBaseUrl}/internal/audience`);
  checks.push(["Bot operations endpoint available", botAudience.ok === true]);

  const bootstrap = await requestJson(`${apiBaseUrl}/api/bootstrap`);
  checks.push(["Bootstrap user loaded", Boolean(bootstrap.currentUser?.name)]);
  checks.push(["Daily drop present", Boolean(bootstrap.dailyDrop?.id)]);
  checks.push(["Passport present", Boolean(bootstrap.passport?.score >= 0)]);

  const scenarios = await requestJson(`${apiBaseUrl}/api/admin/demo/scenarios`);
  checks.push(["Demo scenarios listed", Array.isArray(scenarios.scenarios) && scenarios.scenarios.length >= 4]);

  await requestJson(`${apiBaseUrl}/api/admin/demo/reset`, { method: "POST" });

  const morning = await requestJson(`${apiBaseUrl}/api/admin/demo/scenarios/morning-activation`, {
    method: "POST"
  });
  checks.push([
    "Morning activation queued notifications",
    Array.isArray(morning.bootstrap?.notifications) && morning.bootstrap.notifications.length >= 2
  ]);

  const capstone = await requestJson(`${apiBaseUrl}/api/admin/demo/scenarios/capstone-launch`, {
    method: "POST"
  });
  checks.push(["Capstone unlocked", capstone.bootstrap?.capstone?.unlocked === true]);
  checks.push(["Progress reached 100%", capstone.bootstrap?.stats?.progress === 100]);

  const relayResponse = await fetch(`${botBaseUrl}/internal/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ type: "smoke-test", title: "Smoke test", summary: "relay check", audience: "local" })
  });
  checks.push(["Bot notification relay accepts messages", relayResponse.status === 202]);

  let failures = 0;
  console.log("");
  console.log("CPN Engage POC Smoke Test");
  console.log(`API: ${apiBaseUrl}`);
  console.log(`Bot: ${botBaseUrl}`);
  console.log("");

  for (const [label, passed] of checks) {
    const status = passed ? "PASS" : "FAIL";
    if (!passed) {
      failures += 1;
    }
    console.log(`${status}  ${label}`);
  }

  console.log("");
  if (failures > 0) {
    console.log(`Smoke test finished with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Smoke test finished successfully.");
}

main().catch((error) => {
  console.error("Smoke test failed to run.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
