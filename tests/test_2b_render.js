/* Acceptance test for Phase B step 2b (render-from-records, flag-gated).
   Extracts the REAL functions out of schedule/index.html (regex/brace-slicing by name),
   evals them in a vm sandbox, and exercises them against real fixture data. Nothing here
   is a reimplementation of the board's logic — only the reference-algorithm copy in
   PHASE A (check 3) is hand-written, and that's explicitly what the plan asks for (a
   frozen copy of TODAY'S pre-change algorithm to diff the extracted feedBase() against).
   Run: node tests/test_2b_render.js */
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

/* ───────── check 2: extract the real functions + eval them in a sandbox ───────── */
let sandbox, extractOk = true, extractDetail = '';
try {
  const parseCSVSrc = extractFunction(html, 'parseCSV');
  const rowToJobSrc = extractFunction(html, 'rowToJob');
  const apiToJobSrc = extractFunction(html, 'apiToJob');
  const apiStepsSrc = extractConst(html, 'API_STEPS');
  const recMeaningfulEqualSrc = extractFunction(html, '_recMeaningfulEqual'); // ingestRecords' own dependency — not in the plan's named list, but ingestRecords calls it, so real execution needs it too
  const ingestRecordsSrc = extractFunction(html, 'ingestRecords');
  const feedBaseSrc = extractFunction(html, 'feedBase');
  const recordBaseSrc = extractFunction(html, 'recordBase');

  sandbox = {
    console,
    document: { getElementById() { return { textContent: '' }; } }, // never actually reached — liveCsv is always truthy in these tests, so the `||document...` branch short-circuits away
    store: null, histCsv: null, liveCsv: null, intakeJobs: null,
    intakeAdded: 0, intakeStale: 0,
    _recordsDirty: false, _recordDiag: null,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    [apiStepsSrc, parseCSVSrc, rowToJobSrc, apiToJobSrc, recMeaningfulEqualSrc, ingestRecordsSrc, feedBaseSrc, recordBaseSrc].join('\n\n'),
    sandbox
  );
} catch (e) {
  extractOk = false; extractDetail = e.stack || String(e);
}
check('2. real-source extraction (parseCSV, rowToJob, apiToJob, API_STEPS, feedBase, recordBase, ingestRecords) evaluated in sandbox', extractOk, extractDetail);
if (!extractOk) { console.log('\n' + passCount + ' passed, ' + failCount + ' failed'); process.exit(1); }

/* ───────── reference implementation of TODAY'S (pre-change) feedBase algorithm ─────────
   Hand-copied from the block that used to sit inline in buildModel() before this change —
   NOT extracted from the file (post-change it only exists inside feedBase()). This is the
   frozen baseline check 3 diffs feedBase() against. Runs inside the SAME vm context so it
   resolves parseCSV/rowToJob/apiToJob/store/histCsv/liveCsv/intakeJobs from the shared
   lexical environment set up above — same real parseCSV/rowToJob/apiToJob feedBase() uses. */
sandbox.refIntakeAdded = 0; sandbox.refIntakeStale = 0;
vm.runInContext(`
function referenceFeedBase(){
  const text=histCsv||store.csvText||liveCsv||document.getElementById('csvdata').textContent.trim();
  const raw=parseCSV(text), hdr=raw[0];
  let base=raw.slice(1).map(r=>rowToJob(r,hdr));
  refIntakeAdded=0;refIntakeStale=0;
  if(intakeJobs&&!histCsv&&!store.csvText){
    const known=new Set(base.map(j=>j.invoice)), seen=new Set();
    const staleCut=new Date(Date.now()-60*864e5).toISOString().slice(0,10);
    intakeJobs.forEach(a=>{
      const m=String(a.imprint).match(/^(\\d+)/);
      if(!m||known.has(m[1])||seen.has(String(a.imprint)))return;
      if(a.custDue&&a.custDue<staleCut){refIntakeStale++;return;}
      seen.add(String(a.imprint));base.push(apiToJob(a));refIntakeAdded++;
    });
  }
  return base;
}
`, sandbox);

