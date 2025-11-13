import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { PROJECTS } from '../../src/support/env.js';

test.describe('kanban board', () => {
  test('renders every column with a count that matches its cards', async ({ boardPage }) => {
    await boardPage.goto();

    for (const status of ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const) {
      const cards = await boardPage.cardsIn(status).count();
      await expect(boardPage.columnCount(status)).toHaveText(String(cards));
    }
  });

  test('a card shows its key, title, priority and comment count', async ({ api, boardPage }) => {
    const issue = await api.getIssue('WEB-1');
    await boardPage.goto();

    const card = boardPage.card(issue.key);
    await expect(card.getByTestId('issue-card-key')).toHaveText(issue.key);
    await expect(card.getByTestId('issue-card-title')).toHaveText(issue.title);
    await expect(card.getByTestId('priority-badge')).toHaveAttribute('data-priority', issue.priority);
    await expect(card.getByTestId('issue-card-comments')).toContainText(String(issue.commentCount));
  });

  test('moves a card to another column with the accessible control', async ({ api, boardPage, tempIssue, toast }) => {
    await test.step('the card starts in the backlog', async () => {
      await boardPage.goto();
      await expect(boardPage.column('backlog').getByTestId(`issue-card-${tempIssue.key}`)).toBeVisible();
    });

    await test.step('move it to In progress', async () => {
      await boardPage.moveViaSelect(tempIssue.key, 'in_progress');
      await expect(toast).toContainText(`${tempIssue.key} moved to In progress`);
    });

    await test.step('the card is in the new column and no longer in the old one', async () => {
      await expect(boardPage.column('in_progress').getByTestId(`issue-card-${tempIssue.key}`)).toBeVisible();
      await expect(boardPage.column('backlog').getByTestId(`issue-card-${tempIssue.key}`)).toHaveCount(0);
    });

    await test.step('the change reached the server', async () => {
      expect((await api.getIssue(tempIssue.key)).status).toBe('in_progress');
    });
  });

  // A pointer gesture needs its target on screen, and the shared WEB board grows
  // a long backlog as other specs create fixtures in it. A small project keeps
  // every column visible, so this tests the gesture rather than the scroll
  // position. Long-distance moves are covered by the select control above.
  test('drags a card into the next column', async ({ api, boardPage, isMobile }) => {
    test.skip(
      Boolean(isMobile),
      'HTML5 drag and drop is a pointer gesture. Touch users move cards with the select control, which the test above covers.',
    );

    const issue = await api.createIssue({ title: uniqueTitle('Draggable') }, PROJECTS.withoutMember);

    try {
      await boardPage.goto(PROJECTS.withoutMember);

      await boardPage.dragCardTo(issue.key, 'todo');

      await expect(boardPage.column('todo').getByTestId(`issue-card-${issue.key}`)).toBeVisible();
      expect((await api.getIssue(issue.key)).status).toBe('todo');
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('a move survives a reload', async ({ boardPage, tempIssue, page }) => {
    await boardPage.goto();
    await boardPage.moveViaSelect(tempIssue.key, 'in_review');
    await expect(boardPage.column('in_review').getByTestId(`issue-card-${tempIssue.key}`)).toBeVisible();

    await page.reload();

    await expect(boardPage.column('in_review').getByTestId(`issue-card-${tempIssue.key}`)).toBeVisible();
  });

  test('filtering by assignee hides everyone else’s cards', async ({ api, boardPage }) => {
    const marco = await test.step('look up the user to filter by', async () => {
      const users = await api.listUsers();
      return users.find((user) => user.email === 'dev@bugboard.dev')!;
    });

    await test.step('apply the filter', async () => {
      await boardPage.goto();
      await boardPage.filterByAssignee(marco.id);
    });

    await test.step('every remaining card belongs to that user', async () => {
      // The board refetches after the filter changes, so poll rather than read
      // the avatars once.
      await expect
        .poll(async () => [
          ...new Set(
            await boardPage.board
              .getByTestId('avatar')
              .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.userId ?? '')),
          ),
        ])
        .toEqual([marco.id]);
    });
  });

  test('filtering by unassigned shows only cards with no owner', async ({ boardPage }) => {
    await boardPage.goto();
    await boardPage.filterByAssignee('unassigned');

    await expect(boardPage.board.getByTestId('avatar-unassigned').first()).toBeVisible();
    await expect(boardPage.board.getByTestId('avatar')).toHaveCount(0);
  });

  test('filtering by priority narrows every column at once', async ({ boardPage }) => {
    await boardPage.goto();
    await boardPage.filterByPriority('critical');

    const badges = boardPage.board.getByTestId('priority-badge');
    await expect(badges.first()).toBeVisible();
    for (const badge of await badges.all()) {
      await expect(badge).toHaveAttribute('data-priority', 'critical');
    }
  });

  test('an empty column says so rather than rendering nothing', async ({ boardPage }) => {
    await boardPage.goto();
    await boardPage.filterByAssignee('unassigned');

    await expect(boardPage.column('in_progress')).toContainText('Nothing here');
  });

  test('clicking a card opens the issue', async ({ boardPage, page, tempIssue }) => {
    await boardPage.goto();

    await boardPage.card(tempIssue.key).getByTestId('issue-card-title').click();

    await expect(page).toHaveURL(new RegExp(`/issues/${tempIssue.key}$`));
  });
});
