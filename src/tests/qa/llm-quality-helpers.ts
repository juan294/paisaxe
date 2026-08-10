type ChatApiErrorBody = {
  error?: unknown;
  message?: unknown;
  debug?: { message?: unknown };
};

export async function formatChatApiError(response: Response): Promise<string> {
  const bodyText = await response.text().catch(() => "");
  if (!bodyText) {
    return `Chat API error: ${response.status}`;
  }

  try {
    const errorBody = JSON.parse(bodyText) as ChatApiErrorBody;
    const reasons = [
      errorBody.error,
      errorBody.message,
      errorBody.debug?.message,
    ].filter(
      (reason, index, values): reason is string =>
        typeof reason === "string" && reason.length > 0 && values.indexOf(reason) === index
    );

    if (reasons.length > 0) {
      return `Chat API error: ${response.status} (${reasons.join(": ")})`;
    }
  } catch {
    // Fall through to a bounded raw-body preview for non-JSON errors.
  }

  return `Chat API error: ${response.status} (${bodyText.slice(0, 200)})`;
}

export class RepeatedServerFailureCircuit {
  private fingerprint = "";
  private identicalFailureCount = 0;
  private blockedError: Error | null = null;

  constructor(private readonly threshold = 4) {
    if (!Number.isInteger(threshold) || threshold < 1) {
      throw new Error("RepeatedServerFailureCircuit threshold must be a positive integer");
    }
  }

  assertRequestAllowed(): void {
    if (this.blockedError) {
      throw this.blockedError;
    }
  }

  recordFailure(status: number, detail: string): Error {
    const nextFingerprint = `${status}:${detail}`;
    if (nextFingerprint === this.fingerprint) {
      this.identicalFailureCount += 1;
    } else {
      this.fingerprint = nextFingerprint;
      this.identicalFailureCount = 1;
    }

    if (this.identicalFailureCount >= this.threshold) {
      this.blockedError = new Error(
        `QA BLOCKED: ${this.identicalFailureCount} identical HTTP ${status} responses — ${detail}`
      );
      return this.blockedError;
    }

    return new Error(detail);
  }

  recordSuccess(): void {
    this.fingerprint = "";
    this.identicalFailureCount = 0;
    this.blockedError = null;
  }
}
