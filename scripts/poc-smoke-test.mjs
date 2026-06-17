const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4175";
const botBaseUrl = process.env.BOT_BASE_URL || "http://127.0.0.1:4177";

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBotMessages(minCount, attempts = 5, delayMs = 200) {
  let lastCount = 0;

  for (let index = 0; index < attempts; index += 1) {
    const botMessages = await requestJson(`${botBaseUrl}/api/messages`);
    lastCount = Array.isArray(botMessages.notifications) ? botMessages.notifications.length : 0;

    if (lastCount >= minCount) {
      return lastCount;
    }

    await sleep(delayMs);
  }

  return lastCount;
}

async function main() {
  const checks = [];

  const apiHealth = await requestJson(`${apiBaseUrl}/health`);
  checks.push(["API health", apiHealth.ok === true]);

  const botHealth = await requestJson(`${botBaseUrl}/health`);
  checks.push(["Bot health", botHealth.ok === true]);

  const bootstrap = await requestJson(`${apiBaseUrl}/api/bootstrap`);
  checks.push(["Bootstrap user loaded", Boolean(bootstrap.currentUser?.name)]);
  checks.push(["Daily drop present", Boolean(bootstrap.dailyDrop?.id)]);
  checks.push(["Passport present", Boolean(bootstrap.passport?.score >= 0)]);

  const scenarios = await requestJson(`${apiBaseUrl}/api/admin/demo/scenarios`);
  checks.push(["Demo scenarios listed", Array.isArray(scenarios.scenarios) && scenarios.scenarios.length >= 4]);

  await requestJson(`${botBaseUrl}/api/messages/reset`, { method: "POST" });
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

  const messageCount = await waitForBotMessages(3);
  checks.push(["Bot queue received relayed messages", messageCount >= 3]);

  const dailyDropCard = await requestJson(`${botBaseUrl}/api/cards/daily-drop`);
  checks.push([
    "Daily drop card preview available",
    dailyDropCard.preview?.attachments?.[0]?.content?.type === "AdaptiveCard"
  ]);

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
  console.log(`Bot queue messages after scenario run: ${messageCount}`);

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