/* ───────── fixtures ───────── */
const goodCsvText = fs.readFileSync(path.join(FIXDIR, 'GOODFEED.csv'), 'utf8');
const truncCsvText = fs.readFileSync(path.join(FIXDIR, 'TRUNCFEED.csv'), 'utf8');
const intakeJobs = JSON.parse(fs.readFileSync(path.join(FIXDIR, 'intake_now.json'), 'utf8')).jobs;

function fullMap(base) {
  const m = {};
  base.forEach(j => { m[j.imprint] = { qty: j.qty, date: j.date, station: j.station, minutes: j.minutes }; });
  return m;
}
function schedMap(base) {
  const m = {};
  base.forEach(j => { if (j.date) m[j.imprint] = { date: j.date, station: j.station, minutes: j.minutes }; });
  return m;
}
function fieldsEqual(a, b) {
  if (!a || !b) return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => a[k] === b[k]);
}
function diffMaps(mapA, mapB, labelA, labelB) {
  const keys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
  let mismatches = [];
  keys.forEach(k => {
    if (!fieldsEqual(mapA[k], mapB[k])) mismatches.push(k + ': ' + labelA + '=' + JSON.stringify(mapA[k]) + ' ' + labelB + '=' + JSON.stringify(mapB[k]));
  });
  return mismatches;
}

/* ───────── check 3: OFF-path fidelity — feedBase() === reference algorithm ───────── */
sandbox.store = { csvText: null, jobRecords: {}, moves: {}, splits: {}, alloc: {}, minutesEdit: {}, stations: {}, placeholders: [] };
sandbox.histCsv = null;
sandbox.liveCsv = goodCsvText;
sandbox.intakeJobs = intakeJobs;

const refBase = vm.runInContext('referenceFeedBase()', sandbox);
const realBaseOff = vm.runInContext('feedBase()', sandbox);
const refMap = fullMap(refBase), realMapOff = fullMap(realBaseOff);
const offDiffs = diffMaps(refMap, realMapOff, 'reference', 'feedBase');
check(
  '3. OFF-path fidelity: feedBase() length (' + realBaseOff.length + ') matches reference (' + refBase.length + ')',
  realBaseOff.length === refBase.length,
  'lengths differ'
);
check(
  '3. OFF-path fidelity: feedBase() per-imprint {qty,date,station,minutes} matches reference on GOODFEED+intake (' + Object.keys(realMapOff).length + ' imprints)',
  offDiffs.length === 0,
  offDiffs.slice(0, 5).join(' | ') + (offDiffs.length > 5 ? ' | +' + (offDiffs.length - 5) + ' more' : '')
);
check(
  '3. OFF-path fidelity: intakeAdded/intakeStale counters match reference (feedBase ' + sandbox.intakeAdded + '/' + sandbox.intakeStale + ' vs ref ' + sandbox.refIntakeAdded + '/' + sandbox.refIntakeStale + ')',
  sandbox.intakeAdded === sandbox.refIntakeAdded && sandbox.intakeStale === sandbox.refIntakeStale
);

/* ───────── check 4: equivalence — seed records from GOODFEED, compare recordBase() vs feedBase() ───────── */
vm.runInContext('ingestRecords(feedBase())', sandbox); // guard: histCsv null, store.csvText null, liveCsv truthy -> passes
const recordCountAfterSeed = Object.keys(sandbox.store.jobRecords).length;
const recBaseGood = vm.runInContext('recordBase()', sandbox);
const feedBaseGood = vm.runInContext('feedBase()', sandbox);
const recSchedGood = schedMap(recBaseGood), feedSchedGood = schedMap(feedBaseGood);
const equivDiffs = diffMaps(feedSchedGood, recSchedGood, 'feedBase', 'recordBase');
check(
  '4. equivalence: seeded ' + recordCountAfterSeed + ' job records from GOODFEED via ingestRecords(feedBase()) — one record per feed job (' + feedBaseGood.length + ')',
  recordCountAfterSeed === feedBaseGood.length
);
check(
  '4. equivalence: scheduled-job COUNT matches — recordBase() ' + Object.keys(recSchedGood).length + ' vs feedBase() ' + Object.keys(feedSchedGood).length,
  Object.keys(recSchedGood).length === Object.keys(feedSchedGood).length
);
check(
  '4. equivalence: scheduled-job {date,station,minutes} IDENTICAL per imprint between recordBase() and feedBase()',
  equivDiffs.length === 0,
  equivDiffs.slice(0, 5).join(' | ') + (equivDiffs.length > 5 ? ' | +' + (equivDiffs.length - 5) + ' more' : '')
);

