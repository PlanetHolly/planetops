/* Acceptance test for Phase B: record retirement (retireRecords()).
   Extracts the REAL retireRecords/recordBase + the RETIRE_ consts out of schedule/index.html
   (regex/brace-slicing by name — same real-source-extraction pattern as test_2b_render.js),
   evals them in a vm sandbox, and exercises them against fixture store.jobRecords. Nothing
   here reimplements the archiving logic — only the source's real functions are executed.
   Run: node tests/test_retirement.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(REPO_ROOT, 'schedule', 'index.html');
const FIXDIR = 'C:\\Users\\jean\\AppData\\Local\\Temp\\claude\\C--Users-jean\\9c3ee726-15d8-42c4-b18f-f1adee9bcbc8\\scratchpad';

let passCount = 0, failCount = 0;
function check(name, cond, detail) {
  if (cond) { console.log('PASS - ' + name); passCount++; }
  else { console.log('FAIL - ' + name + (detail ? ('  :: ' + detail) : '')); failCount++; }
}

/* ───────── helpers: pull real source slices out of the file by name ───────── */
function extractFunction(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('function not found in schedule/index.html: ' + name);
  const braceStart = src.indexOf('{', m.index);
  if (braceStart < 0) throw new Error('no opening brace for function ' + name);
  let depth = 0, j = braceStart;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(m.index, j);
}
function extractConst(src, name) {
  const m = new RegExp('const\\s+' + name + '\\s*=').exec(src);
  if (!m) throw new Error('const not found in schedule/index.html: ' + name);
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

/* ───────── check 1: the extracted <script> body must be valid JS ───────── */
const html = fs.readFileSync(INDEX_HTML, 'utf8');
const htmlLines = html.split('\n');
let openIdx = -1, closeIdx = -1;
for (let i = 0; i < htmlLines.length; i++) { if (/^<script>\s*\r?$/.test(htmlLines[i])) { openIdx = i; break; } }
for (let i = htmlLines.length - 1; i > openIdx; i--) { if (/^<\/script>\s*\r?$/.test(htmlLines[i])) { closeIdx = i; break; } }
if (openIdx < 0 || closeIdx < 0) { check('1. locate main <script> boundaries', false, 'openIdx=' + openIdx + ' closeIdx=' + closeIdx); process.exit(1); }
const scriptBody = htmlLines.slice(openIdx + 1, closeIdx).join('\n');
const extractedScriptPath = path.join(FIXDIR, '_extracted_main_script.js');
fs.writeFileSync(extractedScriptPath, scriptBody);
try {
  execSync('node --check "' + extractedScriptPath + '"', { stdio: 'pipe' });
  check('1. syntax: node --check on extracted main <script> body (lines ' + (openIdx + 2) + '-' + closeIdx + ')', true);
} catch (e) {
  check('1. syntax: node --check on extracted main <script> body', false, (e.stderr || e.stdout || e).toString());
}

/* ───────── extract the real functions/consts + eval them in a sandbox ───────── */
let sandbox, extractOk = true, extractDetail = '';
try {
  const apiStepsSrc = extractConst(html, 'API_STEPS');
  const retireStatusReSrc = extractConst(html, 'RETIRE_STATUS_RE');
  const retireStaleDaysSrc = extractConst(html, 'RETIRE_STALE_DAYS');
  const retireRecordsSrc = extractFunction(html, 'retireRecords');
  const recordBaseSrc = extractFunction(html, 'recordBase');

  sandbox = {
    console,
    store: null, histCsv: null, liveCsv: null,
    _recordsDirty: false,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    [apiStepsSrc, retireStatusReSrc, retireStaleDaysSrc, retireRecordsSrc, recordBaseSrc].join('\n\n'),
    sandbox
  );
} catch (e) {
  extractOk = false; extractDetail = e.stack || String(e);
}
check('2. real-source extraction (RETIRE_STATUS_RE, RETIRE_STALE_DAYS, retireRecords, recordBase, API_STEPS) evaluated in sandbox', extractOk, extractDetail);
if (!extractOk) { console.log('\n' + passCount + ' passed, ' + failCount + ' failed'); process.exit(1); }

/* ───────── date helpers mirroring the source's PT-cutoff arithmetic ─────────
   Not a reimplementation of retireRecords' logic — just builds fixture csvDate values
   at known offsets from "today" so the test doesn't hardcode a date that goes stale. */
function ptDateStr(msOffset) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(Date.now() + msOffset));
}
const DAY = 864e5;
const date31Ago = ptDateStr(-31 * DAY);   // past the 30-day backstop cutoff -> should archive
const date5Ago = ptDateStr(-5 * DAY);     // well within the window -> should NOT archive

