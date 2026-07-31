'use strict';

const assert = require('assert');
const mediaRouter = require('./media.js');
const {
  decodePhoto,
  normalizeAssetInput,
  normalizePrintavoAssetInput,
  derivePrintavoGroupCat,
  resolvePrintavoSelection,
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

  // ── Phase 1: 3-category invoice lane (group guessed, cat human-picked) ──────
  // Printavo category.name is the METHOD not the product type (verified live):
  // group is a best-guess, cat is left blank for the human on non-bandana groups.
  assert.deepEqual(derivePrintavoGroupCat('Screen Printed Bandanas', 'ORG2417'), { group: 'Bandanas', cat: 'Bandanas' }, 'bandana by category suffix');
  assert.deepEqual(derivePrintavoGroupCat('Screen Printing', 'PL2219'), { group: 'Bandanas', cat: 'Bandanas' }, 'bandana by known SKU inside the Screen Printing catch-all');
  assert.deepEqual(derivePrintavoGroupCat('Screen Printing', '3001'), { group: 'Apparel', cat: '' }, 'Bella tee in the Screen Printing catch-all is Apparel, not Bandana');
  assert.deepEqual(derivePrintavoGroupCat('Heat Applied Products', '18500'), { group: 'Apparel', cat: '' }, 'Gildan hoodie');
  assert.deepEqual(derivePrintavoGroupCat('Embroidery', 'K540LS'), { group: 'Apparel', cat: '' }, 'polo');
  assert.deepEqual(derivePrintavoGroupCat('Promo', 'BGR8'), { group: 'Promo', cat: '' }, 'promo');

  // normalizePrintavoAssetInput derives group/cat and validates a submitted pick
  const appAsset = normalizePrintavoAssetInput({ brand: 'Acme', sku: '18500', method: 'Heat Applied Products', color: 'Navy' }, { ext: 'jpg', hash: sha256(jpeg) });
  assert.equal(appAsset.group, 'Apparel');
  assert.equal(appAsset.cat, '');
  assert.equal(appAsset.method, 'Heat Applied Products');
  const banAsset = normalizePrintavoAssetInput({ sku: 'PL2219', method: 'Screen Printing', color: 'Black' }, { ext: 'jpg', hash: sha256(jpeg) });
  assert.equal(banAsset.group, 'Bandanas');
  assert.equal(banAsset.cat, 'Bandanas');
  const picked = normalizePrintavoAssetInput({ sku: '18500', method: 'Heat Applied Products', cat: 'Hoodies & Fleece' }, { ext: 'jpg', hash: sha256(jpeg) });
  assert.equal(picked.cat, 'Hoodies & Fleece', 'valid human cat pick is kept');
  const regrouped = normalizePrintavoAssetInput({ sku: 'BGR8', method: 'Screen Printing', group: 'Promo' }, { ext: 'jpg', hash: sha256(jpeg) });
  assert.equal(regrouped.group, 'Promo', 'valid human group override is kept');
  // forged group/cat outside the vocab is rejected (400), never lands in a row
  await expectThrows(() => normalizePrintavoAssetInput({ sku: '18500', method: 'Heat Applied Products', group: 'Garbage' }, { ext: 'jpg', hash: sha256(jpeg) }), /invalid group/);
  await expectThrows(() => normalizePrintavoAssetInput({ sku: '18500', method: 'Heat Applied Products', cat: 'Nope' }, { ext: 'jpg', hash: sha256(jpeg) }), /invalid category/);

  // resolvePrintavoSelection: group/cat defaults + override provenance in edited_fields
  const apparelInvoice = {
    nickname: 'Acme Co',
    groups: [{
      groupId: 'g1', groupPosition: 0, nickname: 'Acme Co',
      imprints: [],
      lineItems: [{ lineItemId: 'li1', itemPosition: 0, sku: '18500', color: 'Navy', method: 'Heat Applied Products' }]
    }]
  };
  const unchanged = resolvePrintavoSelection(apparelInvoice, { lineGroupId: 'g1', lineItemId: 'li1', group: 'Apparel' });
  assert.equal(unchanged.final.group, 'Apparel');
  assert.equal(unchanged.final.cat, '');
  assert.ok(!unchanged.editedFields.includes('group'), 'unchanged group guess is not an edit');
  assert.ok(!unchanged.editedFields.includes('cat'), 'blank cat is not an edit');
  const catFilled = resolvePrintavoSelection(apparelInvoice, { lineGroupId: 'g1', lineItemId: 'li1', group: 'Apparel', cat: 'Hoodies & Fleece' });
  assert.equal(catFilled.final.cat, 'Hoodies & Fleece');
  assert.ok(catFilled.editedFields.includes('cat'), 'human-filled cat is recorded in edited_fields');

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
