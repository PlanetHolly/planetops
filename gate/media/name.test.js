'use strict';
// Plain-node test: run the slim fixture of 54 live filenames through
// buildFilename and assert byte-for-byte equality against the real files on disk.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildFilename } = require('./name.js');

const PHOTO_DIR = path.join(os.homedir(), 'github', 'product-photos', 'bandanas');
const FIXTURE = path.join(__dirname, 'fixtures', 'naming-cases.json');

const realFiles = new Set(fs.readdirSync(PHOTO_DIR).filter(f => !f.startsWith('.')));

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const cases = fixture.cases.map(([sourceFile, brand, printMethod, color, fabric, expected]) => ({
  sourceFile,
  input: {
    brand,
    printMethod,
    color,
    fabric,
    sourceId: sourceFile.replace(/\.[^.]+$/, ''),
    ext: sourceFile.split('.').pop(),
  },
  expected,
}));

if (cases.length < 10) {
  console.error(`FATAL: only loaded ${cases.length} cases from naming-cases.json (need >= 10)`);
  process.exit(1);
}

let pass = 0, fail = 0;
for (const { sourceFile, input, expected } of cases) {
  const got = buildFilename(input);
  const onDisk = realFiles.has(got);
  if (got === expected && onDisk) {
    pass++;
    console.log(`PASS  ${sourceFile.padEnd(24)} -> ${got}`);
  } else {
    fail++;
    console.log(`FAIL  ${sourceFile}`);
    console.log(`      expected: ${expected}`);
    console.log(`      got:      ${got}${onDisk ? '' : '   (also NOT on disk)'}`);
  }
}

// Every generated name accounted for? Also report live files with no sheet row.
const generated = new Set(cases.map(c => buildFilename(c.input)));
const uncovered = [...realFiles].filter(f => !generated.has(f));
if (uncovered.length) console.log(`NOTE  live files with no reconstructed row: ${uncovered.join(', ')}`);

// Fallback sanity: missing sourceId -> 8-hex hash suffix, still well-formed.
const fb = buildFilename(fixture.hashFallback.input);
const fbOk = new RegExp(fixture.hashFallback.pattern).test(fb);
console.log(`${fbOk ? 'PASS' : 'FAIL'}  hash-fallback (no sourceId)   -> ${fb}`);
if (!fbOk) fail++;

console.log(`\n${pass}/${cases.length} fixture cases passed, ${fail} failures, ` +
            `${realFiles.size} real files on disk, ${uncovered.length} uncovered.`);
process.exit(fail === 0 ? 0 : 1);
