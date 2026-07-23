/* Flip-grade parity: with records seeded from the REAL live feed, does rendering from
   records produce the same board as rendering from the feed? test_2b_render check 4 proves
   date/station/minutes on SCHEDULED jobs; this widens it to the FULL job set (scheduled +
   unscheduled), adds qty + due dates + typeOfWork, and — the specific ask — proves the
   Arrivals lane is identical by comparing isOut() classification per imprint on both paths.
   isOut(j)=OUTSOURCED.test(j.status)||/outsourc/i.test(j.typeOfWork); Arrivals=jobs.filter(isOut).
   Real-source extraction. Run: node tests/test_records_parity.js */
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
  const b = src.indexOf('{', m.index); let d = 0, j = b;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) { j++; break; } } }
  return src.slice(m.index, j);
}
function extractConst(src, name) {
  const m = new RegExp('const\\s+' + name + '\\s*=').exec(src);
  let d = 0, s = null, j = m.index + m[0].length;
  for (; j < src.length; j++) {
    const c = src[j];
    if (s) { if (c === '\\') { j++; continue; } if (c === s) s = null; continue; }
    if (c === '"' || c === "'" || c === '`') { s = c; continue; }
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') d--;
    else if (c === ';' && d === 0) { j++; break; }
  }
  return src.slice(m.index, j);
}

const html = fs.readFileSync(INDEX_HTML, 'utf8');
const sandbox = {
  console: { log() {} },
  document: { getElementById() { return { textContent: '' }; } },
  store: null, histCsv: null, liveCsv: null, intakeJobs: null,
  intakeAdded: 0, intakeStale: 0, _recordsDirty: false, _recordDiag: null,
};
vm.createContext(sandbox);
try {
  vm.runInContext([
    extractConst(html, 'API_STEPS'),
    extractConst(html, 'OUTSOURCED'),
    extractFunction(html, 'parseCSV'),
    extractFunction(html, 'rowToJob'),
    extractFunction(html, 'apiToJob'),
    extractFunction(html, '_recMeaningfulEqual'),
    extractFunction(html, 'ingestRecords'),
    extractFunction(html, 'feedBase'),
    extractFunction(html, 'recordBase'),
    extractConst(html, 'isOut'),   // isOut is a const arrow — extractConst handles the ; terminator
  ].join('\n\n'), sandbox);
  check('0. extraction (feedBase, recordBase, ingestRecords, isOut, OUTSOURCED) evaluated', true);
} catch (e) { check('0. extraction', false, e.stack || String(e)); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

const goodCsvText = fs.readFileSync(path.join(FIXDIR, 'GOODFEED.csv'), 'utf8');
const intakeJobs = JSON.parse(fs.readFileSync(path.join(FIXDIR, 'intake_now.json'), 'utf8')).jobs;

/* seed records from the REAL live feed (GOODFEED + intake), exactly as buildModel would */
sandbox.store = { csvText: null, jobRecords: {}, moves: {}, splits: {}, alloc: {}, minutesEdit: {}, stations: {}, placeholders: [] };
sandbox.histCsv = null; sandbox.liveCsv = goodCsvText; sandbox.intakeJobs = intakeJobs;
vm.runInContext('ingestRecords(feedBase())', sandbox);

const feedB = vm.runInContext('feedBase()', sandbox);
const recB = vm.runInContext('recordBase()', sandbox);

/* full-set maps keyed by imprint */
const F = ['date', 'station', 'minutes', 'qty', 'prodDue', 'custDue', 'typeOfWork', 'status'];
const mapOf = base => { const m = {}; base.forEach(j => { m[j.imprint] = j; }); return m; };
const fm = mapOf(feedB), rm = mapOf(recB);
const keys = new Set([...Object.keys(fm), ...Object.keys(rm)]);

/* 1. same set of jobs */
const onlyFeed = [...keys].filter(k => fm[k] && !rm[k]);
const onlyRec = [...keys].filter(k => rm[k] && !fm[k]);
check('1. full-set parity: same job KEYS on both paths (feed ' + feedB.length + ', records ' + recB.length + ')',
  onlyFeed.length === 0 && onlyRec.length === 0,
  'feed-only: ' + onlyFeed.slice(0, 5).join(',') + ' | rec-only: ' + onlyRec.slice(0, 5).join(','));

/* 2. render-relevant fields identical per imprint (normalize number/string for minutes/qty) */
const norm = (k, v) => (k === 'minutes' || k === 'qty') ? (+v || 0) : (v == null ? '' : String(v));
const fieldDiffs = [];
keys.forEach(k => {
  if (!fm[k] || !rm[k]) return;
  F.forEach(f => { if (norm(f, fm[k][f]) !== norm(f, rm[k][f])) fieldDiffs.push(k + '.' + f + ': feed=' + JSON.stringify(fm[k][f]) + ' rec=' + JSON.stringify(rm[k][f])); });
});
check('2. full-set parity: {' + F.join(',') + '} identical per imprint across all ' + keys.size + ' jobs',
  fieldDiffs.length === 0, fieldDiffs.slice(0, 8).join(' | ') + (fieldDiffs.length > 8 ? ' | +' + (fieldDiffs.length - 8) : ''));

/* 3. Arrivals lane parity: isOut() classification identical per imprint */
sandbox._fm = fm; sandbox._rm = rm;
const arrDiffs = [];
let feedArr = 0, recArr = 0;
keys.forEach(k => {
  if (!fm[k] || !rm[k]) return;
  sandbox._k = k;
  const of = vm.runInContext('isOut(_fm[_k])', sandbox);
  const or = vm.runInContext('isOut(_rm[_k])', sandbox);
  if (of) feedArr++; if (or) recArr++;
  if (of !== or) arrDiffs.push(k + ': feed isOut=' + of + ' rec isOut=' + or + ' (status feed=' + JSON.stringify(fm[k].status) + '/rec=' + JSON.stringify(rm[k].status) + ', tow feed=' + JSON.stringify(fm[k].typeOfWork) + '/rec=' + JSON.stringify(rm[k].typeOfWork) + ')');
});
check('3. Arrivals parity: isOut() classification identical per imprint (feed flags ' + feedArr + ' outsourced, records ' + recArr + ')',
  arrDiffs.length === 0, arrDiffs.slice(0, 6).join(' | '));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
