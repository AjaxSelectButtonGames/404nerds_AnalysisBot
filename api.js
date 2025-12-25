import fetch from "node-fetch";
import { CONFIG } from "./config.js";

export async function requestAnalysis(handle) {
  const res = await fetch(CONFIG.api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Analysis failed");
  }

  return data;
}
