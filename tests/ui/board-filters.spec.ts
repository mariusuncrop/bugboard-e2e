import { expect, test } from '../../src/fixtures/index.js';
import { expectEveryAttribute } from '../../src/support/attributes.js';
import { uniqueTitle } from '../../src/support/data.js';

test.describe('searching the board', () => {
  test('narrows every column to matching cards', async ({ api, boardPage, tempIssue }) => {
    await boardPage.goto();

    await boardPage.searchFor(tempIssue.title);

    await expect(boardPage.card(tempIssue.key)).toBeVisible();
    const keys = await boardPage.board
      .locator('[data-issue-key]')
      .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.issueKey));
    expect(keys).toEqual([tempIssue.key]);
    expect((await api.getIssue(tempIssue.key)).title).toBe(tempIssue.title);
  });

  test('matches on the issue key as well as the title', async ({ boardPage, tempIssue }) => {
    await boardPage.goto();

    await boardPage.searchFor(tempIssue.key);

    await expect(boardPage.card(tempIssue.key)).toBeVisible();
  });

  test('a search that matches nothing empties every column', async ({ boardPage }) => {
    await boardPage.goto();

    await boardPage.searchFor('zzz-nothing-on-this-board-zzz');

    for (const status of ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const) {
      await expect(boardPage.columnCount(status)).toHaveText('0');
    }
  });

  test('the search term lives in the URL', async ({ boardPage, page }) => {
    await boardPage.goto();

    await boardPage.searchFor('checkout');

    await expect(page).toHaveURL(/q=checkout/);
  });
});

test.describe('filtering the board by type', () => {
  test('shows only bugs', async ({ boardPage }) => {
    await boardPage.goto();

    await boardPage.filterByType('bug');

    await expectEveryAttribute(boardPage.board.getByTestId('type-badge'), 'data-type', 'bug');
  });

  test('shows only tasks', async ({ boardPage }) => {
    await boardPage.goto();

    await boardPage.filterByType('task');

    await expectEveryAttribute(boardPage.board.getByTestId('type-badge'), 'data-type', 'task');
  });
});

test.describe('the assignee chips', () => {
  test('are avatars you press, not a dropdown', async ({ boardPage }) => {
    await boardPage.goto();

    await expect(boardPage.assigneeFilter).toBeVisible();
    await expect(boardPage.assigneeChip('unassigned')).toHaveAttribute('aria-pressed', 'false');
    await expect(boardPage.assigneeChip('usr_dev')).toContainText('Marco Reyes');
  });

  test('pressing one narrows the board to their cards', async ({ boardPage }) => {
    await boardPage.goto();

    await boardPage.filterByAssignee('usr_dev');

    await expect(boardPage.assigneeChip('usr_dev')).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => [
        ...new Set(
          await boardPage.board
            .getByTestId('avatar')
            .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.userId ?? '')),
        ),
      ])
      .toEqual(['usr_dev']);
  });

  test('two people can be selected at once, which a dropdown could not express', async ({ boardPage, page }) => {
    await boardPage.goto();

    await boardPage.filterByAssignee('usr_dev');
    await boardPage.filterByAssignee('usr_qa');
    await expect(page).toHaveURL(/assigneeId=usr_dev(%2C|,)usr_qa/);

    // The board refetches on each press, so poll rather than read once.
    await expect
      .poll(async () =>
        [
          ...new Set(
            await boardPage.board
              .getByTestId('avatar')
              .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.userId ?? '')),
          ),
        ].sort(),
      )
      .toEqual(['usr_dev', 'usr_qa']);
  });

  test('unassigned is one of the chips', async ({ boardPage, tempIssue }) => {
    await boardPage.goto();

    await boardPage.filterByAssignee('unassigned');

    await expect(boardPage.card(tempIssue.key)).toBeVisible();
    await expect(boardPage.board.getByTestId('avatar')).toHaveCount(0);
  });

  test('pressing a chip again releases it', async ({ boardPage, page }) => {
    await boardPage.goto();
    await boardPage.filterByAssignee('usr_dev');
    await expect(page).toHaveURL(/assigneeId=usr_dev/);

    await boardPage.filterByAssignee('usr_dev');

    await expect(page).not.toHaveURL(/assigneeId=usr_dev/);
    await expect(boardPage.assigneeChip('usr_dev')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('the filters together', () => {
  test('search, type and assignee combine', async ({ api, boardPage, page }) => {
    const title = uniqueTitle('Combined filters');
    const issue = await api.createIssue({ title, type: 'task', assigneeId: 'usr_qa' });

    try {
      await boardPage.goto();
      await boardPage.filterByType('task');
      await expect(page).toHaveURL(/type=task/);

      await boardPage.filterByAssignee('usr_qa');
      await expect(page).toHaveURL(/assigneeId=usr_qa/);

      await boardPage.searchFor(title);

      await expect(boardPage.card(issue.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('clearing drops all of them at once', async ({ boardPage, page }) => {
    await boardPage.goto('WEB');
    await boardPage.filterByType('bug');
    await boardPage.filterByAssignee('usr_dev');
    await expect(page).toHaveURL(/type=bug/);

    await boardPage.clearFilters.click();

    await expect(page).not.toHaveURL(/type=/);
    await expect(page).not.toHaveURL(/assigneeId=/);
    await expect(boardPage.assigneeChip('usr_dev')).toHaveAttribute('aria-pressed', 'false');
  });

  test('a filtered board can be shared as a link', async ({ boardPage, page }) => {
    await page.goto('/projects/web/board?type=task&assigneeId=usr_qa');
    await boardPage.board.waitFor();

    await expect(boardPage.typeFilter).toHaveValue('task');
    await expect(boardPage.assigneeChip('usr_qa')).toHaveAttribute('aria-pressed', 'true');
  });
});
