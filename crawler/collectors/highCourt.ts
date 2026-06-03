/**
 * High Court Search — two-step collector with recursive segmentation (a).
 *
 *   STEP 1 (breadth): POST GetCases to enumerate case refs for a filter,
 *                     paging 1..ceil(total / HCS_PAGE_SIZE).
 *   STEP 2 (depth):   GET GetCaseRefDetails/<caseRef> per case for the full
 *                     record (parties, orders, listings, judgments, appeals).
 *
 * Coverage strategy (verified against the live API):
 *   - The DB holds ~508k records; we drive enumeration by `year`.
 *   - Paging is NOT capped below a query's `total` (a 25,288-record year pages
 *     to its last page), and no year exceeds ~25k, so each year is fully
 *     reachable on its own.
 *   - As a safety net for any partition above HCS_SEGMENT_THRESHOLD (e.g. a
 *     hypothetical all-years query), we recurse and split by `proceeding`
 *     (case type) — case *number* is exact-match, so it can't bucket ranges.
 *
 * The cursor records which (year) partitions are done so runs are resumable.
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import {
  ENDPOINTS,
  HCS_PAGE_SIZE,
  HCS_SEGMENT_THRESHOLD,
  HCS_PROCEEDING_CODES,
  HCS_MIN_YEAR,
  type CrawlerConfig,
} from '../config.js';
import type { HcsCaseRecord, HcsListRow } from '../types.js';

/** All GetCases form keys. Server is picky: every key must be present. */
function casesForm(overrides: Record<string, string>): Record<string, string> {
  return {
    page: '1', proceeding: '', caseRef: '', caseNumber: '', year: '',
    caseparty1: '', caseparty1checked: 'false', caseparty2: '',
    caseparty2checked: 'false', setDownVenue: '', setDownType: '',
    setdownNumFrom: '', courtdate: '', listType: '', appealcasereference: '',
    supremecasereference: '', sortBy: '', ...overrides,
  };
}

const XHR_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  Referer: ENDPOINTS.hcsPage,
};

interface GetCasesResponse {
  status: boolean;
  message: string;
  page: number;
  total: number;
  results: HcsListRow[] | null;
}

interface HcsCursorState {
  /** Year partitions still to process (head is in-progress). */
  yearQueue: number[];
  /** Years already completed (for idempotent resume). */
  doneYears: number[];
  totalCases: number;
  done: boolean;
}

export async function collectHighCourt(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  fromYear?: number;
  toYear?: number;
  /** If false, skip step 2 (list only — much faster). */
  withDetails?: boolean;
}): Promise<void> {
  const { http, cfg } = opts;
  const fromYear = opts.fromYear ?? HCS_MIN_YEAR;
  const toYear = opts.toYear ?? new Date().getFullYear();
  const withDetails = opts.withDetails ?? true;

  const cursor = new Cursor<HcsCursorState>(cfg.outDir, 'high-court');
  const listWriter = new JsonlWriter(`${cfg.outDir}/high-court-list.jsonl`);
  const detailWriter = new JsonlWriter(`${cfg.outDir}/high-court-detail.jsonl`);

  const allYears: number[] = [];
  for (let y = toYear; y >= fromYear; y--) allYears.push(y); // newest first
  const state = await cursor.load({
    yearQueue: allYears, doneYears: [], totalCases: 0, done: false,
  });
  if (state.done) {
    console.log(`[high-court] already complete (${state.totalCases} cases).`);
    return;
  }

  // STEP 0: seed the ASP.NET_SessionId cookie by loading the page.
  console.log('[high-court] seeding session...');
  await http.text(ENDPOINTS.hcsPage);

  /** Count-only call (page=0 returns total with empty rows). */
  const totalFor = async (filter: Record<string, string>): Promise<number> => {
    const r = await http.json<GetCasesResponse>(ENDPOINTS.hcsGetCases, {
      form: casesForm({ ...filter, page: '0' }), headers: XHR_HEADERS,
    });
    return r.total;
  };

  /** Page fully through a filter known to be under the threshold. */
  const drain = async (filter: Record<string, string>, total: number) => {
    const pages = Math.ceil(total / HCS_PAGE_SIZE);
    for (let page = 1; page <= pages; page++) {
      const res = await http.json<GetCasesResponse>(ENDPOINTS.hcsGetCases, {
        form: casesForm({ ...filter, page: String(page) }), headers: XHR_HEADERS,
      });
      const rows = res.results ?? [];
      if (rows.length === 0) break; // defensive: tail reached
      for (const row of rows) {
        await listWriter.write(row);
        if (withDetails) await enrich(row);
        state.totalCases++;
      }
      if (page % 10 === 0 || page === pages) {
        console.log(
          `[high-court] ${JSON.stringify(filter)} page ${page}/${pages} ` +
            `(total ${state.totalCases})`,
        );
      }
    }
  };

  /** Step 2: fetch + write the full detail record for one list row. */
  const enrich = async (row: HcsListRow) => {
    try {
      const detailUrl = ENDPOINTS.hcsGetDetails + encodeURIComponent(row.arch_name);
      const detail = await http.json<HcsCaseRecord>(detailUrl, { headers: XHR_HEADERS });
      await detailWriter.write({
        ...row, ...detail, detailUrl, scrapedAt: new Date().toISOString(),
      } satisfies HcsCaseRecord);
    } catch (err) {
      console.warn(
        `[high-court] detail failed for ${row.arch_name}: ${(err as Error).message}`,
      );
    }
  };

  /**
   * Recursive segmenter: drain `filter` if it's under threshold, else split by
   * the next available axis. Axes are tried in order; `proceeding` is the only
   * practical one here. Returns once the whole subtree is collected.
   */
  const segment = async (
    filter: Record<string, string>,
    axes: Array<'proceeding'>,
  ): Promise<void> => {
    const total = await totalFor(filter);
    if (total === 0) return;
    if (total <= HCS_SEGMENT_THRESHOLD || axes.length === 0) {
      if (total > HCS_SEGMENT_THRESHOLD) {
        console.warn(
          `[high-court] ${JSON.stringify(filter)} has ${total} > threshold ` +
            `but no axes left to split; paging anyway (verified uncapped).`,
        );
      }
      await drain(filter, total);
      return;
    }
    const [axis, ...rest] = axes;
    console.log(`[high-court] splitting ${JSON.stringify(filter)} (${total}) by ${axis}`);
    if (axis === 'proceeding') {
      let covered = 0;
      for (const code of HCS_PROCEEDING_CODES) {
        const sub = { ...filter, proceeding: code };
        const subTotal = await totalFor(sub);
        covered += subTotal;
        if (subTotal > 0) await segment(sub, rest);
      }
      // Residual = records whose proceeding has no filterable code.
      const residual = total - covered;
      if (residual > 0) {
        console.warn(
          `[high-court] ${JSON.stringify(filter)}: ${residual} records in ` +
            `un-coded proceeding types are NOT reachable via proceeding ` +
            `splitting. Page the year directly (it is under the cap) to get them.`,
        );
      }
    }
  };

  try {
    while (state.yearQueue.length > 0) {
      const year = state.yearQueue[0];
      await segment({ year: String(year) }, ['proceeding']);
      state.yearQueue.shift();
      state.doneYears.push(year);
      await cursor.save(state); // checkpoint per completed year
      console.log(`[high-court] year ${year} done (running total ${state.totalCases}).`);
    }
    state.done = true;
    await cursor.save(state);
    console.log(`[high-court] complete: ${state.totalCases} cases.`);
  } finally {
    await listWriter.close();
    await detailWriter.close();
  }
}
