/**
 * Shared collector for the two Drupal PDF-listing corpora on www2.courts.ie:
 *   - Judgments     (/Judgments)      citations: IEHC, IECA, IESC, ...
 *   - Determinations(/determinations) citations: IESCDET
 *
 * Both render judgment PDFs as <a href="/acc/alfresco/<uuid>/<CITATION>.pdf">
 * and paginate with a 0-based `?page=N`. We walk pages until one yields no new
 * PDF links. No form tokens needed — pagination alone exposes the whole corpus.
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { Cursor } from '../lib/cursor.js';
import type { CrawlerConfig } from '../config.js';
import type { JudgmentRecord } from '../types.js';

/** Map a neutral-citation court token to a human-readable court name. */
function courtFromCitation(citation: string | null): string | null {
  if (!citation) return null;
  const m = citation.match(/^\d{4}_IE([A-Z]+?)(?:DET)?_/);
  const token = citation.includes('IESCDET') ? 'SCDET' : m?.[1];
  const map: Record<string, string> = {
    SC: 'Supreme Court',
    SCDET: 'Supreme Court (Determination)',
    CA: 'Court of Appeal',
    HC: 'High Court',
    CC: 'Circuit Court',
    DC: 'District Court',
    CCC: 'Central Criminal Court',
  };
  return token ? map[token] ?? `Unknown (IE${token})` : null;
}

/** Extract judgment PDF links + adjacent title text from one listing page. */
function parseListingPage(html: string, page: number): JudgmentRecord[] {
  const out: JudgmentRecord[] = [];
  const seen = new Set<string>();
  // /acc/alfresco/<uuid>/<filename>.pdf  (optionally followed by /pdf#... view)
  const re =
    /href="(\/acc\/alfresco\/([0-9a-f-]{36})\/([^"\/]+?\.pdf))(?:\/pdf[^"]*)?"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, pathPart, uuid, filename] = m;
    if (seen.has(uuid)) continue;
    seen.add(uuid);
    const base = decodeURIComponent(filename).replace(/\.pdf$/i, '');
    const citation = /\d{4}_IE[A-Z]+_?\d*/i.test(base)
      ? base.match(/\d{4}_IE[A-Z]+_?\d*/i)![0]
      : null;
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
  done: boolean;
}

export async function collectPdfListing(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  name: 'judgments' | 'determinations';
  listUrl: string;
  /** Stop after this many empty pages (guards against gaps). 0 = first empty. */
  maxPages?: number;
}): Promise<void> {
  const { http, cfg, name, listUrl } = opts;
  const cursor = new Cursor<PdfCursorState>(cfg.outDir, name);
  const writer = new JsonlWriter(`${cfg.outDir}/${name}.jsonl`);
  const state = await cursor.load({ nextPage: 0, totalWritten: 0, done: false });

  if (state.done) {
    console.log(`[${name}] already complete (${state.totalWritten} records).`);
    return;
  }
  console.log(`[${name}] resuming at page ${state.nextPage}`);

  try {
    const hardLimit = opts.maxPages ?? Number.POSITIVE_INFINITY;
    while (state.nextPage < hardLimit) {
      const url = `${listUrl}?sort=asc:DateUploaded&page=${state.nextPage}`;
      const html = await http.text(url);
      const rows = parseListingPage(html, state.nextPage);

      if (rows.length === 0) {
        console.log(`[${name}] page ${state.nextPage} empty -> done.`);
        state.done = true;
        await cursor.save(state);
        break;
      }
      for (const r of rows) await writer.write(r);
      state.totalWritten += rows.length;
      state.nextPage += 1;
      await cursor.save(state); // checkpoint after every page
      console.log(
        `[${name}] page ${state.nextPage - 1}: +${rows.length} ` +
          `(total ${state.totalWritten})`,
      );
    }
  } finally {
    await writer.close();
  }
}
