import { expect, test } from '../../src/fixtures/index.js';
import { env } from '../../src/support/env.js';

// This file is the one place that drives the login form. Everywhere else reuses
// the storage state saved by tests/auth.setup.ts.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('signing in', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('signs in and lands on the home page', async ({ loginPage, page, header }) => {
    await loginPage.signIn(env.admin.email, env.admin.password);

    await expect(page).toHaveURL(/\/$/);
    await expect(header.userName).toHaveText('Ada Whitfield');
  });

  test('shows a field error for each empty input without calling the API', async ({ loginPage, page }) => {
    let loginRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login')) loginRequests += 1;
    });

    await loginPage.submit.click();

    await expect(loginPage.emailError).toHaveText('Email is required.');
    await expect(loginPage.passwordError).toHaveText('Password is required.');
    expect(loginRequests, 'client-side validation should short-circuit the request').toBe(0);
  });

  test('rejects a malformed email before submitting', async ({ loginPage }) => {
    await loginPage.signIn('not-an-email', 'whatever');

    await expect(loginPage.emailError).toHaveText('Enter a valid email address.');
  });

  test('surfaces the server message for wrong credentials', async ({ loginPage }) => {
    await loginPage.signIn(env.admin.email, 'wrong-password');

    await expect(loginPage.formError).toHaveText('Invalid email or password.');
    await expect(loginPage.formError).toHaveRole('alert');
  });

  test('disables the submit button while the request is in flight', async ({ loginPage, page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await loginPage.email.fill(env.admin.email);
    await loginPage.password.fill(env.admin.password);
    await loginPage.submit.click();

    await expect(loginPage.submit).toBeDisabled();
    await expect(loginPage.submit).toHaveText('Signing in…');
  });

  test('reports a network failure instead of hanging', async ({ loginPage, page }) => {
    await page.route('**/api/auth/login', (route) => route.abort('failed'));

    await loginPage.signIn(env.admin.email, env.admin.password);

    await expect(loginPage.formError).toContainText('Could not reach the server');
  });

  test('a demo account button fills the form', async ({ loginPage, page }) => {
    await loginPage.demoAccount(env.admin.email).click();

    await expect(loginPage.email).toHaveValue(env.admin.email);
    await expect(loginPage.password).toHaveValue('Password123!');

    await loginPage.submit.click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('protected routes', () => {
  test('an anonymous visitor is redirected to the login page', async ({ page }) => {
    await page.goto('/projects/web/issues');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('after signing in the visitor lands on the page they asked for', async ({ page, loginPage }) => {
    await page.goto('/projects/web/dashboard');
    await expect(page).toHaveURL(/\/login$/);

    await loginPage.signIn(env.admin.email, env.admin.password);

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('an invalid stored token sends the visitor back to login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => window.localStorage.setItem('bugboard.token', 'tampered.token.value'));

    await page.goto('/projects/web/board');

    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('signing out', () => {
  test('clears the session and leaves protected pages unreachable', async ({ page, loginPage, header }) => {
    await test.step('sign in', async () => {
      await loginPage.goto();
      await loginPage.signIn(env.admin.email, env.admin.password);
      await expect(page).toHaveURL(/\/$/);
    });

    await test.step('sign out', async () => {
      await header.logout();
      await expect(page).toHaveURL(/\/login$/);
    });

    await test.step('the stored token is gone', async () => {
      expect(await page.evaluate(() => window.localStorage.getItem('bugboard.token'))).toBeNull();
    });

    await test.step('a protected page is no longer reachable', async () => {
      // Both sign-in and sign-out navigate with `replace`, so there is no /board
      // entry left in history to go back to — visiting it directly is the check
      // that actually means something here.
      await page.goto('/projects/web/board');
      await expect(page).toHaveURL(/\/login$/);
    });
  });
});

test.describe('what is loaded once a session begins', () => {
  // Every other UI spec starts already authenticated, which meant nothing
  // covered data fetched by a provider mounted above the router: it ran once on
  // the login page, got a 401, and never tried again once the visitor signed in.
  test('the project list is populated after signing in through the form', async ({
    loginPage,
    projectsPage,
    homePage,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.signIn(env.admin.email, env.admin.password);
    await expect(homePage.root).toBeVisible();

    // Navigate inside the app rather than calling goto: a fresh page load
    // remounts every provider and would hide the very thing this covers.
    await homePage.allProjectsLink.click();
    await expect(page).toHaveURL(/\/projects$/);

    await expect(projectsPage.list).toBeVisible();
    await expect(projectsPage.empty, 'the visitor is an admin and sees every project').toHaveCount(0);
    expect((await projectsPage.visibleKeys()).length).toBeGreaterThan(0);
  });

  test('the project switcher is populated too', async ({ loginPage, homePage, projectsPage, page }) => {
    await loginPage.goto();
    await loginPage.signIn(env.admin.email, env.admin.password);
    await expect(homePage.root).toBeVisible();

    await homePage.allProjectsLink.click();
    await projectsPage.open('WEB');

    // Options inside a select are never "visible" to Playwright; count them.
    await expect(page.getByTestId('project-select').getByRole('option')).not.toHaveCount(0);
  });

  test('signing in as someone else replaces the previous list', async ({
    loginPage,
    projectsPage,
    homePage,
    header,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.signIn(env.admin.email, env.admin.password);
    // Wait for the session to be established before navigating: going straight
    // to /projects can outrun the login request and bounce back to /login.
    await expect(homePage.root).toBeVisible();

    await projectsPage.goto();
    const asAdmin = await projectsPage.visibleKeys();

    await header.logout();
    // Signing out from /projects means signing back in returns there.
    await loginPage.signIn(env.member.email, env.member.password);
    await expect(page).toHaveURL(/\/projects$/);
    await expect(projectsPage.list.or(projectsPage.empty).first()).toBeVisible();

    const asMember = await projectsPage.visibleKeys();
    expect(asMember.length, 'a member sees fewer projects than an admin').toBeLessThan(asAdmin.length);
    expect(asMember).not.toContain('MOB');
  });

  test('signing out empties the list rather than leaving it behind', async ({ loginPage, page, header }) => {
    await loginPage.goto();
    await loginPage.signIn(env.admin.email, env.admin.password);

    await header.logout();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/projects');
    await expect(page, 'a signed-out visitor never reaches the list').toHaveURL(/\/login$/);
  });
});
