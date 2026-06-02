/**
 * Legal Diary — daily bulk download collector.
 *
 * The Legal Diary (legaldiary.courts.ie) publishes a daily "Downloadable Diary"
 * (PDF + DOCX). Per the site's own description it covers the APPELLATE and HIGH
 * COURT lists only: Supreme Court, Court of Appeal (Civil/Criminal), Central
 * Criminal Court, and the High Court lists (Today's Cases, Chancery, Commercial,
 * Competition, Extradition, Family Law, Judicial Review, Before the Master,
 * Non-Jury, Personal Injuries, Legal Costs Adjudicator, etc.).
 *
 * It does NOT include the Circuit Court or District Court (verified: a sample
 * diary contained 0 "Circuit"/"District" tokens). Those live elsewhere on the
 * site and are not part of this download — Circuit listings are in a separate
 * JS-rendered section (/circuit-court, selectable per venue) with no open data
 * API, and District listings are not published centrally at all (the
 * /district-court page just refers you to each District Court Office).
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
