import { expect, test } from '../../src/fixtures/index.js';
import { uniqueLabel, uniqueTitle } from '../../src/support/data.js';

test.describe('filtering by label', () => {
  test('lists the labels actually in use, with counts', async ({ api, issuesPage }) => {
    const expected = await api.listLabels('WEB');
    await issuesPage.goto();

    await expect(issuesPage.labelFilter).toBeVisible();
    for (const { label, count } of expected.slice(0, 3)) {
      await expect(issuesPage.labelChip(label)).toContainText(label);
      await expect(issuesPage.labelChip(label)).toContainText(String(count));
    }
  });

  test('narrows the list to one label', async ({ api, issuesPage }) => {
    const label = uniqueLabel();
    const issue = await api.createIssue({ title: uniqueTitle('Labelled'), labels: [label] });

    try {
      await issuesPage.goto();
      await issuesPage.toggleLabel(label);

      await expect(issuesPage.rows).toHaveCount(1);
      await expect(issuesPage.row(issue.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('a second label widens the result rather than narrowing it', async ({ api, issuesPage }) => {
    const [first, second] = [uniqueLabel(), uniqueLabel()];
    const a = await api.createIssue({ title: uniqueTitle('First label'), labels: [first] });
    const b = await api.createIssue({ title: uniqueTitle('Second label'), labels: [second] });

    try {
      await issuesPage.goto();

      await issuesPage.toggleLabel(first);
      await expect(issuesPage.rows).toHaveCount(1);

      await issuesPage.toggleLabel(second);
      await expect(issuesPage.rows).toHaveCount(2);
      await expect(issuesPage.row(a.key)).toBeVisible();
      await expect(issuesPage.row(b.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(a.key);
      await api.deleteIssueIfPresent(b.key);
    }
  });

  test('a pressed chip says so, for anyone not going by colour', async ({ issuesPage }) => {
    await issuesPage.goto();
    const chip = issuesPage.labelChip('ui');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    await issuesPage.toggleLabel('ui');

    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  test('the selection lives in the URL, so it can be shared and restored', async ({ api, issuesPage, page }) => {
    await issuesPage.goto();

    await issuesPage.toggleLabel('ui');
    await expect(page).toHaveURL(/label=ui/);

    await issuesPage.goto('?label=ui');
    await expect(issuesPage.labelChip('ui')).toHaveAttribute('aria-pressed', 'true');

    // The table shows no label chips of its own, so check the rows it chose
    // against what the same filter returns from the API.
    const expected = await api.listIssues({ label: 'ui', pageSize: 10 });
    expect(await issuesPage.visibleKeys()).toEqual(expected.items.map((issue) => issue.key));
  });

  test('pressing the chip again removes it', async ({ issuesPage, page }) => {
    await issuesPage.goto('?label=ui');
    await expect(issuesPage.labelChip('ui')).toHaveAttribute('aria-pressed', 'true');

    await issuesPage.toggleLabel('ui');

    await expect(page).not.toHaveURL(/label=ui/);
  });

  test('clearing drops every label at once', async ({ issuesPage, page }) => {
    await issuesPage.goto('?label=ui,api');

    await issuesPage.clearLabels.click();

    await expect(page).not.toHaveURL(/label=/);
    await expect(issuesPage.labelChip('ui')).toHaveAttribute('aria-pressed', 'false');
  });

  test('combines with the other filters rather than replacing them', async ({ issuesPage, page }) => {
    await issuesPage.goto();

    await issuesPage.statusFilter.selectOption('done');
    await issuesPage.toggleLabel('ui');

    await expect(page).toHaveURL(/status=done/);
    await expect(page).toHaveURL(/label=ui/);
    for (const row of await issuesPage.rows.all()) {
      await expect(row.getByTestId('status-badge')).toHaveAttribute('data-status', 'done');
    }
  });

  test('each project offers only its own labels', async ({ api, issuesPage }) => {
    const mobile = await api.listLabels('MOB');
    await issuesPage.goto('', 'MOB');

    // The chips arrive with their own request; wait for them before counting.
    const chips = issuesPage.labelFilter.locator('[data-testid^="label-filter-"]');
    await expect(chips).toHaveCount(mobile.length);
    for (const { label } of mobile) await expect(issuesPage.labelChip(label)).toBeVisible();
  });
});
