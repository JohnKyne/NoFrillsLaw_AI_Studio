/**
 * HTTP client: rate-limited, retrying, with a minimal cookie jar.
 *
 * Uses the global `fetch` (Node 18+). No external dependencies. The cookie jar
 * is intentionally simple — it stores cookies per host, which is all the
 * courts.ie session handling (ASP.NET_SessionId on courts.ie) requires.
 */
import { RateLimiter } from './rateLimiter.js';
import { HttpCache } from './httpCache.js';
import type { CrawlerConfig } from '../config.js';
import path from 'node:path';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class CookieJar {
  private byHost = new Map<string, Map<string, string>>();

  store(host: string, setCookies: string[]): void {
    if (!setCookies.length) return;
    const jar = this.byHost.get(host) ?? new Map<string, string>();
    for (const raw of setCookies) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    this.byHost.set(host, jar);
  }

  header(host: string): string | undefined {
    const jar = this.byHost.get(host);
    if (!jar || jar.size === 0) return undefined;
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  /** Extra request headers (merged over defaults). */
  headers?: Record<string, string>;
  /** Form-encoded body (object -> application/x-www-form-urlencoded). */
  form?: Record<string, string | string[]>;
}

export class HttpClient {
  private readonly limiter: RateLimiter;
  private readonly jar = new CookieJar();
  private readonly cache?: HttpCache;
  /** Original configured delays — AutoThrottle recovers toward these. */
  private readonly baseDelay: Record<string, number>;

  constructor(private readonly cfg: CrawlerConfig) {
    this.limiter = new RateLimiter(cfg.hostDelayMs, cfg.defaultDelayMs, cfg.concurrency);
    this.baseDelay = { ...cfg.hostDelayMs };
    if (cfg.cache) this.cache = new HttpCache(path.join(cfg.outDir, '.cache'));
  }

  private effDelay(host: string): number {
    return this.cfg.hostDelayMs[host] ?? this.cfg.defaultDelayMs;
  }

  /**
   * AutoThrottle: the per-host delay is shared with the RateLimiter, so updating
   * it here steers future request spacing. Backoff under 429/5xx is ALWAYS on
   * (resilience); easing toward latency is opt-in (cfg.autoThrottle).
   */
  private adapt(host: string, status: number, latencyMs: number): void {
    const cur = this.effDelay(host);
    if (status === 429 || status >= 500) {
      this.cfg.hostDelayMs[host] = Math.min(this.cfg.maxDelayMs, Math.round(cur * 2));
      return;
    }
    const base = this.baseDelay[host] ?? this.cfg.defaultDelayMs;
    const floor = this.cfg.autoThrottle ? this.cfg.minDelayMs : base;
    // Target: toward observed latency when throttling adaptively, else recover to base.
    const target = this.cfg.autoThrottle ? Math.max(this.cfg.minDelayMs, Math.min(base, latencyMs)) : base;
    const eased = cur * 0.85 + target * 0.15;
    this.cfg.hostDelayMs[host] = Math.round(Math.min(this.cfg.maxDelayMs, Math.max(floor, eased)));
  }

  private encodeForm(form: Record<string, string | string[]>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(form)) {
      const vals = Array.isArray(v) ? v : [v];
      for (const val of vals) {
        // Server expects repeated keys for multi-select (e.g. alfresco_Court[]).
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val)}`);
      }
    }
    return parts.join('&');
  }

  /** Body fetch with on-disk cache (text/json paths). Streaming downloads use raw(). */
  private async fetchBody(
    url: string,
    opts: RequestOptions,
  ): Promise<{ status: number; contentType: string; body: string }> {
    const method = opts.method ?? (opts.form ? 'POST' : 'GET');
    const key = HttpCache.key(method, url, opts.form ? this.encodeForm(opts.form) : '');
    if (this.cache) {
      const hit = await this.cache.read(key);
      if (hit) return hit;
    }
    const res = await this.raw(url, opts);
    const out = { status: res.status, contentType: res.headers.get('content-type') ?? '', body: await res.text() };
    if (this.cache && res.status < 300) await this.cache.write(key, out);
    return out;
  }

  /** Fetch raw text, with rate limiting, cookies, retry/backoff, and cache. */
  async text(url: string, opts: RequestOptions = {}): Promise<string> {
    return (await this.fetchBody(url, opts)).body;
  }

  /** Fetch and parse JSON. Throws if the response isn't JSON (e.g. an HTML
   *  error/redirect page — a common HCS failure mode for malformed queries). */
  async json<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    const { status, contentType, body } = await this.fetchBody(url, opts);
    if (!contentType.includes('application/json')) {
      throw new Error(
        `Expected JSON from ${url} but got ${contentType || 'unknown'} ` +
          `(status ${status}). First 120 chars: ${body.slice(0, 120)}`,
      );
    }
    return JSON.parse(body) as T;
  }

  /** Low-level request returning a Response after retries; stores cookies. */
  async raw(url: string, opts: RequestOptions = {}): Promise<Response> {
    const host = new URL(url).host;
    const method = opts.method ?? (opts.form ? 'POST' : 'GET');

    const headers: Record<string, string> = {
      'User-Agent': this.cfg.userAgent,
      Accept: '*/*',
      ...opts.headers,
    };
    const cookie = this.jar.header(host);
    if (cookie) headers['Cookie'] = cookie;

    let body: string | undefined;
    if (opts.form) {
      body = this.encodeForm(opts.form);
      headers['Content-Type'] =
        'application/x-www-form-urlencoded; charset=UTF-8';
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      await this.limiter.acquire(host);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.cfg.requestTimeoutMs);
      const started = Date.now();
      try {
        const res = await fetch(url, {
          method,
          headers,
          body,
          redirect: 'manual', // surface 302s instead of silently following
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        this.adapt(host, res.status, Date.now() - started); // AutoThrottle

        // Persist any Set-Cookie for this host (undici exposes getSetCookie).
        const setCookies =
          (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
        this.jar.store(host, setCookies);

        // Retry transient server errors / throttling.
        if (res.status >= 500 || res.status === 429) {
          throw new Error(`HTTP ${res.status} from ${url}`);
        }
        return res;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        if (attempt < this.cfg.maxRetries) {
          const wait = this.cfg.backoffBaseMs * 2 ** attempt; // 2s,4s,8s,16s
          console.warn(
            `  [retry ${attempt + 1}/${this.cfg.maxRetries}] ${url} -> ` +
              `${(err as Error).message}; waiting ${wait}ms`,
          );
          await sleep(wait);
        }
      }
    }
    throw new Error(`Request failed after retries: ${url} (${String(lastErr)})`);
  }
}
