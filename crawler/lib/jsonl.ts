/** Append-only JSONL writer. One object per line; flushes on every write. */
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export class JsonlWriter {
  private stream: WriteStream | null = null;
  private count = 0;

  constructor(private readonly file: string) {}

  private async ensure(): Promise<WriteStream> {
    if (this.stream) return this.stream;
    await mkdir(path.dirname(this.file), { recursive: true });
    this.stream = createWriteStream(this.file, { flags: 'a' });
    return this.stream;
  }

  async write(record: unknown): Promise<void> {
    const s = await this.ensure();
    const line = JSON.stringify(record) + '\n';
    await new Promise<void>((resolve, reject) =>
      s.write(line, (err: Error | null | undefined) =>
        err ? reject(err) : resolve(),
      ),
    );
    this.count++;
  }

  get written(): number {
    return this.count;
  }

  async close(): Promise<void> {
    if (!this.stream) return;
    await new Promise<void>((resolve) => this.stream!.end(resolve));
    this.stream = null;
  }
}
