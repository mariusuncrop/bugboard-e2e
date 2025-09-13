import { expect, test } from '../../src/fixtures/index.js';
import { textFile } from '../../src/support/data.js';

test.describe('attachments', () => {
  test('uploads a file and lists it against the issue', async ({ api, tempIssue }) => {
    const attachment = await api.uploadAttachment(tempIssue.key, textFile('notes.txt', 'repro steps'));

    expect(attachment.filename).toBe('notes.txt');
    expect(attachment.size).toBe(Buffer.byteLength('repro steps'));
    expect(attachment.url).toBe(`/api/attachments/${attachment.id}`);
    expect(attachment.uploadedBy?.email).toBe(api.user.email);

    const issue = await api.getIssue(tempIssue.key);
    expect(issue.attachmentCount).toBe(1);
  });

  test('serves the uploaded bytes back unchanged', async ({ api, tempIssue, request }) => {
    const contents = 'id,name\n1,first\n';
    const attachment = await api.uploadAttachment(tempIssue.key, {
      name: 'rows.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(contents),
    });

    const response = await request.get(attachment.url, {
      headers: { Authorization: `Bearer ${api.token}` },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(await response.text()).toBe(contents);
  });

  test('rejects an unsupported file type', async ({ api, tempIssue }) => {
    const response = await api.uploadAttachmentRaw(tempIssue.key, {
      name: 'payload.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ'),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.details?.[0]?.message).toContain('Unsupported file type');
  });

  test('rejects a file over the 2 MB limit', async ({ api, tempIssue }) => {
    const response = await api.uploadAttachmentRaw(tempIssue.key, {
      name: 'big.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(3 * 1024 * 1024, 'a'),
    });

    expect(response.status()).toBe(413);
    expect((await response.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('deletes an attachment', async ({ api, tempIssue, request }) => {
    const attachment = await api.uploadAttachment(tempIssue.key, textFile('temp.txt', 'gone soon'));

    const response = await request.delete(attachment.url, {
      headers: { Authorization: `Bearer ${api.token}` },
    });

    expect(response.status()).toBe(204);
    expect((await api.getIssue(tempIssue.key)).attachmentCount).toBe(0);
  });
});
