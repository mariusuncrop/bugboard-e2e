import { test as setup } from '@playwright/test';
import { ApiClient } from '../src/api/client.js';
import { STORAGE_STATE } from '../src/support/env.js';

/**
 * Signs in over the API once per run and saves the resulting browser state, so
 * no UI spec has to drive the login form before it can get to the point. The
 * login form itself is tested properly in tests/ui/auth.spec.ts.
 */
async function saveStateFor(
  page: import('@playwright/test').Page,
  client: ApiClient,
  path: string,
): Promise<void> {
  // The origin has to be loaded before its localStorage can be written to.
  await page.goto('/login');
  await page.evaluate((token) => window.localStorage.setItem('bugboard.token', token), client.token);
  await page.context().storageState({ path });
}

setup('authenticate as admin', async ({ page }) => {
  const client = await ApiClient.asAdmin();
  await saveStateFor(page, client, STORAGE_STATE.admin);
  await client.dispose();
});

setup('authenticate as member', async ({ page }) => {
  const client = await ApiClient.asMember();
  await saveStateFor(page, client, STORAGE_STATE.member);
  await client.dispose();
});
