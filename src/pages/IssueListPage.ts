import { expect, type Locator, type Page } from '@playwright/test';
import { PROJECTS } from '../support/env.js';

export class IssueListPage {
  readonly root: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly loading: Locator;
  readonly empty: Locator;
  readonly search: Locator;
  readonly statusFilter: Locator;
  readonly priorityFilter: Locator;
  readonly typeFilter: Locator;
  readonly assigneeFilter: Locator;
  readonly labelFilter: Locator;
  readonly clearLabels: Locator;
  readonly clearFilters: Locator;
  readonly previousPage: Locator;
  readonly nextPage: Locator;
  readonly paginationInfo: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId('issues-page');
    this.table = page.getByTestId('issues-table');
    this.rows = page.locator('[data-testid^="issue-row-"]');
    this.loading = page.getByTestId('issues-loading');
    this.empty = page.getByTestId('issues-empty');
    this.search = page.getByTestId('issues-search');
    this.statusFilter = page.getByTestId('filter-status');
    this.priorityFilter = page.getByTestId('filter-priority');
    this.typeFilter = page.getByTestId('filter-type');
    this.assigneeFilter = page.getByTestId('assignee-filter');
    this.labelFilter = page.getByTestId('label-filter');
    this.clearLabels = page.getByTestId('label-filter-clear');
    this.clearFilters = page.getByTestId('filters-clear');
    this.previousPage = page.getByTestId('pagination-prev');
    this.nextPage = page.getByTestId('pagination-next');
    this.paginationInfo = page.getByTestId('pagination-info');
  }

  async goto(query = '', projectKey: string = PROJECTS.main): Promise<void> {
    await this.page.goto(`/projects/${projectKey.toLowerCase()}/issues${query}`);
    // Wait for the page itself, not for its rows: specs that assert on the
    // loading state or on a failed request need to arrive before those settle.
    await this.root.waitFor();
  }

  row(issueKey: string): Locator {
    return this.page.getByTestId(`issue-row-${issueKey}`);
  }

  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    // Debounced by 300ms, then pushed into the query string. A polling URL
    // assertion suits a history push better than waitForURL, which carries
    // navigation semantics this never triggers.
    await expect(this.page).toHaveURL(term ? /[?&]q=/ : /\/issues(\?|$)/);
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

  assigneeSelect(issueKey: string): Locator {
    return this.page.getByTestId(`assign-${issueKey}`);
  }

  async assign(issueKey: string, userId: string): Promise<void> {
    await this.assigneeSelect(issueKey).selectOption(userId);
  }

  dueBadge(issueKey: string): Locator {
    return this.row(issueKey).getByTestId('due-badge');
  }

  prioritySelect(issueKey: string): Locator {
    return this.page.getByTestId(`priority-${issueKey}`);
  }

  async setPriority(issueKey: string, priority: string): Promise<void> {
    await this.prioritySelect(issueKey).selectOption(priority);
  }

  assigneeChip(value: string): Locator {
    return this.page.getByTestId(`assignee-chip-${value}`);
  }

  async filterByAssignee(value: string): Promise<void> {
    await this.assigneeChip(value).click();
  }

  labelChip(label: string): Locator {
    return this.page.getByTestId(`label-filter-${label}`);
  }

  async toggleLabel(label: string): Promise<void> {
    await this.labelChip(label).click();
  }

  async sortBy(field: 'key' | 'title' | 'priority' | 'createdAt' | 'dueOn'): Promise<void> {
    await this.page.getByTestId(`sort-${field}`).click();
  }
}
