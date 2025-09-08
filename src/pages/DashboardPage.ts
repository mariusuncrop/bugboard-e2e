import type { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly root: Locator;
  readonly loading: Locator;
  readonly total: Locator;
  readonly open: Locator;
  readonly done: Locator;
  readonly unassigned: Locator;
  readonly byStatus: Locator;
  readonly byPriority: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId('dashboard');
    this.loading = page.getByTestId('stats-loading');
    this.total = page.getByTestId('stat-total');
    this.open = page.getByTestId('stat-open');
    this.done = page.getByTestId('stat-done');
    this.unassigned = page.getByTestId('stat-unassigned');
    this.byStatus = page.getByTestId('chart-by-status');
    this.byPriority = page.getByTestId('chart-by-priority');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  statusCount(status: string): Locator {
    return this.page.getByTestId(`count-status-${status}`);
  }
}
