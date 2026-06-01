/**
 * Collector (b): download the actual PDF documents.
 *
 * Reads a *.jsonl produced by the judgments/determinations collectors and
 * downloads every `pdfUrl` to <outDir>/pdfs/<court>/<citation>.pdf. Resumable:
 * already-downloaded files are skipped. A manifest line is appended per file.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { HttpClient } from '../lib/http.js';
import { downloadFile } from '../lib/fetchFile.js';
import { JsonlWriter } from '../lib/jsonl.js';
import type { CrawlerConfig } from '../config.js';
import type { JudgmentRecord } from '../types.js';

/** Build a safe, stable on-disk path for a judgment PDF. */
function destFor(outDir: string, rec: JudgmentRecord): string {
  const court = (rec.court ?? 'unknown').replace(/[^A-Za-z0-9]+/g, '-');
  const stem =
    rec.citation?.replace(/[^A-Za-z0-9_]+/g, '_') ??
    rec.documentId ??
    path.basename(new URL(rec.pdfUrl).pathname).replace(/\.pdf$/i, '');
  return path.join(outDir, 'pdfs', court, `${stem}.pdf`);
}

export async function collectDownloads(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  /** Name of the source corpus ('judgments' | 'determinations'). */
  source: string;
}): Promise<void> {
  const { http, cfg, source } = opts;
  const src = path.join(cfg.outDir, `${source}.jsonl`);
  const manifest = new JsonlWriter(path.join(cfg.outDir, `${source}-downloads.jsonl`));

  let raw: string;
  try {
    raw = await fs.readFile(src, 'utf8');
  } catch {
    console.error(`[download] no source file ${src}. Run \`${source}\` first.`);
    return;
  }

  const records = raw
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as JudgmentRecord);

  // De-dupe by documentId so re-runs over an appended JSONL don't repeat work.
  const seen = new Set<string>();
  let done = 0, skipped = 0, failed = 0;
  try {
    for (const rec of records) {
      const key = rec.documentId ?? rec.pdfUrl;
      if (seen.has(key)) continue;
      seen.add(key);

      const dest = destFor(cfg.outDir, rec);
      const result = await downloadFile(http, rec.pdfUrl, dest);
      await manifest.write({ ...result, citation: rec.citation, court: rec.court });

      if (result.status === 'downloaded') done++;
      else if (result.status === 'skipped') skipped++;
      else { failed++; console.warn(`[download] FAILED ${rec.pdfUrl}: ${result.error}`); }

      if ((done + skipped + failed) % 25 === 0) {
        console.log(`[download] ${done} new, ${skipped} skipped, ${failed} failed`);
      }
    }
    console.log(`[download] complete: ${done} new, ${skipped} skipped, ${failed} failed.`);
  } finally {
    await manifest.close();
  }
}
