/**
 * Legal Diary — daily bulk download collector.
 *
 * The Legal Diary (legaldiary.courts.ie) publishes the full day's court
 * listings — every court including Circuit and District — as a single
 * "Downloadable Diary" document in PDF and DOCX. The per-court web pages render
 * their listings via JavaScript and the underlying data API is not openly
 * exposed, but this bulk file is a plain HTTP download and contains the lot.
 *
 *   GET https://legaldiary.courts.ie/download
 *     -> <a href="/legaldiary.nsf/page/download/$File/Downloadable Diary <date>.pdf">
 *
 * The diary is forward-looking and the download page only exposes the CURRENT
 * edition (older days aren't archived/addressable), so this collector captures
 * "today's" diary and is meant to be run on a schedule (cron / the `loop`
 * skill) to accumulate an archive over time. It's idempotent: each capture is
 * saved under <out>/legal-diary/<captureDate>__<name> and skipped if present.
 */
import { HttpClient } from '../lib/http.js';
import { downloadFile } from '../lib/fetchFile.js';
import { JsonlWriter } from '../lib/jsonl.js';
import path from 'node:path';
import type { CrawlerConfig } from '../config.js';

const DOWNLOAD_PAGE = 'https://legaldiary.courts.ie/download';
const HOST = 'https://legaldiary.courts.ie';

/** Find the current Downloadable Diary file links (pdf + docx). */
function parseDownloadLinks(html: string): Array<{ href: string; label: string; format: string }> {
  const out: Array<{ href: string; label: string; format: string }> = [];
  const re = /href="(\/legaldiary\.nsf\/[^"]*\$File\/([^"]+?\.(pdf|docx|doc|xlsx?)))"/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html))) {
    const [, href, filename, format] = m;
    if (seen.has(href)) continue;
    seen.add(href);
    // Human label, e.g. "Downloadable Diary June 2nd"
    const label = decodeURIComponent(filename).replace(/\.[a-z]+$/i, '');
    out.push({ href, label, format: format.toLowerCase() });
  }
  return out;
}

/** Sanitise a filename for safe on-disk storage. */
function safeName(name: string): string {
  return decodeURIComponent(name).replace(/[^A-Za-z0-9._-]+/g, '_');
}

export async function collectLegalDiary(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
}): Promise<void> {
  const { http, cfg } = opts;
  const manifest = new JsonlWriter(`${cfg.outDir}/legal-diary.jsonl`);
  const captureDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const html = await http.text(DOWNLOAD_PAGE);
    const links = parseDownloadLinks(html);
    if (links.length === 0) {
      console.warn('[legal-diary] no Downloadable Diary links found on /download.');
      return;
    }
    console.log(`[legal-diary] ${captureDate}: found ${links.length} file(s)`);

    for (const { href, label, format } of links) {
      // encodeURI keeps `$`, `/`, `:` and encodes the spaces in the filename.
      const url = HOST + encodeURI(href);
      const filename = path.basename(decodeURIComponent(href));
      const dest = path.join(cfg.outDir, 'legal-diary', `${captureDate}__${safeName(filename)}`);
      const result = await downloadFile(http, url, dest);
      await manifest.write({
        capturedAt: new Date().toISOString(),
        captureDate,
        diaryLabel: label,
        format,
        url,
        ...result,
      });
      console.log(`[legal-diary] ${result.status}: ${label}.${format} (${result.bytes ?? 0}b)`);
    }
  } finally {
    await manifest.close();
  }
}
