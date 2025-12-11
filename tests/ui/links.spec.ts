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

test.describe('finding the issue to link', () => {
  test('searches by part of the title', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('Distinctive phrase here') });

    try {
      await issueDetail.goto(tempIssue.key);

      await issueDetail.searchForLink('Distinctive phrase');

      await expect(issueDetail.linkOption(other.key)).toBeVisible();
      await expect(issueDetail.linkOption(other.key)).toContainText(other.title);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('searches by key', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('Findable by key') });

    try {
      await issueDetail.goto(tempIssue.key);

      await issueDetail.searchForLink(other.key);

      await expect(issueDetail.linkOption(other.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('never offers the issue you are already on', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.searchForLink(tempIssue.title);

    // Linking an issue to itself is refused by the server; the picker simply
    // never suggests it.
    await expect(issueDetail.linkOption(tempIssue.key)).toHaveCount(0);
  });

  test('stops offering an issue once it is linked', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('Linked once already') });

    try {
      await issueDetail.goto(tempIssue.key);
      await issueDetail.addLink('relates', other.key);
      await expect(issueDetail.linkTo(other.key)).toBeVisible();

      await issueDetail.searchForLink(other.key);

      await expect(issueDetail.linkOption(other.key)).toHaveCount(0);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('says so when nothing matches', async ({ issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.searchForLink('zzz-no-issue-is-called-this-zzz');

    await expect(issueDetail.linkNoMatches).toBeVisible();
  });

  test('can be driven from the keyboard alone', async ({ api, issueDetail, tempIssue }) => {
    const other = await api.createIssue({ title: uniqueTitle('Reachable by keyboard') });

    try {
      await issueDetail.goto(tempIssue.key);
      await issueDetail.searchForLink('Reachable by keyboard');
      await expect(issueDetail.linkOption(other.key)).toBeVisible();

      await issueDetail.linkSearch.press('Enter');

      await expect(issueDetail.linkTo(other.key)).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('only offers issues from this project', async ({ api, issueDetail, tempIssue }) => {
    const elsewhere = await api.createIssue({ title: uniqueTitle('Somewhere else entirely') }, 'MOB');

    try {
      await issueDetail.goto(tempIssue.key);

      await issueDetail.searchForLink('Somewhere else entirely');

      await expect(issueDetail.linkOption(elsewhere.key)).toHaveCount(0);
      await expect(issueDetail.linkNoMatches).toBeVisible();
    } finally {
      await api.deleteIssueIfPresent(elsewhere.key);
    }
  });
});

test.describe('linking while creating an issue', () => {
  test('links the new issue to one that already exists', async ({ api, newIssuePage, issueDetail, page }) => {
    const other = await api.createIssue({ title: uniqueTitle('Existing work') });
    const title = uniqueTitle('Created with a link');

    try {
      await newIssuePage.goto();
      await newIssuePage.fill({ title });
      await expect(newIssuePage.pendingLinksEmpty).toBeVisible();

      await newIssuePage.addLink('blocks', other.key);
      await expect(newIssuePage.pendingLink(other.key)).toContainText(other.title);

      await newIssuePage.submitForm();
      await expect(page).toHaveURL(/\/issues\/WEB-\d+$/);

      await expect(issueDetail.linkTo(other.key).getByTestId('link-wording')).toHaveText('blocks');

      const key = (await issueDetail.key.textContent())!;
      expect((await api.listLinks(key))).toHaveLength(1);
      await api.deleteIssueIfPresent(key);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('links to more than one issue at once', async ({ api, newIssuePage, issueDetail }) => {
    const first = await api.createIssue({ title: uniqueTitle('First target') });
    const second = await api.createIssue({ title: uniqueTitle('Second target') });

    try {
      await newIssuePage.goto();
      await newIssuePage.fill({ title: uniqueTitle('Created with two links') });
      await newIssuePage.addLink('relates', first.key);
      await newIssuePage.addLink('duplicates', second.key);

      await newIssuePage.submitForm();

      await expect(issueDetail.linkTo(first.key)).toBeVisible();
      await expect(issueDetail.linkTo(second.key)).toBeVisible();

      const key = (await issueDetail.key.textContent())!;
      await api.deleteIssueIfPresent(key);
    } finally {
      await api.deleteIssueIfPresent(first.key);
      await api.deleteIssueIfPresent(second.key);
    }
  });

  test('a link can be dropped before the issue is created', async ({ api, newIssuePage, issueDetail }) => {
    const other = await api.createIssue({ title: uniqueTitle('Changed my mind about this') });

    try {
      await newIssuePage.goto();
      await newIssuePage.fill({ title: uniqueTitle('Created without the link') });
      await newIssuePage.addLink('relates', other.key);
      await expect(newIssuePage.pendingLink(other.key)).toBeVisible();

      await newIssuePage.removeLink(other.key);

      await expect(newIssuePage.pendingLinksEmpty).toBeVisible();

      await newIssuePage.submitForm();
      await expect(issueDetail.linksEmpty).toBeVisible();

      const key = (await issueDetail.key.textContent())!;
      await api.deleteIssueIfPresent(key);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });

  test('still opens the issue when a link fails after it was created', async ({
    api,
    newIssuePage,
    issueDetail,
    page,
    toast,
  }) => {
    const other = await api.createIssue({ title: uniqueTitle('Doomed link target') });

    try {
      await newIssuePage.goto();
      await newIssuePage.fill({ title: uniqueTitle('Created, link failed') });
      await newIssuePage.addLink('relates', other.key);

      await page.route('**/links', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
          : route.continue(),
      );

      await newIssuePage.submitForm();

      await expect(toast).toContainText('created, but 1 issue could not be linked');
      await expect(page).toHaveURL(/\/issues\/WEB-\d+$/);

      const key = (await issueDetail.key.textContent())!;
      await api.deleteIssueIfPresent(key);
    } finally {
      await api.deleteIssueIfPresent(other.key);
    }
  });
});
