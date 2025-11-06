import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';

test.describe('subtasks on the issue page', () => {
  test('adds one, and it belongs to the same project', async ({ api, issueDetail, tempIssue, toast }) => {
    await issueDetail.goto(tempIssue.key);
    await expect(issueDetail.subtasksEmpty).toBeVisible();

    await issueDetail.addSubtask('Write the migration script');

    await expect(toast).toContainText(`added under ${tempIssue.key}`);
    await expect(issueDetail.subtaskRows()).toHaveCount(1);

    const [child] = await api.listChildren(tempIssue.key);
    expect(child!.parent?.key).toBe(tempIssue.key);
    expect(child!.project?.key).toBe(tempIssue.project?.key);
    await api.deleteIssueIfPresent(child!.key);
  });

  test('counts how many are finished', async ({ api, issueDetail, tempIssue }) => {
    const first = await api.createIssue({ title: uniqueTitle('Done one'), parentId: tempIssue.key, status: 'done' });
    const second = await api.createIssue({ title: uniqueTitle('Open one'), parentId: tempIssue.key });

    try {
      await issueDetail.goto(tempIssue.key);

      await expect(issueDetail.subtaskProgress).toHaveText('(1/2)');
    } finally {
      await api.deleteIssueIfPresent(first.key);
      await api.deleteIssueIfPresent(second.key);
    }
  });

  test('a subtask carries its own status and priority', async ({ api, issueDetail, tempIssue }) => {
    const child = await api.createIssue({
      title: uniqueTitle('Detailed child'),
      parentId: tempIssue.key,
      status: 'in_review',
      priority: 'critical',
    });

    try {
      await issueDetail.goto(tempIssue.key);

      const row = issueDetail.subtask(child.key);
      await expect(row.getByTestId('status-badge')).toHaveAttribute('data-status', 'in_review');
      await expect(row.getByTestId('priority-badge')).toHaveAttribute('data-priority', 'critical');
    } finally {
      await api.deleteIssueIfPresent(child.key);
    }
  });

  test('opens a subtask, which shows its parent in the breadcrumb', async ({
    api,
    issueDetail,
    tempIssue,
    page,
  }) => {
    const child = await api.createIssue({ title: uniqueTitle('Openable child'), parentId: tempIssue.key });

    try {
      await issueDetail.goto(tempIssue.key);

      await issueDetail.subtask(child.key).getByTestId('subtask-key').click();

      await expect(page).toHaveURL(new RegExp(`/issues/${child.key}$`));
      await expect(issueDetail.ancestor(tempIssue.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(child.key);
    }
  });

  test('the breadcrumb walks back up more than one level', async ({ api, issueDetail }) => {
    const top = await api.createIssue({ title: uniqueTitle('Top level') });
    const middle = await api.createIssue({ title: uniqueTitle('Middle level'), parentId: top.key });
    const bottom = await api.createIssue({ title: uniqueTitle('Bottom level'), parentId: middle.key });

    try {
      await issueDetail.goto(bottom.key);

      await expect(issueDetail.ancestor(top.key)).toBeVisible();
      await expect(issueDetail.ancestor(middle.key)).toBeVisible();
    } finally {
      for (const issue of [bottom, middle, top]) await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('detaches a subtask without deleting it', async ({ api, issueDetail, tempIssue, toast }) => {
    const child = await api.createIssue({ title: uniqueTitle('To be freed'), parentId: tempIssue.key });

    try {
      await issueDetail.goto(tempIssue.key);
      await expect(issueDetail.subtask(child.key)).toBeVisible();

      await issueDetail.detachSubtask(child.key);

      await expect(toast).toContainText('no longer a subtask');
      await expect(issueDetail.subtasksEmpty).toBeVisible();
      expect((await api.getIssue(child.key)).parent, 'the issue still exists').toBeNull();
    } finally {
      await api.deleteIssueIfPresent(child.key);
    }
  });

  test('will not add a subtask with too short a title', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.subtaskTitle.fill('abc');

    await expect(issueDetail.addSubtaskButton).toBeDisabled();
  });

  test('a subtask appears on the board like any other issue', async ({ api, boardPage, tempIssue }) => {
    const child = await api.createIssue({ title: uniqueTitle('Board child'), parentId: tempIssue.key });

    try {
      await boardPage.goto();

      await expect(boardPage.card(child.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(child.key);
    }
  });
});
