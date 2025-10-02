import { expect, test } from '../../src/fixtures/index.js';
import { ApiClient } from '../../src/api/client.js';

/**
 * Visual specs run in their own project, one worker at a time, against the
 * untouched seed fixture. The app's seed uses fixed ids and fixed timestamps
 * precisely so these snapshots stay stable between runs.
 *
 * Baselines are per platform (see snapshotPathTemplate). Refresh the Linux ones
 * the same way CI produces them — see the README.
 */
test.beforeAll(async () => {
  await ApiClient.resetDatabase();
});

test.describe('appearance', () => {
  test('the project list matches its baseline', async ({ projectsPage, page }) => {
    await projectsPage.goto();
    await expect(projectsPage.list).toBeVisible();

    await expect(page).toHaveScreenshot('projects.png', { fullPage: true });
  });

  test('the project members page matches its baseline', async ({ projectSettings, page }) => {
    await projectSettings.goto('WEB');
    await expect(projectSettings.memberList).toBeVisible();

    await expect(page).toHaveScreenshot('project-members.png', { fullPage: true });
  });

  test('the board matches its baseline', async ({ boardPage, page }) => {
    await boardPage.goto();
    await expect(boardPage.card('WEB-1')).toBeVisible();

    await expect(page).toHaveScreenshot('board.png', { fullPage: true });
  });

  test('the issue list matches its baseline', async ({ issuesPage, page }) => {
    await issuesPage.goto();
    await expect(issuesPage.table).toBeVisible();

    await expect(page).toHaveScreenshot('issue-list.png', { fullPage: true });
  });

  test('an issue detail page matches its baseline', async ({ issueDetail, page }) => {
    await issueDetail.goto('WEB-1');

    await expect(page).toHaveScreenshot('issue-detail.png', { fullPage: true });
  });

  test('the dashboard matches its baseline', async ({ dashboard, page }) => {
    await dashboard.goto();
    await expect(dashboard.root).toBeVisible({ timeout: 15_000 });

    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true });
  });

  test('the board in dark mode matches its baseline', async ({ boardPage, header, page }) => {
    await boardPage.goto();
    await header.toggleTheme();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await expect(page).toHaveScreenshot('board-dark.png', { fullPage: true });

    // Leave the theme as the next test expects to find it.
    await header.toggleTheme();
  });

  test('the login page matches its baseline', async ({ page, loginPage }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(loginPage.form).toBeVisible();

    await expect(page).toHaveScreenshot('login.png', { fullPage: true });
  });

  test('a single issue card matches its baseline', async ({ boardPage }) => {
    await boardPage.goto();

    await expect(boardPage.card('WEB-1')).toHaveScreenshot('issue-card.png');
  });
});
