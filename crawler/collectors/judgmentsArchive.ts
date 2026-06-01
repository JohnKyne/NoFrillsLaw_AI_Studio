/**
 * Full judgment/determination ARCHIVE collector (headless browser).
 *
 * The browse listings (`/Judgments`, `/determinations`) are capped to the most
 * recent uploads. The full historical archive is exposed only through the
 * "by year" pages (`/judgments-year`, `/determinations-year`), whose year
 * <select> drives a Drupal AJAX form against an Alfresco backend. That form
 * cannot be driven by a plain HTTP POST (it 302s to the homepage; the build_id
 * is edge-cached and `/system/ajax` returns empty), so we drive it in a real
 * browser via Playwright: pick a year, let the AJAX render, scrape the result
 * PDFs, page through, repeat for every year (2001..present).
 *
 * Output matches the listing collectors (JudgmentRecord JSONL), so the existing
 * `download` command can fetch the PDFs afterwards.
 *
 * Requires Playwright (a dev dependency). Install once:
 *   npm install && npx playwright install chromium
 *
 * SELECTORS: the form is server-rendered Drupal; the selectors below are the
 * stable hooks observed on the page (year <select id="search-year">, the
 * `.alfresco-table` results container, `/acc/alfresco/...pdf` links). If the
 * markup shifts, run with `{ debug: true }` to dump a screenshot + HTML per
 * year and recalibrate. Nothing here runs until you invoke the command.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import { RateLimiter } from '../lib/rateLimiter.js';
import { courtFromCitation, citationFromFilename } from '../lib/citation.js';
import type { CrawlerConfig } from '../config.js';
import type { JudgmentRecord } from '../types.js';

// Selectors / config — adjust here if the page markup changes.
const SEL = {
  yearSelect: '#search-year, select[name="alfresco_todate"]',
  searchButton:
    '.alfresco-search-button, form.alfresco-form button[name="op"], ' +
    'form.alfresco-form input[type="submit"], #search_form [type="submit"]',
  resultsContainer: '.alfresco-table, .landing-page-search',
  pdfLink: 'a[href*="/acc/alfresco/"]',
  // Drupal pager "next" within the AJAX results, if present.
  nextPage: '.pager-next a, .pager__item--next a, .pager li.next a, a[rel="next"]',
} as const;

/** A loosely-typed handle to the Playwright Page we actually use. */
interface PWPage {
  goto(url: string, opts?: object): Promise<unknown>;
  selectOption(sel: string, value: string): Promise<unknown>;
  click(sel: string, opts?: object): Promise<unknown>;
  waitForSelector(sel: string, opts?: object): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  $$eval<T>(sel: string, fn: (els: Element[]) => T): Promise<T>;
  $(sel: string): Promise<unknown>;
  content(): Promise<string>;
  screenshot(opts: object): Promise<unknown>;
}

/** Dynamically import Playwright with a clear error if it isn't installed. */
async function loadPlaywright(): Promise<{ chromium: { launch(opts?: object): Promise<any> } }> {
  try {
    return (await import('playwright')) as unknown as {
      chromium: { launch(opts?: object): Promise<any> };
    };
  } catch {
    throw new Error(
      'Playwright is not installed. Run `npm install && npx playwright ' +
        'install chromium`, then retry the *-archive command.',
    );
  }
}

