/* Gate test for the one-cycle-behind fix (Phase B records flip).
   Before the fix, buildModel() computed its render base = recordBase() BEFORE
   ingestRecords() ran, so a brand-new feed job appeared one refresh late. The fix
   reorders ingest+retire ahead of the base capture. This proves it two ways:
     (A) behavioral — with an empty records store and a 1-job live feed, the job is
         absent if you read recordBase() first (old order) and present if you ingest
         first (new order). Same real ingestRecords()/recordBase()/feedBase().
     (B) source-order — the shipped buildModel() now has ingestRecords(...) before the
         `let base=...recordBase()...` line, so the property above holds in the real render.
   Real-source extraction, like test_2b_render.js. Run: node tests/test_render_ordering.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(REPO_ROOT, 'schedule', 'index.html');
const FIXDIR = 'C:\\Users\\jean\\AppData\\Local\\Temp\\claude\\C--Users-jean\\9c3ee726-15d8-42c4-b18f-f1adee9bcbc8\\scratchpad';

let pass = 0, fail = 0;
const check = (n, c, d) => { if (c) { console.log('PASS - ' + n); pass++; } else { console.log('FAIL - ' + n + (d ? ('  :: ' + d) : '')); fail++; } };

function extractFunction(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('function not found: ' + name);
  const braceStart = src.indexOf('{', m.index);
  let depth = 0, j = braceStart;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } } }
  return src.slice(m.index, j);
}
function extractConst(src, name) {
  const m = new RegExp('const\\s+' + name + '\\s*=').exec(src);
  let depth = 0, inStr = null, j = m.index + m[0].length;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth === 0) { j++; break; }
  }
  return src.slice(m.index, j);
}

const html = fs.readFileSync(INDEX_HTML, 'utf8');

/* ── build the sandbox with the real functions ── */
const sandbox = {
  console: { log() {} },   // mute ingestRecords' dropped-diagnostic noise
  document: { getElementById() { return { textContent: '' }; } },
  store: null, histCsv: null, liveCsv: null, intakeJobs: null,
  intakeAdded: 0, intakeStale: 0, _recordsDirty: false, _recordDiag: null,
};
vm.createContext(sandbox);
try {
  vm.runInContext([
    extractConst(html, 'API_STEPS'),
    extractFunction(html, 'parseCSV'),
    extractFunction(html, 'rowToJob'),
    extractFunction(html, 'apiToJob'),
    extractFunction(html, '_recMeaningfulEqual'),
    extractFunction(html, 'ingestRecords'),
    extractFunction(html, 'feedBase'),
    extractFunction(html, 'recordBase'),
  ].join('\n\n'), sandbox);
  check('0. real-source extraction (ingestRecords, feedBase, recordBase, deps) evaluated', true);
} catch (e) { check('0. real-source extraction', false, e.stack || String(e)); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

/* ── a 1-job live feed representing a brand-new job that isn't in records yet ── */
const goodCsvText = fs.readFileSync(path.join(FIXDIR, 'GOODFEED.csv'), 'utf8');
const gLines = goodCsvText.split(/\r?\n/).filter(l => l.length);
const oneJobCsv = gLines[0] + '\n' + gLines[1] + '\n';   // header + one data row
sandbox._one = oneJobCsv;
const newImprint = vm.runInContext('rowToJob(parseCSV(_one).slice(1)[0], parseCSV(_one)[0]).imprint', sandbox);

function freshStore() {
  sandbox.store = { csvText: null, jobRecords: {}, moves: {}, splits: {}, alloc: {}, minutesEdit: {}, stations: {}, placeholders: [] };
  sandbox.histCsv = null; sandbox.liveCsv = oneJobCsv; sandbox.intakeJobs = null;
}

/* ── (A) behavioral: OLD order (recordBase before ingest) misses the brand-new job ── */
freshStore();
const oldOrderBase = vm.runInContext('recordBase()', sandbox);       // read records FIRST (empty)
vm.runInContext('ingestRecords(feedBase())', sandbox);               // ingest AFTER (too late for this cycle)
check(
  'A1. OLD order (recordBase before ingest): brand-new job "' + newImprint + '" is ABSENT this cycle (the one-cycle lag)',
  oldOrderBase.length === 0,
  'expected 0 rendered, got ' + oldOrderBase.length
);

/* ── (A) behavioral: NEW order (ingest before recordBase) shows it same-cycle ── */
freshStore();
vm.runInContext('ingestRecords(feedBase())', sandbox);               // ingest FIRST
const newOrderBase = vm.runInContext('recordBase()', sandbox);       // THEN read records
check(
  'A2. NEW order (ingest before recordBase): brand-new job "' + newImprint + '" is PRESENT the same cycle',
  newOrderBase.length === 1 && newOrderBase[0].imprint === newImprint,
  'expected 1 rendered (' + newImprint + '), got ' + newOrderBase.length
);

/* ── (B) source-order: the shipped buildModel() actually ingests before capturing the base ── */
const bm = extractFunction(html, 'buildModel');
const idxIngest = bm.indexOf('ingestRecords(');
const idxRetire = bm.indexOf('retireRecords(');
const idxBase = bm.search(/let\s+base\s*=/);
check('B1. buildModel(): ingestRecords() appears before the `let base=` capture', idxIngest > -1 && idxBase > -1 && idxIngest < idxBase,
  'ingest@' + idxIngest + ' base@' + idxBase);
check('B2. buildModel(): retireRecords() also runs before the base capture (terminal jobs drop same cycle)', idxRetire > -1 && idxRetire < idxBase,
  'retire@' + idxRetire + ' base@' + idxBase);
check('B3. buildModel(): base is bound to recordBase() on the records path (fix wired to the real render)', /let\s+base=useRecords\?recordBase\(\):fb;/.test(bm),
  'expected `let base=useRecords?recordBase():fb;`');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
