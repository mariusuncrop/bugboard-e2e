import { expect, test } from '../../src/fixtures/index.js';

test.describe('navigation and chrome', () => {
  test('moves between the three main views', async ({ page, header, boardPage, issuesPage, dashboard }) => {
    await test.step('start on the board', async () => {
      await page.goto('/board');
      await expect(boardPage.board).toBeVisible();
    });

    await test.step('go to the issue list', async () => {
      await header.issuesLink.click();
      await expect(page).toHaveURL(/\/issues$/);
      await expect(issuesPage.table).toBeVisible();
    });

    await test.step('go to the dashboard', async () => {
      await header.dashboardLink.click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(dashboard.root).toBeVisible({ timeout: 15_000 });
    });

    await test.step('return to the board', async () => {
      await header.boardLink.click();
      await expect(boardPage.board).toBeVisible();
    });
  });

  test('the root path lands on the board', async ({ page, boardPage }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/board$/);
    await expect(boardPage.board).toBeVisible();
  });

  test('an unknown route shows the not-found page', async ({ page }) => {
    await page.goto('/nowhere-in-particular');

    await expect(page.getByTestId('not-found-page')).toBeVisible();
  });

  test('the user menu shows who is signed in', async ({ header }) => {
    await header.page.goto('/board');

    await header.openUserMenu();

    await expect(header.userRole).toHaveText('admin');
    await expect(header.page.getByTestId('user-menu-email')).toHaveText('admin@bugboard.dev');
  });

  test('the theme toggle switches themes and survives a reload', async ({ page, header }) => {
    await page.goto('/board');
    const before = await header.currentTheme();

    const after = await test.step('toggle the theme', async () => {
      await header.toggleTheme();
      const theme = await header.currentTheme();
      expect(theme).not.toBe(before);
      return theme;
    });

    await test.step('the choice survives a reload', async () => {
      await page.reload();
      expect(await header.currentTheme()).toBe(after);
    });
  });

  test('a toast can be dismissed', async ({ page, boardPage, tempIssue, toast }) => {
    await boardPage.goto();
    await boardPage.moveViaSelect(tempIssue.key, 'todo');
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Dismiss notification' }).click();

    await expect(page.getByTestId('toast')).toHaveCount(0);
  });
});