/* ───────── fixture store.jobRecords covering checks 3-8 ───────── */
function freshStore() {
  return {
    jobRecords: {
      // status-only cases use a RECENT csvDate so the 30-day backstop can't also
      // explain the outcome — the archive/no-archive result here isolates RETIRE_STATUS_RE.
      delivered: { imprint: 'delivered', status: '🤝 Delivered / Picked up 🏁', csvDate: date5Ago, archived: false },
      shipped: { imprint: 'shipped', status: '🚀 Order Shipped ✈️ 🏁', csvDate: date5Ago, archived: false },
      readyPickup: { imprint: 'readyPickup', status: '🚀 Order Ready for Pickup 🚚 🏁', csvDate: date5Ago, archived: false },
      prodCompleted: { imprint: 'prodCompleted', status: '📦 Production Completed - Ready to Package 📦', csvDate: date5Ago, archived: false },
      staleDated: { imprint: 'staleDated', status: 'In Production', csvDate: date31Ago, archived: false },
      freshDated: { imprint: 'freshDated', status: 'In Production', csvDate: date5Ago, archived: false },
      unscheduled: { imprint: 'unscheduled', status: 'In Production', csvDate: '', archived: false },
    },
  };
}

/* ───────── checks 3-8: one live run, assert per-record archive outcome ───────── */
sandbox.store = freshStore();
sandbox.histCsv = null;
sandbox.store.csvText = null;
sandbox.liveCsv = 'live-csv-marker';
sandbox._recordsDirty = false;
vm.runInContext('retireRecords()', sandbox);
const jr = sandbox.store.jobRecords;

check('3. Delivered / Picked up -> archived', !!jr.delivered.archived, 'archived=' + jr.delivered.archived);
check('4. Order Shipped -> NOT archived (load-bearing: 🏁 is a customer-email trigger, not terminal)', jr.shipped.archived === false, 'archived=' + jr.shipped.archived);
check('5. Order Ready for Pickup -> NOT archived', jr.readyPickup.archived === false, 'archived=' + jr.readyPickup.archived);
check('6. Production Completed - Ready to Package -> NOT archived (still in-house)', jr.prodCompleted.archived === false, 'archived=' + jr.prodCompleted.archived);
check('7. dated, non-terminal, csvDate 31 days ago (' + date31Ago + ') -> archived by backstop', !!jr.staleDated.archived, 'archived=' + jr.staleDated.archived);
check('8. dated, non-terminal, csvDate 5 days ago (' + date5Ago + ') -> NOT archived', jr.freshDated.archived === false, 'archived=' + jr.freshDated.archived);
check('9. unscheduled (csvDate empty), non-terminal -> NOT archived (backstop must skip empty dates)', jr.unscheduled.archived === false, 'archived=' + jr.unscheduled.archived);

/* ───────── check 9 (dirty flag / no save-loop) ───────── */
check('10a. _recordsDirty=true after archiving >=1 record on first run', sandbox._recordsDirty === true, '_recordsDirty=' + sandbox._recordsDirty);
sandbox._recordsDirty = false;   // simulate buildModel()'s deferred save resetting the flag
vm.runInContext('retireRecords()', sandbox);   // second run: everything qualifying is already archived
check('10b. second run with everything already archived leaves _recordsDirty=false (no save-loop)', sandbox._recordsDirty === false, '_recordsDirty=' + sandbox._recordsDirty);

/* ───────── check 10: guard — history / manual import / no live feed archives nothing ───────── */
function guardCase(label, setup) {
  const s = freshStore();
  sandbox.store = s;
  sandbox.histCsv = null; sandbox.store.csvText = null; sandbox.liveCsv = 'live-csv-marker';
  setup(sandbox);
  sandbox._recordsDirty = false;
  vm.runInContext('retireRecords()', sandbox);
  const anyArchived = Object.values(sandbox.store.jobRecords).some(r => r.archived);
  check('11. guard: ' + label + ' -> archives nothing', anyArchived === false && sandbox._recordsDirty === false, 'anyArchived=' + anyArchived + ' _recordsDirty=' + sandbox._recordsDirty);
}
guardCase('liveCsv empty (fallback)', s => { s.liveCsv = ''; });
guardCase('histCsv set', s => { s.histCsv = 'history-snapshot-text'; });
guardCase('store.csvText set (manual import)', s => { s.store.csvText = 'manual-import-text'; });

/* ───────── check 11: recordBase() excludes archived records ───────── */
sandbox.store = freshStore();
sandbox.histCsv = null; sandbox.store.csvText = null; sandbox.liveCsv = 'live-csv-marker';
sandbox._recordsDirty = false;
vm.runInContext('retireRecords()', sandbox);
const rb = vm.runInContext('recordBase()', sandbox);
const rbImprints = new Set(rb.map(j => j.imprint));
check(
  '12. recordBase() excludes archived records (delivered/staleDated absent, shipped/readyPickup/prodCompleted/freshDated/unscheduled present)',
  !rbImprints.has('delivered') && !rbImprints.has('staleDated') &&
    rbImprints.has('shipped') && rbImprints.has('readyPickup') && rbImprints.has('prodCompleted') &&
    rbImprints.has('freshDated') && rbImprints.has('unscheduled'),
  'recordBase imprints: ' + [...rbImprints].join(', ')
);

console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
