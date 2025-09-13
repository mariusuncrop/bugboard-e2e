import { errorSchema } from '../../src/api/schemas.js';
import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';

test.describe('role based permissions', () => {
  test('a member cannot delete an issue', async ({ memberApi, tempIssue }) => {
    const response = await memberApi.deleteIssueRaw(tempIssue.key);

    expect(response.status()).toBe(403);
    const body = errorSchema.parse(await response.json());
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('admin');
  });

  test('an admin can delete an issue', async ({ api }) => {
    const issue = await api.createIssue({ title: uniqueTitle('Deletable') });

    const response = await api.deleteIssueRaw(issue.key);

    expect(response.status()).toBe(204);
  });

  test('a member can still create and update issues', async ({ memberApi }) => {
    const issue = await memberApi.createIssue({ title: uniqueTitle('Member created') });
    const updated = await memberApi.updateIssue(issue.key, { status: 'todo' });

    expect(updated.status).toBe('todo');
    expect(issue.reporter?.email).toBe(memberApi.user.email);

    // Cleanup needs the admin role.
    const admin = await (await import('../../src/api/client.js')).ApiClient.asAdmin();
    await admin.deleteIssueIfPresent(issue.key);
    await admin.dispose();
  });

  test('a member cannot delete someone else’s comment', async ({ api, memberApi, tempIssue, request }) => {
    const comment = await api.addComment(tempIssue.key, 'Written by the admin.');

    const response = await request.delete(`/api/comments/${comment.id}`, {
      headers: { Authorization: `Bearer ${memberApi.token}` },
    });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.message).toBe('You can only delete your own comments.');
  });

  test('an author can delete their own comment', async ({ memberApi, tempIssue, request }) => {
    const comment = await memberApi.addComment(tempIssue.key, 'Written by a member.');

    const response = await request.delete(`/api/comments/${comment.id}`, {
      headers: { Authorization: `Bearer ${memberApi.token}` },
    });

    expect(response.status()).toBe(204);
  });

  test('an admin can delete anyone’s comment', async ({ api, memberApi, tempIssue, request }) => {
    const comment = await memberApi.addComment(tempIssue.key, 'Written by a member, removed by an admin.');

    const response = await request.delete(`/api/comments/${comment.id}`, {
      headers: { Authorization: `Bearer ${api.token}` },
    });

    expect(response.status()).toBe(204);
  });
});
