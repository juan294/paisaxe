/** Opt-in media environment for tests that exercise real media-query hooks. */
export function createMatchMedia(initial: Record<string, boolean> = {}) {
  const queries = new Map<string, ControlledMediaQueryList>();

  const matchMedia = (query: string): MediaQueryList => {
    if (!queries.has(query)) {
      queries.set(query, new ControlledMediaQueryList(query, initial[query] ?? false));
    }
    return queries.get(query)!;
  };

  return {
    matchMedia,
    setMatches(query: string, matches: boolean) {
      (matchMedia(query) as ControlledMediaQueryList).setMatches(matches);
    },
  };
}

class ControlledMediaQueryList extends EventTarget implements MediaQueryList {
  onchange: MediaQueryList["onchange"] = null;

  constructor(readonly media: string, public matches: boolean) {
    super();
  }

  addListener(callback: Parameters<MediaQueryList["addListener"]>[0]) {
    if (callback) this.addEventListener("change", callback as EventListener);
  }

  removeListener(callback: Parameters<MediaQueryList["removeListener"]>[0]) {
    if (callback) this.removeEventListener("change", callback as EventListener);
  }

  setMatches(matches: boolean) {
    if (this.matches === matches) return;
    this.matches = matches;
    this.dispatchEvent(Object.assign(new Event("change"), { matches, media: this.media }));
  }

  override dispatchEvent(event: Event) {
    if (event.type === "change") this.onchange?.call(this, event as MediaQueryListEvent);
    return super.dispatchEvent(event);
  }
}
