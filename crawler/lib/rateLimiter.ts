/**
 * Per-host rate limiter. Serializes requests to each host and guarantees a
 * minimum gap between them (honouring robots.txt Crawl-delay). Requests to
 * *different* hosts proceed in parallel; requests to the *same* host queue.
 */
export class RateLimiter {
  /** Tail of the promise chain per host — each request awaits the previous. */
  private chains = new Map<string, Promise<void>>();

  constructor(
    private readonly hostDelayMs: Record<string, number>,
    private readonly defaultDelayMs: number,
  ) {}

  private delayFor(host: string): number {
    return this.hostDelayMs[host] ?? this.defaultDelayMs;
  }

  /**
   * Acquire a slot for `host`. Resolves once it is this caller's turn AND the
   * configured delay since the previous same-host request has elapsed.
   */
  async acquire(host: string): Promise<void> {
    const delay = this.delayFor(host);
    const prev = this.chains.get(host) ?? Promise.resolve();

    let release!: () => void;
    const mine = new Promise<void>((resolve) => (release = resolve));
    // Next caller for this host waits on `mine`.
    this.chains.set(host, mine);

    await prev;
    // It's our turn; schedule the release after the delay so the *next*
    // request is spaced out, but let this one proceed immediately.
    setTimeout(release, delay);
  }
}
