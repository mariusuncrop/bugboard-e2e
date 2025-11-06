import { expect, test } from '../../src/fixtures/index.js';
import { uniqueTitle } from '../../src/support/data.js';

test.describe('linking issues through the UI', () => {
  test('links two issues and shows how they relate', async ({ api, issueDetail, tempIssue, toast }) => {
    const other = await api.createIssue({ title: uniqueTitle('The other one') });

    try {
      await issueDetail.goto(tempIssue.key);
      await expect(issueDetail.linksEmpty).toBeVisible();

      await issueDetail.addLink('blocks', other.key);

      await expect(toast).toContainText(`${tempIssue.key} now blocks ${other.key}`);
      await expect(issueDetail.linkTo(other.key)).toBeVisible();
      await expect(issueDetail.linkTo(other.key).getByTestId('link-wording')).toHaveText('blocks');
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('the other issue shows the reverse wording', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('Blocked one') });

    try {
      await api.linkIssues(tempIssue.key, 'blocks', other.key);

      await issueDetail.goto(other.key);

      await expect(issueDetail.linkTo(tempIssue.key).getByTestId('link-wording')).toHaveText('is blocked by');
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('a linked issue can be opened from the link', async ({ api, issueDetail, tempIssue, page }) => {
    const other = await api.createIssue({ title: uniqueTitle('Jump target') });

    try {
      await api.linkIssues(tempIssue.key, 'relates', other.key);
      await issueDetail.goto(tempIssue.key);

      await issueDetail.linkTo(other.key).getByTestId('link-key').click();

      await expect(page).toHaveURL(new RegExp(`/issues/${other.key}$`));
      await expect(issueDetail.title).toHaveText(other.title);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('shows the status of the issue at the other end', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('In review'), status: 'in_review' });

    try {
      await api.linkIssues(tempIssue.key, 'relates', other.key);
      await issueDetail.goto(tempIssue.key);

      await expect(issueDetail.linkTo(other.key).getByTestId('status-badge')).toHaveAttribute(
        'data-status',
        'in_review',
      );
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('unlinks again', async ({ api, issueDetail, tempIssue, toast }) => {
    const other = await api.createIssue({ title: uniqueTitle('Temporarily linked') });

    try {
      await api.linkIssues(tempIssue.key, 'relates', other.key);
      await issueDetail.goto(tempIssue.key);

      await issueDetail.removeLink(other.key);

      await expect(toast).toContainText('Link removed.');
      await expect(issueDetail.linksEmpty).toBeVisible();
      expect(await api.listLinks(tempIssue.key)).toHaveLength(0);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('reports a key that matches nothing', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.addLink('relates', 'WEB-999999');

    await expect(issueDetail.linkError).toContainText('WEB-999999');
    await expect(issueDetail.linksEmpty).toBeVisible();
  });

  test('refuses to link an issue to itself, with a reason', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.addLink('relates', tempIssue.key);

    await expect(issueDetail.linkError).toHaveText('An issue cannot be linked to itself.');
  });

  test('refuses a second link between the same pair', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('Already linked') });

    try {
      await api.linkIssues(tempIssue.key, 'relates', other.key);
      await issueDetail.goto(tempIssue.key);

      await issueDetail.addLink('blocks', other.key);

      await expect(issueDetail.linkError).toContainText('already linked');
      await expect(issueDetail.linkRows()).toHaveCount(1);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('accepts a key typed in lower case', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('Lower case target') });

    try {
      await issueDetail.goto(tempIssue.key);

      await issueDetail.addLink('relates', other.key.toLowerCase());

      await expect(issueDetail.linkTo(other.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });
});
