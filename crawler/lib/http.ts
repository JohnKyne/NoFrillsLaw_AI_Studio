/**
 * HTTP client: rate-limited, retrying, with a minimal cookie jar.
 *
 * Uses the global `fetch` (Node 18+). No external dependencies. The cookie jar
 * is intentionally simple — it stores cookies per host, which is all the
 * courts.ie session handling (ASP.NET_SessionId on courts.ie) requires.
 */
import { RateLimiter } from './rateLimiter.js';
import type { CrawlerConfig } from '../config.js';

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

  constructor(private readonly cfg: CrawlerConfig) {
    this.limiter = new RateLimiter(cfg.hostDelayMs, cfg.defaultDelayMs, cfg.concurrency);
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

  /** Fetch raw text, with rate limiting, cookies, and retry/backoff. */
  async text(url: string, opts: RequestOptions = {}): Promise<string> {
    const res = await this.raw(url, opts);
    return res.text();
  }

  /** Fetch and parse JSON. Throws if the response isn't JSON (e.g. an HTML
   *  error/redirect page — a common HCS failure mode for malformed queries). */
  async json<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    const res = await this.raw(url, opts);
    const body = await res.text();
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      throw new Error(
        `Expected JSON from ${url} but got ${ct || 'unknown'} ` +
          `(status ${res.status}). First 120 chars: ${body.slice(0, 120)}`,
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
      try {
        const res = await fetch(url, {
          method,
          headers,
          body,
          redirect: 'manual', // surface 302s instead of silently following
          signal: ctrl.signal,
        });
        clearTimeout(timer);

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
