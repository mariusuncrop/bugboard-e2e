import type { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly root: Locator;
  readonly loading: Locator;
  readonly projects: Locator;
  readonly projectsEmpty: Locator;
  readonly assigned: Locator;
  readonly assignedList: Locator;
  readonly assignedEmpty: Locator;
  readonly allProjectsLink: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId('home-page');
    this.loading = page.getByTestId('home-loading');
    this.projects = page.getByTestId('home-projects');
    this.projectsEmpty = page.getByTestId('home-projects-empty');
    this.assigned = page.getByTestId('home-assigned');
    this.assignedList = page.getByTestId('home-assigned-list');
    this.assignedEmpty = page.getByTestId('home-assigned-empty');
    this.allProjectsLink = page.getByTestId('home-all-projects');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.root.waitFor();
  }

  stat(name: 'open' | 'overdue' | 'done' | 'projects'): Locator {
    return this.page.getByTestId(`home-stat-${name}`);
  }

  async statValue(name: 'open' | 'overdue' | 'done' | 'projects'): Promise<number> {
    return Number((await this.stat(name).locator('.stat__value').textContent())!.trim());
  }

  project(projectKey: string): Locator {
    return this.page.getByTestId(`home-project-${projectKey}`);
  }

  projectRows(): Locator {
    // Scoped to the list items: the name link and the counts inside each row
    // share the same test id prefix.
    return this.projects.locator('li[data-testid^="home-project-"]');
  }

  issue(issueKey: string): Locator {
    return this.page.getByTestId(`home-issue-${issueKey}`);
  }

  issueRows(): Locator {
    return this.assignedList.locator('li[data-testid^="home-issue-"]');
  }
}
