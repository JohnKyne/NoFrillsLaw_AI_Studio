/**
 * Resumable cursor. Each collector persists a small JSON checkpoint so a run
 * can be interrupted and resumed without re-fetching completed work.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export class Cursor<T extends object> {
  private readonly file: string;

  constructor(outDir: string, name: string) {
    this.file = path.join(outDir, '.cursors', `${name}.json`);
  }

  /** Load saved state, or return `fallback` if none exists yet. */
  async load(fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      return { ...fallback, ...(JSON.parse(raw) as T) };
    } catch {
      return fallback;
    }
  }

  /** Atomically persist state (write temp + rename). */
  async save(state: T): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }
}
