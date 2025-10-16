import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { daysFromToday, today, tomorrow, yesterday } from '../../src/support/dates.js';

test.describe('setting a deadline', () => {
  test('stores the date and works out how urgent it is', async ({ api }) => {
    const issue = await api.createIssue({ title: uniqueTitle('With a deadline'), dueOn: tomorrow() });

    expect(issue.dueOn).toBe(tomorrow());
    expect(issue.dueState).toBe('soon');
    expect(issue.daysUntilDue).toBe(1);

    await api.deleteIssueIfPresent(issue.key);
  });

  test.describe('classifies every distance from today', () => {
    const cases = [
      { days: -10, state: 'overdue' },
      { days: -1, state: 'overdue' },
      { days: 0, state: 'today' },
      { days: 1, state: 'soon' },
      { days: 3, state: 'soon' },
      { days: 4, state: 'later' },
      { days: 60, state: 'later' },
    ] as const;

    for (const { days, state } of cases) {
      test(`${days} days from today is "${state}"`, async ({ api }) => {
        const issue = await api.createIssue({
          title: uniqueTitle(`Due in ${days}`),
          dueOn: daysFromToday(days),
        });

        expect(issue.dueState).toBe(state);
        expect(issue.daysUntilDue).toBe(days);

        await api.deleteIssueIfPresent(issue.key);
      });
    }
  });

  test('an issue without a deadline has no state to show', async ({ tempIssue }) => {
    expect(tempIssue.dueOn).toBeNull();
    expect(tempIssue.dueState).toBe('none');
    expect(tempIssue.daysUntilDue).toBeNull();
  });

  test('a deadline can be added, changed and cleared', async ({ api, tempIssue }) => {
    const withDate = await api.updateIssue(tempIssue.key, { dueOn: today() });
    expect(withDate.dueState).toBe('today');

    const moved = await api.updateIssue(tempIssue.key, { dueOn: daysFromToday(30) });
    expect(moved.dueState).toBe('later');

    const cleared = await api.updateIssue(tempIssue.key, { dueOn: null });
    expect(cleared.dueOn).toBeNull();
    expect(cleared.dueState).toBe('none');
  });

  test('rejects anything that is not a calendar date', async ({ api }) => {
    for (const bad of ['31-12-2025', '2025/12/31', 'tomorrow', '2025-13-01']) {
      const response = await api.createIssueRaw({ title: uniqueTitle('Bad date'), type: 'bug', dueOn: bad });
      expect(response.status(), `"${bad}" should be refused`).toBe(400);
    }
  });
});

test.describe('filtering and sorting by deadline', () => {
  test('filters down to what is already late', async ({ api }) => {
    const late = await api.createIssue({ title: uniqueTitle('Late'), dueOn: yesterday() });

    try {
      const result = await api.listIssues({ due: 'overdue', pageSize: 100 });

      expect(result.items.map((issue) => issue.key)).toContain(late.key);
      for (const issue of result.items) expect(issue.dueState).toBe('overdue');
    } finally {
      await api.deleteIssueIfPresent(late.key);
    }
  });

  test('combines states, so "needs attention" is one request', async ({ api }) => {
    const result = await api.listIssues({ due: 'overdue,today', pageSize: 100 });

    for (const issue of result.items) expect(['overdue', 'today']).toContain(issue.dueState);
  });

  test('sorts by date, with undated issues last either way', async ({ api }) => {
    for (const order of ['asc', 'desc'] as const) {
      const { items } = await api.listIssues({ sort: 'dueOn', order, pageSize: 100 });

      const firstUndated = items.findIndex((issue) => issue.dueOn === null);
      if (firstUndated !== -1) {
        expect(
          items.slice(firstUndated).every((issue) => issue.dueOn === null),
          `undated issues should be last when sorting ${order}`,
        ).toBe(true);
      }

      const dated = items.filter((issue) => issue.dueOn !== null).map((issue) => issue.dueOn!);
      const expected = [...dated].sort((a, b) => (order === 'asc' ? a.localeCompare(b) : b.localeCompare(a)));
      expect(dated).toEqual(expected);
    }
  });
});
