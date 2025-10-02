import { expect, test } from '../../src/fixtures/index.js';
import { PROJECTS, STORAGE_STATE } from '../../src/support/env.js';

const projectKey = () => `U${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

test.describe('the project list', () => {
  test('an admin sees every project and can create another', async ({ projectsPage }) => {
    await projectsPage.goto();

    await expect(projectsPage.list).toBeVisible();
    const keys = await projectsPage.visibleKeys();
    expect(keys).toEqual(expect.arrayContaining([PROJECTS.main, PROJECTS.withoutPm, PROJECTS.withoutMember]));
    await expect(projectsPage.newProjectButton).toBeVisible();
  });

  test('a card shows how much is in the project', async ({ api, projectsPage }) => {
    const expected = await api.getProject(PROJECTS.withoutMember);
    await projectsPage.goto();

    const card = projectsPage.card(PROJECTS.withoutMember);
    await expect(card.getByTestId('project-card-counts')).toContainText(`${expected.issueCount} issues`);
    await expect(card.getByTestId('project-card-counts')).toContainText(`${expected.memberCount} members`);
  });

  test('opening a project lands on its board', async ({ projectsPage, boardPage, page }) => {
    await projectsPage.goto();

    await projectsPage.open(PROJECTS.withoutPm);

    await expect(page).toHaveURL(/\/projects\/api\/board$/);
    await expect(boardPage.board).toBeVisible();
  });
});

test.describe('the project list as a member', () => {
  test.use({ storageState: STORAGE_STATE.member });

  test('shows only the projects they belong to', async ({ projectsPage }) => {
    await projectsPage.goto();

    const keys = await projectsPage.visibleKeys();
    expect(keys).toContain(PROJECTS.main);
    expect(keys).not.toContain(PROJECTS.withoutMember);
  });

  test('offers no way to create one', async ({ projectsPage }) => {
    await projectsPage.goto();

    await expect(projectsPage.newProjectButton).toHaveCount(0);
  });

  test('typing the URL of a project they cannot see does not get them in', async ({ page, projectSettings }) => {
    await page.goto(`/projects/${PROJECTS.withoutMember.toLowerCase()}/settings`);

    await expect(projectSettings.notFound).toBeVisible();
  });

  test('the create page redirects them away', async ({ page, newProjectPage }) => {
    await newProjectPage.goto();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(newProjectPage.form).toHaveCount(0);
  });
});

test.describe('creating a project', () => {
  test('creates one and opens its board', async ({ api, newProjectPage, page, toast, boardPage }) => {
    const key = projectKey();
    await newProjectPage.goto();

    await newProjectPage.create({ key, name: 'Created through the UI', description: 'Filed by the suite.' });

    await expect(toast).toContainText(`${key} created.`);
    await expect(page).toHaveURL(new RegExp(`/projects/${key.toLowerCase()}/board$`));
    await expect(boardPage.board).toBeVisible();

    const project = await api.getProject(key);
    expect(project.name).toBe('Created through the UI');
    expect(project.members.map((member) => member.email)).toContain('admin@bugboard.dev');
  });

  test('adds the members ticked on the form', async ({ api, newProjectPage, page }) => {
    const key = projectKey();
    await newProjectPage.goto();

    await newProjectPage.create({ key, name: 'With members', memberIds: ['usr_pm'] });

    // Wait for the app to confirm the write before asking the API about it.
    await expect(page).toHaveURL(new RegExp(`/projects/${key.toLowerCase()}/board$`));

    const project = await api.getProject(key);
    expect(project.members.map((member) => member.email).sort()).toEqual([
      'admin@bugboard.dev',
      'pm@bugboard.dev',
    ]);
  });

  test('refuses a key that could not prefix an issue', async ({ newProjectPage, page }) => {
    await newProjectPage.goto();

    await newProjectPage.create({ key: '1', name: 'Bad key project' });

    await expect(newProjectPage.keyError).toContainText('2 to 6 letters or digits');
    await expect(page).toHaveURL(/\/projects\/new$/);
  });

  test('surfaces a duplicate key the server rejects', async ({ newProjectPage }) => {
    await newProjectPage.goto();

    await newProjectPage.create({ key: PROJECTS.main, name: 'Clashing project' });

    await expect(newProjectPage.formError).toBeVisible();
    await expect(newProjectPage.page.getByTestId('error-key')).toContainText('already in use');
  });
});

test.describe('managing members through the UI', () => {
  test('adds someone, then removes them again', async ({ api, projectSettings, toast }) => {
    const key = projectKey();
    await api.createProject({ key, name: 'Managed in the browser' });
    await projectSettings.goto(key);

    await test.step('the project starts with only its creator', async () => {
      await expect(projectSettings.members()).toHaveCount(1);
    });

    await test.step('add a member', async () => {
      await projectSettings.addMember('usr_qa');
      await expect(toast).toContainText('Member added.');
      await expect(projectSettings.member('usr_qa')).toBeVisible();
      await expect(projectSettings.members()).toHaveCount(2);
    });

    await test.step('remove them again', async () => {
      await projectSettings.removeMember('usr_qa');
      await expect(projectSettings.member('usr_qa')).toHaveCount(0);
      expect((await api.getProject(key)).members).toHaveLength(1);
    });
  });

  test('warns that removing someone unassigns their work', async ({ api, projectSettings, toast }) => {
    const key = projectKey();
    await api.createProject({ key, name: 'Handover', memberIds: ['usr_qa'] });
    const issue = await api.createIssue({ title: 'Work that needs a new owner', assigneeId: 'usr_qa' }, key);

    await projectSettings.goto(key);
    await projectSettings.removeMember('usr_qa');

    await expect(toast).toContainText('1 issue left unassigned');
    expect((await api.getIssue(issue.key)).assigneeId).toBeNull();
  });

  test('a new member becomes assignable on the issue form', async ({ api, newIssuePage }) => {
    const key = projectKey();
    await api.createProject({ key, name: 'Assignable after joining' });

    await newIssuePage.goto(key);
    await expect(newIssuePage.assignee.getByRole('option')).toHaveCount(2); // Unassigned + the creator

    await api.addMember(key, 'usr_pm');
    await newIssuePage.goto(key);

    await expect(newIssuePage.assignee.getByRole('option', { name: 'Jonas Lindqvist' })).toHaveCount(1);
  });
});

test.describe('switching project', () => {
  test('the switcher moves between boards', async ({ boardPage, page, header }) => {
    await boardPage.goto(PROJECTS.main);

    await header.page.getByTestId('project-select').selectOption(PROJECTS.withoutPm);

    await expect(page).toHaveURL(/\/projects\/api\/board$/);
    await expect(boardPage.card(`${PROJECTS.withoutPm}-1`)).toBeVisible();
  });

  test('each board shows only its own project’s issues', async ({ boardPage }) => {
    await boardPage.goto(PROJECTS.withoutPm);

    const keys = await boardPage.board
      .locator('[data-issue-key]')
      .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.issueKey ?? ''));

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key.startsWith(`${PROJECTS.withoutPm}-`)).toBe(true);
  });

  test('the switcher only lists projects the user can open', async ({ boardPage, page }) => {
    await boardPage.goto(PROJECTS.main);

    const options = await page.getByTestId('project-select').getByRole('option').allTextContents();

    expect(options.join(' ')).toContain(PROJECTS.withoutMember);
  });
});
