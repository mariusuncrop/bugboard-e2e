import type { Locator, Page } from '@playwright/test';

export class ProjectSettingsPage {
  readonly root: Locator;
  readonly notFound: Locator;
  readonly projectKey: Locator;
  readonly memberList: Locator;
  readonly memberSelect: Locator;
  readonly addMemberButton: Locator;
  readonly manageHint: Locator;
  readonly confirmDialog: Locator;
  readonly confirmAccept: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId('project-settings-page');
    this.notFound = page.getByTestId('project-not-found');
    this.projectKey = page.getByTestId('settings-project-key');
    this.memberList = page.getByTestId('member-list');
    this.memberSelect = page.getByTestId('member-select');
    this.addMemberButton = page.getByTestId('add-member-button');
    this.manageHint = page.getByTestId('manage-members-hint');
    this.confirmDialog = page.getByTestId('confirm-dialog');
    this.confirmAccept = page.getByTestId('confirm-accept');
  }

  async goto(projectKey: string): Promise<void> {
    await this.page.goto(`/projects/${projectKey.toLowerCase()}/settings`);
  }

  member(userId: string): Locator {
    return this.page.getByTestId(`member-${userId}`);
  }

  members(): Locator {
    return this.memberList.locator('[data-testid^="member-usr_"]');
  }

  async addMember(userId: string): Promise<void> {
    await this.memberSelect.selectOption(userId);
    await this.addMemberButton.click();
  }

  async removeMember(userId: string): Promise<void> {
    await this.page.getByTestId(`remove-member-${userId}`).click();
    await this.confirmDialog.waitFor();
    await this.confirmAccept.click();
  }
}
