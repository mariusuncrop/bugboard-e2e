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
