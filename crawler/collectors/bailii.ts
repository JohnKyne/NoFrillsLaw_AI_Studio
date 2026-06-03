/**
 * BAILII (bailii.org) — Irish judgments index, with dedup against courts.ie.
 *
 * Why this exists: courts.ie starts ~2001 (and is sparse 2001–2004), whereas
 * BAILII is comprehensive for that early window and reaches back further
 * (IEHC from the 1930s, IESC from the 1960s). So BAILII is the backfill source
 * for everything courts.ie lacks — and it lets us CONFIRM gap-audit candidates
 * (a missing courts.ie citation that exists on BAILII = a proven omission).
 *
 * Transport: BAILII serves plain STATIC HTML (no data API), but fronts it with
 * "Anubis" — a proof-of-work anti-bot that plain HTTP can't pass. Verified that
 * the browser is only needed ONCE: solve the PoW, take the `…anubis-auth`
 * cookie, and every subsequent static page is fetchable over normal rate-limited
 * HTTP with that cookie. So we spin up Chromium a single time for the cookie
 * (needs `npx playwright install chromium`), then read every per-year index page
 * — each lists all its cases with name + neutral citation — through HttpClient.
 *
 *   GET https://www.bailii.org/ie/cases/<SERIES>/<YEAR>/
 *
 * Each record is flagged `inCourtsIe` by matching its neutral citation against
 * the judgments-archive index (if present), so BAILII-only rows are the backfill.
 */
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import { HttpClient } from '../lib/http.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CrawlerConfig } from '../config.js';

const HOST = 'https://www.bailii.org';

/** Irish court series on BAILII (neutral-citation tokens). */
export const BAILII_SERIES = ['IESC', 'IECA', 'IECCA', 'IEHC'] as const;

const COURT_NAMES: Record<string, string> = {
  IESC: 'Supreme Court',
  IECA: 'Court of Appeal',
  IECCA: 'Court of Criminal Appeal',
  IEHC: 'High Court',
};

interface BailiiCursor { done: string[]; }

/**
 * Solve the Anubis proof-of-work once (real browser) and return a Cookie header.
 * Solved under the SAME UA the HttpClient uses — Anubis binds the clearance to
 * the User-Agent, so this keeps our honest identifying UA end-to-end (no spoof).
 */
async function solveAnubis(ua: string): Promise<string> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: ua, ignoreHTTPSErrors: true });
    await page.goto(`${HOST}/ie/cases/IEHC/2003/`, { waitUntil: 'networkidle', timeout: 60_000 });
    // The PoW resolves asynchronously — poll for the auth cookie (up to ~15s).
    for (let i = 0; i < 15; i++) {
      const cookies = await page.context().cookies();
      const header = cookies
        .filter((c) => /anubis/i.test(c.name))
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
      if (header) return header;
      await page.waitForTimeout(1_000);
    }
    throw new Error('no Anubis cookie obtained');
  } finally {
    await browser.close();
  }
}

/** Pull {name, citation, court, year, url} from a per-year index page's HTML. */
function parseYearHtml(html: string, series: string, year: number) {
  const re = new RegExp(`href="(/ie/cases/${series}/${year}/[^"]+)"[^>]*>([^<]+)<`, 'gi');
  const out: Array<{ caseName: string; citation: string; court: string; courtName: string; year: number; bailiiUrl: string }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[2].replace(/\s+/g, ' ').trim();
    const c = text.match(/\[(\d{4})\]\s*(IE[A-Z]+)\s*(\d+)/i);
    if (!c) continue;
    const citation = `${c[1]}_${c[2].toUpperCase()}_${c[3]}`; // courts.ie key format
    if (seen.has(citation)) continue; // collapse multi-part files of one case
    seen.add(citation);
    out.push({
      caseName: text.split(/\s*\[\d{4}\]/)[0].replace(/[\s,;-]+$/, '').trim(),
      citation,
      court: c[2].toUpperCase(),
      courtName: COURT_NAMES[c[2].toUpperCase()] ?? c[2].toUpperCase(),
      year: Number(c[1]),
      bailiiUrl: new URL(m[1], HOST).toString(),
    });
  }
  return out;
}

