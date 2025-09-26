import { expect, test } from '../../src/fixtures/index.js';
import { dragFilesAway, dragFilesOver } from '../../src/support/dragAndDrop.js';
import { oversizedFile, tempFile } from '../../src/support/files.js';

test.describe('attachments', () => {
  test('uploads a file and lists it', async ({ api, issueDetail, tempIssue, toast }) => {
    const path = tempFile('repro-steps.txt', '1. open the app\n2. watch it break\n');
    await issueDetail.goto(tempIssue.key);
    await expect(issueDetail.attachmentList).toContainText('Nothing attached yet.');

    await issueDetail.uploadFile(path);

    await expect(toast).toContainText('repro-steps.txt uploaded.');
    await expect(issueDetail.attachment('repro-steps.txt')).toBeVisible();
    expect((await api.getIssue(tempIssue.key)).attachmentCount).toBe(1);
  });

  test('refuses a file over the size limit without uploading it', async ({ issueDetail, tempIssue, page, toast }) => {
    let uploads = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/attachments')) uploads += 1;
    });

    await issueDetail.goto(tempIssue.key);
    await issueDetail.uploadFile(oversizedFile());

    await expect(toast).toContainText('The limit is 2.0 MB.');
    await expect(issueDetail.attachmentList).toContainText('Nothing attached yet.');
    expect(uploads, 'the file should never leave the browser').toBe(0);
  });

  test('still reports a rejection that only the server can make', async ({ issueDetail, tempIssue, page, toast }) => {
    // The client cannot know every reason the server might refuse a file, so the
    // server's own message still has to reach the user.
    await page.route('**/attachments', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 413,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The uploaded file is too large.' } }),
          })
        : route.continue(),
    );

    await issueDetail.goto(tempIssue.key);
    await issueDetail.uploadFile(tempFile('small.txt', 'tiny'));

    await expect(toast).toContainText('The uploaded file is too large.');
  });

  test('rejects an unsupported file type', async ({ issueDetail, tempIssue, toast }) => {
    const path = tempFile('installer.exe', 'MZ');
    await issueDetail.goto(tempIssue.key);

    await issueDetail.uploadFile(path);

    await expect(toast).toContainText('not a supported file type');
  });

  test('removes an attachment', async ({ api, issueDetail, tempIssue }) => {
    const path = tempFile('remove-me.txt', 'temporary');

    await test.step('upload a file', async () => {
      await issueDetail.goto(tempIssue.key);
      await issueDetail.uploadFile(path);
      await expect(issueDetail.attachment('remove-me.txt')).toBeVisible();
    });

    await test.step('remove it again', async () => {
      await issueDetail.page.getByTestId('remove-attachment-remove-me.txt').click();
      await expect(issueDetail.attachmentList).toContainText('Nothing attached yet.');
      expect((await api.getIssue(tempIssue.key)).attachmentCount).toBe(0);
    });
  });
});

test.describe('dragging files onto an issue', () => {
  test('uploads a file dropped onto the attachments card', async ({ api, issueDetail, tempIssue, toast }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.dropFiles([tempFile('dropped.txt', 'arrived by drag')]);

    await expect(toast).toContainText('dropped.txt uploaded.');
    await expect(issueDetail.attachment('dropped.txt')).toBeVisible();
    expect((await api.getIssue(tempIssue.key)).attachmentCount).toBe(1);
  });

  test('uploads several files dropped at once', async ({ api, issueDetail, tempIssue }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.dropFiles([tempFile('one.txt', 'first'), tempFile('two.csv', 'a,b\n1,2\n')]);

    await expect(issueDetail.attachment('one.txt')).toBeVisible();
    await expect(issueDetail.attachment('two.csv')).toBeVisible();
    expect((await api.getIssue(tempIssue.key)).attachmentCount).toBe(2);
  });

  test('refuses a dropped file the same way as a chosen one', async ({ issueDetail, tempIssue, toast }) => {
    await issueDetail.goto(tempIssue.key);

    await issueDetail.dropFiles([tempFile('installer.exe', 'MZ')]);

    await expect(toast).toContainText('not a supported file type');
    await expect(issueDetail.attachmentList).toContainText('Nothing attached yet.');
  });

  test('highlights the drop zone only while files are over it', async ({ issueDetail, tempIssue, page }) => {
    await issueDetail.goto(tempIssue.key);
    const zone = issueDetail.attachmentDropZone;
    await expect(zone).toHaveAttribute('data-active', 'false');

    await dragFilesOver(page, zone, [tempFile('hovering.txt', 'not dropped')]);
    await expect(zone).toHaveAttribute('data-active', 'true');

    await dragFilesAway(zone);
    await expect(zone).toHaveAttribute('data-active', 'false');
  });
});
