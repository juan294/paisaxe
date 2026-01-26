const FRESHNESS_DAYS = 14;

export function isNewStory(createdAt: string, now?: Date): boolean {
  const created = new Date(createdAt);
  const current = now || new Date();
  const diffMs = current.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= FRESHNESS_DAYS;
}
