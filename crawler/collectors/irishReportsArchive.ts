/**
 * Irish Reports archive — public-domain volumes via the Internet Archive.
 *
 * The founding modern series, The Irish Reports 1894–1925 (ICLR), has been
 * digitised on archive.org as a complete, gap-free run (`irish-reports_<year>_<vol>`,
 * ~2 vols/year). These volumes are public domain by age, and the Internet
 * Archive's API explicitly permits programmatic access — so unlike the vLex
 * layer this is free, legitimate, and unrestricted.
 *
 * Each volume carries far more than metadata:
 *   - a structured "TABLE OF CASES REPORTED" (case name -> page) → the by-year
 *     reported-case INDEX with [year] vol I.R. page citations;
 *   - a "TABLE OF CASES CITED" (a citation graph, as a bonus);
 *   - the full reported text + headnotes (also PD for this period).
 *
 * Modes:
 *   'metadata' (default) — one IA search call; writes a manifest of all volumes
 *                          (identifier, year, vol, citation prefix, page count,
 *                          size, download URLs). Light.
 *   'text' | 'pdf' | 'all' — also download the OCR text / PDFs (heavy) and parse
 *                          the case index from the text. Run these deliberately.
 */
import { HttpClient } from '../lib/http.js';
import { JsonlWriter } from '../lib/jsonl.js';
import { downloadFile } from '../lib/fetchFile.js';
import { Cursor } from '../lib/cursor.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CrawlerConfig } from '../config.js';

const IA = 'https://archive.org';
const SEARCH = `${IA}/advancedsearch.php`;

export type IrishReportsMode = 'metadata' | 'text' | 'pdf' | 'all';

interface VolumeMeta {
  identifier: string;
  year: number;
  vol: number;
  title: string;
  citationPrefix: string; // e.g. "[1894] 1 I.R."
  pages: number | null;   // imagecount
  sizeBytes: number | null;
  textUrl: string;        // _djvu.txt
  pdfUrl: string;
  detailsUrl: string;
}

/** One enumeration call → metadata for every digitised volume. */
async function enumerateVolumes(http: HttpClient): Promise<VolumeMeta[]> {
  const fields = ['identifier', 'year', 'title', 'imagecount', 'item_size'];
  const fl = fields.map((f) => `fl[]=${f}`).join('&');
  const url =
    `${SEARCH}?q=${encodeURIComponent('identifier:irish-reports_*')}` +
    `&${fl}&rows=500&sort[]=identifier+asc&output=json`;
  const data = await http.json<{ response: { docs: Record<string, unknown>[] } }>(url);

  const out: VolumeMeta[] = [];
  for (const d of data.response.docs) {
    const id = String(d.identifier);
    const m = id.match(/irish-reports_(\d{4})_(\d+)/);
    if (!m) continue;
    const year = Number(m[1]);
    const vol = Number(m[2]);
    out.push({
      identifier: id,
      year,
      vol,
      title: String(d.title ?? '').trim(),
      citationPrefix: `[${year}] ${vol} I.R.`,
      pages: d.imagecount != null ? Number(d.imagecount) : null,
      sizeBytes: d.item_size != null ? Number(d.item_size) : null,
      textUrl: `${IA}/download/${id}/${id}_djvu.txt`,
      pdfUrl: `${IA}/download/${id}/${id}.pdf`,
      detailsUrl: `${IA}/details/${id}`,
    });
  }
  return out.sort((a, b) => a.year - b.year || a.vol - b.vol);
}

/** Reject OCR garbage masquerading as a case name (e.g. "1 ART", "Bf - cunts y P oe"). */
function looksLikeCaseName(s: string): boolean {
  if (/^\d/.test(s)) return false;                       // starts with a digit
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  if (letters < 4) return false;
  if (letters / s.replace(/\s/g, '').length < 0.55) return false; // too few letters
  if ((s.match(/\b[A-Za-z]\b/g) || []).length >= 3) return false;  // scattered single letters
  return true;
}

/** Roman/OCR header & alphabet-divider lines to skip inside the case table. */
function isNoise(line: string): boolean {
  return (
    line === '' ||
    /^[A-Z]\.?$/.test(line) ||                 // "D." section divider
    /TABLE OF CASES|IN THIS VOLUME|^PAGE\b/i.test(line) ||
    /^(?:vou|vol)\b/i.test(line) ||            // "Vou. I.) ... xi" page header
    /^x?[ivxl]+\b/i.test(line)                 // roman-numeral page markers
  );
}

