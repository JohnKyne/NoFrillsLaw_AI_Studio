/**
 * Collector for the two Drupal PDF-listing corpora on www2.courts.ie:
 *   - Judgments      (/Judgments)      citations: IEHC, IECA, IESC, ...
 *   - Determinations (/determinations) citations: IESCDET
 *
 * IMPORTANT COVERAGE CAVEAT
 * -------------------------
 * The public browse listing is CAPPED to the most-recent uploads, NOT the full
 * historical corpus (verified: Judgments exposes ~196 PDFs over pages 0-1 then
 * nothing; Determinations ~24 on page 0). The complete archive lives behind an
 * Alfresco-backed AJAX search form (`alfresco_*` fields + date range) which a
 * plain POST cannot drive — it 302-redirects to the homepage. Fully covering
 * the judgment archive therefore needs the Alfresco search endpoint reverse-
 * engineered or a headless browser (see COVERAGE.md). This collector reliably
 * captures the recent window only.
 *
 * Mechanics: PDFs render as <a href="/acc/alfresco/<uuid>/<file>.pdf">. We page
 * a 0-based `?page=N` and stop when a page yields no *new* judgment documents.
 * A persistent help PDF appears in the page chrome on every page and is
 * denylisted so it neither pollutes output nor prevents termination.
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import type { CrawlerConfig } from '../config.js';
import type { JudgmentRecord } from '../types.js';

/** Filenames that are page chrome, not judgments. */
const CHROME_PDF = /Searching-Judgments\.pdf$/i;

function courtFromCitation(citation: string | null): string | null {
  if (!citation) return null;
  if (citation.includes('IESCDET')) return 'Supreme Court (Determination)';
  const token = citation.match(/^\d{4}_IE([A-Z]+)_/)?.[1];
  const map: Record<string, string> = {
    SC: 'Supreme Court', CA: 'Court of Appeal', HC: 'High Court',
    CC: 'Circuit Court', DC: 'District Court', CCC: 'Central Criminal Court',
  };
  return token ? map[token] ?? `Unknown (IE${token})` : null;
}

/** Extract judgment PDF links (excluding chrome) from one listing page. */
function parseListingPage(html: string, page: number): JudgmentRecord[] {
  const out: JudgmentRecord[] = [];
  const seen = new Set<string>();
  const re =
    /href="(\/acc\/alfresco\/([0-9a-f-]{36})\/([^"\/]+?\.pdf))(?:\/pdf[^"]*)?"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, pathPart, uuid, filename] = m;
    if (CHROME_PDF.test(filename) || seen.has(uuid)) continue;
    seen.add(uuid);
    const base = decodeURIComponent(filename).replace(/\.pdf$/i, '');
    const citation = base.match(/\d{4}_IE[A-Z]+_?\d*/i)?.[0] ?? null;
    out.push({
      citation,
      court: courtFromCitation(citation),
      pdfUrl: new URL(pathPart, 'https://www2.courts.ie').toString(),
      documentId: uuid,
      title: base.replace(/_/g, ' '),
      page,
      scrapedAt: new Date().toISOString(),
    });
  }
  return out;
}

interface PdfCursorState {
  nextPage: number;
  totalWritten: number;
  /** documentIds already emitted, so re-runs and overlap don't duplicate. */
  seenIds: string[];
  done: boolean;
}

export async function collectPdfListing(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  name: 'judgments' | 'determinations';
  listUrl: string;
}): Promise<void> {
  const { http, cfg, name, listUrl } = opts;
  const cursor = new Cursor<PdfCursorState>(cfg.outDir, name);
  const writer = new JsonlWriter(`${cfg.outDir}/${name}.jsonl`);
  const state = await cursor.load({
    nextPage: 0, totalWritten: 0, seenIds: [], done: false,
  });
  if (state.done) {
    console.log(`[${name}] already complete (${state.totalWritten} records).`);
    return;
  }
  const seen = new Set(state.seenIds);
  console.log(
    `[${name}] resuming at page ${state.nextPage} ` +
      `(NB: listing captures the recent window only — see COVERAGE.md)`,
  );

  try {
    // Stop after a page contributes no *new* judgment documents.
    while (true) {
      const url = `${listUrl}?sort=desc:DateUploaded&page=${state.nextPage}`;
      const html = await http.text(url);
      const rows = parseListingPage(html, state.nextPage).filter(
        (r) => !seen.has(r.documentId ?? r.pdfUrl),
      );

      if (rows.length === 0) {
        console.log(`[${name}] page ${state.nextPage} added nothing new -> done.`);
        state.done = true;
        await cursor.save(state);
        break;
      }
      for (const r of rows) {
        await writer.write(r);
        seen.add(r.documentId ?? r.pdfUrl);
      }
      state.totalWritten += rows.length;
      state.seenIds = [...seen];
      state.nextPage += 1;
      await cursor.save(state);
      console.log(
        `[${name}] page ${state.nextPage - 1}: +${rows.length} (total ${state.totalWritten})`,
      );
    }
  } finally {
    await writer.close();
  }
}
