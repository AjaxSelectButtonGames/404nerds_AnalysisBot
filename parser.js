export function parseCommand(text, authorHandle) {
  const lower = text.toLowerCase();

  if (!lower.includes("analyze")) return null;

  // analyze me → always safe
  if (lower.includes("analyze me")) {
    return authorHandle;
  }

  // analyze @handle
  const match = text.match(/@([a-z0-9.\-]+)/i);
  if (!match) return null;

  let handle = match[1];

  // 🔑 Normalize bare handles
  if (!handle.includes(".")) {
    handle = `${handle}.bsky.social`;
  }

  return handle;
}
