/**
 * Gap audit — flag judgments that appear to be MISSING from courts.ie.
 *
 * Two independent signals, both derived cheaply from the public judgments
 * search (citations only — NO PDF downloads):
 *
 *   1. Neutral-citation sequence gaps (works for ANY year, incl. recent).
 *      Neutral citations are assigned sequentially per court per year —
 *      [2024] IEHC 1, 2, 3, ... So if courts.ie exposes [2024] IEHC 1, 2, 4
 *      but not 3, then [2024] IEHC 3 was assigned yet isn't published. The
 *      highest citation in a year ≈ how many that court issued; everything
 *      missing below it is a candidate gap. No second source needed.
 *
 *   2. Coverage ratio (present distinct citations / highest citation). A low
 *      ratio flags a year/court that is sparsely published (e.g. courts.ie
 *      holds 1 of ~404 High Court judgments for 2003).
 *
 * Caveats (state these when raising with the Courts Service): a missing number
 * is a *candidate*, not proof — a citation may be assigned then not delivered,
 * or a judgment may be lawfully withheld/anonymised (e.g. childcare, some
 * family law). The report is a list to query, not an accusation. For pre-~2005
 * years, missing citations can often be CONFIRMED to exist on BAILII (which is
 * comprehensive there); recent years have no such cross-source, which is
 * exactly why the sequence signal matters.
 *
 * Output (under <out>/gap-audit/):
 *   - gap-audit.jsonl  one record per (year, court) with present/max/missing
 *   - REPORT.md        human-readable summary, framed for the Courts Service
 *
 * Lightweight by design; still, this paginates each requested year, so run it
 * for a targeted range — not as a blanket sweep.
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { CrawlerConfig } from '../config.js';

const SEARCH_HOST = 'https://ww2.courts.ie/search';
const SAFETY_MAX_PAGES = 400; // generous stop guard (8000 results/year)
const CHROME_PDF = /Searching-Judgments\.pdf$/i; // search-UI help file, not a judgment

/** Human names for neutral-citation court tokens. */
const COURT_NAMES: Record<string, string> = {
  HC: 'High Court',
  SC: 'Supreme Court',
  CA: 'Court of Appeal',
  CCA: 'Court of Criminal Appeal',
  CC: 'Circuit Court',
  DC: 'District Court',
  CCC: 'Central Criminal Court',
};

/** Build the Solr results URL for one (year, page) — same query as the archive. */
function yearUrl(year: number, page: number): string {
  const query =
    `" type:Judgment"` +
    ` AND "filter:alfresco_year.true"` +
    ` AND "filter:alfresco_todate.${year}"`;
  return `${SEARCH_HOST}/judgments-year/${encodeURIComponent(query)}?page=${page}`;
}

