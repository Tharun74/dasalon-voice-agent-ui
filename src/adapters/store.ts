import type { AgentSnapshot } from '../types.js';

export abstract class AdapterStore {
  private snapshot: AgentSnapshot = { state: 'idle', transcript: [] };
  private readonly listeners = new Set<() => void>();

  get state() { return this.snapshot.state; }
  get transcript() { return this.snapshot.transcript; }
  get permission() { return this.snapshot.permission; }
  get error() { return this.snapshot.error; }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  protected update(patch: Partial<AgentSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    const previous = this.snapshot;
    if (next.state === previous.state && next.transcript === previous.transcript &&
        next.permission === previous.permission && next.error === previous.error) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
