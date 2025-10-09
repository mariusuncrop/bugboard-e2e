import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';

const MARCO = 'usr_dev';
const PRIYA = 'usr_qa';

test.describe('assigning from the board', () => {
  test('assigns an unassigned card to someone', async ({ api, boardPage, tempIssue, toast }) => {
    await boardPage.goto();
    await expect(boardPage.assigneeSelect(tempIssue.key)).toHaveValue('');

    await boardPage.assign(tempIssue.key, MARCO);

    await expect(toast).toContainText(`${tempIssue.key} assigned to Marco Reyes.`);
    await expect(boardPage.assigneeSelect(tempIssue.key)).toHaveValue(MARCO);
    expect((await api.getIssue(tempIssue.key)).assignee?.name).toBe('Marco Reyes');
  });

  test('hands a card from one person to another', async ({ api, boardPage, tempIssue }) => {
    await api.updateIssue(tempIssue.key, { assigneeId: MARCO });
    await boardPage.goto();

    await boardPage.assign(tempIssue.key, PRIYA);

    await expect(boardPage.assigneeSelect(tempIssue.key)).toHaveValue(PRIYA);
    expect((await api.getIssue(tempIssue.key)).assignee?.name).toBe('Priya Natarajan');
  });

  test('takes the assignment away again', async ({ api, boardPage, tempIssue, toast }) => {
    await api.updateIssue(tempIssue.key, { assigneeId: MARCO });
    await boardPage.goto();

    await boardPage.assign(tempIssue.key, '');

    await expect(toast).toContainText(`${tempIssue.key} unassigned.`);
    expect((await api.getIssue(tempIssue.key)).assigneeId).toBeNull();
  });

  test('offers only the project’s own members', async ({ boardPage, tempIssue }) => {
    await boardPage.goto();

    const options = await boardPage.assigneeSelect(tempIssue.key).getByRole('option').allTextContents();

    expect(options).toContain('Unassigned');
    expect(options).toContain('Jonas Lindqvist');
    expect(options, 'everyone is on the WEB project').toHaveLength(5);
  });

  test('the change survives a reload', async ({ boardPage, tempIssue, page }) => {
    await boardPage.goto();
    await boardPage.assign(tempIssue.key, PRIYA);
    await expect(boardPage.assigneeSelect(tempIssue.key)).toHaveValue(PRIYA);

    await page.reload();

    await expect(boardPage.assigneeSelect(tempIssue.key)).toHaveValue(PRIYA);
  });
});

test.describe('assigning from the issue list', () => {
  test('assigns a row without opening it', async ({ api, issuesPage, tempIssue, toast }) => {
    await issuesPage.goto();
    await issuesPage.searchFor(tempIssue.title);

    await issuesPage.assign(tempIssue.key, MARCO);

    await expect(toast).toContainText('assigned to Marco Reyes');
    await expect(issuesPage.assigneeSelect(tempIssue.key)).toHaveValue(MARCO);
    expect((await api.getIssue(tempIssue.key)).assigneeId).toBe(MARCO);
  });

  test('leaves the rest of the row alone', async ({ issuesPage, tempIssue }) => {
    await issuesPage.goto();
    await issuesPage.searchFor(tempIssue.title);
    const row = issuesPage.row(tempIssue.key);

    await issuesPage.assign(tempIssue.key, PRIYA);

    await expect(issuesPage.assigneeSelect(tempIssue.key)).toHaveValue(PRIYA);
    await expect(row.getByTestId('row-title')).toContainText(tempIssue.title);
    await expect(row.getByTestId('status-badge')).toHaveAttribute('data-status', tempIssue.status);
  });

  test('reports a rejected change instead of showing it as applied', async ({ issuesPage, tempIssue, page, toast }) => {
    await issuesPage.goto();
    await issuesPage.searchFor(tempIssue.title);

    await page.route(`**/api/issues/${tempIssue.key}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'The request body is invalid.',
                details: [{ path: 'assigneeId', message: 'Marco Reyes is not a member of WEB.' }],
              },
            }),
          })
        : route.continue(),
    );

    await issuesPage.assign(tempIssue.key, MARCO);

    await expect(toast).toContainText('is not a member of WEB');
    await expect(issuesPage.assigneeSelect(tempIssue.key)).toHaveValue('');
  });

  test('an issue in another project offers that project’s members', async ({ api, issuesPage }) => {
    const issue = await api.createIssue({ title: uniqueTitle('Mobile work') }, 'MOB');

    try {
      await issuesPage.goto('', 'MOB');
      await issuesPage.searchFor(issue.title);

      const options = await issuesPage.assigneeSelect(issue.key).getByRole('option').allTextContents();

      expect(options).toContain('Jonas Lindqvist');
      expect(options, 'Marco is not on the mobile project').not.toContain('Marco Reyes');
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });
});

test.describe('changing priority in place', () => {
  test('raises the priority from a board card', async ({ api, boardPage, tempIssue, toast }) => {
    await boardPage.goto();
    await expect(boardPage.prioritySelect(tempIssue.key)).toHaveValue('medium');

    await boardPage.setPriority(tempIssue.key, 'critical');

    await expect(toast).toContainText(`${tempIssue.key} set to Critical priority.`);
    await expect(boardPage.prioritySelect(tempIssue.key)).toHaveValue('critical');
    expect((await api.getIssue(tempIssue.key)).priority).toBe('critical');
  });

  test('the badge beside the control follows the new value', async ({ boardPage, tempIssue }) => {
    await boardPage.goto();

    await boardPage.setPriority(tempIssue.key, 'low');

    await expect(boardPage.card(tempIssue.key).getByTestId('priority-badge')).toHaveAttribute(
      'data-priority',
      'low',
    );
  });

  test('lowers the priority from the issue list', async ({ api, issuesPage, tempIssue }) => {
    await issuesPage.goto();
    await issuesPage.searchFor(tempIssue.title);

    await issuesPage.setPriority(tempIssue.key, 'low');

    await expect(issuesPage.prioritySelect(tempIssue.key)).toHaveValue('low');
    expect((await api.getIssue(tempIssue.key)).priority).toBe('low');
  });

  test('a change made on the list shows on the board', async ({ issuesPage, boardPage, tempIssue }) => {
    await issuesPage.goto();
    await issuesPage.searchFor(tempIssue.title);
    await issuesPage.setPriority(tempIssue.key, 'high');
    await expect(issuesPage.prioritySelect(tempIssue.key)).toHaveValue('high');

    await boardPage.goto();

    await expect(boardPage.prioritySelect(tempIssue.key)).toHaveValue('high');
  });

  test('the priority filter picks the card up at its new level', async ({ boardPage, tempIssue }) => {
    await boardPage.goto();
    await boardPage.setPriority(tempIssue.key, 'critical');
    await expect(boardPage.prioritySelect(tempIssue.key)).toHaveValue('critical');

    await boardPage.filterByPriority('critical');

    await expect(boardPage.card(tempIssue.key)).toBeVisible();
  });
});
