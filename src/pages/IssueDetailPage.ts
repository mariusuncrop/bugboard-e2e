import type { Locator, Page } from '@playwright/test';
import { dropFiles } from '../support/dragAndDrop.js';

export class IssueDetailPage {
  readonly root: Locator;
  readonly loading: Locator;
  readonly notFound: Locator;
  readonly key: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly labels: Locator;
  readonly statusSelect: Locator;
  readonly prioritySelect: Locator;
  readonly assigneeSelect: Locator;
  readonly assignee: Locator;
  readonly statusBadge: Locator;
  readonly commentList: Locator;
  readonly comments: Locator;
  readonly commentBody: Locator;
  readonly commentSubmit: Locator;
  readonly commentError: Locator;
  readonly attachmentInput: Locator;
  readonly attachmentDropZone: Locator;
  readonly attachmentList: Locator;
  readonly deleteButton: Locator;
  readonly deleteHint: Locator;
  readonly confirmDialog: Locator;
  readonly confirmAccept: Locator;
  readonly confirmCancel: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId('issue-detail');
    this.loading = page.getByTestId('issue-loading');
    this.notFound = page.getByTestId('issue-not-found');
    this.key = page.getByTestId('issue-key');
    this.title = page.getByTestId('issue-title');
    this.description = page.getByTestId('issue-description');
    this.labels = page.getByTestId('issue-labels');
    this.statusSelect = page.getByTestId('issue-status-select');
    this.prioritySelect = page.getByTestId('issue-priority-select');
    this.assigneeSelect = page.getByTestId('issue-assignee-select');
    this.assignee = page.getByTestId('issue-assignee');
    this.statusBadge = page.getByTestId('issue-side').getByTestId('status-badge');
    this.commentList = page.getByTestId('comment-list');
    this.comments = page.locator('[data-testid^="comment-cmt_"]');
    this.commentBody = page.getByTestId('comment-body');
    this.commentSubmit = page.getByTestId('comment-submit');
    this.commentError = page.getByTestId('error-comment');
    this.attachmentInput = page.getByTestId('attachment-input');
    this.attachmentDropZone = page.getByTestId('attachment-dropzone');
    this.attachmentList = page.getByTestId('attachment-list');
    this.deleteButton = page.getByTestId('delete-issue');
    this.deleteHint = page.getByTestId('delete-issue-hint');
    this.confirmDialog = page.getByTestId('confirm-dialog');
    this.confirmAccept = page.getByTestId('confirm-accept');
    this.confirmCancel = page.getByTestId('confirm-cancel');
  }

  async goto(issueKey: string): Promise<void> {
    await this.page.goto(`/issues/${issueKey}`);
    await this.root.waitFor();
  }

  async setStatus(status: string): Promise<void> {
    await this.statusSelect.selectOption(status);
  }

  async setPriority(priority: string): Promise<void> {
    await this.prioritySelect.selectOption(priority);
  }

  async assignTo(name: string): Promise<void> {
    await this.assigneeSelect.selectOption({ label: name });
  }

  async addComment(body: string): Promise<void> {
    await this.page.getByTestId('comment-body').fill(body);
    await this.commentSubmit.click();
  }

  commentWithText(text: string): Locator {
    return this.commentList.locator('li', { hasText: text });
  }

  attachment(filename: string): Locator {
    return this.page.getByTestId(`attachment-${filename}`);
  }

  async uploadFile(path: string): Promise<void> {
    await this.attachmentInput.setInputFiles(path);
  }

  /** Drops files onto the attachments card rather than choosing them. */
  async dropFiles(paths: string[]): Promise<void> {
    await dropFiles(this.page, this.attachmentDropZone, paths);
  }

  async deleteIssue(): Promise<void> {
    await this.deleteButton.click();
    await this.confirmDialog.waitFor();
    await this.confirmAccept.click();
  }
}
