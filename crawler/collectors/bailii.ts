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
 * "Anubis" — a proof-of-work anti-bot. We tried solving the PoW once and reusing
 * the cookie over plain HTTP, but Anubis re-challenges the non-browser client
 * intermittently (it fingerprints beyond UA+cookie), so that was flaky. Instead
 * we drive a real browser for the whole run — one Chromium, navigating each
 * per-year index page (needs `npx playwright install chromium`). Anubis also
 * refuses non-browser User-Agents outright, so this requires opting in to a
 * browser UA via CRAWLER_UA (the collector refuses our honest UA and says so).
 *
 *   GET https://www.bailii.org/ie/cases/<SERIES>/<YEAR>/
 *
 * Each record is flagged `inCourtsIe` by matching its neutral citation against
 * the judgments-archive index (if present), so BAILII-only rows are the backfill.
 */
import type { Browser, Page } from 'playwright';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
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
 * Launch a browser and clear Anubis (PoW). Returns the open browser+page for
 * reuse across the whole run. Throws if Anubis won't clear (non-browser UA):
 * the `-anubis-auth` cookie is the proof the PoW finished.
 */
async function openClearedBrowser(ua: string): Promise<{ browser: Browser; page: Page }> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: ua, ignoreHTTPSErrors: true });
    await page.goto(`${HOST}/ie/cases/IEHC/2003/`, { waitUntil: 'networkidle', timeout: 60_000 });
    for (let i = 0; i < 20; i++) {
      const cookies = await page.context().cookies();
      if (cookies.some((c) => /anubis-auth/i.test(c.name))) return { browser, page };
      await page.waitForTimeout(1_000);
    }
    throw new Error('Anubis auth cookie not obtained (UA likely rejected)');
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Pull {name, citation, court, year, url} from a per-year index page's HTML.
 * BAILII renders TWO anchors per case sharing one href: a name anchor
 * ("Carroll v. Ryan") and a citation anchor ("[2003] IESC 1"). Group by href to
 * pair them; take the citation from the citation anchor (authoritative).
 */
function parseYearHtml(html: string, series: string, year: number, sourceUrl: string) {
  const re = new RegExp(`<a[^>]*href="(/ie/cases/${series}/${year}/[^"]+)"[^>]*>([^<]*)</a>`, 'gi');
  const byHref = new Map<string, { name: string; citation: string }>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const text = m[2].replace(/\s+/g, ' ').trim();
    const cur = byHref.get(href) ?? { name: '', citation: '' };
    const c = text.match(/\[(\d{4})\]\s*(IE[A-Z]+)\s*(\d+)/i);
    if (c) cur.citation = `${c[1]}_${c[2].toUpperCase()}_${c[3]}`; // courts.ie key format
    else if (text && !cur.name) cur.name = text; // the name anchor
    byHref.set(href, cur);
  }
  const out: Array<{ caseName: string; citation: string; court: string; courtName: string; year: number; bailiiUrl: string; sourceUrl: string; fetchedAt: string }> = [];
  for (const [href, { name, citation }] of byHref) {
    if (!citation) continue;
    out.push({
      caseName: name,
      citation,
      court: series,
      courtName: COURT_NAMES[series] ?? series,
      year,
      bailiiUrl: new URL(href, HOST).toString(),
      sourceUrl,
      fetchedAt: new Date().toISOString(),
    });
  }
  return out;
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
  cfg: CrawlerConfig;
  fromYear: number;
  toYear: number;
  series?: readonly string[];
}): Promise<void> {
  const { cfg, fromYear, toYear } = opts;
  const series = opts.series ?? BAILII_SERIES;
  const delayMs = cfg.hostDelayMs['www.bailii.org'] ?? cfg.defaultDelayMs;

  const cie = await loadCourtsIeCitations(cfg.outDir);
  console.log(`[bailii] dedup against ${cie.size} courts.ie citations.`);
  console.log(`[bailii] opening browser + clearing Anubis (UA="${cfg.userAgent}")…`);

  let browser: Browser;
  let page: Page;
  try {
    ({ browser, page } = await openClearedBrowser(cfg.userAgent));
  } catch {
    // Anubis only clears browser-like User-Agents — it won't clear our honest UA.
    // Bypassing it means presenting as a browser: a deliberate operator choice,
    // NOT a default. Refuse and tell the user how to opt in explicitly.
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
          // Drive the browser per page — Anubis re-challenges plain HTTP, but a
          // real navigation in the cleared session is reliable.
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          html = await page.content();
        } catch (err) {
          console.warn(`[bailii] ${key}: ${(err as Error).message.slice(0, 60)}`);
        }
        const cases = html ? parseYearHtml(html, s, year, url) : [];
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
        await page.waitForTimeout(delayMs); // politeness between navigations
      }
    }
  } finally {
    await writer.close();
    await browser.close();
  }
  console.log(`[bailii] done: ${total} cases indexed, ${backfill} not on courts.ie (backfill candidates).`);
}