/**
 * Best-effort parse of the "TABLE OF CASES REPORTED" section of a volume's OCR
 * text into {caseName, pages, citation}. The tables are TWO-COLUMN and list each
 * case twice (forward + reversed), and the flat _djvu.txt linearises that
 * imperfectly, so expect garbled/duplicate tails — this is a candidate index to
 * clean, not gospel. (A cleaner pass would use the page-level `_djvu.xml` word
 * boxes to reconstruct columns by x-position.)
 */
export function parseCasesReported(
  text: string,
  year: number,
  vol: number,
): Array<{ caseName: string; pages: number[]; citation: string }> {
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const start = lines.findIndex((l) => /TABLE OF CASES REPORTED/i.test(l));
  if (start < 0) return [];
  // Section ends at the cases-cited table.
  let end = lines.findIndex((l, i) => i > start && /TABLE OF CASES CITED/i.test(l));
  if (end < 0) end = Math.min(lines.length, start + 1200);

  const out: Array<{ caseName: string; pages: number[]; citation: string }> = [];
  let buf: string[] = [];
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (isNoise(line)) continue;
    buf.push(line);
    if (!/\d\s*$/.test(line)) continue; // entry continues until it ends in a page no.

    const joined = buf.join(' ')
      .replace(/»\.?/g, 'v.')   // OCR: "v." -> "»."
      .replace(/\s+,/g, ',')
      .trim();
    buf = [];
    const m = joined.match(/^(.*?)[\s,]+(\d{1,4}(?:\s*,\s*\d{1,4})*)\s*$/);
    if (!m) continue;
    const caseName = m[1].replace(/[\s,]+$/, '').trim();
    const pages = m[2].split(',').map((p) => Number(p.trim())).filter((n) => n > 0);
    if (pages.length === 0 || !looksLikeCaseName(caseName)) continue;
    out.push({ caseName, pages, citation: `[${year}] ${vol} I.R. ${pages[0]}` });
  }
  return out;
}

interface IrCursorState { doneIds: string[]; }

export async function collectIrishReports(opts: {
  http: HttpClient;
  cfg: CrawlerConfig;
  mode?: IrishReportsMode;
  fromYear?: number;
  toYear?: number;
}): Promise<void> {
  const { http, cfg } = opts;
  const mode = opts.mode ?? 'metadata';
  const dir = path.join(cfg.outDir, 'irish-reports');
  const manifest = new JsonlWriter(path.join(dir, 'manifest.jsonl'));

  const allVolumes = await enumerateVolumes(http);
  console.log(`[irish-reports] enumerated ${allVolumes.length} volumes (${allVolumes[0]?.year}–${allVolumes.at(-1)?.year}).`);
  try {
    for (const v of allVolumes) await manifest.write(v);
  } finally {
    await manifest.close();
  }
  console.log(`[irish-reports] manifest written: ${path.join(dir, 'manifest.jsonl')}`);

  // Optional year window for the (heavy) download/parse pass.
  const from = opts.fromYear ?? -Infinity;
  const to = opts.toYear ?? Infinity;
  const volumes = allVolumes.filter((v) => v.year >= from && v.year <= to);

  if (mode === 'metadata') {
    console.log('[irish-reports] metadata-only mode — no volume downloads. ' +
      'Use --mode text|pdf|all to fetch volumes and parse the case index.');
    return;
  }

  // Heavy modes: download volumes (resumable) and parse the case index from text.
  const cursor = new Cursor<IrCursorState>(cfg.outDir, 'irish-reports');
  const state = await cursor.load({ doneIds: [] });
  const done = new Set(state.doneIds);
  const index = new JsonlWriter(path.join(dir, 'case-index.jsonl'));

  try {
    for (const v of volumes) {
      if (done.has(v.identifier)) continue;
      if (mode === 'pdf' || mode === 'all') {
        const r = await downloadFile(http, v.pdfUrl, path.join(dir, 'pdf', `${v.identifier}.pdf`));
        console.log(`[irish-reports] ${v.identifier} pdf: ${r.status} (${r.bytes ?? 0}b)`);
      }
      if (mode === 'text' || mode === 'all') {
        const dest = path.join(dir, 'text', `${v.identifier}.txt`);
        const r = await downloadFile(http, v.textUrl, dest);
        if (r.status !== 'failed') {
          const cases = parseCasesReported(await readFile(dest, 'utf8'), v.year, v.vol);
          for (const c of cases) await index.write({ ...c, year: v.year, vol: v.vol, identifier: v.identifier });
          console.log(`[irish-reports] ${v.identifier} text: ${r.status}; parsed ${cases.length} reported cases`);
        }
      }
      done.add(v.identifier);
      await cursor.save({ doneIds: [...done] });
    }
  } finally {
    await index.close();
  }
  console.log(`[irish-reports] case index: ${path.join(dir, 'case-index.jsonl')}`);
}
