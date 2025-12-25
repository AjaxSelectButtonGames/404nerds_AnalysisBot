import fetch from "node-fetch";
import { CONFIG } from "./config.js";

export async function requestAnalysis(handle) {
  const res = await fetch(CONFIG.api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle })
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Analysis API returned non-JSON (check endpoint)");
  }

  if (!res.ok) {
    throw new Error(data.detail || "Analysis failed");
  }

  return data;
}
