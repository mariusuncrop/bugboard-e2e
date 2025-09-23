import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'bugboard-e2e-'));

/** Writes a fixture file and returns its path, for setInputFiles. */
export function tempFile(name: string, contents: string | Buffer): string {
  const path = join(dir, name);
  writeFileSync(path, contents);
  return path;
}

/** A file comfortably over the app's 2 MB attachment limit. */
export const oversizedFile = (name = 'too-big.txt'): string => tempFile(name, Buffer.alloc(3 * 1024 * 1024, 'a'));
