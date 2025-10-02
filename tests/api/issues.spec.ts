import { errorSchema, issueSchema } from '../../src/api/schemas.js';
import { expect, test } from '../../src/fixtures/index.js';
import { uniqueLabel, uniqueTitle } from '../../src/support/data.js';

test.describe('issue lifecycle', () => {
  test('creates, reads, updates and deletes an issue', async ({ api }) => {
    const title = uniqueTitle('Lifecycle');

    const created = await test.step('create the issue', async () => {
      const issue = await api.createIssue({ title, type: 'bug', priority: 'high', labels: ['api'] });
      expect(issue.key).toMatch(/^WEB-\d+$/);
      expect(issue.status, 'a new issue starts in the backlog').toBe('backlog');
      expect(issue.reporter?.email).toBe(api.user.email);
      return issue;
    });

    await test.step('read it back', async () => {
      expect(await api.getIssue(created.key)).toEqual(created);
    });

    await test.step('update two fields', async () => {
      const updated = await api.updateIssue(created.key, { priority: 'critical', title: `${title} (edited)` });
      expect(updated.priority).toBe('critical');
      expect(updated.title).toBe(`${title} (edited)`);
      expect(
        Date.parse(updated.updatedAt),
        'updatedAt should move forward on every change',
      ).toBeGreaterThanOrEqual(Date.parse(created.updatedAt));
    });

    await test.step('delete it', async () => {
      await api.deleteIssue(created.key);
      expect((await api.getIssueRaw(created.key)).status()).toBe(404);
    });
  });

  test('looks an issue up by key or by id', async ({ tempIssue, api }) => {
    const byKey = await api.getIssue(tempIssue.key);
    const byId = await api.getIssue(tempIssue.id);

    expect(byKey.id).toBe(byId.id);
  });

  test('deleting an issue removes its comments too', async ({ api }) => {
    const issue = await api.createIssue({ title: uniqueTitle('Cascade') });
    const comment = await api.addComment(issue.key, 'This should not outlive its issue.');

    await api.deleteIssue(issue.key);

    const response = await api.getIssueRaw(issue.key);
    expect(response.status()).toBe(404);
    expect(comment.issueId).toBe(issue.id);
  });

  test('returns 404 for a key that does not exist', async ({ api }) => {
    const response = await api.getIssueRaw('WEB-999999');

    expect(response.status()).toBe(404);
    const body = errorSchema.parse(await response.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('WEB-999999');
  });
});

test.describe('GET /api/issues', () => {
  test('pages through results and reports totals', async ({ api }) => {
    // Oldest first: specs running in parallel append new issues at the end, so
    // the first two pages stay stable for the length of this test.
    const order = { sort: 'createdAt', order: 'asc' } as const;

    const first = await test.step('fetch page 1', async () => {
      const page = await api.listIssues({ ...order, page: 1, pageSize: 5 });
      expect(page.items).toHaveLength(5);
      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(5);
      expect(page.totalPages).toBe(Math.ceil(page.total / 5));
      return page;
    });

    await test.step('fetch page 2 and check it does not repeat page 1', async () => {
      const second = await api.listIssues({ ...order, page: 2, pageSize: 5 });
      const overlap = second.items.filter((issue) => first.items.some((other) => other.id === issue.id));
      expect(overlap, 'pages must not repeat issues').toHaveLength(0);
    });
  });

  test('caps pageSize at 100', async ({ api }) => {
    const response = await api.listIssues({ pageSize: 100 });
    expect(response.pageSize).toBe(100);
  });

  test('filters by a label that only this test uses', async ({ api }) => {
    const label = uniqueLabel();
    const issue = await api.createIssue({ title: uniqueTitle('Labelled'), labels: [label] });

    try {
      const result = await api.listIssues({ label });
      expect(result.total).toBe(1);
      expect(result.items[0]?.key).toBe(issue.key);
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('filters by status and type together', async ({ api }) => {
    const result = await api.listIssues({ status: 'done', type: 'task', pageSize: 100 });

    expect(result.items.length).toBeGreaterThan(0);
    for (const issue of result.items) {
      expect(issue.status).toBe('done');
      expect(issue.type).toBe('task');
    }
  });

  test('accepts comma separated values for a filter', async ({ api }) => {
    const result = await api.listIssues({ priority: 'critical,high', pageSize: 100 });

    expect(result.items.length).toBeGreaterThan(0);
    for (const issue of result.items) {
      expect(['critical', 'high']).toContain(issue.priority);
    }
  });

  test('searches across key, title and description', async ({ api }) => {
    const marker = uniqueTitle('Needle');
    const issue = await api.createIssue({ title: 'An ordinary title', description: `Contains ${marker}` });

    try {
      await test.step('a term in the description matches', async () => {
        const result = await api.listIssues({ q: marker });
        expect(result.items.map((item) => item.key)).toEqual([issue.key]);
      });

      await test.step('the issue key matches', async () => {
        const result = await api.listIssues({ q: issue.key });
        expect(result.items.map((item) => item.key)).toContain(issue.key);
      });
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('returns an empty page rather than an error when nothing matches', async ({ api }) => {
    const result = await api.listIssues({ q: 'zzz-no-issue-says-this-zzz' });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  test('sorts by priority ascending', async ({ api }) => {
    const rank = { low: 0, medium: 1, high: 2, critical: 3 };
    const result = await api.listIssues({ sort: 'priority', order: 'asc', pageSize: 100 });

    const ranks = result.items.map((issue) => rank[issue.priority]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test('every item matches the documented issue shape', async ({ api }) => {
    const result = await api.listIssues({ pageSize: 100 });

    for (const issue of result.items) {
      expect(() => issueSchema.parse(issue)).not.toThrow();
    }
  });
});

test.describe('POST /api/issues/:key/move', () => {
  test('moves an issue to another column and renumbers positions', async ({ api, tempIssue }) => {
    await test.step('move it to the top of In review', async () => {
      const moved = await api.moveIssue(tempIssue.key, 'in_review', 0);
      expect(moved.status).toBe('in_review');
      expect(moved.position).toBe(0);
    });

    await test.step('the column reflects the move and stays densely ordered', async () => {
      const column = (await api.getBoard()).columns.find((c) => c.status === 'in_review');
      expect(column?.issues[0]?.key).toBe(tempIssue.key);
      expect(
        column?.issues.map((issue) => issue.position),
        'positions stay a dense 0..n-1 sequence',
      ).toEqual(column?.issues.map((_, index) => index));
    });
  });

  test('a position past the end of the column lands the issue last', async ({ api, tempIssue }) => {
    const moved = await api.moveIssue(tempIssue.key, 'todo', 9999);

    const column = (await api.getBoard()).columns.find((c) => c.status === 'todo');
    expect(column?.issues.at(-1)?.key).toBe(tempIssue.key);
    expect(moved.position).toBe((column?.issues.length ?? 1) - 1);
  });

  test('rejects an unknown status', async ({ api, tempIssue, request }) => {
    const response = await request.post(`/api/issues/${tempIssue.key}/move`, {
      headers: { Authorization: `Bearer ${api.token}` },
      data: { status: 'shipped' },
    });

    expect(response.status()).toBe(400);
    const body = errorSchema.parse(await response.json());
    expect(body.error.details?.[0]).toEqual({ path: 'status', message: 'Unknown status.' });
  });
});
