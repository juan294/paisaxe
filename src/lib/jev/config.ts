import "server-only";
import { getEnv } from "@/lib/env";
import type { JevRuntimeTask } from "./contracts";

export type JevConfiguration =
  | { available: true; apiKey: string; tasks: readonly JevRuntimeTask[] }
  | { available: false; reason: "invalid_config" | "not_configured"; message: string };
const HELP = "See docs/operations/jev.md.";

/** Lazy reads permit an explicit later request to recover after configuration repair. */
export function getJevConfiguration(): JevConfiguration {
  const tokens = (getEnv("JEV_ENABLED_TASKS") ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (tokens.some(token => token !== "booking_intake" && token !== "experience_match")) {
    return { available: false, reason: "invalid_config", message: `JEV_ENABLED_TASKS accepts only booking_intake and experience_match. ${HELP}` };
  }
  const apiKey = getEnv("TYPESAFE_API_KEY");
  if (!apiKey) return { available: false, reason: "not_configured", message: `TYPESAFE_API_KEY is absent. ${HELP}` };
  return { available: true, apiKey, tasks: [...new Set(tokens)] as JevRuntimeTask[] };
}

/** Capability callers receive no credential or operator configuration details. */
export function isJevTaskEnabled(task: JevRuntimeTask): boolean {
  const config = getJevConfiguration();
  return config.available && config.tasks.includes(task);
}
