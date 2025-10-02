import type { Locator, Page } from '@playwright/test';

export class ProjectsPage {
  readonly list: Locator;
  readonly empty: Locator;
  readonly loading: Locator;
  readonly newProjectButton: Locator;

  constructor(readonly page: Page) {
    this.list = page.getByTestId('project-list');
    this.empty = page.getByTestId('projects-empty');
    this.loading = page.getByTestId('projects-loading');
    this.newProjectButton = page.getByTestId('new-project-button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/projects');
    // visibleKeys() takes a single snapshot, so settle the page first rather
    // than letting callers read a list that has not rendered yet.
    await this.list.or(this.empty).first().waitFor();
  }

  card(projectKey: string): Locator {
    return this.page.getByTestId(`project-card-${projectKey}`);
  }

  cards(): Locator {
    return this.page.locator('[data-testid^="project-card-"]');
  }

  async visibleKeys(): Promise<string[]> {
    return this.cards().getByTestId('project-card-key').allTextContents();
  }

  async open(projectKey: string): Promise<void> {
    await this.card(projectKey).getByTestId('project-card-name').click();
    await this.page.waitForURL(new RegExp(`/projects/${projectKey.toLowerCase()}/board$`));
  }
}
