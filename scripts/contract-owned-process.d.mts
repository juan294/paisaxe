import type { StdioOptions } from "node:child_process";
import type { ReceiptCommandTracker } from "./contract-stack-lifecycle.mjs";

interface ChildIdentity {
  pid: number | null;
  pgid: number | null;
  /** A fixed-locale birth identity, "unknown", or null when no child was spawned. */
  startedAt: string | null;
}

interface CommandResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error & { code: string };
  child: ChildIdentity & { settled: boolean };
  settlementBasis: "supervisor-observed" | "unproven";
  spawnFailed?: true;
}

interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  maxBuffer?: number;
  /** Compatibility option; captured output remains decoded as UTF-8. */
  encoding?: string;
  commandTracker?: ReceiptCommandTracker | null;
  stdio?: StdioOptions;
}

interface Interruption {
  signal: "SIGINT" | "SIGTERM" | null;
  reason: "signal" | "output-limit" | "timeout" | "unsettled";
  child: ChildIdentity | null;
  settled: boolean;
}

interface OwnedProcessScope {
  readonly interruption: Interruption | null;
  checkpoint(): void;
  stop(signal?: "SIGINT" | "SIGTERM"): void;
  close(): void;
  run(binary: string, args: string[], options?: CommandOptions): Promise<CommandResult>;
}

/** Null proves PID absence; "unknown" never proves absence. */
export function processIdentity(pid: number): string | null;

/** settlementMs must be positive and no greater than 30000. */
export function createOwnedProcessScope(options?: { settlementMs?: number }): OwnedProcessScope;
