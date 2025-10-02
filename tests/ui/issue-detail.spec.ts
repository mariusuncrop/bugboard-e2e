import { expect, test } from '../../src/fixtures/index.js';
import { STORAGE_STATE } from '../../src/support/env.js';

test.describe('issue detail', () => {
  test('shows the issue, its comments and its metadata', async ({ api, issueDetail }) => {
    const issue = await api.getIssue('WEB-1');
    const comments = await api.listComments('WEB-1');

    await issueDetail.goto('WEB-1');

    await expect(issueDetail.key).toHaveText('WEB-1');
    await expect(issueDetail.title).toHaveText(issue.title);
    await expect(issueDetail.statusSelect).toHaveValue(issue.status);
    await expect(issueDetail.prioritySelect).toHaveValue(issue.priority);
    await expect(issueDetail.comments).toHaveCount(comments.length);
  });

  test('changes the status and persists it', async ({ api, issueDetail, tempIssue, toast }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.setStatus('in_review');

    await expect(toast).toContainText('Status updated.');
    await expect(issueDetail.statusBadge).toHaveAttribute('data-status', 'in_review');
    expect((await api.getIssue(tempIssue.key)).status).toBe('in_review');
  });

  test('changes the priority', async ({ api, issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.setPriority('critical');

    await expect(issueDetail.prioritySelect).toHaveValue('critical');
    expect((await api.getIssue(tempIssue.key)).priority).toBe('critical');
  });

  test('assigns and then unassigns the issue', async ({ api, issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await test.step('assign it to someone', async () => {
      await issueDetail.assignTo('Marco Reyes');
      await expect(issueDetail.assignee).toContainText('Marco Reyes');
      expect((await api.getIssue(tempIssue.key)).assignee?.name).toBe('Marco Reyes');
    });

    await test.step('take the assignment away again', async () => {
      await issueDetail.assignTo('Unassigned');
      await expect(issueDetail.assignee).toContainText('Unassigned');
      expect((await api.getIssue(tempIssue.key)).assigneeId).toBeNull();
    });
  });

  test('adds a comment and clears the box', async ({ api, issueDetail, tempIssue, toast }) => {
    await issueDetail.goto(tempIssue.key);
    await expect(issueDetail.commentList).toContainText('No comments yet.');

    await issueDetail.addComment('Reproduced on the latest build.');

    await expect(toast).toContainText('Comment added.');
    await expect(issueDetail.commentWithText('Reproduced on the latest build.')).toBeVisible();
    await expect(issueDetail.commentBody).toHaveValue('');
    expect(await api.listComments(tempIssue.key)).toHaveLength(1);
  });

  test('rejects a comment that is too short', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.addComment('x');

    await expect(issueDetail.commentError).toHaveText('A comment needs at least 2 characters.');
    await expect(issueDetail.comments).toHaveCount(0);
  });

  test('deletes a comment the signed-in user wrote', async ({ api, issueDetail, tempIssue }) => {
    const comment = await api.addComment(tempIssue.key, 'Written over the API, removed through the UI.');
    await issueDetail.goto(tempIssue.key);

    await issueDetail.page.getByTestId(`delete-comment-${comment.id}`).click();

    await expect(issueDetail.comments).toHaveCount(0);
    expect(await api.listComments(tempIssue.key)).toHaveLength(0);
  });

  test('shows a not-found page for an unknown key', async ({ page, issueDetail }) => {
    await page.goto('/projects/web/issues/WEB-999999');

    await expect(issueDetail.notFound).toBeVisible();
    await expect(issueDetail.notFound).toContainText('WEB-999999');
  });
});

test.describe('deleting an issue', () => {
  test('asks for confirmation and can be cancelled', async ({ api, issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await test.step('the delete button opens a modal dialog', async () => {
      await issueDetail.deleteButton.click();
      await expect(issueDetail.confirmDialog).toBeVisible();
      await expect(issueDetail.confirmDialog).toHaveAttribute('aria-modal', 'true');
    });

    await test.step('cancelling closes it and leaves the issue alone', async () => {
      await issueDetail.confirmCancel.click();
      await expect(issueDetail.confirmDialog).toBeHidden();
      expect((await api.getIssueRaw(tempIssue.key)).status()).toBe(200);
    });
  });

  test('closes the dialog on Escape', async ({ issueDetail, tempIssue, page }) => {
    await issueDetail.goto(tempIssue.key);
    await issueDetail.deleteButton.click();

    await page.keyboard.press('Escape');

    await expect(issueDetail.confirmDialog).toBeHidden();
  });

  test('deletes the issue and returns to the list', async ({ api, issueDetail, tempIssue, page }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.deleteIssue();

    await expect(page).toHaveURL(/\/issues$/);
    expect((await api.getIssueRaw(tempIssue.key)).status()).toBe(404);
  });
});

test.describe('as a member', () => {
  test.use({ storageState: STORAGE_STATE.member });

  test('the delete button is replaced by an explanation', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await expect(issueDetail.deleteButton).toHaveCount(0);
    await expect(issueDetail.deleteHint).toHaveText('Only admins can delete issues.');
  });

  test('a member can still change the status', async ({ api, issueDetail, tempIssue, toast }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.setStatus('todo');

    // Wait for the UI to confirm the write before asking the API about it —
    // otherwise this races the request the click just started.
    await expect(toast).toContainText('Status updated.');
    expect((await api.getIssue(tempIssue.key)).status).toBe('todo');
  });
});
