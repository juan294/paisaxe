interface RpcError {
  message?: string;
}

interface RpcClient {
  rpc: <T = unknown>(
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: T | null; error: RpcError | null }>;
}

export interface CronJobLease {
  acquired: boolean;
  token: string | null;
  error: string | null;
}

export async function acquireCronJobLease(
  supabase: RpcClient,
  lockKey: string,
  leaseSeconds: number
): Promise<CronJobLease> {
  const { data, error } = await supabase.rpc<string>("try_acquire_cron_job_lock", {
    p_lock_key: lockKey,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    return {
      acquired: false,
      token: null,
      error: error.message ?? "Failed to acquire cron job lease",
    };
  }

  if (!data) {
    return {
      acquired: false,
      token: null,
      error: null,
    };
  }

  return {
    acquired: true,
    token: data,
    error: null,
  };
}

export async function releaseCronJobLease(
  supabase: RpcClient,
  lockKey: string,
  token: string | null
): Promise<void> {
  if (!token) {
    return;
  }

  const { error } = await supabase.rpc("release_cron_job_lock", {
    p_lock_key: lockKey,
    p_lock_token: token,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to release cron job lease");
  }
}
