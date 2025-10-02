import { expect, test } from '../../src/fixtures/index.js';

const STUBBED_STATS = {
  total: 42,
  open: 30,
  done: 12,
  unassigned: 7,
  byStatus: { backlog: 9, todo: 8, in_progress: 7, in_review: 6, done: 12 },
  byPriority: { low: 10, medium: 14, high: 13, critical: 5 },
  byType: { bug: 25, task: 17 },
  byAssignee: [{ id: 'usr_dev', name: 'Marco Reyes', avatarColor: '#0369a1', open: 11 }],
};

test.describe('dashboard', () => {
  test('shows a loading state, then the numbers', async ({ dashboard }) => {
    await dashboard.goto();

    await expect(dashboard.loading).toBeVisible();
    await expect(dashboard.loading).toContainText('Crunching numbers');

    await expect(dashboard.root).toBeVisible({ timeout: 15_000 });
    await expect(dashboard.loading).toBeHidden();
  });

  test('renders exactly what the stats endpoint returns', async ({ dashboard, page }) => {
    // Specs run in parallel against one database, so the live totals move while
    // this test is running. Stubbing the response is what makes the rendering
    // contract assertable — the numbers themselves are covered by the API suite.
    await page.route('**/stats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUBBED_STATS) }),
    );

    await dashboard.goto();

    await expect(dashboard.total).toContainText('42');
    await expect(dashboard.open).toContainText('30');
    await expect(dashboard.done).toContainText('12');
    await expect(dashboard.unassigned).toContainText('7');

    for (const [status, count] of Object.entries(STUBBED_STATS.byStatus)) {
      await expect(dashboard.statusCount(status)).toHaveText(String(count));
    }

    await expect(page.getByTestId('workload-usr_dev')).toContainText('11 open');
  });

  test('the live numbers are internally consistent', async ({ dashboard, page }) => {
    await dashboard.goto();
    await expect(dashboard.root).toBeVisible({ timeout: 15_000 });

    const read = async (testId: string) =>
      Number((await page.getByTestId(testId).textContent())!.replace(/\D/g, ''));

    const [total, open, done] = await Promise.all([read('stat-total'), read('stat-open'), read('stat-done')]);

    expect(open + done, 'every issue is either open or done').toBe(total);
  });

  test('the backlog link carries the filter into the issue list', async ({ dashboard, page, issuesPage }) => {
    await dashboard.goto();
    await expect(dashboard.root).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('dashboard-backlog-link').click();

    await expect(page).toHaveURL(/\/issues\?status=backlog/);
    await expect(issuesPage.statusFilter).toHaveValue('backlog');
  });
});
