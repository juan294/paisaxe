/** Public ownership helpers consumed by TypeScript release runners. */
import type { ReceiptCommandTracker } from "./contract-stack-lifecycle.mjs";
import type { createOwnedProcessScope } from "./contract-owned-process.mjs";

export interface StackCommandOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
  encoding?: string;
  stdio?: string[];
}
export type StackCommandExecutor = (binary: string, args: string[], options: StackCommandOptions) => Promise<string>;
export function runStackCommand(scope: ReturnType<typeof createOwnedProcessScope>, commandTracker: ReceiptCommandTracker | null | undefined, binary: string, args: string[], options: StackCommandOptions): Promise<string>;
export interface ContractStackManifest {
  version: 1;
  taskDir: string;
  projectId: string;
  nonce: string;
  apiUrl: string;
  dbPort: number;
  migrationDigest: string;
  schemaDigest: string;
  transport?: "docker-exec-v1";
}
export type LocalDockerEnvironment = Record<string, string> & { DOCKER_HOST: string; SUPABASE_TELEMETRY_DISABLED: string };
export function validateManifest(data: unknown, taskDir: string): ContractStackManifest;
export function validateKeys(status: unknown, manifest: ContractStackManifest): { anon: string; service: string; dbUrl: string };
export function inspectStack(manifest: ContractStackManifest, env: LocalDockerEnvironment): Promise<void>;
export function localDockerEnvironment(inherited?: NodeJS.ProcessEnv): LocalDockerEnvironment;
export function dockerSql(projectId: string, sql: string, env: LocalDockerEnvironment): string;
export function dockerSql(projectId: string, sql: string, env: LocalDockerEnvironment, run: StackCommandExecutor): Promise<string>;
export function schemaDigest(projectId: string, env: LocalDockerEnvironment): string;
export function schemaDigest(projectId: string, env: LocalDockerEnvironment, run: StackCommandExecutor): Promise<string>;
export function migrationInventory(root: string): { files: string[]; versions: string[]; digest: string };
