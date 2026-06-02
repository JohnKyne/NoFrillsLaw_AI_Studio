/**
 * courts.ie crawler — CLI entry point.
 *
 * Run with the project's tsx, e.g. `npx tsx crawler/index.ts <cmd>`:
 *
 *   judgments                        recent judgments listing (capped window)
 *   determinations                   recent determinations listing (capped)
 *   judgments-archive [--from Y]     FULL judgment archive (plain HTTP; the
 *     [--to Y]                       by-year Solr GET endpoint, no browser)
 *   determinations-archive ...       FULL determinations archive (same engine)
 *   download <judgments|determinations|*-archive>  pull the PDFs (b)
 *   high-court [--from Y] [--to Y]    two-step High Court records (segmented)
 *              [--no-details]         list only (skip step 2)
 *   irish-reports [--mode m]         public-domain Irish Reports 1894–1925 via
 *                                    the Internet Archive. mode=metadata
 *                                    (default, light) | text | pdf | all
 *   gap-audit  [--from Y] [--to Y]    flag judgments apparently MISSING from
 *                                    courts.ie via citation-sequence analysis;
 *                                    writes a Courts-Service-facing REPORT.md
 *   legal-diary                      today's Legal Diary (PDF+DOCX, appellate
 *                                    + High Court lists); run on a schedule
 *   probate    [--years a,b,..]       probate grants — full year sweep
 *              [--lastnames a,b]      optional surname filter instead
 *   all                              run every collector sequentially
 *
 * Global flags:
 *   --delay <ms>   per-host crawl delay (default 10000, polite)
 *   --out <dir>    output directory (default ./crawler/data)
 *
 * State is checkpointed per collector under <out>/.cursors, so re-running a
 * command resumes. Nothing runs on import — you must invoke a command.
 *
 * COVERAGE: see crawler/COVERAGE.md. Short version — High Court records and
 * probate grants are fully coverable; the judgment/determination *archives*
 * are not (the browse listings are capped; the full corpus is behind an
 * Alfresco AJAX search this CLI does not yet drive).
 */
import {
  DEFAULT_CONFIG, ENDPOINTS, HCS_MIN_YEAR, ARCHIVE_MIN_YEAR, type CrawlerConfig,
} from './config.js';
import { HttpClient } from './lib/http.js';
import { collectPdfListing } from './collectors/pdfListing.js';
import { collectDownloads } from './collectors/download.js';
import { collectHighCourt } from './collectors/highCourt.js';
import { collectProbate } from './collectors/probate.js';
import { collectArchive } from './collectors/judgmentsArchive.js';
import { collectLegalDiary } from './collectors/legalDiary.js';
import { collectGapAudit } from './collectors/gapAudit.js';
import { collectIrishReports, type IrishReportsMode } from './collectors/irishReportsArchive.js';

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const cmd = positional[0];

  const cfg: CrawlerConfig = { ...DEFAULT_CONFIG };
  if (flags.out) cfg.outDir = String(flags.out);
  if (flags.delay) {
    const ms = Number(flags.delay);
    cfg.defaultDelayMs = ms;
    cfg.hostDelayMs = Object.fromEntries(
      Object.keys(cfg.hostDelayMs).map((h) => [h, ms]),
    );
  }

  const http = new HttpClient(cfg);
  const thisYear = new Date().getFullYear();
  const yearRange = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => to - i);

  switch (cmd) {
    case 'judgments':
      await collectPdfListing({ http, cfg, name: 'judgments', listUrl: ENDPOINTS.judgmentsList });
      break;

    case 'determinations':
      await collectPdfListing({ http, cfg, name: 'determinations', listUrl: ENDPOINTS.determinationsList });
      break;

    case 'judgments-archive':
      await collectArchive({
        http, cfg, name: 'judgments-archive',
        searchPath: 'judgments-year', typeValue: 'Judgment',
        fromYear: flags.from ? Number(flags.from) : ARCHIVE_MIN_YEAR,
        toYear: flags.to ? Number(flags.to) : thisYear,
      });
      break;

    case 'determinations-archive':
      await collectArchive({
        http, cfg, name: 'determinations-archive',
        searchPath: 'determinations-year', typeValue: 'Determination',
        fromYear: flags.from ? Number(flags.from) : ARCHIVE_MIN_YEAR,
        toYear: flags.to ? Number(flags.to) : thisYear,
      });
      break;

    case 'download': {
      const source = positional[1];
      const valid = ['judgments', 'determinations', 'judgments-archive', 'determinations-archive'];
      if (!valid.includes(source)) {
        console.error(`Usage: download <${valid.join('|')}>`);
        process.exit(1);
      }
      await collectDownloads({ http, cfg, source });
      break;
    }

    case 'high-court':
      await collectHighCourt({
        http, cfg,
        fromYear: flags.from ? Number(flags.from) : HCS_MIN_YEAR,
        toYear: flags.to ? Number(flags.to) : thisYear,
        withDetails: !flags['no-details'],
      });
      break;

    case 'irish-reports':
      // Public-domain Irish Reports 1894–1925 via the Internet Archive.
      // Default 'metadata' is light (one API call). text|pdf|all are heavy.
      await collectIrishReports({
        http, cfg,
        mode: (flags.mode ? String(flags.mode) : 'metadata') as IrishReportsMode,
        fromYear: flags.from ? Number(flags.from) : undefined,
        toYear: flags.to ? Number(flags.to) : undefined,
      });
      break;

    case 'gap-audit':
      // Flag judgments apparently missing from courts.ie (citation-sequence
      // analysis). Targeted year range only — not a blanket sweep.
      await collectGapAudit({
        http, cfg,
        fromYear: flags.from ? Number(flags.from) : thisYear - 1,
        toYear: flags.to ? Number(flags.to) : thisYear,
      });
      break;

    case 'legal-diary':
      // Captures the CURRENT day's diary (all courts). Run on a schedule to
      // accumulate an archive — older editions aren't retained server-side.
      await collectLegalDiary({ http, cfg });
      break;

    case 'probate': {
      const years = flags.years
        ? String(flags.years).split(',').map(Number)
        : yearRange(thisYear - 30, thisYear); // wide default sweep
      const lastnames = flags.lastnames ? String(flags.lastnames).split(',') : undefined;
      await collectProbate({ http, cfg, years, lastnames });
      break;
    }

    case 'all':
      await collectPdfListing({ http, cfg, name: 'judgments', listUrl: ENDPOINTS.judgmentsList });
      await collectPdfListing({ http, cfg, name: 'determinations', listUrl: ENDPOINTS.determinationsList });
      await collectHighCourt({ http, cfg, fromYear: HCS_MIN_YEAR, toYear: thisYear });
      await collectProbate({ http, cfg, years: yearRange(thisYear - 30, thisYear) });
      break;

    default:
      console.error(
        'Unknown command. Use: judgments | determinations | ' +
          'judgments-archive | determinations-archive | download | ' +
          'high-court | probate | legal-diary | gap-audit | irish-reports | all\nSee crawler/README.md for flags.',
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
