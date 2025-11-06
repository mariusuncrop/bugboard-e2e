import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { PROJECTS } from '../../src/support/env.js';

test.describe('putting an issue under another', () => {
  test('a child knows its parent, and a parent counts its children', async ({ api }) => {
    const parent = await api.createIssue({ title: uniqueTitle('Parent') });
    const child = await api.createIssue({ title: uniqueTitle('Child'), parentId: parent.key });

    try {
      expect(child.parent?.key).toBe(parent.key);
      expect(child.ancestors.map((a) => a.key)).toEqual([parent.key]);
      expect((await api.getIssue(parent.key)).childCount).toBe(1);
      expect((await api.listChildren(parent.key)).map((issue) => issue.key)).toEqual([child.key]);
    } finally {
      await api.deleteIssueIfPresent(child.key);
      await api.deleteIssueIfPresent(parent.key);
    }
  });

  test('a parent can be set and cleared afterwards', async ({ api, tempIssue }) => {
    const parent = await api.createIssue({ title: uniqueTitle('Later parent') });

    try {
      const attached = await api.updateIssue(tempIssue.key, { parentId: parent.key });
      expect(attached.parent?.key).toBe(parent.key);

      const detached = await api.updateIssue(tempIssue.key, { parentId: null });
      expect(detached.parent).toBeNull();
      expect((await api.getIssue(parent.key)).childCount).toBe(0);
    } finally {
      await api.deleteIssueIfPresent(parent.key);
    }
  });

  test('the chain of ancestors is reported nearest first', async ({ api }) => {
    const grandparent = await api.createIssue({ title: uniqueTitle('Grandparent') });
    const parent = await api.createIssue({ title: uniqueTitle('Middle'), parentId: grandparent.key });
    const child = await api.createIssue({ title: uniqueTitle('Leaf'), parentId: parent.key });

    try {
      const fetched = await api.getIssue(child.key);

      expect(fetched.ancestors.map((a) => a.key)).toEqual([parent.key, grandparent.key]);
    } finally {
      for (const issue of [child, parent, grandparent]) await api.deleteIssueIfPresent(issue.key);
    }
  });
});

test.describe('relationships that would make a loop', () => {
  test('an issue cannot be its own parent', async ({ api, tempIssue }) => {
    const response = await api.updateIssueRaw(tempIssue.key, { parentId: tempIssue.key });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'parentId',
      message: 'An issue cannot be its own parent.',
    });
  });

  test('a parent cannot be moved under its own child', async ({ api }) => {
    const parent = await api.createIssue({ title: uniqueTitle('Would-be loop') });
    const child = await api.createIssue({ title: uniqueTitle('Its child'), parentId: parent.key });

    try {
      const response = await api.updateIssueRaw(parent.key, { parentId: child.key });

      expect(response.status()).toBe(400);
      expect((await response.json()).error.details?.[0]?.message).toContain('already sits beneath');
    } finally {
      await api.deleteIssueIfPresent(child.key);
      await api.deleteIssueIfPresent(parent.key);
    }
  });

  test('nor under a grandchild, two levels down', async ({ api }) => {
    const top = await api.createIssue({ title: uniqueTitle('Top') });
    const middle = await api.createIssue({ title: uniqueTitle('Middle'), parentId: top.key });
    const bottom = await api.createIssue({ title: uniqueTitle('Bottom'), parentId: middle.key });

    try {
      const response = await api.updateIssueRaw(top.key, { parentId: bottom.key });

      expect(response.status(), 'the walk up has to look past the first step').toBe(400);
    } finally {
      for (const issue of [bottom, middle, top]) await api.deleteIssueIfPresent(issue.key);
    }
  });
});

test.describe('parents across projects and lifetimes', () => {
  test('a parent has to be in the same project', async ({ api, tempIssue }) => {
    const elsewhere = await api.createIssue({ title: uniqueTitle('Far away') }, PROJECTS.withoutMember);

    try {
      const response = await api.updateIssueRaw(tempIssue.key, { parentId: elsewhere.key });

      expect(response.status()).toBe(400);
      expect((await response.json()).error.details?.[0]?.message).toContain('another project');
    } finally {
      await api.deleteIssueIfPresent(elsewhere.key);
    }
  });

  test('rejects a parent that does not exist', async ({ api, tempIssue }) => {
    const response = await api.updateIssueRaw(tempIssue.key, { parentId: 'WEB-999999' });

    expect(response.status()).toBe(400);
  });

  test('deleting a parent frees its children rather than taking them down', async ({ api }) => {
    const parent = await api.createIssue({ title: uniqueTitle('Doomed parent') });
    const child = await api.createIssue({ title: uniqueTitle('Surviving child'), parentId: parent.key });

    try {
      await api.deleteIssue(parent.key);

      const orphan = await api.getIssue(child.key);
      expect(orphan.parent, 'the child outlives its parent').toBeNull();
      expect(orphan.ancestors).toEqual([]);
    } finally {
      await api.deleteIssueIfPresent(child.key);
    }
  });
});
