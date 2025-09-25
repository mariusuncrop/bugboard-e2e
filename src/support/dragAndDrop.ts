import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import type { JSHandle, Locator, Page } from '@playwright/test';

/** The browser infers a type from the extension for a picked file; a constructed one needs telling. */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.exe': 'application/x-msdownload',
};

/**
 * Playwright has no way to drop a file from the operating system, so the
 * DataTransfer is built inside the page and the drag sequence dispatched by
 * hand. Reading the bytes here keeps the fixtures on disk, the same ones the
 * click-to-browse specs use.
 */
async function buildDataTransfer(page: Page, paths: string[]): Promise<JSHandle<DataTransfer>> {
  const payload = paths.map((path) => ({
    name: basename(path),
    type: MIME_BY_EXTENSION[extname(path).toLowerCase()] ?? 'application/octet-stream',
    base64: readFileSync(path).toString('base64'),
  }));

  return page.evaluateHandle((files) => {
    const transfer = new DataTransfer();
    for (const file of files) {
      const binary = atob(file.base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      transfer.items.add(new File([bytes], file.name, { type: file.type }));
    }
    return transfer;
  }, payload);
}

/** Drags files over a target and leaves them hovering, for asserting the highlight. */
export async function dragFilesOver(page: Page, target: Locator, paths: string[]): Promise<void> {
  const dataTransfer = await buildDataTransfer(page, paths);
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await dataTransfer.dispose();
}

/** Drags files away again without dropping them. */
export async function dragFilesAway(target: Locator): Promise<void> {
  await target.dispatchEvent('dragleave');
}

/** The whole gesture: drag over, then drop. */
export async function dropFiles(page: Page, target: Locator, paths: string[]): Promise<void> {
  const dataTransfer = await buildDataTransfer(page, paths);
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
  await dataTransfer.dispose();
}
