import { randomUUID } from 'node:crypto';

/**
 * Specs run in parallel against one shared database, so anything a test creates
 * needs a name no other test could collide with — and a name a human can trace
 * back to a spec if cleanup ever fails.
 */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

export function uniqueLabel(): string {
  return `t-${randomUUID().slice(0, 6)}`;
}

export const textFile = (name: string, contents: string) => ({
  name,
  mimeType: 'text/plain',
  buffer: Buffer.from(contents, 'utf8'),
});
