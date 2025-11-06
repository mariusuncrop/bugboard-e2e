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
  readonly dueOn: Locator;
  readonly dueBadge: Locator;
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
  readonly subtasks: Locator;
  readonly subtaskList: Locator;
  readonly subtasksEmpty: Locator;
  readonly subtaskTitle: Locator;
  readonly addSubtaskButton: Locator;
  readonly subtaskProgress: Locator;
  readonly subtaskError: Locator;
  readonly links: Locator;
  readonly linkList: Locator;
  readonly linksEmpty: Locator;
  readonly linkType: Locator;
  readonly linkTarget: Locator;
  readonly addLinkButton: Locator;
  readonly linkError: Locator;
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
    this.dueOn = page.getByTestId('issue-due-on');
    this.dueBadge = page.getByTestId('issue-side').getByTestId('due-badge');
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
    this.subtasks = page.getByTestId('subtasks');
    this.subtaskList = page.getByTestId('subtask-list');
    this.subtasksEmpty = page.getByTestId('subtasks-empty');
    this.subtaskTitle = page.getByTestId('subtask-title');
    this.addSubtaskButton = page.getByTestId('add-subtask-button');
    this.subtaskProgress = page.getByTestId('subtask-progress');
    this.subtaskError = page.getByTestId('subtask-error');
    this.links = page.getByTestId('issue-links');
    this.linkList = page.getByTestId('link-list');
    this.linksEmpty = page.getByTestId('links-empty');
    this.linkType = page.getByTestId('link-type');
    this.linkTarget = page.getByTestId('link-target');
    this.addLinkButton = page.getByTestId('add-link-button');
    this.linkError = page.getByTestId('link-error');
    this.deleteButton = page.getByTestId('delete-issue');
    this.deleteHint = page.getByTestId('delete-issue-hint');
    this.confirmDialog = page.getByTestId('confirm-dialog');
    this.confirmAccept = page.getByTestId('confirm-accept');
    this.confirmCancel = page.getByTestId('confirm-cancel');
  }

  /** The project is taken from the key's prefix, so WEB-1 needs no second argument. */
  async goto(issueKey: string, projectKey = issueKey.split('-')[0]!): Promise<void> {
    await this.page.goto(`/projects/${projectKey.toLowerCase()}/issues/${issueKey}`);
    await this.root.waitFor();
  }

  async setStatus(status: string): Promise<void> {
    await this.statusSelect.selectOption(status);
  }

  async setDueOn(date: string): Promise<void> {
    await this.dueOn.fill(date);
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

  subtask(issueKey: string): Locator {
    return this.page.getByTestId(`subtask-${issueKey}`);
  }

  subtaskRows(): Locator {
    return this.subtaskList.locator('li[data-testid^="subtask-"]');
  }

  ancestor(issueKey: string): Locator {
    return this.page.getByTestId(`ancestor-${issueKey}`);
  }

  async addSubtask(title: string): Promise<void> {
    await this.subtaskTitle.fill(title);
    await this.addSubtaskButton.click();
  }

  async detachSubtask(issueKey: string): Promise<void> {
    await this.page.getByTestId(`detach-${issueKey}`).click();
  }

  linkTo(issueKey: string): Locator {
    return this.page.getByTestId(`link-${issueKey}`);
  }

  linkRows(): Locator {
    return this.linkList.locator('li[data-testid^="link-"]');
  }

  async addLink(type: string, targetKey: string): Promise<void> {
    await this.linkType.selectOption(type);
    await this.linkTarget.fill(targetKey);
    await this.addLinkButton.click();
  }

  async removeLink(issueKey: string): Promise<void> {
    await this.page.getByTestId(`unlink-${issueKey}`).click();
  }

  async deleteIssue(): Promise<void> {
    await this.deleteButton.click();
    await this.confirmDialog.waitFor();
    await this.confirmAccept.click();
  }
}
