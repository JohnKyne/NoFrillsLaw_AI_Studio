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
 *   all [--parallel] [--metadata-only]
 *                                    run every collector (sequential by default;
 *                                    --parallel runs them concurrently across
 *                                    hosts; --metadata-only = light index pass)
 *
 * Global flags:
 *   --delay <ms>      per-host crawl delay (default 10000, polite)
 *   --concurrency <n> max in-flight requests PER HOST (default 1; >1 = faster,
 *                     less polite — aggregate per-host rate ≈ n/delay)
 *   --out <dir>       output directory (default ./crawler/data)
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
import { collectBailii } from './collectors/bailii.js';

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
  // Bounded in-flight requests PER HOST. >1 trades politeness for speed.
  if (flags.concurrency) cfg.concurrency = Math.max(1, Number(flags.concurrency));
  // AutoThrottle: adaptively ease the per-host delay toward latency when healthy.
  if (flags.autothrottle) cfg.autoThrottle = true;
  // On-disk HTTP cache (free re-runs + request dedup).
  if (flags.cache) cfg.cache = true;

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

    case 'bailii':
      // BAILII Irish judgment index (one-time browser for the anti-bot, then
      // plain HTTP), deduped vs the courts.ie index. Fills the pre-2001/2005
      // hole. Needs `npx playwright install chromium`.
      await collectBailii({
        http, cfg,
        fromYear: flags.from ? Number(flags.from) : 1996,
        toYear: flags.to ? Number(flags.to) : thisYear,
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

    case 'all': {
      // --metadata-only: the light index pass. Otherwise the full bulk crawl.
      // --parallel: run collectors concurrently. The per-host rate limiter still
      //   applies, so this only speeds up work that spans *different* hosts
      //   (ww2 search ∥ www2 PDFs ∥ archive.org ∥ bailii.org ∥ courts.ie HCS).
      const metaOnly = Boolean(flags['metadata-only']);
      const tasks: Array<{ name: string; run: () => Promise<void> }> = metaOnly
        ? [
            { name: 'judgments-archive', run: () => collectArchive({ http, cfg, name: 'judgments-archive', searchPath: 'judgments-year', typeValue: 'Judgment', fromYear: ARCHIVE_MIN_YEAR, toYear: thisYear }) },
            { name: 'determinations-archive', run: () => collectArchive({ http, cfg, name: 'determinations-archive', searchPath: 'determinations-year', typeValue: 'Determination', fromYear: ARCHIVE_MIN_YEAR, toYear: thisYear }) },
            { name: 'irish-reports', run: () => collectIrishReports({ http, cfg, mode: 'metadata' }) },
            { name: 'bailii', run: () => collectBailii({ http, cfg, fromYear: 1996, toYear: thisYear }) },
          ]
        : [
            { name: 'judgments', run: () => collectPdfListing({ http, cfg, name: 'judgments', listUrl: ENDPOINTS.judgmentsList }) },
            { name: 'determinations', run: () => collectPdfListing({ http, cfg, name: 'determinations', listUrl: ENDPOINTS.determinationsList }) },
            { name: 'high-court', run: () => collectHighCourt({ http, cfg, fromYear: HCS_MIN_YEAR, toYear: thisYear }) },
            { name: 'probate', run: () => collectProbate({ http, cfg, years: yearRange(thisYear - 30, thisYear) }) },
          ];
      if (flags.parallel) {
        console.log(`[all] running ${tasks.length} collectors in parallel (per-host limits still enforced)`);
        const results = await Promise.allSettled(tasks.map((t) => t.run()));
        results.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`[all] ${tasks[i].name} failed:`, r.reason);
        });
      } else {
        for (const t of tasks) await t.run();
      }
      break;
    }

    default:
      console.error(
        'Unknown command. Use: judgments | determinations | ' +
          'judgments-archive | determinations-archive | download | ' +
          'high-court | probate | legal-diary | gap-audit | irish-reports | bailii | all\nSee crawler/README.md for flags.',
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
