import type { Locator, Page } from '@playwright/test';

/**
 * Page objects here expose locators and actions only — assertions stay in the
 * specs, so a reader can see what is being checked without opening another file.
 */
export class AppHeader {
  readonly root: Locator;
  readonly boardLink: Locator;
  readonly issuesLink: Locator;
  readonly dashboardLink: Locator;
  readonly newIssueButton: Locator;
  readonly themeToggle: Locator;
  readonly userMenu: Locator;
  readonly userName: Locator;
  readonly userRole: Locator;
  readonly logoutButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId('app-header');
    this.boardLink = page.getByTestId('nav-board');
    this.issuesLink = page.getByTestId('nav-issues');
    this.dashboardLink = page.getByTestId('nav-dashboard');
    this.newIssueButton = page.getByTestId('new-issue-button');
    this.themeToggle = page.getByTestId('theme-toggle');
    this.userMenu = page.getByTestId('user-menu');
    this.userName = page.getByTestId('user-menu-name');
    this.userRole = page.getByTestId('user-menu-role');
    this.logoutButton = page.getByTestId('logout-button');
  }

  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.logoutButton.click();
    await this.page.waitForURL('**/login');
  }

  async toggleTheme(): Promise<void> {
    await this.themeToggle.click();
  }

  currentTheme(): Promise<string | null> {
    return this.page.locator('html').getAttribute('data-theme');
  }
}