/** Scrape all PDF links currently rendered, paging through AJAX results. */
async function scrapeYear(
  page: PWPage,
  year: number,
  writer: JsonlWriter,
  seen: Set<string>,
  maxResultPages = 1000,
): Promise<number> {
  let added = 0;
  for (let p = 0; p < maxResultPages; p++) {
    await page.waitForSelector(SEL.pdfLink, { timeout: 15_000 }).catch(() => {});
    const links = await page.$$eval(SEL.pdfLink, (els) =>
      els
        .map((e) => (e as HTMLAnchorElement).getAttribute('href') || '')
        .filter((h) => /\/acc\/alfresco\/[0-9a-f-]{36}\/.+\.pdf/i.test(h)),
    );

    let newOnPage = 0;
    for (const href of links) {
      const m = href.match(/\/acc\/alfresco\/([0-9a-f-]{36})\/([^"\/?#]+?\.pdf)/i);
      if (!m) continue;
      const [, uuid, filename] = m;
      if (/Searching-Judgments\.pdf$/i.test(filename) || seen.has(uuid)) continue;
      seen.add(uuid);
      newOnPage++;
      const citation = citationFromFilename(filename);
      const rec: JudgmentRecord = {
        citation,
        court: courtFromCitation(citation),
        pdfUrl: new URL(href, 'https://www2.courts.ie').toString(),
        documentId: uuid,
        title: decodeURIComponent(filename).replace(/\.pdf$/i, '').replace(/_/g, ' '),
        page: p,
        scrapedAt: new Date().toISOString(),
      };
      await writer.write(rec);
      added++;
    }

    // Advance to the next result page if a pager exists; else stop.
    const next = await page.$(SEL.nextPage);
    if (!next || newOnPage === 0) break;
    await page.click(SEL.nextPage).catch(() => {});
    await page.waitForTimeout(1500); // let the AJAX swap the table
  }
  return added;
}

interface ArchiveCursorState {
  yearQueue: number[];
  doneYears: number[];
  total: number;
  done: boolean;
}

export async function collectArchive(opts: {
  cfg: CrawlerConfig;
  name: 'judgments-archive' | 'determinations-archive';
  browseUrl: string; // https://www2.courts.ie/judgments-year (or -determinations)
  fromYear: number;
  toYear: number;
  headless?: boolean;
  debug?: boolean;
}): Promise<void> {
  const { cfg, name, browseUrl, fromYear, toYear } = opts;
  const cursor = new Cursor<ArchiveCursorState>(cfg.outDir, name);
  const writer = new JsonlWriter(`${cfg.outDir}/${name}.jsonl`);
  const limiter = new RateLimiter(cfg.hostDelayMs, cfg.defaultDelayMs);
  const host = new URL(browseUrl).host;

  const years: number[] = [];
  for (let y = toYear; y >= fromYear; y--) years.push(y);
  const state = await cursor.load({
    yearQueue: years, doneYears: [], total: 0, done: false,
  });
  if (state.done) {
    console.log(`[${name}] already complete (${state.total} records).`);
    return;
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: opts.headless ?? true });
  const context = await browser.newContext({ userAgent: cfg.userAgent });
  const page = (await context.newPage()) as unknown as PWPage;
  const seen = new Set<string>();

  try {
    while (state.yearQueue.length > 0) {
      const year = state.yearQueue[0];
      await limiter.acquire(host); // honour Crawl-delay between year loads

      try {
        await page.goto(browseUrl, { waitUntil: 'networkidle', timeout: 45_000 });
        await page.selectOption(SEL.yearSelect, String(year));
        await page.click(SEL.searchButton, { timeout: 10_000 }).catch(() => {});
        await page.waitForSelector(SEL.resultsContainer, { timeout: 20_000 }).catch(() => {});
        await page.waitForTimeout(1500);

        if (opts.debug) {
          const dir = path.join(cfg.outDir, 'debug');
          await fs.mkdir(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${name}-${year}.png`), fullPage: true });
          await fs.writeFile(path.join(dir, `${name}-${year}.html`), await page.content());
        }

        const added = await scrapeYear(page, year, writer, seen);
        state.total += added;
        console.log(`[${name}] year ${year}: +${added} (total ${state.total})`);
      } catch (err) {
        console.warn(`[${name}] year ${year} failed: ${(err as Error).message}`);
      }

      state.yearQueue.shift();
      state.doneYears.push(year);
      await cursor.save(state); // checkpoint per year
    }
    state.done = true;
    await cursor.save(state);
    console.log(`[${name}] complete: ${state.total} records.`);
  } finally {
    await writer.close();
    await browser.close();
  }
}
