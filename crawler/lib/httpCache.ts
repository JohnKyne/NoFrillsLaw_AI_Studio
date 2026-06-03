/**
 * On-disk HTTP cache (opt-in via --cache). Keyed by method+url+body, stored as
 * JSON under <outDir>/.cache. Makes re-runs free and doubles as a request
 * dedup filter (a repeated URL is served from disk, never re-fetched). Only the
 * text/json paths are cached — streaming PDF downloads bypass it.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CachedResponse {
  status: number;
  contentType: string;
  body: string;
}

export class HttpCache {
  constructor(private readonly dir: string) {}

  static key(method: string, url: string, body = ''): string {
    return createHash('sha256').update(`${method}\n${url}\n${body}`).digest('hex');
  }

  private file(key: string): string {
    return path.join(this.dir, `${key}.json`);
  }

  async read(key: string): Promise<CachedResponse | null> {
    try {
      return JSON.parse(await readFile(this.file(key), 'utf8')) as CachedResponse;
    } catch {
      return null;
    }
  }

  async write(key: string, res: CachedResponse): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(key), JSON.stringify(res));
  }
}
