import { ApiClient } from '../api/client.js';
import { env } from './env.js';

const REACHABLE_TIMEOUT_MS = 30_000;

async function waitForUrl(url: string, label: string): Promise<void> {
  const deadline = Date.now() + REACHABLE_TIMEOUT_MS;
  let lastError = 'no response';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    [
      `Could not reach the ${label} at ${url} (${lastError}).`,
      '',
      'These tests run against a live BugBoard instance. Start one with:',
      '',
      '  git clone https://github.com/mariusuncrop/bugboard-app',
      '  cd bugboard-app && npm install && npm run dev',
      '',
      'Then point BASE_URL and API_URL at it (see .env.example).',
    ].join('\n'),
  );
}

/**
 * Runs once before the whole suite: fails fast with a useful message if the app
 * is not running, then restores the seed fixture so the run starts from a known
 * baseline. Individual specs create and clean up their own data from there, so
 * they stay independent and can run in parallel.
 */
export default async function globalSetup(): Promise<void> {
  await waitForUrl(`${env.apiUrl}/api/health`, 'BugBoard API');
  await waitForUrl(env.baseUrl, 'BugBoard web app');
  await ApiClient.resetDatabase();
}
