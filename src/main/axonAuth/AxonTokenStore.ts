import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Development-only plaintext storage. Keep the same store methods as AXON.
export class AxonTokenStore {
  constructor(private file: string) {}
  async save(token: string, fingerprint: string) {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ token, fingerprint }, null, 2) + '\n');
    return true;
  }
  async load(fingerprint: string): Promise<string | null> {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      return value.fingerprint === fingerprint && typeof value.token === 'string' && value.token.trim()
        ? value.token : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return null;
      throw error;
    }
  }
  clear() { return rm(this.file, { force: true }); }
}
