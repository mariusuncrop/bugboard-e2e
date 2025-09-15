import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';

test.describe('creating an issue', () => {
  test('creates one and opens it', async ({ api, newIssuePage, issueDetail, page, toast }) => {
    const title = uniqueTitle('Created through the UI');

    await test.step('fill in and submit the form', async () => {
      await newIssuePage.goto();
      await newIssuePage.create({
        title,
        description: 'Filed by the end-to-end suite.',
        type: 'task',
        priority: 'high',
        status: 'todo',
        assignee: 'Priya Natarajan',
        labels: 'ui, regression',
      });
    });

    await test.step('the app navigates to the new issue and confirms it', async () => {
      await expect(page).toHaveURL(/\/issues\/TASK-\d+$/);
      await expect(toast).toContainText('created');
    });

    await test.step('the detail page shows everything that was entered', async () => {
      await expect(issueDetail.title).toHaveText(title);
      await expect(issueDetail.description).toHaveText('Filed by the end-to-end suite.');
      await expect(issueDetail.assignee).toContainText('Priya Natarajan');
      await expect(issueDetail.labels).toContainText('regression');
    });

    const key = (await issueDetail.key.textContent())!;

    await test.step('the API agrees with what the UI is showing', async () => {
      expect(await api.getIssue(key)).toMatchObject({ title, type: 'task', priority: 'high', status: 'todo' });
    });

    await api.deleteIssueIfPresent(key);
  });

  test('blocks a title that is too short, before reaching the API', async ({ newIssuePage, page }) => {
    let created = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/issues')) created += 1;
    });

    await newIssuePage.goto();
    await newIssuePage.create({ title: 'abcd' });

    await expect(newIssuePage.titleError).toHaveText('Title must be at least 5 characters.');
    expect(created).toBe(0);
    await expect(page).toHaveURL(/\/issues\/new$/);
  });

  test('surfaces a server-side field error the client did not catch', async ({ newIssuePage }) => {
    await newIssuePage.goto();

    await newIssuePage.create({
      title: uniqueTitle('Too many labels'),
      labels: 'one, two, three, four, five, six',
    });

    await expect(newIssuePage.formError).toHaveText('The request body is invalid.');
    await expect(newIssuePage.labelsError).toHaveText('An issue can carry at most 5 labels.');
  });

  test('defaults a new issue to an unassigned backlog bug', async ({ api, newIssuePage, issueDetail }) => {
    const title = uniqueTitle('Defaults');

    await test.step('the form opens with sensible defaults selected', async () => {
      await newIssuePage.goto();
      await expect(newIssuePage.type).toHaveValue('bug');
      await expect(newIssuePage.priority).toHaveValue('medium');
      await expect(newIssuePage.status).toHaveValue('backlog');
      await expect(newIssuePage.assignee).toHaveValue('');
    });

    await test.step('submitting with only a title keeps those defaults', async () => {
      await newIssuePage.create({ title });
      await expect(issueDetail.assignee).toContainText('Unassigned');
    });

    const key = (await issueDetail.key.textContent())!;
    await api.deleteIssueIfPresent(key);
  });

  test('cancelling returns to the list without creating anything', async ({ newIssuePage, page, issuesPage }) => {
    await newIssuePage.goto();
    await newIssuePage.fill({ title: uniqueTitle('Abandoned') });

    await newIssuePage.cancel.click();

    await expect(page).toHaveURL(/\/issues$/);
    await expect(issuesPage.table).toBeVisible();
  });

  test('the new issue appears on the board in the column it was filed under', async ({
    api,
    newIssuePage,
    issueDetail,
    boardPage,
  }) => {
    const title = uniqueTitle('Straight to review');
    await newIssuePage.goto();
    await newIssuePage.create({ title, status: 'in_review' });

    const key = (await issueDetail.key.textContent())!;
    await boardPage.goto();

    await expect(boardPage.column('in_review').getByTestId(`issue-card-${key}`)).toBeVisible();
    await api.deleteIssueIfPresent(key);
  });
});
