import type { Locator, Page } from '@playwright/test';
import { dropFiles } from '../support/dragAndDrop.js';
import { PROJECTS } from '../support/env.js';

export interface NewIssueInput {
  title?: string;
  description?: string;
  type?: 'bug' | 'task';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  assignee?: string;
  dueOn?: string;
  labels?: string;
  /** Local paths to attach before submitting. */
  files?: string[];
}

export class NewIssuePage {
  readonly form: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly type: Locator;
  readonly priority: Locator;
  readonly status: Locator;
  readonly assignee: Locator;
  readonly dueOn: Locator;
  readonly labels: Locator;
  readonly linkType: Locator;
  readonly linkSearch: Locator;
  readonly linkResults: Locator;
  readonly pendingLinks: Locator;
  readonly pendingLinksEmpty: Locator;
  readonly submit: Locator;
  readonly cancel: Locator;
  readonly attachmentInput: Locator;
  readonly attachmentDropZone: Locator;
  readonly pendingAttachments: Locator;
  readonly pendingAttachmentsEmpty: Locator;
  readonly attachmentError: Locator;
  readonly titleError: Locator;
  readonly labelsError: Locator;
  readonly formError: Locator;

  constructor(readonly page: Page) {
    this.form = page.getByTestId('issue-form');
    this.title = page.getByTestId('issue-title');
    this.description = page.getByTestId('issue-description');
    this.type = page.getByTestId('issue-type');
    this.priority = page.getByTestId('issue-priority');
    this.status = page.getByTestId('issue-status');
    this.assignee = page.getByTestId('issue-assignee');
    this.dueOn = page.getByTestId('issue-due-on');
    this.labels = page.getByTestId('issue-labels');
    this.linkType = page.getByTestId('new-link-type');
    this.linkSearch = page.getByTestId('new-link-target');
    this.linkResults = page.getByTestId('new-link-target-results');
    this.pendingLinks = page.getByTestId('pending-links');
    this.pendingLinksEmpty = page.getByTestId('pending-links-empty');
    this.submit = page.getByTestId('issue-submit');
    this.cancel = page.getByTestId('issue-cancel');
    this.attachmentInput = page.getByTestId('issue-attachment-input');
    this.attachmentDropZone = page.getByTestId('issue-attachment-dropzone');
    this.pendingAttachments = page.getByTestId('pending-attachments');
    this.pendingAttachmentsEmpty = page.getByTestId('pending-attachments-empty');
    this.attachmentError = page.getByTestId('error-attachments');
    this.titleError = page.getByTestId('error-title');
    this.labelsError = page.getByTestId('error-labels');
    this.formError = page.getByTestId('form-error');
  }

  async goto(projectKey: string = PROJECTS.main): Promise<void> {
    await this.page.goto(`/projects/${projectKey.toLowerCase()}/issues/new`);
    await this.form.waitFor();
  }

  async fill(input: NewIssueInput): Promise<void> {
    if (input.title !== undefined) await this.title.fill(input.title);
    if (input.description !== undefined) await this.description.fill(input.description);
    if (input.type) await this.type.selectOption(input.type);
    if (input.priority) await this.priority.selectOption(input.priority);
    if (input.status) await this.status.selectOption(input.status);
    if (input.assignee) await this.assignee.selectOption({ label: input.assignee });
    if (input.dueOn !== undefined) await this.dueOn.fill(input.dueOn);
    if (input.labels !== undefined) await this.labels.fill(input.labels);
    if (input.files) await this.attachFiles(input.files);
  }

  /**
   * The input accepts several files at once, and the page appends rather than
   * replaces, so calling this twice builds up a list.
   */
  async attachFiles(paths: string[]): Promise<void> {
    await this.attachmentInput.setInputFiles(paths);
  }

  /** Drops files onto the form rather than choosing them through the picker. */
  async dropFiles(paths: string[]): Promise<void> {
    await dropFiles(this.page, this.attachmentDropZone, paths);
  }

  linkOption(issueKey: string): Locator {
    // Issue keys are uppercase; the picker finds them whatever you type.
    return this.page.getByTestId(`new-link-target-option-${issueKey.toUpperCase()}`);
  }

  pendingLink(issueKey: string): Locator {
    return this.page.getByTestId(`pending-link-${issueKey}`);
  }

  async searchForLink(term: string): Promise<void> {
    await this.linkSearch.fill(term);
    await this.linkResults.waitFor();
  }

  /** Picks an issue to link once this one has been created. */
  async addLink(type: string, targetKey: string): Promise<void> {
    await this.linkType.selectOption(type);
    await this.searchForLink(targetKey);
    await this.linkOption(targetKey).click();
  }

  async removeLink(issueKey: string): Promise<void> {
    await this.page.getByTestId(`remove-link-${issueKey}`).click();
  }

  pendingAttachment(filename: string): Locator {
    return this.page.getByTestId(`pending-attachment-${filename}`);
  }

  async removePending(filename: string): Promise<void> {
    await this.page.getByTestId(`remove-pending-${filename}`).click();
  }

  async submitForm(): Promise<void> {
    await this.submit.click();
  }

  async create(input: NewIssueInput): Promise<void> {
    await this.fill(input);
    await this.submitForm();
  }
}
