import { describe, it, expect, vi } from "vitest";
import { acquireCronJobLease, releaseCronJobLease } from "./cron-job-lock";

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

function makeRpc(
  impl: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>
) {
  return { rpc: vi.fn(impl) } as unknown as Parameters<
    typeof acquireCronJobLease
  >[0];
}

describe("acquireCronJobLease", () => {
  it("returns acquired=false and the error message when the RPC returns an error", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: null, error: { message: "lock table missing" } })
    );

    const result = await acquireCronJobLease(supabase, "my-lock", 60);

    expect(result.acquired).toBe(false);
    expect(result.token).toBeNull();
    expect(result.error).toBe("lock table missing");
  });

  it("falls back to a default error message when the RPC error has no message", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: null, error: {} })
    );

    const result = await acquireCronJobLease(supabase, "my-lock", 60);

    expect(result.acquired).toBe(false);
    expect(result.error).toBe("Failed to acquire cron job lease");
  });

  it("returns acquired=false with no error when another process holds the lock (data=null, error=null)", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: null, error: null })
    );

    const result = await acquireCronJobLease(supabase, "my-lock", 60);

    expect(result.acquired).toBe(false);
    expect(result.token).toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns acquired=true with the lease token when the lock is granted", async () => {
    const token = "uuid-lease-token-abc123";
    const supabase = makeRpc(() =>
      Promise.resolve({ data: token, error: null })
    );

    const result = await acquireCronJobLease(supabase, "my-lock", 60);

    expect(result.acquired).toBe(true);
    expect(result.token).toBe(token);
    expect(result.error).toBeNull();
  });

  it("passes the lock key and lease duration to the RPC", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: "token", error: null })
    );

    await acquireCronJobLease(supabase, "report-job", 300);

    expect(supabase.rpc).toHaveBeenCalledWith("try_acquire_cron_job_lock", {
      p_lock_key: "report-job",
      p_lease_seconds: 300,
    });
  });
});

describe("releaseCronJobLease", () => {
  it("returns immediately without calling the RPC when token is null (line 57)", async () => {
    const supabase = makeRpc(() => Promise.resolve({ data: null, error: null }));

    await releaseCronJobLease(supabase, "my-lock", null);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns an error (line 66)", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: null, error: { message: "lock not found" } })
    );

    await expect(
      releaseCronJobLease(supabase, "my-lock", "valid-token")
    ).rejects.toThrow("lock not found");
  });

  it("throws with a default message when the RPC error has no message", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: null, error: {} })
    );

    await expect(
      releaseCronJobLease(supabase, "my-lock", "valid-token")
    ).rejects.toThrow("Failed to release cron job lease");
  });

  it("resolves without throwing when the lock is released successfully", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: true, error: null })
    );

    await expect(
      releaseCronJobLease(supabase, "my-lock", "valid-token")
    ).resolves.toBeUndefined();
  });

  it("passes the lock key and token to the RPC", async () => {
    const supabase = makeRpc(() =>
      Promise.resolve({ data: true, error: null })
    );

    await releaseCronJobLease(supabase, "report-job", "lease-abc");

    expect(supabase.rpc).toHaveBeenCalledWith("release_cron_job_lock", {
      p_lock_key: "report-job",
      p_lock_token: "lease-abc",
    });
  });
});
