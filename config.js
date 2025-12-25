import "dotenv/config";

export const CONFIG = {
  username: process.env.BLUESKY_USERNAME,
  password: process.env.BLUESKY_PASSWORD,
  api: process.env.ANALYSIS_API,
  botName: process.env.BOT_NAME,
  pollInterval: 60_000,
  cooldownHours: 6
};
