/**
 * Probe which Viva Engage (Yammer) post FORMATS are creatable via the legacy
 * API. Honest empirical test — we try each and report what the API actually does.
 *
 *   YAMMER_TOKEN=xxx YAMMER_GROUP_ID=123 node scripts/yammer-formats.mjs
 */
const BASE = "https://www.yammer.com/api/v1";
const TOKEN = process.env.YAMMER_TOKEN;
const GROUP = process.env.YAMMER_GROUP_ID;
if (!TOKEN || !GROUP) {
  console.error("Need YAMMER_TOKEN and YAMMER_GROUP_ID");
  process.exit(1);
}

async function post(label, params) {
  const body = new URLSearchParams({ group_id: GROUP, ...params }).toString();
  try {
    const res = await fetch(`${BASE}/messages.json`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    const msg = json?.messages?.[0];
    if (res.status === 201 || (res.ok && msg)) {
      console.log(`✓ ${label}: PROVEN (id ${msg?.id}, type=${msg?.message_type})`);
    } else {
      console.log(`✗ ${label}: NOT SUPPORTED (HTTP ${res.status}) ${text.slice(0, 160)}`);
    }
  } catch (e) {
    console.log(`✗ ${label}: ERROR ${e.message}`);
  }
}

console.log("=== Viva Engage post-format probe ===\n");

// 1. Rich text (line breaks + emoji)
await post("Rich text", {
  body: "Selamat! 🎉 Tim *Customers* memimpin minggu ini.\n• Empati pelanggan\n• Recovery cepat\n👏 React untuk apresiasi!"
});

// 2. Link preview (Open Graph attachment)
await post("Link preview (og_url)", {
  body: "Pelajari 4 Beliefs CPN di sini:",
  og_url: "https://www.centralpattana.co.th"
});

// 3. Praise (native recognition) — try the documented praise shape
await post("Praise (message_type=praise)", {
  body: "Terima kasih sudah hidupkan Belief Collaboration!",
  message_type: "praise"
});

// 4. Poll
await post("Poll (message_type=poll)", {
  body: "Belief mana yang paling kamu rasakan minggu ini?",
  message_type: "poll",
  "poll_options[]": "Customers"
});

console.log("\n(Gambar/video butuh upload file dulu — diuji terpisah kalau perlu.)");
