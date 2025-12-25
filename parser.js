export function parseCommand(text, authorHandle) {
  const lower = text.toLowerCase();

if (!lower.includes("analyze")) return null;

  //analyze me
  if (lower.includes("analyze me")) {
    return authorHandle;
  }

//analyze @handle
const match = text.match(/@([a-z0-9.\-]+)/i);

if (match) {
  return match[1];
}
  return null;
}
