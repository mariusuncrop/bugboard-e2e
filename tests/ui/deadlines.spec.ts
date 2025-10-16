import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { daysFromToday, today, tomorrow, yesterday } from '../../src/support/dates.js';

test.describe('deadlines on the board', () => {
  test('a late card is coloured as overdue and says how late', async ({ api, boardPage, tempIssue }) => {
    await api.updateIssue(tempIssue.key, { dueOn: daysFromToday(-4) });
    await boardPage.goto();

    const badge = boardPage.dueBadge(tempIssue.key);
    await expect(badge).toHaveAttribute('data-due-state', 'overdue');
    await expect(badge).toHaveText('4d late');
  });

  test.describe('each urgency gets its own colour', () => {
    const cases = [
      { days: -1, state: 'overdue', text: '1d late' },
      { days: 0, state: 'today', text: 'Due today' },
      { days: 2, state: 'soon', text: '2d left' },
      { days: 30, state: 'later', text: '30d left' },
    ] as const;

    for (const { days, state, text } of cases) {
      test(`due in ${days} days reads as "${state}"`, async ({ api, boardPage, tempIssue }) => {
        await api.updateIssue(tempIssue.key, { dueOn: daysFromToday(days) });
        await boardPage.goto();

        const badge = boardPage.dueBadge(tempIssue.key);
        await expect(badge).toHaveAttribute('data-due-state', state);
        await expect(badge).toHaveText(text);
      });
    }
  });

  test('a card with no deadline shows no badge at all', async ({ boardPage, tempIssue }) => {
    await boardPage.goto();

    await expect(boardPage.dueBadge(tempIssue.key)).toHaveCount(0);
  });

  test('the badge carries the date for anyone hovering it', async ({ api, boardPage, tempIssue }) => {
    await api.updateIssue(tempIssue.key, { dueOn: tomorrow() });
    await boardPage.goto();

    await expect(boardPage.dueBadge(tempIssue.key)).toHaveAttribute('data-due-on', tomorrow());
  });
});

test.describe('deadlines on the issue list', () => {
  test('the row shows the same badge as the card', async ({ api, issuesPage, tempIssue }) => {
    await api.updateIssue(tempIssue.key, { dueOn: yesterday() });
    await issuesPage.goto();
    await issuesPage.searchFor(tempIssue.title);

    await expect(issuesPage.dueBadge(tempIssue.key)).toHaveAttribute('data-due-state', 'overdue');
  });

  test('sorting by due date orders the rows both ways', async ({ issuesPage, page }) => {
    const dates = async () =>
      issuesPage.table
        .getByTestId('due-badge')
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.dueOn ?? ''));

    await issuesPage.goto();

    await test.step('the first click puts the latest deadline first', async () => {
      await issuesPage.sortBy('dueOn');
      await expect(page).toHaveURL(/sort=dueOn/);
      await expect(page).toHaveURL(/order=desc/);
      await expect.poll(async () => {
        const seen = await dates();
        return seen.join() === [...seen].sort().reverse().join();
      }).toBe(true);
    });

    await test.step('the second click reverses it', async () => {
      await issuesPage.sortBy('dueOn');
      await expect(page).toHaveURL(/order=asc/);
      await expect.poll(async () => {
        const seen = await dates();
        return seen.join() === [...seen].sort().join();
      }).toBe(true);
    });
  });
});

test.describe('setting a deadline through the UI', () => {
  test('files a new issue with a deadline already on it', async ({ api, newIssuePage, issueDetail }) => {
    const title = uniqueTitle('Deadline at creation');
    await newIssuePage.goto();

    await newIssuePage.create({ title, dueOn: tomorrow() });

    await expect(issueDetail.dueBadge).toHaveAttribute('data-due-state', 'soon');

    const key = (await issueDetail.key.textContent())!;
    expect((await api.getIssue(key)).dueOn).toBe(tomorrow());
    await api.deleteIssueIfPresent(key);
  });

  test('adds a deadline to an issue that had none', async ({ api, issueDetail, tempIssue, toast }) => {
    await issueDetail.goto(tempIssue.key);
    await expect(issueDetail.dueBadge).toHaveCount(0);

    await issueDetail.setDueOn(today());

    await expect(toast).toContainText('Due date updated.');
    await expect(issueDetail.dueBadge).toHaveAttribute('data-due-state', 'today');
    expect((await api.getIssue(tempIssue.key)).dueOn).toBe(today());
  });

  test('clears a deadline again', async ({ api, issueDetail, tempIssue }) => {
    await api.updateIssue(tempIssue.key, { dueOn: tomorrow() });
    await issueDetail.goto(tempIssue.key);
    await expect(issueDetail.dueBadge).toBeVisible();

    await issueDetail.dueOn.fill('');

    await expect(issueDetail.dueBadge).toHaveCount(0);
    expect((await api.getIssue(tempIssue.key)).dueOn).toBeNull();
  });

  test('a deadline set on the detail page colours the card', async ({ api, issueDetail, boardPage, tempIssue }) => {
    await api.updateIssue(tempIssue.key, { dueOn: daysFromToday(-2) });

    await issueDetail.goto(tempIssue.key);
    await expect(issueDetail.dueBadge).toHaveAttribute('data-due-state', 'overdue');

    await boardPage.goto();
    await expect(boardPage.dueBadge(tempIssue.key)).toHaveAttribute('data-due-state', 'overdue');
  });
});
