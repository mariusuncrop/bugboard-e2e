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

export const issueSchema = z.object({
  id: z.string(),
  key: z.string().regex(/^(BUG|TASK)-\d+$/),
  title: z.string(),
  description: z.string(),
  type: z.enum(['bug', 'task']),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assigneeId: z.string().nullable(),
  reporterId: z.string(),
  labels: z.array(z.string()),
  position: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  assignee: userSummarySchema.nullable(),
  reporter: userSummarySchema.nullable(),
  commentCount: z.number().int(),
  attachmentCount: z.number().int(),
});

export const issuePageSchema = z.object({
  items: z.array(issueSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
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

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});

export type Issue = z.infer<typeof issueSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type ApiErrorBody = z.infer<typeof errorSchema>;
