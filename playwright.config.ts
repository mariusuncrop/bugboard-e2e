import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE, env } from './src/support/env.js';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  // Every spec arranges its own data, so they are safe to run concurrently.
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : undefined,
  timeout: 30_000,
  globalSetup: './src/support/global-setup.ts',

  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },

  // Blob reports merge cleanly across shards; locally the HTML report is friendlier.
  reporter: isCI
    ? [['blob'], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  // Screenshots are rendered by the OS, so keep one set per platform rather than
  // letting a macOS run overwrite the baselines CI compares against.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{platform}/{arg}{ext}',

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.apiUrl },
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testDir: './tests/ui',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE.admin },
    },
    {
      name: 'firefox',
      testDir: './tests/ui',
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE.admin },
    },
    {
      name: 'webkit',
      testDir: './tests/ui',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE.admin },
    },
    {
      name: 'mobile-chrome',
      testDir: './tests/ui',
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'], storageState: STORAGE_STATE.admin },
    },
    {
      name: 'visual',
      testDir: './tests/visual',
      dependencies: ['setup'],
      // Visual specs assert on the untouched seed fixture, so they take the
      // database to themselves rather than racing specs that write to it.
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE.admin,
        viewport: { width: 1280, height: 900 },
        colorScheme: 'light',
        timezoneId: 'UTC',
        locale: 'en-GB',
      },
    },
  ],
});
