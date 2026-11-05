/** Consumer lease used by reusable TypeScript callers of a prepared contract stack. */
export interface ReceiptCommandTracker {
  beforeLaunch(): string;
  onStart(id: string, child: { pid: number; pgid: number; startedAt: string }): void;
  onSettled(id: string, result: unknown): void;
  handoffRelay(id: string, proof: unknown): void;
}
export function createReceiptCommandTracker(root: string, projectId: string, options: {
  purpose: string;
  leaseId?: string | null;
  settlement?: "process-group" | "explicit-consumer" | "managed-relay";
}): ReceiptCommandTracker;
export function leaseForCaller(projectId: string, purpose: string, env?: NodeJS.ProcessEnv): {
  readonly root: string;
  readonly projectId: string;
  readonly id: string | null;
  readonly commandTracker: ReceiptCommandTracker | null | undefined;
  release(): void;
};
