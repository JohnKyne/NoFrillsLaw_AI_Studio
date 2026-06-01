/**
 * Full judgment/determination ARCHIVE collector (plain HTTP — no browser).
 *
 * The browse listings (`/Judgments`, `/determinations`) are capped to recent
 * uploads. The full archive is reached through the "by year" search, which —
 * once driven in a browser to discover it — turned out to redirect to a plain,
 * unauthenticated GET endpoint backed by Solr:
 *
 *   GET https://ww2.courts.ie/search/judgments-year/<SOLR_QUERY>?page=<N>
 *   SOLR_QUERY = " type:Judgment" AND "filter:alfresco_year.true"
 *                                  AND "filter:alfresco_todate.<YEAR>"
 *
 * (Determinations use `/search/determinations-year/` + ` type:Determination`.)
 *
 * Verified properties:
 *   - No cookie / form token / browser needed — curl-able directly.
 *   - `page` is 0-based, ~95-100 results/page, pages are DISTINCT, and a year
 *     terminates on the first page that yields zero judgment PDFs
 *     (e.g. 2015 = pages 0..13 ≈ 1,234 judgments, vs ~196 from the listing).
 *   - Covers ALL courts: IEHC, IECA, IESC, IECC (Circuit), IEDC (District),
 *     IECCA (Court of Criminal Appeal), etc.
 *
 * So no Playwright is required at runtime; it was only the discovery tool.
 * Output matches the listing collectors so `download` can fetch the PDFs.
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import { courtFromCitation, citationFromFilename } from '../lib/citation.js';
import type { CrawlerConfig } from '../config.js';
import type { JudgmentRecord } from '../types.js';

const SEARCH_HOST = 'https://ww2.courts.ie/search';
const CHROME_PDF = /Searching-Judgments\.pdf$/i;

/** Build the Solr-query results URL for one (search, year, page). */
function archiveUrl(searchPath: string, typeValue: string, year: number, page: number): string {
  const query =
    `" type:${typeValue}"` +
    ` AND "filter:alfresco_year.true"` +
    ` AND "filter:alfresco_todate.${year}"`;
  return `${SEARCH_HOST}/${searchPath}/${encodeURIComponent(query)}?page=${page}`;
}

/** Extract distinct judgment PDFs (excluding chrome) from a results page. */
function parsePage(html: string, page: number): JudgmentRecord[] {
  const out: JudgmentRecord[] = [];
  const seen = new Set<string>();
  const re = /href="(\/acc\/alfresco\/([0-9a-f-]{36})\/([^"\/]+?\.pdf))(?:\/pdf[^"]*)?"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, pathPart, uuid, filename] = m;
    if (CHROME_PDF.test(filename) || seen.has(uuid)) continue;
    seen.add(uuid);
    const citation = citationFromFilename(filename);
    out.push({
      citation,
      court: courtFromCitation(citation),
      pdfUrl: new URL(pathPart, 'https://www2.courts.ie').toString(),
      documentId: uuid,
      title: decodeURIComponent(filename).replace(/\.pdf$/i, '').replace(/_/g, ' '),
      page,
      scrapedAt: new Date().toISOString(),
    });
  }
  return out;
}

interface ArchiveCursorState {
  yearQueue: number[];
  /** Next 0-based page within the current (head) year. */
  nextPage: number;
  doneYears: number[];
  total: number;
  seenIds: string[];
  done: boolean;
}

export async function collectArchive(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  name: 'judgments-archive' | 'determinations-archive';
  /** URL path segment: 'judgments-year' | 'determinations-year'. */
  searchPath: string;
  /** Solr `type:` value: 'Judgment' | 'Determination'. */
  typeValue: string;
  fromYear: number;
  toYear: number;
}): Promise<void> {
  const { http, cfg, name, searchPath, typeValue, fromYear, toYear } = opts;
  const cursor = new Cursor<ArchiveCursorState>(cfg.outDir, name);
  const writer = new JsonlWriter(`${cfg.outDir}/${name}.jsonl`);

  const years: number[] = [];
  for (let y = toYear; y >= fromYear; y--) years.push(y);
  const state = await cursor.load({
    yearQueue: years, nextPage: 0, doneYears: [], total: 0, seenIds: [], done: false,
  });
  if (state.done) {
    console.log(`[${name}] already complete (${state.total} records).`);
    return;
  }
  const seen = new Set(state.seenIds);
  console.log(`[${name}] resuming: ${state.yearQueue.length} years left, ` +
    `head year ${state.yearQueue[0]} page ${state.nextPage}`);

  try {
    while (state.yearQueue.length > 0) {
      const year = state.yearQueue[0];
      const html = await http.text(archiveUrl(searchPath, typeValue, year, state.nextPage));
      const rows = parsePage(html, state.nextPage).filter((r) => !seen.has(r.documentId!));

      if (rows.length === 0) {
        // Empty page -> this year is exhausted; advance.
        console.log(`[${name}] year ${year} done at page ${state.nextPage} (total ${state.total}).`);
        state.yearQueue.shift();
        state.doneYears.push(year);
        state.nextPage = 0;
        state.seenIds = [...seen];
        await cursor.save(state);
        continue;
      }
      for (const r of rows) {
        await writer.write(r);
        seen.add(r.documentId!);
      }
      state.total += rows.length;
      state.nextPage += 1;
      await cursor.save(state); // checkpoint per page
      if (state.nextPage % 5 === 0) {
        console.log(`[${name}] year ${year} page ${state.nextPage - 1}: +${rows.length} (total ${state.total})`);
      }
    }
    state.done = true;
    await cursor.save(state);
    console.log(`[${name}] complete: ${state.total} records.`);
  } finally {
    await writer.close();
  }
}
