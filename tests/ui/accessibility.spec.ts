import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '../../src/fixtures/index.js';

/**
 * Automated checks catch roughly a third of accessibility defects, so treat a
 * green run as a floor rather than a pass mark. Everything here is scoped to
 * WCAG 2.1 A and AA, which is the bar most teams are actually held to.
 */
const scan = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

test.describe('accessibility', () => {
  test('the board has no detectable violations', async ({ page, boardPage }) => {
    await boardPage.goto();

    const results = await scan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('the issue list has no detectable violations', async ({ page, issuesPage }) => {
    await issuesPage.goto();
    await expect(issuesPage.table).toBeVisible();

    const results = await scan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('the issue detail page has no detectable violations', async ({ page, issueDetail }) => {
    await issueDetail.goto('WEB-1');

    const results = await scan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('the new issue form has no detectable violations', async ({ page, newIssuePage }) => {
    await newIssuePage.goto();

    const results = await scan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('the confirmation dialog is announced as a modal', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);
    await issueDetail.deleteButton.click();

    await expect(issueDetail.confirmDialog).toHaveAttribute('role', 'dialog');
    await expect(issueDetail.confirmDialog).toHaveAttribute('aria-modal', 'true');
    await expect(issueDetail.confirmAccept).toBeFocused();
  });

  test('the login form is reachable and usable with the keyboard alone', async ({ page, loginPage }) => {
    await test.step('start from a signed-out login page', async () => {
      await page.context().clearCookies();
      await page.goto('/login');
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
    });

    await test.step('tab to the email field and type', async () => {
      await page.keyboard.press('Tab');
      await expect(loginPage.email).toBeFocused();
      await page.keyboard.type('admin@bugboard.dev');
    });

    await test.step('tab to the password field and type', async () => {
      await page.keyboard.press('Tab');
      await expect(loginPage.password).toBeFocused();
      await page.keyboard.type('Password123!');
    });

    await test.step('Enter submits the form', async () => {
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/$/);
    });
  });
});
