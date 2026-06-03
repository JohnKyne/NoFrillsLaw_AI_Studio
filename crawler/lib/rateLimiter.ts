/**
 * Per-host rate limiter. Requests to *different* hosts proceed in parallel;
 * requests to the *same* host are throttled to a minimum gap (honouring
 * robots.txt Crawl-delay).
 *
 * Concurrency: each host gets `concurrency` independent slots, each spaced by
 * the host delay — so aggregate throughput per host is ~concurrency/delay.
 * `concurrency = 1` (default) is strict serial spacing, identical to before.
 * Raising it trades politeness for speed (more in-flight requests per host).
 */
export class RateLimiter {
  /** Per host: a ring of `concurrency` promise-chain tails. */
  private slots = new Map<string, Promise<void>[]>();
  /** Per host: round-robin index into its slot ring. */
  private rr = new Map<string, number>();

  constructor(
    private readonly hostDelayMs: Record<string, number>,
    private readonly defaultDelayMs: number,
    private readonly concurrency = 1,
  ) {}

  private delayFor(host: string): number {
    return this.hostDelayMs[host] ?? this.defaultDelayMs;
  }

  /**
   * Acquire a slot for `host`. Resolves once one of the host's slots is free
   * AND the configured delay since that slot's previous request has elapsed.
   */
  async acquire(host: string): Promise<void> {
    const delay = this.delayFor(host);
    const n = Math.max(1, this.concurrency);

    let ring = this.slots.get(host);
    if (!ring) {
      ring = Array.from({ length: n }, () => Promise.resolve());
      this.slots.set(host, ring);
      this.rr.set(host, 0);
    }

    const i = this.rr.get(host)!;
    this.rr.set(host, (i + 1) % ring.length);

    const prev = ring[i];
    let release!: () => void;
    const mine = new Promise<void>((resolve) => (release = resolve));
    ring[i] = mine; // the next caller routed to this slot waits on us

    await prev;
    // Our turn; free this slot after `delay` so the next request on it is spaced.
    setTimeout(release, delay);
  }
}
