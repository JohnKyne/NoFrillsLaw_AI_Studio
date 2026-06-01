/**
 * courts.ie crawler — CLI entry point.
 *
 * Usage (run with the project's tsx, e.g. `npx tsx crawler/index.ts <cmd>`):
 *
 *   judgments                       crawl the full-text judgments corpus
 *   determinations                  crawl the Supreme Court determinations
 *   high-court [--from Y] [--to Y]   two-step High Court records
 *              [--no-details]        list only (skip step 2)
 *   probate    [--years a,b]         probate grants (enumerated)
 *              [--lastnames a,b,c]
 *   all                              run every collector sequentially
 *
 * Global flags:
 *   --delay <ms>   override per-host crawl delay (default 10000, polite)
 *   --out <dir>    output directory (default ./crawler/data)
 *
 * State is checkpointed per collector under <out>/.cursors, so re-running a
 * command resumes where it left off. Output is JSONL under <out>/.
 *
 * NB: nothing here runs on import — you must invoke a command.
 */
import { DEFAULT_CONFIG, ENDPOINTS, type CrawlerConfig } from './config.js';
import { HttpClient } from './lib/http.js';
import { collectPdfListing } from './collectors/pdfListing.js';
import { collectHighCourt } from './collectors/highCourt.js';
import { collectProbate } from './collectors/probate.js';

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
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

  switch (cmd) {
    case 'judgments':
      await collectPdfListing({
        http, cfg, name: 'judgments', listUrl: ENDPOINTS.judgmentsList,
      });
      break;

    case 'determinations':
      await collectPdfListing({
        http, cfg, name: 'determinations', listUrl: ENDPOINTS.determinationsList,
      });
      break;

    case 'high-court':
      await collectHighCourt({
        http, cfg,
        fromYear: flags.from ? Number(flags.from) : 2000,
        toYear: flags.to ? Number(flags.to) : thisYear,
        withDetails: !flags['no-details'],
      });
      break;

    case 'probate': {
      const years = flags.years
        ? String(flags.years).split(',').map(Number)
        : Array.from({ length: 5 }, (_, i) => thisYear - i);
      const lastnames = flags.lastnames
        ? String(flags.lastnames).split(',')
        : 'abcdefghijklmnopqrstuvwxyz'.split(''); // prefix sweep
      await collectProbate({ http, cfg, lastnames, years });
      break;
    }

    case 'all':
      await collectPdfListing({ http, cfg, name: 'judgments', listUrl: ENDPOINTS.judgmentsList });
      await collectPdfListing({ http, cfg, name: 'determinations', listUrl: ENDPOINTS.determinationsList });
      await collectHighCourt({ http, cfg, fromYear: 2000, toYear: thisYear });
      await collectProbate({
        http, cfg,
        lastnames: 'abcdefghijklmnopqrstuvwxyz'.split(''),
        years: Array.from({ length: 5 }, (_, i) => thisYear - i),
      });
      break;

    default:
      console.error(
        'Unknown command. Use one of: judgments | determinations | ' +
          'high-court | probate | all\nSee crawler/README.md for flags.',
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
