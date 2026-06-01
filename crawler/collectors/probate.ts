/**
 * Probate Register — single-step collector.
 *
 * It's a server-rendered GET form (no JSON API). Every field is on the results
 * card itself, so there is no drill-in. We must supply search criteria — there
 * is no "list all" — so we enumerate by (lastname-prefix x year). Tune the
 * prefix/year ranges in index.ts for your coverage needs.
 *
 *   GET /app/probate-register?firstname=&lastname=<x>&year=<yyyy>&page=<n>
 *   (page is 1-based; ~10 grants/page; header reads "Grants found: N").
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import { ENDPOINTS, type CrawlerConfig } from '../config.js';
import type { ProbateRecord } from '../types.js';

/** Strip tags and collapse whitespace/entities to plain text. */
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
 * Parse the `.probate-grants-entity` cards. The markup is class-driven, so we
 * slice on the entity class and pull labelled fields out of each block.
 * NOTE: regex parsing is intentionally dependency-free but brittle — swap in a
 * real HTML parser (e.g. node-html-parser) if the markup shifts.
 */
function parseGrants(
  html: string,
  query: ProbateRecord['query'],
): ProbateRecord[] {
  const blocks = html.split(/class="[^"]*probate-grants-entity\b/).slice(1);
  const out: ProbateRecord[] = [];
  for (const block of blocks) {
    const text = clean(block.slice(0, 1500));
    const field = (label: string) =>
      text.match(new RegExp(`${label}:?\\s*([^·]+?)(?:\\s{2,}|·|$)`, 'i'))?.[1]?.trim() ??
      null;

    // Title line: "<Name>  ·  <dd/mm/yyyy>  <GrantType>"
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
  /** Pending (lastname, year) jobs; head is in-progress. */
  jobs: Array<{ lastname: string; year: string }>;
  nextPage: number;
  totalGrants: number;
  done: boolean;
}

export async function collectProbate(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  /** Last-name seeds to enumerate (e.g. 'a'..'z' prefixes or full surnames). */
  lastnames: string[];
  /** Years of death to sweep. */
  years: number[];
}): Promise<void> {
  const { http, cfg } = opts;
  const cursor = new Cursor<ProbateCursorState>(cfg.outDir, 'probate');
  const writer = new JsonlWriter(`${cfg.outDir}/probate.jsonl`);

  const seedJobs = opts.lastnames.flatMap((lastname) =>
    opts.years.map((y) => ({ lastname, year: String(y) })),
  );
  const state = await cursor.load({
    jobs: seedJobs,
    nextPage: 1,
    totalGrants: 0,
    done: false,
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
      for (const g of grants) await writer.write(g);
      state.totalGrants += grants.length;
      state.nextPage += 1;
      await cursor.save(state);
      console.log(
        `[probate] ${lastname}/${year} page ${state.nextPage - 1}: ` +
          `+${grants.length} (total ${state.totalGrants}, ` +
          `found=${parseTotal(html)})`,
      );
    }
    state.done = true;
    await cursor.save(state);
    console.log(`[probate] complete: ${state.totalGrants} grants.`);
  } finally {
    await writer.close();
  }
}