/* baseline to check retention against — the scheduled set established in check 4 */
const baselineSched = recSchedGood;

/* ───────── check 5: retention — switch to TRUNCFEED, re-ingest, records must still hold everything ─────────
   Depends on ingestRecords()'s field-level precedence: intake contributes identity/status/gap-fill
   only and must never blank a good CSV value. Without that precedence, feedBase()'s intake-union
   re-adds any invoice still known to the (independently-pulled, broader) intake feed as an
   unscheduled placeholder the moment its row drops from a truncated CSV pull, and a wholesale
   record-replace would let that blank clobber the previously-good csvDate/csvStation/csvMinutes. */
sandbox.liveCsv = truncCsvText;
vm.runInContext('ingestRecords(feedBase())', sandbox);
const feedBaseTrunc = vm.runInContext('feedBase()', sandbox);
const feedSchedTrunc = schedMap(feedBaseTrunc);
const recBaseAfterTrunc = vm.runInContext('recordBase()', sandbox);
const recSchedAfterTrunc = schedMap(recBaseAfterTrunc);

const lostByFeedAlone = Object.keys(baselineSched).filter(k => !feedSchedTrunc[k]);
const retentionDiffs = Object.keys(baselineSched).filter(k => !fieldsEqual(baselineSched[k], recSchedAfterTrunc[k]));
check(
  '5. retention: TRUNCFEED actually drops jobs vs GOODFEED (feed alone lost ' + lostByFeedAlone.length + ' of ' + Object.keys(baselineSched).length + ' scheduled jobs)',
  lostByFeedAlone.length > 0,
  'expected TRUNCFEED to be a genuine truncation — 0 jobs lost means the fixture is not actually truncated relative to GOODFEED'
);
check(
  '5. retention: recordBase() after truncated re-ingest still contains ALL ' + Object.keys(baselineSched).length + ' baseline scheduled jobs with identical date/station/minutes',
  retentionDiffs.length === 0,
  retentionDiffs.length + ' of ' + Object.keys(baselineSched).length + ' lost/changed: ' +
    retentionDiffs.slice(0, 5).map(k => k + ': baseline=' + JSON.stringify(baselineSched[k]) + ' now=' + JSON.stringify(recSchedAfterTrunc[k])).join(' | ') +
    (retentionDiffs.length > 5 ? ' | +' + (retentionDiffs.length - 5) + ' more' : '')
);

/* ───────── check 6: flag gating — history/import always force the feed path ───────── */
function useRecordsExpr(RENDER_FROM_RECORDS, histCsvVal, csvTextVal) {
  return RENDER_FROM_RECORDS && !histCsvVal && !csvTextVal;
}
const gatingCases = [
  { label: 'flag ON, no history, no import -> records', RENDER_FROM_RECORDS: true, histCsv: null, csvText: null, expect: true },
  { label: 'flag ON, HISTORY mode -> feed (history always wins)', RENDER_FROM_RECORDS: true, histCsv: 'snapshot-csv-text', csvText: null, expect: false },
  { label: 'flag ON, MANUAL IMPORT -> feed (import always wins)', RENDER_FROM_RECORDS: true, histCsv: null, csvText: 'imported-csv-text', expect: false },
  { label: 'flag OFF, no history, no import -> feed (default)', RENDER_FROM_RECORDS: false, histCsv: null, csvText: null, expect: false },
];
let gatingOk = true, gatingDetail = [];
gatingCases.forEach(c => {
  const got = useRecordsExpr(c.RENDER_FROM_RECORDS, c.histCsv, c.csvText);
  if (got !== c.expect) { gatingOk = false; gatingDetail.push(c.label + ' -> got ' + got + ', expected ' + c.expect); }
});
check('6. flag gating: useRecords = RENDER_FROM_RECORDS && !histCsv && !store.csvText — ' + gatingCases.map(c => c.label).join('; '), gatingOk, gatingDetail.join(' | '));

