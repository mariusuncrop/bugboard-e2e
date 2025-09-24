import { boardSchema, statsSchema } from '../../src/api/schemas.js';
import { expect, test } from '../../src/fixtures/index.js';

test.describe('API contract', () => {
  test('the board returns all five columns in workflow order', async ({ api }) => {
    const board = boardSchema.parse(await api.getBoard());

    expect(board.columns.map((column) => column.status)).toEqual([
      'backlog',
      'todo',
      'in_progress',
      'in_review',
      'done',
    ]);
  });

  test('dashboard totals add up', async ({ api }) => {
    const stats = statsSchema.parse(await api.getStats());

    expect(stats.open + stats.done).toBe(stats.total);
    expect(Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0)).toBe(stats.total);
    expect(stats.byType.bug + stats.byType.task).toBe(stats.total);
  });

  test('the upload limits are published for clients to validate against', async ({ api }) => {
    const { upload } = await api.getConfig();

    expect(upload.maxBytes).toBe(2 * 1024 * 1024);
    expect(upload.allowedMimeTypes).toContain('text/plain');
    expect(upload.allowedMimeTypes).not.toContain('application/x-msdownload');
  });

  test('the published limits are the ones actually enforced', async ({ api, tempIssue }) => {
    const { upload } = await api.getConfig();

    const oversized = await api.uploadAttachmentRaw(tempIssue.key, {
      name: 'over.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(upload.maxBytes + 1024, 'a'),
    });
    expect(oversized.status()).toBe(413);

    const allowed = await api.uploadAttachment(tempIssue.key, {
      name: 'under.txt',
      mimeType: upload.allowedMimeTypes[0] === 'image/png' ? 'text/plain' : upload.allowedMimeTypes[0]!,
      buffer: Buffer.from('small enough'),
    });
    expect(allowed.size).toBeGreaterThan(0);
  });

  test('the OpenAPI document is served and describes the login endpoint', async ({ request }) => {
    const response = await request.get('/api/openapi.yaml');

    expect(response.status()).toBe(200);
    const document = await response.text();
    expect(document).toContain('openapi: 3.0.3');
    expect(document).toContain('/api/auth/login');
  });

  test('an unknown API path returns a structured 404, not an HTML page', async ({ request }) => {
    const response = await request.get('/api/not-a-real-endpoint');

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
    expect((await response.json()).error.code).toBe('NOT_FOUND');
  });

  test('the health endpoint needs no authentication', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);
    expect((await response.json()).status).toBe('ok');
  });
});
