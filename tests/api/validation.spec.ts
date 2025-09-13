import { errorSchema } from '../../src/api/schemas.js';
import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';

test.describe('request validation', () => {
  test('reports every invalid field at once, not just the first', async ({ api }) => {
    const response = await api.createIssueRaw({ title: 'no', type: 'epic', priority: 'urgent' });

    expect(response.status()).toBe(400);
    const body = errorSchema.parse(await response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.map((detail) => detail.path).sort()).toEqual(['priority', 'title', 'type']);
  });

  test('rejects a title under the minimum length', async ({ api }) => {
    const response = await api.createIssueRaw({ title: 'abcd', type: 'bug' });

    expect(response.status()).toBe(400);
    const body = errorSchema.parse(await response.json());
    expect(body.error.details).toContainEqual({
      path: 'title',
      message: 'Title must be at least 5 characters.',
    });
  });

  test('rejects a title over the maximum length', async ({ api }) => {
    const response = await api.createIssueRaw({ title: 'x'.repeat(121), type: 'bug' });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'title',
      message: 'Title must be 120 characters or fewer.',
    });
  });

  test('accepts a title exactly at each boundary', async ({ api }) => {
    const shortest = await api.createIssue({ title: 'abcde' });
    const longest = await api.createIssue({ title: 'y'.repeat(120) });

    expect(shortest.title).toBe('abcde');
    expect(longest.title).toHaveLength(120);

    await api.deleteIssueIfPresent(shortest.key);
    await api.deleteIssueIfPresent(longest.key);
  });

  test('rejects more than five labels', async ({ api }) => {
    const response = await api.createIssueRaw({
      title: uniqueTitle('Too many labels'),
      type: 'bug',
      labels: ['a', 'b', 'c', 'd', 'e', 'f'],
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'labels',
      message: 'An issue can carry at most 5 labels.',
    });
  });

  test('rejects an assignee that does not exist', async ({ api }) => {
    const response = await api.createIssueRaw({
      title: uniqueTitle('Ghost assignee'),
      type: 'bug',
      assigneeId: 'usr_does_not_exist',
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'assigneeId',
      message: 'No user matches that id.',
    });
  });

  test('a PATCH validates the fields it is given and ignores the rest', async ({ api, tempIssue }) => {
    const invalid = await api.updateIssueRaw(tempIssue.key, { priority: 'whenever' });
    expect(invalid.status()).toBe(400);

    const valid = await api.updateIssue(tempIssue.key, { priority: 'low' });
    expect(valid.priority).toBe('low');
    expect(valid.title, 'fields left out of a PATCH stay untouched').toBe(tempIssue.title);
  });

  test('rejects a comment that is too short', async ({ api, tempIssue }) => {
    const response = await api.addCommentRaw(tempIssue.key, { body: 'x' });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'body',
      message: 'A comment needs at least 2 characters.',
    });
  });

  test('trims whitespace before storing a title', async ({ api }) => {
    const issue = await api.createIssue({ title: '   Padded title   ' });

    expect(issue.title).toBe('Padded title');
    await api.deleteIssueIfPresent(issue.key);
  });
});
