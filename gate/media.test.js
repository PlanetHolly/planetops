'use strict';

const assert = require('assert');
const mediaRouter = require('./media.js');
const {
  decodePhoto,
  normalizeAssetInput,
  filenameFor,
  sha256,
  parseInkType,
  processOutboxOnce
} = mediaRouter._internals;

function dataUrl(mime, bytes) {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

async function expectThrows(fn, pattern) {
  try {
    await fn();
  } catch (e) {
    assert.match(e.message, pattern);
    return;
  }
  assert.fail('expected throw');
}

(async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
  const decoded = decodePhoto(dataUrl('image/jpeg', jpeg));
  assert.equal(decoded.mime, 'image/jpeg');
  assert.equal(decoded.ext, 'jpg');
  assert.equal(sha256(jpeg).length, 64);

  await expectThrows(() => decodePhoto(dataUrl('image/jpeg', Buffer.from('not a jpeg'))), /does not match/);

  assert.deepEqual(
    parseInkType('📍Location: Front Print 📏Imprint: 20" wide 🎨Ink Type: Plastisol 🎁Finishing: None  ✨ Up to...'),
    { inkType: 'Plastisol', confidence: 'parsed' }
  );

  const withSku = normalizeAssetInput({
    brand: 'June Shine',
    sku: 'org2416',
    group: 'Bandanas',
    cat: 'Bandanas',
    color: 'Natural',
    sourceId: '379A8139'
  }, { ext: 'jpg', hash: sha256(jpeg) });
  assert.equal(withSku.sku, 'ORG2416');
  assert.equal(withSku.fabric, 'Organic Cotton');
  assert.equal(withSku.print_method, 'Screen-Printed');
  // sourceId ALWAYS carries the short content-hash suffix (collision fix D5)
  assert.equal(withSku.sourceId, '379A8139-' + sha256(jpeg).slice(0, 8));
  assert.equal(filenameFor(withSku), 'june-shine-screen-printed-natural-organic-cotton-379a8139-' + sha256(jpeg).slice(0, 8) + '.jpg');

  const noSku = normalizeAssetInput({
    brand: 'Planet Apparel',
    sku: '',
    group: 'Promo',
    cat: 'Drinkware',
    color: 'Black',
    fabric: 'Stainless Steel',
    print_method: 'Laser Engraved',
    sourceId: 'Cup-001'
  }, { ext: 'png', hash: sha256(jpeg) });
  assert.equal(noSku.sku, '');
  assert.equal(filenameFor(noSku), 'planet-apparel-laser-engraved-black-stainless-steel-cup-001-' + sha256(jpeg).slice(0, 8) + '.png');

  await expectThrows(() => normalizeAssetInput({
    sku: 'NOPE',
    group: 'Bandanas',
    cat: 'Bandanas',
    color: 'Natural'
  }, { ext: 'jpg', hash: sha256(jpeg) }), /unknown sku/);

  await expectThrows(() => normalizeAssetInput({
    group: 'Bandanas',
    cat: 'Bandanas',
    color: 'Skyblue'
  }, { ext: 'jpg', hash: sha256(jpeg) }), /invalid color/);

  const pool = { query: async () => { throw new Error('pool should not be touched when sink url is unset'); } };
  const prevUrl = process.env.MEDIA_SINK_URL;
  delete process.env.MEDIA_SINK_URL;
  const shadow = await processOutboxOnce(pool);
  if (prevUrl) process.env.MEDIA_SINK_URL = prevUrl;
  assert.deepEqual(shadow, { skipped: true, reason: 'MEDIA_SINK_URL unset' });

  console.log('media helper tests passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
