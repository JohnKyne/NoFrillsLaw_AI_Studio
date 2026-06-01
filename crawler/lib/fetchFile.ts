/**
 * Streaming file downloader with resume-by-skip. Used to pull the actual
 * judgment/determination PDFs (collector (b)). Rate-limited through the shared
 * HttpClient so it honours the same per-host Crawl-delay.
 */
import { createWriteStream } from 'node:fs';
import { stat, mkdir, rename } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import type { HttpClient } from './http.js';

export interface DownloadResult {
  url: string;
  dest: string;
  status: 'downloaded' | 'skipped' | 'failed';
  bytes?: number;
  error?: string;
}

/** Download `url` to `dest`. Skips if a non-empty file already exists. */
export async function downloadFile(
  http: HttpClient,
  url: string,
  dest: string,
): Promise<DownloadResult> {
  try {
    const existing = await stat(dest).catch(() => null);
    if (existing && existing.size > 0) {
      return { url, dest, status: 'skipped', bytes: existing.size };
    }
    await mkdir(path.dirname(dest), { recursive: true });

    const res = await http.raw(url);
    if (res.status >= 300 || !res.body) {
      return { url, dest, status: 'failed', error: `HTTP ${res.status}` };
    }

    const out = createWriteStream(`${dest}.part`);
    await new Promise<void>((resolve, reject) => {
      // res.body is a web ReadableStream in Node 18+; bridge to a Node stream.
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
        .pipe(out)
        .on('finish', () => resolve())
        .on('error', reject);
    });
    const { size } = await stat(`${dest}.part`);
    await rename(`${dest}.part`, dest);
    return { url, dest, status: 'downloaded', bytes: size };
  } catch (err) {
    return { url, dest, status: 'failed', error: (err as Error).message };
  }
}
