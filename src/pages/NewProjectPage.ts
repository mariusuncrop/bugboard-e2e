import type { Locator, Page } from '@playwright/test';

export interface NewProjectInput {
  key?: string;
  name?: string;
  description?: string;
  memberIds?: string[];
}

export class NewProjectPage {
  readonly form: Locator;
  readonly key: Locator;
  readonly name: Locator;
  readonly description: Locator;
  readonly submit: Locator;
  readonly cancel: Locator;
  readonly keyError: Locator;
  readonly nameError: Locator;
  readonly formError: Locator;

  constructor(readonly page: Page) {
    this.form = page.getByTestId('project-form');
    this.key = page.getByTestId('project-key');
    this.name = page.getByTestId('project-name');
    this.description = page.getByTestId('project-description');
    this.submit = page.getByTestId('project-submit');
    this.cancel = page.getByTestId('project-cancel');
    this.keyError = page.getByTestId('error-key');
    this.nameError = page.getByTestId('error-name');
    this.formError = page.getByTestId('project-form-error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/projects/new');
  }

  async fill(input: NewProjectInput): Promise<void> {
    if (input.key !== undefined) await this.key.fill(input.key);
    if (input.name !== undefined) await this.name.fill(input.name);
    if (input.description !== undefined) await this.description.fill(input.description);
    for (const id of input.memberIds ?? []) {
      await this.page.getByTestId(`member-option-${id}`).check();
    }
  }

  async create(input: NewProjectInput): Promise<void> {
    await this.fill(input);
    await this.submit.click();
  }
}
