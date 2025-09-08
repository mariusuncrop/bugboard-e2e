import type { Locator, Page } from '@playwright/test';

export class IssueListPage {
  readonly table: Locator;
  readonly rows: Locator;
  readonly loading: Locator;
  readonly empty: Locator;
  readonly search: Locator;
  readonly statusFilter: Locator;
  readonly priorityFilter: Locator;
  readonly typeFilter: Locator;
  readonly assigneeFilter: Locator;
  readonly clearFilters: Locator;
  readonly previousPage: Locator;
  readonly nextPage: Locator;
  readonly paginationInfo: Locator;

  constructor(readonly page: Page) {
    this.table = page.getByTestId('issues-table');
    this.rows = page.locator('[data-testid^="issue-row-"]');
    this.loading = page.getByTestId('issues-loading');
    this.empty = page.getByTestId('issues-empty');
    this.search = page.getByTestId('issues-search');
    this.statusFilter = page.getByTestId('filter-status');
    this.priorityFilter = page.getByTestId('filter-priority');
    this.typeFilter = page.getByTestId('filter-type');
    this.assigneeFilter = page.getByTestId('filter-assignee');
    this.clearFilters = page.getByTestId('filters-clear');
    this.previousPage = page.getByTestId('pagination-prev');
    this.nextPage = page.getByTestId('pagination-next');
    this.paginationInfo = page.getByTestId('pagination-info');
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/issues${query}`);
  }

  row(issueKey: string): Locator {
    return this.page.getByTestId(`issue-row-${issueKey}`);
  }

  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    // The input is debounced by 300ms before it rewrites the query string.
    await this.page.waitForURL(term ? /[?&]q=/ : /\/issues(\?|$)/);
  }

  async openIssue(issueKey: string): Promise<void> {
    await this.row(issueKey).getByTestId('row-key').click();
    await this.page.waitForURL(`**/issues/${issueKey}`);
  }

  visibleKeys(): Promise<string[]> {
    return this.rows.evaluateAll((rows) =>
      rows.map((row) => (row as HTMLElement).dataset.issueKey ?? '').filter(Boolean),
    );
  }

  async sortBy(field: 'key' | 'title' | 'priority' | 'createdAt'): Promise<void> {
    await this.page.getByTestId(`sort-${field}`).click();
  }
}
