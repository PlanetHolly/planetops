'use strict';
// buildFilename — generates published bandana photo filenames:
//   {brand}-{print-method}-{color}-{fabric}-{sourceid}.{ext}
// Empty/missing tokens are DROPPED (no empty segments). All tokens slugified.
//
// NOTE: the hyphen is both the field separator AND the intra-field word
// separator ("natural" + "organic cotton" -> natural-organic-cotton), so the
// format is AMBIGUOUS to parse back. Accepted: we only ever GENERATE names,
// we never parse them.
//
// Brand gets two extra normalizations, both derived from the 54 live files:
//   1. a single trailing word "bandana" (singular only) is stripped —
//      "Hest / Hestival Sublimated Bandana" -> hest-hestival-sublimated;
//      plural "bandanas" is KEPT (obey-giant-get-out-and-vote-collection-bandanas).
//   2. consecutive duplicate words collapse —
//      "Rivian / Rivian Compass ..." -> rivian-compass,
//      "Kodiak / Kodiak USA Made ..." -> kodiak-usa-made;
//      non-adjacent repeats survive: "June Shine / June Shine Spirits" ->
//      june-shine-june-shine-spirits (june,shine,june,shine never adjacent-equal).
// This collapse is brand-only: it must NOT cross field boundaries, or the real
// name hest-hestival-sublimated-SUBLIMATED-full-color-all-over-... would break.

const crypto = require('crypto');

function slugify(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // spaces & punctuation -> single hyphen
    .replace(/^-+|-+$/g, '');      // no leading/trailing hyphens
}

function brandSlug(brand) {
  let words = slugify(brand).split('-').filter(Boolean);
  if (words[words.length - 1] === 'bandana') words.pop(); // singular only
  words = words.filter((w, i) => w !== words[i - 1]);     // adjacent dedup
  return words.join('-');
}

function buildFilename({ brand, printMethod, color, fabric, sourceId, ext } = {}) {
  const tokens = [
    brandSlug(brand),
    slugify(printMethod),
    slugify(color),
    slugify(fabric),
  ].filter(Boolean); // drop empty tokens entirely

  let id = slugify(sourceId);
  if (!id) {
    // Fallback: short content-hash prefix so the name is still unique-ish.
    // COLLISION RISK: hashing only the metadata tokens means two photos with
    // identical metadata get the SAME name (the live set has 7 photos that
    // differ ONLY by sourceId: sublimated-full-color-all-over-polyester-*).
    // In production the hash input should be the image bytes, not metadata.
    id = crypto.createHash('sha256').update(tokens.join('-')).digest('hex').slice(0, 8);
  }
  tokens.push(id);

  return tokens.join('-') + '.' + (slugify(ext) || 'jpg');
}

module.exports = { buildFilename, slugify, brandSlug };
