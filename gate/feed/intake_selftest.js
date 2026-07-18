/* Build #3 selftest — pure functions only (no DB, no HTTP).
   Run: node gate/feed/intake_selftest.js
   Exercises: AES-256-GCM round-trip, magic-byte sniffer, PDF safety guard. */

const crypto = require('crypto');
const assert = require('assert');
const { sniffType, pdfGuard, encryptRaw, decryptRaw, MIME_TO_TYPE } = require('./intake.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { fail++; console.log('FAIL  ' + name + '  →  ' + e.message); }
}

/* ── AES-256-GCM round-trip ─────────────────────────────────────────────── */
const key = crypto.randomBytes(32);
const payload = crypto.randomBytes(1024 * 1024); // 1MB random doc

t('encrypt → decrypt round-trip returns the original bytes', () => {
  const enc = encryptRaw(key, payload);
  assert.strictEqual(enc.length, 12 + 16 + payload.length, 'enc_raw = iv(12) + tag(16) + ciphertext');
  assert.ok(decryptRaw(key, enc).equals(payload));
});
t('two encryptions of the same doc differ (random IV) but both decrypt', () => {
  const a = encryptRaw(key, payload), b = encryptRaw(key, payload);
  assert.ok(!a.equals(b));
  assert.ok(decryptRaw(key, a).equals(payload) && decryptRaw(key, b).equals(payload));
});
t('tampered ciphertext fails auth (GCM)', () => {
  const enc = encryptRaw(key, payload);
  enc[40] ^= 0xff;
  assert.throws(() => decryptRaw(key, enc));
});
t('wrong key fails auth (GCM)', () => {
  const enc = encryptRaw(key, payload);
  assert.throws(() => decryptRaw(crypto.randomBytes(32), enc));
});

/* ── Magic-byte sniffer ─────────────────────────────────────────────────── */
const fakePdf  = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page >>\nendobj\n%%EOF');
const fakePng  = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)]);
const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(64)]);
const csvText  = Buffer.from('vendor,amount,date\nMax Apparel,455.00,2026-07-01\n', 'utf8');

t('sniff: %PDF header → pdf',   () => assert.strictEqual(sniffType(fakePdf), 'pdf'));
t('sniff: PNG header → png',    () => assert.strictEqual(sniffType(fakePng), 'png'));
t('sniff: JPEG header → jpeg',  () => assert.strictEqual(sniffType(fakeJpeg), 'jpeg'));
t('sniff: UTF-8 CSV → text',    () => assert.strictEqual(sniffType(csvText), 'text'));
t('sniff: unknown binary (NUL bytes, no magic) → null', () => {
  assert.strictEqual(sniffType(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00, 0xfe])), null);
});
t('sniff: invalid UTF-8 without magic → null', () => {
  assert.strictEqual(sniffType(Buffer.from([0xc3, 0x28, 0x61, 0x62])), null);
});
t('sniff: empty buffer → null', () => assert.strictEqual(sniffType(Buffer.alloc(0)), null));
t('mismatch: JPEG bytes declared as image/png is caught by the route check', () => {
  assert.notStrictEqual(MIME_TO_TYPE['image/png'], sniffType(fakeJpeg));   // 'png' !== 'jpeg' → 400 in the route
});
t('mismatch: text bytes declared as application/pdf is caught', () => {
  assert.notStrictEqual(MIME_TO_TYPE['application/pdf'], sniffType(csvText));
});

/* ── PDF safety guard ───────────────────────────────────────────────────── */
t('pdf guard: clean 1-page PDF passes', () => assert.strictEqual(pdfGuard(fakePdf), null));
t('pdf guard: /Encrypt rejects', () => {
  const enc = Buffer.concat([fakePdf, Buffer.from('\ntrailer\n<< /Encrypt 4 0 R >>')]);
  assert.strictEqual(pdfGuard(enc), 'encrypted PDFs are not accepted');
});
t('pdf guard: /JavaScript rejects', () => {
  const js = Buffer.concat([fakePdf, Buffer.from('\n<< /S /JavaScript /JS (app.alert(1)) >>')]);
  assert.strictEqual(pdfGuard(js), 'PDFs with embedded scripts are not accepted');
});
t('pdf guard: /OpenAction rejects', () => {
  const oa = Buffer.concat([fakePdf, Buffer.from('\n<< /OpenAction 5 0 R >>')]);
  assert.strictEqual(pdfGuard(oa), 'PDFs with embedded scripts are not accepted');
});
t('pdf guard: 41 pages via /Type /Page tokens rejects', () => {
  const many = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('<< /Type /Page >>\n'.repeat(41))]);
  assert.strictEqual(pdfGuard(many), 'PDF too long');
});
t('pdf guard: /Count 99 rejects even with few Page tokens', () => {
  const big = Buffer.from('%PDF-1.4\n<< /Type /Pages /Count 99 >>\n<< /Type /Page >>\n');
  assert.strictEqual(pdfGuard(big), 'PDF too long');
});
t('pdf guard: 40 pages exactly passes (cap is > 40)', () => {
  const forty = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('<< /Type /Page >>\n'.repeat(40))]);
  assert.strictEqual(pdfGuard(forty), null);
});
t('pdf guard: /Type/Pages node does not count as a page (no false /Type/Page hit)', () => {
  const one = Buffer.from('%PDF-1.4\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n<< /Type /Page >>\n');
  assert.strictEqual(pdfGuard(one), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
