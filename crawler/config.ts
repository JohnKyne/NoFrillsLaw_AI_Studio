/**
 * Central configuration for the courts.ie crawler.
 *
 * Everything that is environment- or politeness-sensitive lives here so the
 * collectors stay declarative. Values can be overridden per-run via CLI flags
 * (see index.ts) or environment variables.
 */

export interface CrawlerConfig {
  /** User-Agent sent on every request. Identify the crawler honestly. */
  userAgent: string;
  /**
   * Minimum delay between requests *to the same host*, in milliseconds.
   * robots.txt on www.courts.ie and www2.courts.ie both declare
   * `Crawl-delay: 10`, so 10_000 is the polite default. The HCS API host
   * (courts.ie) has no such directive but we stay polite by default.
   */
  hostDelayMs: Record<string, number>;
  /** Fallback delay for any host not listed above. */
  defaultDelayMs: number;
  /** Network retry policy (applies to transient errors / 5xx / 429). */
  maxRetries: number;
  /** Base backoff in ms; doubles each retry (2s, 4s, 8s, 16s ...). */
  backoffBaseMs: number;
  /** Per-request timeout in ms. */
  requestTimeoutMs: number;
  /** Root directory for JSONL output and cursor checkpoints. */
  outDir: string;
}

export const DEFAULT_CONFIG: CrawlerConfig = {
  userAgent:
    process.env.CRAWLER_UA ??
    'NoFrillsLaw-Research-Crawler/0.1 (+contact: john@bazsar.com)',
  hostDelayMs: {
    'www.courts.ie': 10_000,
    'www2.courts.ie': 10_000,
    'courts.ie': 10_000,
  },
  defaultDelayMs: 10_000,
  maxRetries: 4,
  backoffBaseMs: 2_000,
  requestTimeoutMs: 45_000,
  outDir: process.env.CRAWLER_OUT ?? new URL('./data', import.meta.url).pathname,
};

/** Known endpoints, kept in one place so they are easy to audit/adjust. */
export const ENDPOINTS = {
  // Full-text judgments listing (Drupal). Pagination is 0-based.
  judgmentsList: 'https://www2.courts.ie/Judgments',
  // Supreme Court "determinations" (leave-to-appeal). 0-based pagination.
  determinationsList: 'https://www2.courts.ie/determinations',
  // High Court Search (Sitefinity). Loading this GET seeds ASP.NET_SessionId.
  hcsPage: 'https://courts.ie/high-court-search',
  // List endpoint (JSON). POST, form-encoded. Pagination is 1-based.
  hcsGetCases: 'https://courts.ie/high-court-search/GetCases/',
  // Detail endpoint (JSON). GET, keyed by case ref. NOTE: lives at site root,
  // /high-court-search/HCS/... 302-redirects away.
  hcsGetDetails: 'https://courts.ie/HCS/GetCaseRefDetails/',
  // Probate register (server-rendered GET form). Pagination is 1-based.
  probate: 'https://www.courts.ie/app/probate-register',
} as const;

/** Result rows per page returned by the HCS DataTable. */
export const HCS_PAGE_SIZE = 25;
