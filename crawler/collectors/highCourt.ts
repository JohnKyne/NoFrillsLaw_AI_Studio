/**
 * High Court Search — the two-step collector.
 *
 *   STEP 1 (breadth): POST GetCases to enumerate case refs for a filter,
 *                     paging 1..ceil(total / HCS_PAGE_SIZE).
 *   STEP 2 (depth):   GET GetCaseRefDetails/<caseRef> per case for the full
 *                     record (parties, orders, listings, judgments, appeals).
 *
 * Why two steps: GetCases is a cheap search/count that hands back the *key*
 * (arch_name = case ref); GetCaseRefDetails explodes one key into the deep
 * record. We only pay the per-case detail cost for refs step 1 confirmed.
 *
 * Enumeration strategy: the DB has ~508k records but a single query is capped,
 * so we segment by `year`. If a year's `total` still exceeds what paging can
 * return, sub-segment by case number (left as a TODO hook below).
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import { ENDPOINTS, HCS_PAGE_SIZE, type CrawlerConfig } from '../config.js';
import type { HcsCaseRecord, HcsListRow } from '../types.js';

/** All GetCases form keys. Server is picky: every key must be present. */
function casesForm(overrides: Record<string, string>): Record<string, string> {
  return {
    page: '1',
    proceeding: '',
    caseRef: '',
    caseNumber: '',
    year: '',
    caseparty1: '',
    caseparty1checked: 'false',
    caseparty2: '',
    caseparty2checked: 'false',
    setDownVenue: '',
    setDownType: '',
    setdownNumFrom: '',
    courtdate: '',
    listType: '',
    appealcasereference: '',
    supremecasereference: '',
    sortBy: '',
    ...overrides,
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
  total: number; // match count for the query
  results: HcsListRow[] | null;
}

interface HcsCursorState {
  /** Years still to process (head is in-progress). */
  yearQueue: number[];
  /** Within the current year, next 1-based page to fetch. */
  nextPage: number;
  totalCases: number;
  done: boolean;
}

export async function collectHighCourt(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  /** Inclusive year range to enumerate. */
  fromYear: number;
  toYear: number;
  /** If false, skip step 2 (list only — much faster, names + parties only). */
  withDetails?: boolean;
}): Promise<void> {
  const { http, cfg, fromYear, toYear } = opts;
  const withDetails = opts.withDetails ?? true;
  const cursor = new Cursor<HcsCursorState>(cfg.outDir, 'high-court');
  const listWriter = new JsonlWriter(`${cfg.outDir}/high-court-list.jsonl`);
  const detailWriter = new JsonlWriter(`${cfg.outDir}/high-court-detail.jsonl`);

  const defaultYears: number[] = [];
  for (let y = toYear; y >= fromYear; y--) defaultYears.push(y); // newest first
  const state = await cursor.load({
    yearQueue: defaultYears,
    nextPage: 1,
    totalCases: 0,
    done: false,
  });
  if (state.done) {
    console.log(`[high-court] already complete (${state.totalCases} cases).`);
    return;
  }

  // STEP 0: seed the session cookie (ASP.NET_SessionId) by loading the page.
  console.log('[high-court] seeding session...');
  await http.text(ENDPOINTS.hcsPage);

  try {
    while (state.yearQueue.length > 0) {
      const year = state.yearQueue[0];

      // First contact for this year: read the match count (page=0 returns the
      // count with an empty rows array — that's the planning call).
      if (state.nextPage === 1) {
        const head = await http.json<GetCasesResponse>(ENDPOINTS.hcsGetCases, {
          form: casesForm({ page: '0', year: String(year) }),
          headers: XHR_HEADERS,
        });
        console.log(`[high-court] year ${year}: total=${head.total}`);
        if (head.total > 0 && head.total / HCS_PAGE_SIZE > 4000) {
          // ~100k results: paging won't reach the tail. Sub-segment here.
          // TODO: split by caseNumber ranges (caseNumber=1..N) for this year.
          console.warn(
            `[high-court] year ${year} exceeds safe paging depth; ` +
              `consider sub-segmenting by caseNumber.`,
          );
        }
      }

      const res = await http.json<GetCasesResponse>(ENDPOINTS.hcsGetCases, {
        form: casesForm({ page: String(state.nextPage), year: String(year) }),
        headers: XHR_HEADERS,
      });
      const rows = res.results ?? [];

      if (rows.length === 0) {
        // Year exhausted -> advance to next year.
        state.yearQueue.shift();
        state.nextPage = 1;
        await cursor.save(state);
        continue;
      }

      for (const row of rows) {
        await listWriter.write(row);
        if (withDetails) {
          const ref = encodeURIComponent(row.arch_name);
          try {
            const detail = await http.json<HcsCaseRecord>(
              ENDPOINTS.hcsGetDetails + ref,
              { headers: XHR_HEADERS },
            );
            await detailWriter.write({
              ...row,
              ...detail,
              scrapedAt: new Date().toISOString(),
            } satisfies HcsCaseRecord);
          } catch (err) {
            console.warn(
              `[high-court] detail failed for ${row.arch_name}: ` +
                `${(err as Error).message}`,
            );
          }
        }
        state.totalCases += 1;
      }

      state.nextPage += 1;
      await cursor.save(state); // checkpoint per page (resumable cursor)
      console.log(
        `[high-court] year ${year} page ${state.nextPage - 1}: ` +
          `+${rows.length} (total ${state.totalCases})`,
      );
    }
    state.done = true;
    await cursor.save(state);
    console.log(`[high-court] complete: ${state.totalCases} cases.`);
  } finally {
    await listWriter.close();
    await detailWriter.close();
  }
}