/** Looks like the Anubis challenge page rather than a real index? */
function isChallenge(html: string): boolean {
  return /anubis|making sure you|not a robot/i.test(html) && !/\/ie\/cases\//i.test(html);
}

async function loadCourtsIeCitations(outDir: string): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const txt = await readFile(path.join(outDir, 'judgments-archive.jsonl'), 'utf8');
    for (const line of txt.split('\n')) {
      if (!line.trim()) continue;
      const c = (JSON.parse(line) as { citation?: string }).citation;
      if (c) set.add(c);
    }
  } catch {
    /* no index yet — every BAILII row reads as backfill */
  }
  return set;
}

export async function collectBailii(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  fromYear: number;
  toYear: number;
  series?: readonly string[];
}): Promise<void> {
  const { http, cfg, fromYear, toYear } = opts;
  const series = opts.series ?? BAILII_SERIES;

  const cie = await loadCourtsIeCitations(cfg.outDir);
  console.log(`[bailii] dedup against ${cie.size} courts.ie citations.`);
  console.log(`[bailii] solving Anubis proof-of-work (one-time browser, UA="${cfg.userAgent}")…`);
  let cookie: string;
  try {
    cookie = await solveAnubis(cfg.userAgent);
  } catch {
    // BAILII's Anubis anti-bot only clears browser-like User-Agents; it will not
    // clear our honest identifying UA. Bypassing it means presenting as a browser
    // — a deliberate choice left to the operator, NOT a default.
    console.error(
      '[bailii] Anubis did not clear UA "' + cfg.userAgent + '".\n' +
      '         BAILII\'s anti-bot only clears browser-like User-Agents. To proceed you\n' +
      '         must opt in explicitly by setting a browser UA, e.g.\n' +
      '           CRAWLER_UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120 Safari/537.36" \\\n' +
      '           npx tsx crawler/index.ts bailii --from 1996 --to 2005\n' +
      '         BAILII is free public-interest law, but this presents the crawler as a\n' +
      '         browser to pass their anti-bot — see crawler/README.md before doing so.',
    );
    return;
  }

  const writer = new JsonlWriter(`${cfg.outDir}/bailii-index.jsonl`);
  const cursor = new Cursor<BailiiCursor>(cfg.outDir, 'bailii');
  const state = await cursor.load({ done: [] });
  const done = new Set(state.done);
  let total = 0;
  let backfill = 0;

  try {
    for (const s of series) {
      for (let year = fromYear; year <= toYear; year++) {
        const key = `${s}/${year}`;
        if (done.has(key)) continue;
        const url = `${HOST}/ie/cases/${s}/${year}/`;
        let html = '';
        try {
          html = await http.text(url, { headers: { Cookie: cookie } });
          if (isChallenge(html)) { // cookie expired — re-solve once
            cookie = await solveAnubis(cfg.userAgent);
            html = await http.text(url, { headers: { Cookie: cookie } });
          }
        } catch (err) {
          console.warn(`[bailii] ${key}: ${(err as Error).message.slice(0, 60)}`);
        }
        const cases = html ? parseYearHtml(html, s, year) : [];
        for (const c of cases) {
          const inCourtsIe = cie.has(c.citation);
          if (!inCourtsIe) backfill++;
          await writer.write({ ...c, inCourtsIe });
        }
        total += cases.length;
        if (cases.length) {
          const miss = cases.filter((c) => !cie.has(c.citation)).length;
          console.log(`[bailii] ${key}: ${cases.length} cases (${miss} not on courts.ie)`);
        }
        done.add(key);
        await cursor.save({ done: [...done] });
      }
    }
  } finally {
    await writer.close();
  }
  console.log(`[bailii] done: ${total} cases indexed, ${backfill} not on courts.ie (backfill candidates).`);
}
