import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';

test.describe('issue list', () => {
  test('shows a page of ten issues with working pagination', async ({ issuesPage }) => {
    const firstPage = await test.step('page 1 shows ten rows and disables Previous', async () => {
      // Oldest first, so issues created by specs running in parallel are appended
      // at the end instead of shifting rows from page 1 onto page 2 mid-test.
      await issuesPage.goto('?sort=createdAt&order=asc');
      await expect(issuesPage.rows).toHaveCount(10);
      await expect(issuesPage.previousPage).toBeDisabled();
      await expect(issuesPage.paginationInfo).toContainText('Page 1 of');
      return issuesPage.visibleKeys();
    });

    await test.step('page 2 shows different rows and enables Previous', async () => {
      await issuesPage.nextPage.click();
      await expect(issuesPage.paginationInfo).toContainText('Page 2 of');
      await expect(issuesPage.previousPage).toBeEnabled();
      const secondPage = await issuesPage.visibleKeys();
      expect(secondPage.some((key) => firstPage.includes(key))).toBe(false);
    });
  });

  test('keeps the page in the URL so the back button works', async ({ issuesPage, page }) => {
    await issuesPage.goto();
    await issuesPage.nextPage.click();
    await expect(page).toHaveURL(/page=2/);

    await page.goBack();

    await expect(page).not.toHaveURL(/page=2/);
    await expect(issuesPage.paginationInfo).toContainText('Page 1 of');
  });

  test('searches by title', async ({ api, issuesPage }) => {
    const title = uniqueTitle('Searchable');
    const issue = await api.createIssue({ title });

    try {
      await issuesPage.goto();
      await issuesPage.searchFor(title);

      await expect(issuesPage.rows).toHaveCount(1);
      await expect(issuesPage.row(issue.key)).toContainText(title);
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('shows an empty state when nothing matches', async ({ issuesPage }) => {
    await issuesPage.goto();
    await issuesPage.searchFor('zzz-nothing-matches-this-zzz');

    await expect(issuesPage.empty).toHaveText('No issues match these filters.');
    await expect(issuesPage.table).toHaveCount(0);
  });

  test('filters by status', async ({ issuesPage }) => {
    await issuesPage.goto();
    await issuesPage.statusFilter.selectOption('done');

    await expect(issuesPage.rows.first()).toBeVisible();
    for (const badge of await issuesPage.table.getByTestId('status-badge').all()) {
      await expect(badge).toHaveAttribute('data-status', 'done');
    }
  });

  test('combines several filters', async ({ issuesPage, page }) => {
    await test.step('filter by status and type', async () => {
      await issuesPage.goto();
      await issuesPage.statusFilter.selectOption('done');
      await issuesPage.typeFilter.selectOption('task');
    });

    await test.step('both filters land in the URL', async () => {
      await expect(page).toHaveURL(/status=done/);
      await expect(page).toHaveURL(/type=task/);
    });

    await test.step('every row satisfies both filters', async () => {
      for (const row of await issuesPage.rows.all()) {
        await expect(row.getByTestId('status-badge')).toHaveAttribute('data-status', 'done');
        await expect(row.getByTestId('type-badge')).toHaveAttribute('data-type', 'task');
      }
    });
  });

  test('clears every filter at once', async ({ issuesPage, page }) => {
    await issuesPage.goto('?status=done&priority=high&type=task');
    await expect(issuesPage.statusFilter).toHaveValue('done');

    await issuesPage.clearFilters.click();

    await expect(page).toHaveURL(/\/issues$/);
    await expect(issuesPage.statusFilter).toHaveValue('');
    await expect(issuesPage.priorityFilter).toHaveValue('');
  });

  test('restores filters from the URL on a fresh load', async ({ issuesPage }) => {
    await issuesPage.goto('?priority=critical');

    await expect(issuesPage.priorityFilter).toHaveValue('critical');
    for (const badge of await issuesPage.table.getByTestId('priority-badge').all()) {
      await expect(badge).toHaveAttribute('data-priority', 'critical');
    }
  });

  test('sorts by priority, and reverses on a second click', async ({ issuesPage, page }) => {
    const rank = { Low: 0, Medium: 1, High: 2, Critical: 3 } as Record<string, number>;
    await issuesPage.goto();

    const priorityRanks = async () =>
      (await issuesPage.table.getByTestId('priority-badge').allTextContents()).map((label) => rank[label]!);

    await test.step('the first click sorts highest priority first', async () => {
      await issuesPage.sortBy('priority');
      await expect(page).toHaveURL(/order=desc/);
      // allTextContents() takes a single snapshot and never retries, so wait on
      // an auto-retrying assertion first rather than reading a half-rendered table.
      await expect(issuesPage.table.getByTestId('priority-badge').first()).toHaveText('Critical');

      const ranks = await priorityRanks();
      expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    });

    await test.step('the second click reverses it', async () => {
      await issuesPage.sortBy('priority');
      await expect(page).toHaveURL(/order=asc/);
      await expect(issuesPage.table.getByTestId('priority-badge').first()).toHaveText('Low');

      const ranks = await priorityRanks();
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });
  });

  test('opens an issue from the table', async ({ issuesPage, tempIssue, page, issueDetail }) => {
    await issuesPage.goto();
    await issuesPage.searchFor(tempIssue.title);
    await issuesPage.openIssue(tempIssue.key);

    await expect(page).toHaveURL(new RegExp(`/issues/${tempIssue.key}$`));
    await expect(issueDetail.title).toHaveText(tempIssue.title);
  });

  test('shows a loading state before the rows arrive', async ({ issuesPage, page }) => {
    await page.route('**/api/issues?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await issuesPage.goto();

    await expect(issuesPage.loading).toBeVisible();
    await expect(issuesPage.table).toBeVisible();
    await expect(issuesPage.loading).toBeHidden();
  });

  test('reports a failed request instead of showing an empty table', async ({ issuesPage, page, toast }) => {
    await page.route('**/api/issues?*', (route) => route.fulfill({ status: 500, body: '{}' }));

    await issuesPage.goto();

    await expect(toast).toContainText('Could not load issues.');
  });
});
