import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { daysFromToday } from '../../src/support/dates.js';
import { PROJECTS, STORAGE_STATE } from '../../src/support/env.js';

test.describe('the home page', () => {
  test('is where signing in lands you', async ({ page, loginPage, homePage }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await loginPage.signIn('admin@bugboard.dev', 'Password123!');

    await expect(page).toHaveURL(/\/$/);
    await expect(homePage.root).toBeVisible();
  });

  test('greets the signed-in user by name', async ({ homePage }) => {
    await homePage.goto();

    await expect(homePage.root.getByRole('heading', { level: 1 })).toHaveText('Hello, Ada');
  });

  // Specs running in parallel create and assign issues, so the totals move
  // between one request and the next. Assert what the page says about itself.
  test('its tiles agree with the rest of the page', async ({ homePage }) => {
    await homePage.goto();

    expect(await homePage.statValue('projects')).toBe(await homePage.projectRows().count());
    expect(await homePage.statValue('overdue')).toBeLessThanOrEqual(await homePage.statValue('open'));
    for (const name of ['open', 'overdue', 'done', 'projects'] as const) {
      expect(await homePage.statValue(name), `${name} should be a count`).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('as a member with work of their own', () => {
  test.use({ storageState: STORAGE_STATE.member });

  test('lists only the projects they are on', async ({ homePage }) => {
    await homePage.goto();

    await expect(homePage.project(PROJECTS.main)).toBeVisible();
    await expect(homePage.project(PROJECTS.withoutPm)).toBeVisible();
    await expect(homePage.project(PROJECTS.withoutMember), 'Marco is not on the mobile project').toHaveCount(0);
  });

  test('shows how much of each project is theirs', async ({ api, memberApi, homePage }) => {
    // A project of its own: the shared ones gain and lose issues while other
    // specs run, so an exact count there could never hold still.
    const key = `H${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await api.createProject({ key, name: 'Counting test', memberIds: [memberApi.user.id] });
    const mine = await api.createIssue(
      { title: uniqueTitle('Theirs'), assigneeId: memberApi.user.id },
      key,
    );
    const other = await api.createIssue({ title: uniqueTitle('Nobody’s') }, key);

    try {
      await homePage.goto();

      await expect(homePage.project(key).getByTestId('home-project-counts')).toHaveText('2 open · 1 yours');
    } finally {
      await api.deleteIssueIfPresent(mine.key);
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('lists work assigned to them, and nothing assigned to anyone else', async ({
    api,
    memberApi,
    homePage,
  }) => {
    const mine = await memberApi.createIssue({ title: uniqueTitle('Mine'), assigneeId: memberApi.user.id });
    const theirs = await api.createIssue({ title: uniqueTitle('Someone else’s'), assigneeId: 'usr_qa' });

    try {
      await homePage.goto();

      await expect(homePage.issue(mine.key)).toBeVisible();
      await expect(homePage.issue(theirs.key), 'Priya’s work is not Marco’s').toHaveCount(0);
    } finally {
      await api.deleteIssueIfPresent(mine.key);
      await api.deleteIssueIfPresent(theirs.key);
    }
  });

  test('puts the soonest deadline at the top', async ({ homePage }) => {
    await homePage.goto();

    const dates = await homePage
      .issueRows()
      .getByTestId('due-badge')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.dueOn ?? ''));

    expect(dates).toEqual([...dates].sort());
  });

  test('an issue opens in its own project', async ({ memberApi, homePage, page, issueDetail }) => {
    const mine = await memberApi.getMySummary();
    const first = mine.assigned.items[0]!;
    await homePage.goto();

    await homePage.issue(first.key).getByTestId('home-issue-key').click();

    await expect(page).toHaveURL(new RegExp(`/issues/${first.key}$`));
    await expect(issueDetail.key).toHaveText(first.key);
  });
});

test.describe('what the home page reflects', () => {
  test('work assigned to you appears on it', async ({ api, homePage }) => {
    const issue = await api.createIssue({
      title: uniqueTitle('Newly mine'),
      assigneeId: api.user.id,
      dueOn: daysFromToday(2),
    });

    try {
      await homePage.goto();

      await expect(homePage.issue(issue.key)).toBeVisible();
      await expect(homePage.issue(issue.key).getByTestId('due-badge')).toHaveAttribute('data-due-state', 'soon');
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('finishing something takes it off the list', async ({ api, homePage }) => {
    const issue = await api.createIssue({ title: uniqueTitle('About to be done'), assigneeId: api.user.id });

    try {
      await homePage.goto();
      await expect(homePage.issue(issue.key)).toBeVisible();

      await api.updateIssue(issue.key, { status: 'done' });
      await homePage.goto();

      await expect(homePage.issue(issue.key)).toHaveCount(0);
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('an overdue assignment is counted and coloured', async ({ api, homePage }) => {
    const issue = await api.createIssue({
      title: uniqueTitle('Already late'),
      assigneeId: api.user.id,
      dueOn: daysFromToday(-2),
    });

    try {
      await homePage.goto();

      expect(await homePage.statValue('overdue')).toBeGreaterThanOrEqual(1);
      await expect(homePage.issue(issue.key).getByTestId('due-badge')).toHaveAttribute(
        'data-due-state',
        'overdue',
      );
    } finally {
      await api.deleteIssueIfPresent(issue.key);
    }
  });

  test('links on to the full project list', async ({ homePage, page, projectsPage }) => {
    await homePage.goto();

    await homePage.allProjectsLink.click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(projectsPage.list).toBeVisible();
  });
});
