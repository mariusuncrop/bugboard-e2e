import { request as playwrightRequest, type APIRequestContext, type APIResponse } from '@playwright/test';
import { PROJECTS, env } from '../support/env.js';
import {
  appConfigSchema,
  attachmentSchema,
  projectMemberSchema,
  projectSchema,
  projectSummarySchema,
  boardSchema,
  commentSchema,
  issueLinkSchema,
  issuePageSchema,
  issueSchema,
  statsSchema,
  type Attachment,
  type Comment,
  type Issue,
  type IssueLink,
  type Project,
} from './schemas.js';

export interface IssueInput {
  title: string;
  type?: 'bug' | 'task';
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  assigneeId?: string | null;
  labels?: string[];
  dueOn?: string | null;
  parentId?: string | null;
}

export interface ProjectInput {
  key: string;
  name: string;
  description?: string;
  memberIds?: string[];
}

export interface ListQuery {
  q?: string;
  status?: string;
  priority?: string;
  type?: string;
  assigneeId?: string;
  label?: string;
  due?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * A thin, typed wrapper over the BugBoard API.
 *
 * UI specs use it to arrange state quickly — creating an issue over HTTP takes
 * milliseconds where driving the form takes seconds, and a failure in setup then
 * reads as a setup failure rather than a mysterious assertion error.
 *
 * Every method that is expected to succeed validates the response against a zod
 * schema, so a contract change surfaces immediately. Methods ending in `Raw`
 * return the untouched response for negative tests.
 */
export class ApiClient {
  private constructor(
    private readonly context: APIRequestContext,
    readonly token: string,
    readonly user: { id: string; email: string; name: string; role: string },
  ) {}

  static async signIn(email: string, password: string): Promise<ApiClient> {
    const context = await playwrightRequest.newContext({ baseURL: env.apiUrl });
    const response = await context.post('/api/auth/login', { data: { email, password } });

    if (!response.ok()) {
      throw new Error(`Could not sign in as ${email}: ${response.status()} ${await response.text()}`);
    }

    const body = (await response.json()) as { token: string; user: ApiClient['user'] };
    return new ApiClient(context, body.token, body.user);
  }

  static asAdmin(): Promise<ApiClient> {
    return ApiClient.signIn(env.admin.email, env.admin.password);
  }

  static asMember(): Promise<ApiClient> {
    return ApiClient.signIn(env.member.email, env.member.password);
  }

  /** An unauthenticated context, for reset calls and 401 assertions. */
  static async anonymous(): Promise<APIRequestContext> {
    return playwrightRequest.newContext({ baseURL: env.apiUrl });
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }

  private get auth(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  private async expectOk(response: APIResponse, action: string): Promise<APIResponse> {
    if (!response.ok()) {
      throw new Error(`${action} failed: ${response.status()} ${await response.text()}`);
    }
    return response;
  }

  // --- reads ---------------------------------------------------------------

  async listIssues(query: ListQuery = {}, projectKey: string = PROJECTS.main) {
    const response = await this.expectOk(
      await this.context.get(`/api/projects/${projectKey}/issues`, {
        headers: this.auth,
        params: query as Record<string, string>,
      }),
      `List issues in ${projectKey}`,
    );
    return issuePageSchema.parse(await response.json());
  }

  async listIssuesRaw(projectKey: string, query: ListQuery = {}): Promise<APIResponse> {
    return this.context.get(`/api/projects/${projectKey}/issues`, {
      headers: this.auth,
      params: query as Record<string, string>,
    });
  }

  async getIssue(key: string): Promise<Issue> {
    const response = await this.expectOk(
      await this.context.get(`/api/issues/${key}`, { headers: this.auth }),
      `Get issue ${key}`,
    );
    return issueSchema.parse((await response.json()).issue);
  }

  async getIssueRaw(key: string): Promise<APIResponse> {
    return this.context.get(`/api/issues/${key}`, { headers: this.auth });
  }

  async getBoard(projectKey: string = PROJECTS.main) {
    const response = await this.expectOk(
      await this.context.get(`/api/projects/${projectKey}/board`, { headers: this.auth }),
      `Get the ${projectKey} board`,
    );
    return boardSchema.parse(await response.json());
  }

  async getBoardRaw(projectKey: string): Promise<APIResponse> {
    return this.context.get(`/api/projects/${projectKey}/board`, { headers: this.auth });
  }

  async getStats(projectKey: string = PROJECTS.main) {
    const response = await this.expectOk(
      await this.context.get(`/api/projects/${projectKey}/stats`, { headers: this.auth }),
      `Get ${projectKey} stats`,
    );
    return statsSchema.parse(await response.json());
  }

  async getConfig() {
    const response = await this.expectOk(await this.context.get('/api/config', { headers: this.auth }), 'Get config');
    return appConfigSchema.parse(await response.json());
  }

  async getMySummary() {
    const response = await this.expectOk(
      await this.context.get('/api/me/summary', { headers: this.auth }),
      'Get personal summary',
    );
    return (await response.json()) as {
      projects: { key: string; openIssues: number; assignedToMe: number }[];
      assigned: { open: number; overdue: number; done: number; items: { key: string }[] };
    };
  }

  async listProjects() {
    const response = await this.expectOk(
      await this.context.get('/api/projects', { headers: this.auth }),
      'List projects',
    );
    return ((await response.json()).items as unknown[]).map((item) => projectSummarySchema.parse(item));
  }

  async getProject(key: string): Promise<Project> {
    const response = await this.expectOk(
      await this.context.get(`/api/projects/${key}`, { headers: this.auth }),
      `Get project ${key}`,
    );
    return projectSchema.parse((await response.json()).project);
  }

  async getProjectRaw(key: string): Promise<APIResponse> {
    return this.context.get(`/api/projects/${key}`, { headers: this.auth });
  }

  async createProject(input: ProjectInput): Promise<Project> {
    const response = await this.expectOk(
      await this.context.post('/api/projects', { headers: this.auth, data: input }),
      'Create project',
    );
    return projectSchema.parse((await response.json()).project);
  }

  async createProjectRaw(input: Record<string, unknown>): Promise<APIResponse> {
    return this.context.post('/api/projects', { headers: this.auth, data: input });
  }

  async listLabels(key: string) {
    const response = await this.expectOk(
      await this.context.get(`/api/projects/${key}/labels`, { headers: this.auth }),
      `List labels in ${key}`,
    );
    return (await response.json()).items as { label: string; count: number }[];
  }

  async listMembers(key: string) {
    const response = await this.expectOk(
      await this.context.get(`/api/projects/${key}/members`, { headers: this.auth }),
      `List members of ${key}`,
    );
    return ((await response.json()).items as unknown[]).map((item) => projectMemberSchema.parse(item));
  }

  async addMember(key: string, userId: string): Promise<Project> {
    const response = await this.expectOk(
      await this.context.post(`/api/projects/${key}/members`, { headers: this.auth, data: { userId } }),
      `Add ${userId} to ${key}`,
    );
    return projectSchema.parse((await response.json()).project);
  }

  async addMemberRaw(key: string, data: Record<string, unknown>): Promise<APIResponse> {
    return this.context.post(`/api/projects/${key}/members`, { headers: this.auth, data });
  }

  async removeMember(key: string, userId: string): Promise<{ project: Project; unassignedIssues: number }> {
    const response = await this.expectOk(
      await this.context.delete(`/api/projects/${key}/members/${userId}`, { headers: this.auth }),
      `Remove ${userId} from ${key}`,
    );
    const body = await response.json();
    return { project: projectSchema.parse(body.project), unassignedIssues: body.unassignedIssues as number };
  }

  async removeMemberRaw(key: string, userId: string): Promise<APIResponse> {
    return this.context.delete(`/api/projects/${key}/members/${userId}`, { headers: this.auth });
  }

  async listUsers() {
    const response = await this.expectOk(await this.context.get('/api/users', { headers: this.auth }), 'List users');
    return (await response.json()).items as { id: string; name: string; email: string; role: string }[];
  }

  // --- writes --------------------------------------------------------------

  async createIssue(input: IssueInput, projectKey: string = PROJECTS.main): Promise<Issue> {
    const response = await this.expectOk(
      await this.context.post(`/api/projects/${projectKey}/issues`, {
        headers: this.auth,
        data: { type: 'bug', ...input },
      }),
      `Create an issue in ${projectKey}`,
    );
    return issueSchema.parse((await response.json()).issue);
  }

  async createIssueRaw(
    input: Partial<IssueInput> | Record<string, unknown>,
    projectKey: string = PROJECTS.main,
  ): Promise<APIResponse> {
    return this.context.post(`/api/projects/${projectKey}/issues`, { headers: this.auth, data: input });
  }

  async updateIssue(key: string, patch: Partial<IssueInput>): Promise<Issue> {
    const response = await this.expectOk(
      await this.context.patch(`/api/issues/${key}`, { headers: this.auth, data: patch }),
      `Update ${key}`,
    );
    return issueSchema.parse((await response.json()).issue);
  }

  async updateIssueRaw(key: string, patch: Record<string, unknown>): Promise<APIResponse> {
    return this.context.patch(`/api/issues/${key}`, { headers: this.auth, data: patch });
  }

  async moveIssue(key: string, status: string, position = 0): Promise<Issue> {
    const response = await this.expectOk(
      await this.context.post(`/api/issues/${key}/move`, { headers: this.auth, data: { status, position } }),
      `Move ${key}`,
    );
    return issueSchema.parse((await response.json()).issue);
  }

  async deleteIssue(key: string): Promise<void> {
    await this.expectOk(
      await this.context.delete(`/api/issues/${key}`, { headers: this.auth }),
      `Delete ${key}`,
    );
  }

  async deleteIssueRaw(key: string): Promise<APIResponse> {
    return this.context.delete(`/api/issues/${key}`, { headers: this.auth });
  }

  /** Deletes without failing the test if the issue is already gone. */
  async deleteIssueIfPresent(key: string): Promise<void> {
    await this.context.delete(`/api/issues/${key}`, { headers: this.auth });
  }

  async listComments(key: string): Promise<Comment[]> {
    const response = await this.expectOk(
      await this.context.get(`/api/issues/${key}/comments`, { headers: this.auth }),
      `List comments on ${key}`,
    );
    return ((await response.json()).items as unknown[]).map((item) => commentSchema.parse(item));
  }

  async addComment(key: string, body: string): Promise<Comment> {
    const response = await this.expectOk(
      await this.context.post(`/api/issues/${key}/comments`, { headers: this.auth, data: { body } }),
      `Comment on ${key}`,
    );
    return commentSchema.parse((await response.json()).comment);
  }

  async addCommentRaw(key: string, data: Record<string, unknown>): Promise<APIResponse> {
    return this.context.post(`/api/issues/${key}/comments`, { headers: this.auth, data });
  }

  async uploadAttachment(
    key: string,
    file: { name: string; mimeType: string; buffer: Buffer },
  ): Promise<Attachment> {
    const response = await this.expectOk(
      await this.context.post(`/api/issues/${key}/attachments`, { headers: this.auth, multipart: { file } }),
      `Upload to ${key}`,
    );
    return attachmentSchema.parse((await response.json()).attachment);
  }

  async uploadAttachmentRaw(
    key: string,
    file: { name: string; mimeType: string; buffer: Buffer },
  ): Promise<APIResponse> {
    return this.context.post(`/api/issues/${key}/attachments`, { headers: this.auth, multipart: { file } });
  }

  async listChildren(key: string): Promise<Issue[]> {
    const response = await this.expectOk(
      await this.context.get(`/api/issues/${key}/children`, { headers: this.auth }),
      `List children of ${key}`,
    );
    return ((await response.json()).items as unknown[]).map((item) => issueSchema.parse(item));
  }

  async listLinks(key: string): Promise<IssueLink[]> {
    const response = await this.expectOk(
      await this.context.get(`/api/issues/${key}/links`, { headers: this.auth }),
      `List links on ${key}`,
    );
    return ((await response.json()).items as unknown[]).map((item) => issueLinkSchema.parse(item));
  }

  async linkIssues(key: string, type: string, target: string): Promise<IssueLink> {
    const response = await this.expectOk(
      await this.context.post(`/api/issues/${key}/links`, { headers: this.auth, data: { type, target } }),
      `Link ${key} to ${target}`,
    );
    return issueLinkSchema.parse((await response.json()).link);
  }

  async linkIssuesRaw(key: string, data: Record<string, unknown>): Promise<APIResponse> {
    return this.context.post(`/api/issues/${key}/links`, { headers: this.auth, data });
  }

  async unlinkRaw(id: string): Promise<APIResponse> {
    return this.context.delete(`/api/links/${id}`, { headers: this.auth });
  }

  // --- test support --------------------------------------------------------

  /** Restores the app's deterministic seed fixture. */
  static async resetDatabase(): Promise<void> {
    const context = await ApiClient.anonymous();
    try {
      const response = await context.post('/api/test/reset');
      if (!response.ok()) {
        throw new Error(
          `POST /api/test/reset returned ${response.status()}. ` +
            'Start BugBoard with ENABLE_TEST_ENDPOINTS=true.',
        );
      }
    } finally {
      await context.dispose();
    }
  }
}