/** Distinct judgment-PDF filenames on a results page (excluding the help file). */
function pdfsOnPage(html: string): string[] {
  const files = new Set<string>();
  const re = /\/acc\/alfresco\/[0-9a-f-]{36}\/([^"\/]+?\.pdf)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const name = decodeURIComponent(m[1]);
    if (!CHROME_PDF.test(name)) files.add(name);
  }
  return [...files];
}

/** Parse a (court, number) citation from a PDF filename, if it has one. */
function citationFromName(name: string, year: number): { court: string; num: number } | null {
  // e.g. 2003_IESC_67_1.pdf -> court SC, number 67 (trailing _1 is a part index)
  const c = name.match(new RegExp(`^${year}_IE([A-Z]+)_(\\d+)`, 'i'));
  return c ? { court: c[1].toUpperCase(), num: Number(c[2]) } : null;
}

interface CourtYearAudit {
  year: number;
  court: string;
  courtName: string;
  present: number;       // distinct citations courts.ie exposes
  maxCitation: number;   // highest citation number seen
  missing: number[];     // numbers in 1..max absent from courts.ie
  coverage: number;      // present / maxCitation, 0..1
}

/** Page one year fully, collecting distinct citations per court. */
async function auditYear(http: HttpClient, year: number): Promise<CourtYearAudit[]> {
  const byCourt = new Map<string, Set<number>>();
  const seenFiles = new Set<string>();
  for (let page = 0; page < SAFETY_MAX_PAGES; page++) {
    const files = pdfsOnPage(await http.text(yearUrl(year, page)));
    if (files.length === 0) break; // empty results page = end (mirror the archive)
    let fresh = 0; // guard against a search that re-serves page 0 past the end
    for (const name of files) {
      if (seenFiles.has(name)) continue;
      seenFiles.add(name);
      fresh++;
      const c = citationFromName(name, year);
      if (!c) continue; // non-citation filename (older scans) — can't sequence it
      if (!byCourt.has(c.court)) byCourt.set(c.court, new Set());
      byCourt.get(c.court)!.add(c.num);
    }
    if (fresh === 0) break;
  }

  const audits: CourtYearAudit[] = [];
  for (const [court, nums] of byCourt) {
    const maxCitation = Math.max(...nums);
    const missing: number[] = [];
    for (let n = 1; n <= maxCitation; n++) if (!nums.has(n)) missing.push(n);
    audits.push({
      year,
      court,
      courtName: COURT_NAMES[court] ?? `IE${court}`,
      present: nums.size,
      maxCitation,
      missing,
      coverage: nums.size / maxCitation,
    });
  }
  // Stable order: most-incomplete courts first.
  return audits.sort((a, b) => a.coverage - b.coverage);
}

/**
 * Wholesale gaps: a court that publishes in some years of the range but is
 * entirely ABSENT (or near-absent) in others. Sequence analysis can't see these
 * — with zero citations there's no sequence — so we compare across years. This
 * is what catches e.g. High Court 2001–2004 (present ~500/yr from 2005, ~0
 * before). Only meaningful when the range spans multiple years.
 */
function wholesaleGaps(
  all: CourtYearAudit[],
  fromYear: number,
  toYear: number,
): Array<{ court: string; courtName: string; year: number; present: number; typical: number }> {
  const byCourt = new Map<string, Map<number, number>>(); // court -> year -> present
  for (const a of all) {
    if (!byCourt.has(a.court)) byCourt.set(a.court, new Map());
    byCourt.get(a.court)!.set(a.year, a.present);
  }
  const out: Array<{ court: string; courtName: string; year: number; present: number; typical: number }> = [];
  for (const [court, years] of byCourt) {
    const counts = [...years.values()].sort((x, y) => x - y);
    const typical = counts[Math.floor(counts.length / 2)]; // median
    if (typical < 10) continue; // court too sparse to judge "wholesale"
    const name = COURT_NAMES[court] ?? `IE${court}`;
    for (let y = fromYear; y <= toYear; y++) {
      const present = years.get(y) ?? 0;
      if (present < typical * 0.2) out.push({ court, courtName: name, year: y, present, typical });
    }
  }
  return out.sort((a, b) => a.year - b.year || a.court.localeCompare(b.court));
}

/** Render a Courts-Service-facing markdown report. */
function renderReport(
  all: CourtYearAudit[],
  wholesale: ReturnType<typeof wholesaleGaps>,
): string {
  const lines: string[] = [];
  lines.push('# courts.ie judgment publication — candidate gaps');
  lines.push('');
  if (wholesale.length) {
    lines.push('## Court-years that appear wholesale-missing');
    lines.push('');
    lines.push(
      'These court/year combinations publish far fewer judgments than the same ' +
      'court does in other years of this range — suggesting an entire run is ' +
      'absent from courts.ie (cross-checkable against BAILII for pre-~2005 years).',
    );
    lines.push('');
    lines.push('| Year | Court | Published | Typical (median) |');
    lines.push('|------|-------|-----------|------------------|');
    for (const w of wholesale) {
      lines.push(`| ${w.year} | ${w.courtName} (IE${w.court}) | ${w.present} | ${w.typical} |`);
    }
    lines.push('');
  }
  lines.push(
    'Generated from the public judgments search at courts.ie. For each court and ' +
    'year, neutral citations are assigned sequentially, so a missing number ' +
    'indicates a judgment that was assigned a citation but does not appear in the ' +
    'online database. These are **candidates to verify**, not confirmed omissions ' +
    '(a citation may have been assigned and not delivered, or a judgment lawfully ' +
    'withheld/anonymised).',
  );
  lines.push('');
  lines.push('| Year | Court | Published | Highest citation | Apparent gaps | Coverage |');
  lines.push('|------|-------|-----------|------------------|---------------|----------|');
  for (const a of all) {
    lines.push(
      `| ${a.year} | ${a.courtName} (IE${a.court}) | ${a.present} | ${a.maxCitation} | ` +
      `${a.missing.length} | ${(a.coverage * 100).toFixed(0)}% |`,
    );
  }
  lines.push('');
  for (const a of all) {
    if (a.missing.length === 0) continue;
    lines.push(`## [${a.year}] IE${a.court} — ${a.courtName}: ${a.missing.length} apparent gaps`);
    const sample = a.missing.slice(0, 200);
    lines.push(
      sample.map((n) => `[${a.year}] IE${a.court} ${n}`).join(', ') +
      (a.missing.length > sample.length ? `, … (+${a.missing.length - sample.length} more)` : ''),
    );
    lines.push('');
  }
  return lines.join('\n');
}

export async function collectGapAudit(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  fromYear: number;
  toYear: number;
}): Promise<void> {
  const { http, cfg, fromYear, toYear } = opts;
  const dir = path.join(cfg.outDir, 'gap-audit');
  const manifest = new JsonlWriter(path.join(dir, 'gap-audit.jsonl'));
  const all: CourtYearAudit[] = [];

  try {
    for (let year = fromYear; year <= toYear; year++) {
      console.log(`[gap-audit] auditing ${year}…`);
      const audits = await auditYear(http, year);
      for (const a of audits) {
        await manifest.write(a);
        all.push(a);
        const flag = a.missing.length ? `⚠ ${a.missing.length} gaps` : 'complete';
        console.log(
          `[gap-audit]   ${year} IE${a.court}: ${a.present}/${a.maxCitation} ` +
          `(${(a.coverage * 100).toFixed(0)}%) — ${flag}`,
        );
      }
    }
  } finally {
    await manifest.close();
  }

  const wholesale = wholesaleGaps(all, fromYear, toYear);
  const reportPath = path.join(dir, 'REPORT.md');
  await writeFile(reportPath, renderReport(all, wholesale), 'utf8');
  const totalGaps = all.reduce((s, a) => s + a.missing.length, 0);
  console.log(
    `[gap-audit] done: ${all.length} court-years, ${totalGaps} sequence gaps, ` +
    `${wholesale.length} wholesale-missing court-years.`,
  );
  console.log(`[gap-audit] report: ${reportPath}`);
}
