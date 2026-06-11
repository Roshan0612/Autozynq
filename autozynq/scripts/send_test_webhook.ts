import crypto from 'crypto';

const url = process.argv[2];
const secret = process.env.WEBHOOK_SECRET || process.env.GOOGLE_FORMS_WEBHOOK_SECRET || 'secret';
const payload = process.argv[3] || JSON.stringify({ id: 'test-evt-1', fileId: 'abc123', fileName: 'test.txt' });

if (!url) {
  console.error('Usage: node dist/scripts/send_test_webhook.js <webhook-url> [payload-json]');
  process.exit(1);
}

const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

(async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': sig },
    body,
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
})();
