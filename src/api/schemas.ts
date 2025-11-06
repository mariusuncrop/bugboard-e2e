import { z } from 'zod';

/**
 * Response schemas double as contract assertions: `parse` throws the moment the
 * API changes shape, so a rename is caught by the API suite rather than by a
 * confusing UI failure three specs later.
 */
export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarColor: z.string(),
});

export const projectSummarySchema = z.object({
  id: z.string(),
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/),
  name: z.string(),
  description: z.string(),
  issueCount: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const projectMemberSchema = userSummarySchema.extend({
  role: z.enum(['admin', 'member']),
});

export const projectSchema = projectSummarySchema.extend({
  members: z.array(projectMemberSchema),
});

export const issueSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Project key, then a number that restarts at 1 in every project. */
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,5}-\d+$/),
  title: z.string(),
  description: z.string(),
  type: z.enum(['bug', 'task']),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assigneeId: z.string().nullable(),
  reporterId: z.string(),
  labels: z.array(z.string()),
  position: z.number().int(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dueState: z.enum(['overdue', 'today', 'soon', 'later', 'none']),
  daysUntilDue: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  assignee: userSummarySchema.nullable(),
  reporter: userSummarySchema.nullable(),
  commentCount: z.number().int(),
  linkCount: z.number().int(),
  parent: z.object({ id: z.string(), key: z.string(), title: z.string(), status: z.string() }).nullable(),
  ancestors: z.array(z.object({ id: z.string(), key: z.string(), title: z.string() })),
  childCount: z.number().int(),
  attachmentCount: z.number().int(),
  project: z.object({ id: z.string(), key: z.string(), name: z.string() }).nullable(),
});

export const issuePageSchema = z.object({
  items: z.array(issueSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const issueLinkSchema = z.object({
  id: z.string(),
  type: z.enum(['relates', 'blocks', 'duplicates']),
  direction: z.enum(['outward', 'inward']),
  wording: z.string(),
  issue: z
    .object({ id: z.string(), key: z.string(), title: z.string(), status: z.string(), type: z.string() })
    .nullable(),
});

export const commentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  author: userSummarySchema.nullable(),
});

export const attachmentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  url: z.string(),
  createdAt: z.string().datetime(),
  uploadedBy: userSummarySchema.nullable(),
});

export const boardSchema = z.object({
  columns: z
    .array(
      z.object({
        status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
        title: z.string(),
        issues: z.array(issueSchema),
      }),
    )
    .length(5),
});

export const statsSchema = z.object({
  total: z.number().int(),
  open: z.number().int(),
  done: z.number().int(),
  unassigned: z.number().int(),
  byStatus: z.record(z.number().int()),
  byPriority: z.record(z.number().int()),
  byType: z.object({ bug: z.number().int(), task: z.number().int() }),
  byAssignee: z.array(
    z.object({ id: z.string(), name: z.string(), avatarColor: z.string(), open: z.number().int() }),
  ),
});

export const appConfigSchema = z.object({
  upload: z.object({
    maxBytes: z.number().int().positive(),
    allowedMimeTypes: z.array(z.string()).nonempty(),
  }),
});

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});

export type Issue = z.infer<typeof issueSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type Comment = z.infer<typeof commentSchema>;
export type IssueLink = z.infer<typeof issueLinkSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type ApiErrorBody = z.infer<typeof errorSchema>;
