import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { oversizedFile, tempFile } from '../../src/support/files.js';

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

test.describe('attaching files while creating an issue', () => {
  test('attaches a file to the new issue', async ({ api, newIssuePage, issueDetail, page, toast }) => {
    const title = uniqueTitle('With an attachment');
    const path = tempFile('steps-to-reproduce.txt', 'open the app, watch it break');

    await test.step('choose a file before submitting', async () => {
      await newIssuePage.goto();
      await newIssuePage.fill({ title, files: [path] });
      await expect(newIssuePage.pendingAttachment('steps-to-reproduce.txt')).toBeVisible();
      await expect(newIssuePage.pendingAttachmentsEmpty).toHaveCount(0);
    });

    await test.step('submit, and the file follows the issue', async () => {
      await newIssuePage.submitForm();
      await expect(page).toHaveURL(/\/issues\/BUG-\d+$/);
      await expect(toast).toContainText('created with 1 file attached');
      await expect(issueDetail.attachment('steps-to-reproduce.txt')).toBeVisible();
    });

    const key = (await issueDetail.key.textContent())!;

    await test.step('the attachment is really on the server', async () => {
      expect((await api.getIssue(key)).attachmentCount).toBe(1);
    });

    await api.deleteIssueIfPresent(key);
  });

  test('attaches several files at once', async ({ api, newIssuePage, issueDetail, toast }) => {
    const title = uniqueTitle('Two attachments');
    const paths = [tempFile('first.txt', 'one'), tempFile('second.csv', 'a,b\n1,2\n')];

    await newIssuePage.goto();
    await newIssuePage.create({ title, files: paths });

    await expect(toast).toContainText('created with 2 files attached');
    await expect(issueDetail.attachment('first.txt')).toBeVisible();
    await expect(issueDetail.attachment('second.csv')).toBeVisible();

    const key = (await issueDetail.key.textContent())!;
    expect((await api.getIssue(key)).attachmentCount).toBe(2);
    await api.deleteIssueIfPresent(key);
  });

  test('rejects a file over the size limit without creating anything', async ({
    api,
    newIssuePage,
    issueDetail,
    page,
  }) => {
    const title = uniqueTitle('Oversized');
    await newIssuePage.goto();

    await test.step('the file is refused as soon as it is chosen', async () => {
      await newIssuePage.attachFiles([oversizedFile()]);
      await expect(newIssuePage.attachmentError).toContainText('The limit is 2.0 MB.');
      await expect(newIssuePage.pendingAttachmentsEmpty).toBeVisible();
      await expect(page, 'nothing should have been submitted yet').toHaveURL(/\/issues\/new$/);
    });

    await test.step('the issue can still be created, with nothing attached', async () => {
      await newIssuePage.fill({ title });
      await newIssuePage.submitForm();
      const key = (await issueDetail.key.textContent())!;
      expect((await api.getIssue(key)).attachmentCount).toBe(0);
      await api.deleteIssueIfPresent(key);
    });
  });

  test('rejects an unsupported file type', async ({ newIssuePage }) => {
    await newIssuePage.goto();

    await newIssuePage.attachFiles([tempFile('installer.exe', 'MZ')]);

    await expect(newIssuePage.attachmentError).toContainText('not a supported file type');
    await expect(newIssuePage.pendingAttachmentsEmpty).toBeVisible();
  });

  test('a file can be removed before submitting', async ({ api, newIssuePage, issueDetail }) => {
    const title = uniqueTitle('Changed my mind');
    const paths = [tempFile('keep.txt', 'keep'), tempFile('drop.txt', 'drop')];

    await newIssuePage.goto();
    await newIssuePage.fill({ title, files: paths });
    await expect(newIssuePage.pendingAttachment('drop.txt')).toBeVisible();

    await newIssuePage.removePending('drop.txt');

    await expect(newIssuePage.pendingAttachment('drop.txt')).toHaveCount(0);
    await expect(newIssuePage.pendingAttachment('keep.txt')).toBeVisible();

    await newIssuePage.submitForm();
    await expect(issueDetail.attachment('keep.txt')).toBeVisible();

    const key = (await issueDetail.key.textContent())!;
    expect((await api.getIssue(key)).attachmentCount).toBe(1);
    await api.deleteIssueIfPresent(key);
  });

  test('still opens the issue when an upload fails after it was created', async ({
    api,
    newIssuePage,
    issueDetail,
    page,
    toast,
  }) => {
    const title = uniqueTitle('Upload fails late');
    // Break only the upload. The detail page lists attachments from the same
    // path, and failing that too would mask the behaviour under test.
    await page.route('**/attachments', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );

    await newIssuePage.goto();
    await newIssuePage.create({ title, files: [tempFile('doomed.txt', 'never lands')] });

    await test.step('the failure is reported as an attachment problem, not a failed creation', async () => {
      await expect(toast).toContainText('created, but 1 file could not be attached');
      await expect(page).toHaveURL(/\/issues\/BUG-\d+$/);
    });

    const key = (await issueDetail.key.textContent())!;
    expect((await api.getIssue(key)).attachmentCount).toBe(0);
    await api.deleteIssueIfPresent(key);
  });
});
