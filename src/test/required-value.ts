/** Reject missing indexed fixture data without changing null or other values. */
export function requiredValue<T>(value: T | undefined, context: string): T {
  if (value === undefined) {
    throw new Error(`Missing required fixture value: ${context}`);
  }
  return value;
}
