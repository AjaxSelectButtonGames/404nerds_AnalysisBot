import { BskyAgent, RichText } from "@atproto/api";
import Database from "better-sqlite3";
import { CONFIG } from "./config.js";
import { parseCommand } from "./parser.js";
import { requestAnalysis } from "./api.js";

const agent = new BskyAgent({ service: "https://bsky.social" });
const db = new Database("state.db");

/* =========================
   DATABASE SETUP
   ========================= */

// Cooldowns (per DID)
db.prepare(`
  CREATE TABLE IF NOT EXISTS cooldowns (
    did TEXT PRIMARY KEY,
    last_used INTEGER
  )
`).run();

// Handled notifications (reply-once guarantee)
db.prepare(`
  CREATE TABLE IF NOT EXISTS handled_notifications (
    uri TEXT PRIMARY KEY,
    handled_at INTEGER
  )
`).run();

/* =========================
   HELPERS
   ========================= */

function isOnCooldown(did) {
  const row = db
    .prepare("SELECT last_used FROM cooldowns WHERE did = ?")
    .get(did);

  if (!row) return false;
  return Date.now() - row.last_used < CONFIG.cooldownHours * 3600_000;
}

function markCooldown(did) {
  db.prepare(`
    INSERT OR REPLACE INTO cooldowns (did, last_used)
    VALUES (?, ?)
  `).run(did, Date.now());
}

function hasHandled(uri) {
  const row = db
    .prepare("SELECT 1 FROM handled_notifications WHERE uri = ?")
    .get(uri);
  return !!row;
}

function markHandled(uri) {
  db.prepare(`
    INSERT OR IGNORE INTO handled_notifications (uri, handled_at)
    VALUES (?, ?)
  `).run(uri, Date.now());
}

/* =========================
   LOGIN
   ========================= */

async function login() {
  await agent.login({
    identifier: CONFIG.username,
    password: CONFIG.password
  });
  console.log("✅ Logged in as", CONFIG.username);
}

/* =========================
   MAIN LOOP
   ========================= */

async function checkMentions() {
  const res = await agent.listNotifications({ limit: 50 });

  for (const n of res.data.notifications) {
    if (hasHandled(n.uri)) continue;
    if (n.reason !== "mention" && n.reason !== "reply") continue;
    if (!n.record?.text) {
      markHandled(n.uri);
      continue;
    }

    const text = n.record.text;
    const authorHandle = n.author.handle;
    const authorDid = n.author.did;

    const target = parseCommand(text, authorHandle);

    // Not a command → mark handled and skip
    if (!target) {
      markHandled(n.uri);
      continue;
    }

    // Cooldown check
    if (isOnCooldown(authorDid)) {
      const rt = new RichText({
        text: `@${authorHandle} ⏳ You can request another analysis in a few hours.`
      });
      await rt.detectFacets(agent);

      await agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: { uri: n.uri, cid: n.cid },
          parent: { uri: n.uri, cid: n.cid }
        }
      });

      markHandled(n.uri);
      await agent.updateSeenNotifications(n.indexedAt);
      continue;
    }

    // Perform analysis
    try {
      const result = await requestAnalysis(target);

      const replyText =
        `📊 Analysis ready for @${target}\n\n` +
        `🔗 ${result.url}\n` +
        `⏱ Expires in 24h`;

      const rt = new RichText({ text: replyText });
      await rt.detectFacets(agent);

      await agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: { uri: n.uri, cid: n.cid },
          parent: { uri: n.uri, cid: n.cid }
        }
      });

      markCooldown(authorDid);
    } catch (err) {
      const rt = new RichText({
        text: `@${authorHandle} ❌ ${err.message}`
      });
      await rt.detectFacets(agent);

      await agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: { uri: n.uri, cid: n.cid },
          parent: { uri: n.uri, cid: n.cid }
        }
      });
    }

    markHandled(n.uri);
    await agent.updateSeenNotifications(n.indexedAt);
  }
}

/* =========================
   BOOT
   ========================= */

(async () => {
  await login();
  setInterval(checkMentions, CONFIG.pollInterval);
})();
