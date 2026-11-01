/** Fixture-only date projection; frozen corpora and paid benchmarks keep their source clock. */
export function createBookingEvalClock(sourceClock: string, wallClock = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const sourceMs = Date.parse(sourceClock);
  if (!Number.isFinite(sourceMs) || !Number.isFinite(wallClock.getTime())) {
    throw new Error("Booking evaluation clocks must be valid dates");
  }
  const dateShiftDays = Math.max(0, Math.ceil((wallClock.getTime() + dayMs - sourceMs) / (7 * dayMs))) * 7;
  const executionClock = new Date(sourceMs + dateShiftDays * dayMs).toISOString();
  const shiftDate = (date: string) => {
    if (dateShiftDays === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return date;
    return new Date(parsed.getTime() + dateShiftDays * dayMs).toISOString().slice(0, 10);
  };
  const shiftText = (text: string) => text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, shiftDate);
  const shiftUserInput = (message: string, history: readonly { role: "user" | "assistant"; content: string }[] = []) => ({
    message: shiftText(message),
    // Assistant history already contains execution dates returned by the route.
    history: history.map(turn => turn.role === "user" ? { ...turn, content: shiftText(turn.content) } : turn),
  });
  return { sourceClock, executionClock, dateShiftDays, shiftDate, shiftUserInput };
}
