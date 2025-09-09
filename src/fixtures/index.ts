import { test as base, expect, type Locator } from '@playwright/test';
import { ApiClient } from '../api/client.js';
import type { Issue } from '../api/schemas.js';
import {
  AppHeader,
  BoardPage,
  DashboardPage,
  IssueDetailPage,
  IssueListPage,
  LoginPage,
  NewIssuePage,
} from '../pages/index.js';
import { uniqueTitle } from '../support/data.js';

interface Fixtures {
  /** API client signed in as the admin account. Use it to arrange state. */
  api: ApiClient;
  /** API client signed in as a member, for permission assertions. */
  memberApi: ApiClient;
  /** An issue created for this test only, removed again afterwards. */
  tempIssue: Issue;
  /** The most recent toast notification. */
  toast: Locator;
  header: AppHeader;
  loginPage: LoginPage;
  boardPage: BoardPage;
  issuesPage: IssueListPage;
  newIssuePage: NewIssuePage;
  issueDetail: IssueDetailPage;
  dashboard: DashboardPage;
}

export const test = base.extend<Fixtures>({
  api: async ({}, use) => {
    const client = await ApiClient.asAdmin();
    await use(client);
    await client.dispose();
  },

  memberApi: async ({}, use) => {
    const client = await ApiClient.asMember();
    await use(client);
    await client.dispose();
  },

  // Arranging over the API keeps UI specs focused on the behaviour they are
  // actually testing, and the teardown means the suite can run repeatedly
  // without the seed data drifting.
  tempIssue: async ({ api }, use) => {
    const issue = await api.createIssue({
      title: uniqueTitle('Fixture issue'),
      description: 'Created by the e2e suite.',
      type: 'bug',
      priority: 'medium',
      status: 'backlog',
    });
    await use(issue);
    await api.deleteIssueIfPresent(issue.key);
  },

  toast: async ({ page }, use) => {
    await use(page.getByTestId('toast').last());
  },

  header: async ({ page }, use) => use(new AppHeader(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  boardPage: async ({ page }, use) => use(new BoardPage(page)),
  issuesPage: async ({ page }, use) => use(new IssueListPage(page)),
  newIssuePage: async ({ page }, use) => use(new NewIssuePage(page)),
  issueDetail: async ({ page }, use) => use(new IssueDetailPage(page)),
  dashboard: async ({ page }, use) => use(new DashboardPage(page)),
});

export { expect };
export { ApiClient };
