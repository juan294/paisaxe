/** Consumer lease used by reusable TypeScript callers of a prepared contract stack. */
export function leaseForCaller(projectId: string, purpose: string, env?: NodeJS.ProcessEnv): { release(): void };
