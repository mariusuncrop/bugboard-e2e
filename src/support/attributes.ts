import { expect, type Locator } from '@playwright/test';

/**
 * Asserts every matching element carries the same attribute value.
 *
 * The obvious loop — `for (const el of await locator.all())` — snapshots a list
 * of handles and then asserts against them one at a time. If the page refetches
 * in between, those handles are stale and the assertion fails on an element
 * that no longer exists. Polling the values as a set retries the whole read.
 */
export async function expectEveryAttribute(
  locator: Locator,
  attribute: string,
  value: string,
  message?: string,
): Promise<void> {
  await expect(locator.first()).toBeVisible();
  await expect
    .poll(
      async () =>
        [...new Set(await locator.evaluateAll((nodes, name) =>
          nodes.map((node) => (node as HTMLElement).getAttribute(name) ?? ''), attribute))].sort(),
      { message },
    )
    .toEqual([value]);
}
