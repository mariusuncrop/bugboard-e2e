import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { PROJECTS } from '../../src/support/env.js';

/** Two throwaway issues in the same project. */
async function pair(api: { createIssue: (i: { title: string }, p?: string) => Promise<{ key: string }> }) {
  return [
    await api.createIssue({ title: uniqueTitle('Link A') }),
    await api.createIssue({ title: uniqueTitle('Link B') }),
  ] as const;
}

test.describe('linking two issues', () => {
  test('a link reads correctly from both ends', async ({ api }) => {
    const [a, b] = await pair(api);

    try {
      const link = await api.linkIssues(a.key, 'blocks', b.key);

      expect(link.wording).toBe('blocks');
      expect(link.direction).toBe('outward');
      expect(link.issue?.key).toBe(b.key);

      const [reverse] = await api.listLinks(b.key);
      expect(reverse!.wording, 'the other end reads the other way round').toBe('is blocked by');
      expect(reverse!.direction).toBe('inward');
      expect(reverse!.issue?.key).toBe(a.key);
    } finally {
      await api.deleteIssueIfPresent(a.key);
      await api.deleteIssueIfPresent(b.key);
    }
  });

  test.describe('each type has its own wording', () => {
    const cases = [
      { type: 'relates', outward: 'relates to', inward: 'relates to' },
      { type: 'blocks', outward: 'blocks', inward: 'is blocked by' },
      { type: 'duplicates', outward: 'duplicates', inward: 'is duplicated by' },
    ] as const;

    for (const { type, outward, inward } of cases) {
      test(`"${type}" reads as "${outward}" and "${inward}"`, async ({ api }) => {
        const [a, b] = await pair(api);

        try {
          const link = await api.linkIssues(a.key, type, b.key);
          expect(link.wording).toBe(outward);
          expect((await api.listLinks(b.key))[0]!.wording).toBe(inward);
        } finally {
          await api.deleteIssueIfPresent(a.key);
          await api.deleteIssueIfPresent(b.key);
        }
      });
    }
  });

  test('an issue cannot be linked to itself', async ({ api, tempIssue }) => {
    const response = await api.linkIssuesRaw(tempIssue.key, { type: 'relates', target: tempIssue.key });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'target',
      message: 'An issue cannot be linked to itself.',
    });
  });

  test('the same pair cannot be linked twice, in either direction', async ({ api }) => {
    const [a, b] = await pair(api);

    try {
      await api.linkIssues(a.key, 'relates', b.key);

      const same = await api.linkIssuesRaw(a.key, { type: 'blocks', target: b.key });
      expect(same.status()).toBe(400);

      const reversed = await api.linkIssuesRaw(b.key, { type: 'relates', target: a.key });
      expect(reversed.status(), 'the reverse pair is the same link').toBe(400);
    } finally {
      await api.deleteIssueIfPresent(a.key);
      await api.deleteIssueIfPresent(b.key);
    }
  });

  test('issues in different projects cannot be linked', async ({ api }) => {
    const here = await api.createIssue({ title: uniqueTitle('Local') }, PROJECTS.main);
    const there = await api.createIssue({ title: uniqueTitle('Elsewhere') }, PROJECTS.withoutMember);

    try {
      const response = await api.linkIssuesRaw(here.key, { type: 'relates', target: there.key });

      expect(response.status()).toBe(400);
      expect((await response.json()).error.details?.[0]?.message).toContain(PROJECTS.withoutMember);
    } finally {
      await api.deleteIssueIfPresent(here.key);
      await api.deleteIssueIfPresent(there.key);
    }
  });

  test('rejects an unknown link type', async ({ api, tempIssue }) => {
    const response = await api.linkIssuesRaw(tempIssue.key, { type: 'supersedes', target: 'WEB-1' });

    expect(response.status()).toBe(400);
  });

  test('rejects a target that does not exist', async ({ api, tempIssue }) => {
    const response = await api.linkIssuesRaw(tempIssue.key, { type: 'relates', target: 'WEB-999999' });

    expect(response.status()).toBe(404);
  });

  test('an issue in a hidden project cannot be linked to', async ({ api, memberApi }) => {
    const mine = await memberApi.createIssue({ title: uniqueTitle('Visible') });
    const hidden = (await api.listIssues({ pageSize: 1 }, PROJECTS.withoutMember)).items[0]!;

    try {
      const response = await memberApi.linkIssuesRaw(mine.key, { type: 'relates', target: hidden.key });

      expect(response.status(), 'the target is invisible, so it is a 404').toBe(404);
    } finally {
      await api.deleteIssueIfPresent(mine.key);
    }
  });
});

test.describe('the life of a link', () => {
  test('counts towards the issue it is on', async ({ api }) => {
    const [a, b] = await pair(api);

    try {
      expect((await api.getIssue(a.key)).linkCount).toBe(0);

      await api.linkIssues(a.key, 'relates', b.key);

      expect((await api.getIssue(a.key)).linkCount).toBe(1);
      expect((await api.getIssue(b.key)).linkCount, 'both ends count it').toBe(1);
    } finally {
      await api.deleteIssueIfPresent(a.key);
      await api.deleteIssueIfPresent(b.key);
    }
  });

  test('can be removed from either end', async ({ api }) => {
    const [a, b] = await pair(api);

    try {
      const link = await api.linkIssues(a.key, 'relates', b.key);

      const response = await api.unlinkRaw(link.id);

      expect(response.status()).toBe(204);
      expect(await api.listLinks(a.key)).toHaveLength(0);
      expect(await api.listLinks(b.key)).toHaveLength(0);
    } finally {
      await api.deleteIssueIfPresent(a.key);
      await api.deleteIssueIfPresent(b.key);
    }
  });

  test('deleting an issue takes its links with it', async ({ api }) => {
    const [a, b] = await pair(api);
    await api.linkIssues(a.key, 'blocks', b.key);

    await api.deleteIssue(a.key);

    expect(await api.listLinks(b.key), 'no link should point at a deleted issue').toHaveLength(0);
    await api.deleteIssueIfPresent(b.key);
  });
});
