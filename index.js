import { BskyAgent } from "@atproto/api";
import Database from "better-sqlite3";
import { CONFIG } from "./config.js";
import { parseCommand } from "./parser.js";
import { requestAnalysis } from "./api.js";

const agent = new BskyAgent({ service: "https://bsky.social" });
const db = new Database("state.db");

// cooldown tracking
db.prepare(`
  CREATE TABLE IF NOT EXISTS cooldowns (
    did TEXT PRIMARY KEY,
    last_used INTEGER
  )
`).run();

function isOnCooldown(did) {
  const row = db.prepare(
    "SELECT last_used FROM cooldowns WHERE did = ?"
  ).get(did);

  if (!row) return false;
  return Date.now() - row.last_used < CONFIG.cooldownHours * 3600_000;
}

function markUsed(did) {
  db.prepare(`
    INSERT OR REPLACE INTO cooldowns (did, last_used)
    VALUES (?, ?)
  `).run(did, Date.now());
}

async function login() {
  await agent.login({
    identifier: CONFIG.username,
    password: CONFIG.password
  });
  console.log("✅ Logged in as", CONFIG.username);
}

async function checkMentions() {
  const res = await agent.listNotifications({ limit: 50 });

  for (const n of res.data.notifications) {
    if (n.isRead) continue;
    if (n.reason !== "mention" && n.reason !== "reply") continue;

    const text = n.record?.text || "";
    const author = n.author.handle;
    const authorDid = n.author.did;

    const target = parseCommand(text, author);
    if (!target) continue;

    if (isOnCooldown(authorDid)) {
      await agent.post({
        text: `@${author} ⏳ You can request another analysis in a few hours.`,
        reply: { root: n, parent: n }
      });
      continue;
    }

    try {
      const result = await requestAnalysis(target);

      await agent.post({
        text:
          `📊 Analysis ready for @${target}\n\n` +
          `🔗 ${result.url}\n` +
          `⏱ Expires in 24h`,
        reply: { root: n, parent: n }
      });

      markUsed(authorDid);
    } catch (err) {
      await agent.post({
        text: `@${author} ❌ ${err.message}`,
        reply: { root: n, parent: n }
      });
    }

    await agent.updateSeenNotifications(n.indexedAt);
  }
}

(async () => {
  await login();
  setInterval(checkMentions, CONFIG.pollInterval);
})();
