import { errorSchema } from '../../src/api/schemas.js';
import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';
import { PROJECTS } from '../../src/support/env.js';

const projectKey = () => `T${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

test.describe('what each user can see', () => {
  test('an admin sees every project without being added to it', async ({ api }) => {
    const keys = (await api.listProjects()).map((project) => project.key);

    expect(keys).toEqual(expect.arrayContaining([PROJECTS.main, PROJECTS.withoutPm, PROJECTS.withoutMember]));
  });

  test('a member sees only the projects they belong to', async ({ memberApi }) => {
    const keys = (await memberApi.listProjects()).map((project) => project.key);

    expect(keys).toContain(PROJECTS.main);
    expect(keys, 'Marco is not on the mobile project').not.toContain(PROJECTS.withoutMember);
  });

  test('a project a member cannot see reports 404, not 403', async ({ memberApi }) => {
    const response = await memberApi.getProjectRaw(PROJECTS.withoutMember);

    // Answering "forbidden" would confirm the project exists to someone with no
    // access to it.
    expect(response.status()).toBe(404);
    expect((await response.json()).error.code).toBe('NOT_FOUND');
  });

  test('its issues are hidden too, by list and by key', async ({ memberApi, api }) => {
    const hidden = (await api.listIssues({ pageSize: 1 }, PROJECTS.withoutMember)).items[0]!;

    expect((await memberApi.listIssuesRaw(PROJECTS.withoutMember)).status()).toBe(404);
    expect((await memberApi.getIssueRaw(hidden.key)).status()).toBe(404);
    expect((await memberApi.getBoardRaw(PROJECTS.withoutMember)).status()).toBe(404);
  });

  test('comments on a hidden issue are out of reach as well', async ({ memberApi, api, request }) => {
    const hidden = (await api.listIssues({ pageSize: 1 }, PROJECTS.withoutMember)).items[0]!;

    const response = await request.get(`/api/issues/${hidden.key}/comments`, {
      headers: { Authorization: `Bearer ${memberApi.token}` },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('issue keys', () => {
  test('each project numbers its issues from one, behind its own prefix', async ({ api }) => {
    for (const key of [PROJECTS.main, PROJECTS.withoutPm, PROJECTS.withoutMember]) {
      const { items } = await api.listIssues({ pageSize: 100, sort: 'key', order: 'asc' }, key);
      expect(items.length).toBeGreaterThan(0);
      for (const issue of items) expect(issue.key).toMatch(new RegExp(`^${key}-\\d+$`));
      expect(items.map((issue) => issue.key)).toContain(`${key}-1`);
    }
  });

  test('a new issue takes the next number in its own project', async ({ api }) => {
    const before = await api.listIssues({ pageSize: 100 }, PROJECTS.withoutMember);
    const created = await api.createIssue({ title: uniqueTitle('Numbered') }, PROJECTS.withoutMember);

    expect(created.key).toBe(`${PROJECTS.withoutMember}-${before.total + 1}`);
    expect(created.project?.key).toBe(PROJECTS.withoutMember);

    await api.deleteIssueIfPresent(created.key);
  });
});

test.describe('creating a project', () => {
  test('a member cannot create one', async ({ memberApi }) => {
    const response = await memberApi.createProjectRaw({ key: projectKey(), name: 'Should not exist' });

    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('FORBIDDEN');
  });

  test('an admin creates one and is added to it', async ({ api }) => {
    const key = projectKey();

    const project = await api.createProject({ key, name: 'Created by a test', description: 'Temporary.' });

    expect(project.key).toBe(key);
    expect(project.members.map((member) => member.email)).toContain(api.user.email);
    expect(project.issueCount).toBe(0);
  });

  test('rejects a duplicate key', async ({ api }) => {
    const response = await api.createProjectRaw({ key: PROJECTS.main, name: 'Clashing project' });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'key',
      message: `The key "${PROJECTS.main}" is already in use.`,
    });
  });

  test('rejects a key that is not a usable prefix', async ({ api }) => {
    const response = await api.createProjectRaw({ key: '1bad!', name: 'Bad key' });

    expect(response.status()).toBe(400);
    const body = errorSchema.parse(await response.json());
    expect(body.error.details?.map((detail) => detail.path)).toContain('key');
  });

  test('uppercases a lowercase key rather than refusing it', async ({ api }) => {
    const key = projectKey();

    const project = await api.createProject({ key: key.toLowerCase(), name: 'Case insensitive' });

    expect(project.key).toBe(key);
  });
});

test.describe('managing members', () => {
  test('a member cannot add anyone', async ({ memberApi }) => {
    const response = await memberApi.addMemberRaw(PROJECTS.main, { userId: 'usr_pm' });

    expect(response.status()).toBe(403);
  });

  test('an admin adds someone, and they can then see the project', async ({ api, memberApi }) => {
    const key = projectKey();
    await api.createProject({ key, name: 'Membership test' });

    expect((await memberApi.getProjectRaw(key)).status(), 'not a member yet').toBe(404);

    await api.addMember(key, memberApi.user.id);

    expect((await memberApi.getProjectRaw(key)).status()).toBe(200);
    expect((await memberApi.listProjects()).map((project) => project.key)).toContain(key);
  });

  test('removing someone takes their access away again', async ({ api, memberApi }) => {
    const key = projectKey();
    await api.createProject({ key, name: 'Removal test', memberIds: [memberApi.user.id] });
    expect((await memberApi.getProjectRaw(key)).status()).toBe(200);

    await api.removeMember(key, memberApi.user.id);

    expect((await memberApi.getProjectRaw(key)).status()).toBe(404);
  });

  test('removing someone unassigns the work they held there', async ({ api, memberApi }) => {
    const key = projectKey();
    await api.createProject({ key, name: 'Handover test', memberIds: [memberApi.user.id] });
    const issue = await api.createIssue(
      { title: uniqueTitle('Assigned then orphaned'), assigneeId: memberApi.user.id },
      key,
    );

    const { unassignedIssues } = await api.removeMember(key, memberApi.user.id);

    expect(unassignedIssues).toBe(1);
    expect((await api.getIssue(issue.key)).assigneeId).toBeNull();
  });

  test('rejects adding the same person twice', async ({ api }) => {
    const response = await api.addMemberRaw(PROJECTS.main, { userId: 'usr_dev' });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toContainEqual({
      path: 'userId',
      message: 'That user is already a member.',
    });
  });

  test('rejects a user id that matches nobody', async ({ api }) => {
    const response = await api.addMemberRaw(PROJECTS.main, { userId: 'usr_nobody' });

    expect(response.status()).toBe(400);
  });

  test('removing someone who is not a member is a 404', async ({ api }) => {
    const response = await api.removeMemberRaw(PROJECTS.withoutMember, 'usr_dev');

    expect(response.status()).toBe(404);
  });
});

test.describe('assignment respects membership', () => {
  test('an issue cannot be assigned to someone outside the project', async ({ api }) => {
    const response = await api.createIssueRaw(
      { title: uniqueTitle('Outsider'), type: 'bug', assigneeId: 'usr_dev' },
      PROJECTS.withoutMember,
    );

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details?.[0]?.message).toContain(
      `is not a member of ${PROJECTS.withoutMember}`,
    );
  });

  test('a member of the project can be assigned', async ({ api }) => {
    const issue = await api.createIssue(
      { title: uniqueTitle('Insider'), assigneeId: 'usr_pm' },
      PROJECTS.withoutMember,
    );

    expect(issue.assignee?.email).toBe('pm@bugboard.dev');
    await api.deleteIssueIfPresent(issue.key);
  });

  test('the member list only offers people on the project', async ({ api }) => {
    const members = await api.listMembers(PROJECTS.withoutMember);

    expect(members.map((member) => member.email)).not.toContain('dev@bugboard.dev');
    expect(members.map((member) => member.email)).toContain('pm@bugboard.dev');
  });
});
