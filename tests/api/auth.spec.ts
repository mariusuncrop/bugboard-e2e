import { errorSchema } from '../../src/api/schemas.js';
import { expect, test } from '../../src/fixtures/index.js';
import { env } from '../../src/support/env.js';

test.describe('POST /api/auth/login', () => {
  test('issues a token for valid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: env.admin.email, password: env.admin.password },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ email: env.admin.email, role: 'admin' });
    expect(body.user, 'the password must never be returned').not.toHaveProperty('password');
  });

  test('rejects a wrong password without revealing which field was wrong', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: env.admin.email, password: 'definitely-not-it' },
    });

    expect(response.status()).toBe(401);
    const body = errorSchema.parse(await response.json());
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Invalid email or password.');
  });

  test('rejects an unknown email with the same message', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'nobody@bugboard.dev', password: env.admin.password },
    });

    expect(response.status()).toBe(401);
    expect((await response.json()).error.message).toBe('Invalid email or password.');
  });

  test('returns a field error for each invalid input', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: { email: 'not-an-email', password: '' } });

    expect(response.status()).toBe(400);
    const body = errorSchema.parse(await response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual([
      { path: 'email', message: 'Enter a valid email address.' },
      { path: 'password', message: 'Password is required.' },
    ]);
  });
});

test.describe('authenticated access', () => {
  test('GET /api/auth/me returns the token holder', async ({ request, api }) => {
    const response = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${api.token}` },
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).user).toMatchObject({ email: env.admin.email, role: 'admin' });
  });

  test('protected endpoints reject a missing token', async ({ request }) => {
    const response = await request.get('/api/issues');

    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe('UNAUTHORIZED');
  });

  test('protected endpoints reject a malformed token', async ({ request }) => {
    const response = await request.get('/api/issues', { headers: { Authorization: 'Bearer not.a.jwt' } });

    expect(response.status()).toBe(401);
  });
});
