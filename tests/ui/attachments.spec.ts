import { expect, test } from '../../src/fixtures/index.js';
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

  test('shows the server error when the file is too large', async ({ issueDetail, tempIssue, toast }) => {
    const path = oversizedFile();
    await issueDetail.goto(tempIssue.key);

    await issueDetail.uploadFile(path);

    await expect(toast).toContainText('too large');
    await expect(issueDetail.attachmentList).toContainText('Nothing attached yet.');
  });

  test('rejects an unsupported file type', async ({ issueDetail, tempIssue, toast }) => {
    const path = tempFile('installer.exe', 'MZ');
    await issueDetail.goto(tempIssue.key);

    await issueDetail.uploadFile(path);

    await expect(toast).toContainText('Unsupported file type');
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
