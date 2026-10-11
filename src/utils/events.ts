type Handler = (...args: unknown[]) => void;

/** Tiny typed-ish event bus. */
export class EventBus {
  private readonly map = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): void {
    let set = this.map.get(event);
    if (!set) {
      set = new Set();
      this.map.set(event, set);
    }
    set.add(handler);
  }

  off(event: string, handler: Handler): void {
    this.map.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.map.get(event);
    if (!set) return;
    for (const h of [...set]) {
      try {
        h(...args);
      } catch (err) {
        console.error(`SVNC event handler error (${event}):`, err);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}