/* also confirm it against the ACTUAL buildModel() line text, so this isn't just testing a hand-copied expression */
const buildModelSrc = extractFunction(html, 'buildModel');
const hasUseRecordsLine = /const useRecords=RENDER_FROM_RECORDS&&!histCsv&&!store\.csvText;/.test(buildModelSrc);
check('6. flag gating: buildModel() contains the exact useRecords gating expression verified above', hasUseRecordsLine, 'buildModel() source did not contain the expected literal expression');

/* ───────── check 7: a real CSV row's Prod. Date going set -> blank DOES blank the record ─────────
   The precedence fix must not overcorrect: a REAL CSV row (j.apiIntake falsy) stays authoritative
   for base fields — INCLUDING a legitimately blank date (Jean unscheduling the job in Printavo
   produces exactly this: a real CSV row with an empty Prod. Date). Built via the real parseCSV +
   rowToJob against a genuine GOODFEED row for '27444 - 1' (already seeded with a real date by
   check 4/5), with its Prod. Date column cleared — a faithful stand-in for the next live pull
   after Jean unschedules it. */
const realConsole = sandbox.console;
sandbox.console = { log: () => {} };   // mute ingestRecords' "dropped" diagnostic — these isolated 1-job bases make nearly everything look dropped, which is expected noise, not a finding

sandbox._t7Good = goodCsvText;
const t7Rows = vm.runInContext('parseCSV(_t7Good)', sandbox);
const t7Hdr = t7Rows[0];
const t7DateIdx = t7Hdr.indexOf('Prod. Date');
const t7OrigRow = t7Rows.find(r => r[t7Hdr.indexOf('Imprint')] === '27444 - 1');
const preT7 = (sandbox.store.jobRecords['27444 - 1'] || {}).csvDate;
const t7Row = t7OrigRow.slice(); t7Row[t7DateIdx] = '';
sandbox._t7Row = t7Row; sandbox._t7Hdr = t7Hdr;
const t7Job = vm.runInContext('rowToJob(_t7Row,_t7Hdr)', sandbox);
sandbox._t7Base = [t7Job];
vm.runInContext('ingestRecords(_t7Base)', sandbox);
const postT7 = sandbox.store.jobRecords['27444 - 1'].csvDate;
check(
  "7. real CSV row: '27444 - 1' Prod. Date set (" + JSON.stringify(preT7) + ') -> blank CSV row blanks the record (csvDate now ' + JSON.stringify(postT7) + ')',
  !!preT7 && postT7 === '',
  'expected a non-empty prior date and an empty date after ingesting the blanked CSV row'
);

/* ───────── check 8: an intake-only heartbeat over an unchanged record must not dirty the store ───────── */
sandbox._t8Input = { imprint: '99999 - 1', nickname: 'TEST HEARTBEAT JOB', qty: 10, custDue: '2026-08-01', prodDue: '2026-07-30', invoiceStatus: 'Test Status', screens: 2, ink: 'Plastisol', typeOfWork: 'In-House Production', invoiceId: '1', groupId: '1', imprintId: '12345' };
const t8Job1 = vm.runInContext('apiToJob(_t8Input)', sandbox);
sandbox._t8Base1 = [t8Job1];
vm.runInContext('ingestRecords(_t8Base1)', sandbox);   // seed: new record, prev=null -> _recordsDirty=true expected here, not under test
sandbox._recordsDirty = false;                          // reset right before the actual heartbeat under test
const t8Job2 = vm.runInContext('apiToJob(_t8Input)', sandbox);   // simulate a second, identical intake pull
sandbox._t8Base2 = [t8Job2];
vm.runInContext('ingestRecords(_t8Base2)', sandbox);
sandbox.console = realConsole;
check(
  '8. intake-only heartbeat over an unchanged record does not mark the store dirty (no save loop) — _recordsDirty=' + sandbox._recordsDirty,
  sandbox._recordsDirty === false,
  '_recMeaningfulEqual(prev,rec) should have held true on an identical repeat intake pull'
);

console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
