/**
 * Probate Register — single-step collector with full-coverage year sweep.
 *
 * It's a server-rendered GET form (no JSON API); every field is on the results
 * card, so there is no drill-in. Crucially, an EMPTY `lastname` with a `year`
 * returns *every* grant for that year-of-death (verified: 16,796 for 2020), so
 * we enumerate by year alone for complete coverage — no surname guessing.
 *
 *   GET /app/probate-register?firstname=&lastname=&year=<yyyy>&page=<n>
 *   (page is 1-based; ~10 grants/page; header reads "Grants found: N").
 *
 * Records with a blank/unknown year-of-death won't surface in a year sweep;
 * pass an explicit `lastname` job set if you need to chase those separately.
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import { ENDPOINTS, type CrawlerConfig } from '../config.js';
import type { ProbateRecord } from '../types.js';

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&bull;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTotal(html: string): number {
  const m = html.match(/Grants found:\s*([\d,]+)/i);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

/**
 * Parse `.probate-grants-entity` cards. Regex-based and dependency-free but
 * brittle — swap in a real HTML parser if the markup shifts.
 */
function parseGrants(html: string, query: ProbateRecord['query']): ProbateRecord[] {
  const blocks = html.split(/class="[^"]*probate-grants-entity\b/).slice(1);
  const out: ProbateRecord[] = [];
  for (const block of blocks) {
    const text = clean(block.slice(0, 1500));
    const field = (label: string) =>
      text.match(new RegExp(`${label}:?\\s*([^·]+?)(?:\\s{2,}|·|$)`, 'i'))?.[1]?.trim() ?? null;
    const head = text.match(/^(.+?)\s*·\s*(\d{2}\/\d{2}\/\d{4})\s*(\w+)?/);
    const granteesRaw = field('Grantees');
    out.push({
      deceasedName: head?.[1]?.trim() ?? null,
      dateOfDeath: head?.[2] ?? null,
      grantType: head?.[3] ?? null,
      address: field('Address'),
      caseRef: field('Case ref\\.?'),
      issuedDate: field('Issued'),
      grantees: granteesRaw
        ? granteesRaw.split('·').map((g) => g.trim()).filter(Boolean)
        : [],
      query,
      scrapedAt: new Date().toISOString(),
    });
  }
  return out;
}

interface ProbateCursorState {
  jobs: Array<{ lastname: string; year: string }>;
  nextPage: number;
  totalGrants: number;
  done: boolean;
}

export async function collectProbate(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  /** Years of death to sweep (empty lastname -> all grants for the year). */
  years: number[];
  /** Optional surnames; if given, jobs become (lastname × year) instead. */
  lastnames?: string[];
}): Promise<void> {
  const { http, cfg } = opts;
  const cursor = new Cursor<ProbateCursorState>(cfg.outDir, 'probate');
  const writer = new JsonlWriter(`${cfg.outDir}/probate.jsonl`);

  const surnames = opts.lastnames && opts.lastnames.length ? opts.lastnames : [''];
  const seedJobs = surnames.flatMap((lastname) =>
    opts.years.map((y) => ({ lastname, year: String(y) })),
  );
  const state = await cursor.load({
    jobs: seedJobs, nextPage: 1, totalGrants: 0, done: false,
  });
  if (state.done) {
    console.log(`[probate] already complete (${state.totalGrants} grants).`);
    return;
  }

  try {
    while (state.jobs.length > 0) {
      const { lastname, year } = state.jobs[0];
      const url =
        `${ENDPOINTS.probate}?firstname=&lastname=${encodeURIComponent(lastname)}` +
        `&year=${encodeURIComponent(year)}&page=${state.nextPage}`;
      const html = await http.text(url);
      const grants = parseGrants(html, { firstname: '', lastname, year, page: state.nextPage });

      if (grants.length === 0) {
        state.jobs.shift();
        state.nextPage = 1;
        await cursor.save(state);
        continue;
      }
      for (const g of grants) await writer.write({ ...g, sourceUrl: url });
      state.totalGrants += grants.length;
      state.nextPage += 1;
      await cursor.save(state);
      const tag = lastname ? `${lastname}/${year}` : `${year}`;
      console.log(
        `[probate] ${tag} page ${state.nextPage - 1}: +${grants.length} ` +
          `(total ${state.totalGrants}, found=${parseTotal(html)})`,
      );
    }
    state.done = true;
    await cursor.save(state);
    console.log(`[probate] complete: ${state.totalGrants} grants.`);
  } finally {
    await writer.close();
  }
}
