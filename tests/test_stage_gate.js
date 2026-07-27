/* Stage-gate acceptance test (2026-07-27).

   Jean's flow has exactly two stages and a job must be in EXACTLY ONE:
     Stage 1, QUEUE  — fill in details, ⏱ time, station.
     Stage 2, BOARD  — enriched job waits in the unscheduled pool for a production date.

   Before this change the Board pool was `!j.date && !isOut(j)`, which ignored the Queue entirely:
   `27401 - 1` (no time, no station — still stage 1) showed on BOTH surfaces, and `27553 - 1`
   (✕ removed from the Queue as not-production-work) stayed in the Board pool with no way to
   remove it there. `inQueue` / `inBoardPool` / `isRemoved` now live at module scope and the pool
   is the exact complement of the Queue.

   Extracts the REAL predicates out of schedule/index.html and evaluates them, so this asserts
   against the shipped source rather than a reimplementation.
   Run: node tests/test_stage_gate.js */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'schedule', 'index.html'), 'utf8');
let passCount = 0, failCount = 0;
function check(name, cond, detail) {
  if (cond) { console.log('PASS - ' + name); passCount++; }
  else { console.log('FAIL - ' + name + (detail ? ('  :: ' + detail) : '')); failCount++; }
}
function extractLine(re, label) {
  const m = re.exec(src);
  if (!m) throw new Error('could not find ' + label + ' in schedule/index.html');
  return m[0];
}
function extractConst(name) {   // brace/paren/string/comment-aware, stops at the top-level ';'
  const m = new RegExp('const\\s+' + name + '\\s*=').exec(src);
  if (!m) throw new Error('const not found: ' + name);
  let depth = 0, inStr = null, j = m.index + m[0].length;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); if (j === -1) j = src.length; continue; }
    if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j + 2); j = (j === -1 ? src.length : j + 1); continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth === 0) { j++; break; }
  }
  return src.slice(m.index, j);
}
function makeFns(store, jobs) {
  return new Function('store', 'jobs', `
    ${extractConst('LANES')}
    ${extractLine(/const laneOf=.*$/m, 'laneOf')}
    ${extractLine(/const OUTSOURCED=.*$/m, 'OUTSOURCED')}
    ${extractLine(/const isOut=.*$/m, 'isOut')}
    ${extractLine(/const pptOf=.*$/m, 'pptOf')}
    ${extractLine(/const realPP=.*$/m, 'realPP')}
    ${extractLine(/const vendorTow=.*$/m, 'vendorTow')}
    ${extractLine(/const inHouseLeg=.*$/m, 'inHouseLeg')}
    ${extractConst('invReleasable')}
    ${extractLine(/const isPrintavoPost=.*$/m, 'isPrintavoPost')}
    ${extractLine(/const inQueue=.*$/m, 'inQueue')}
    ${extractLine(/const isRemoved=.*$/m, 'isRemoved')}
    ${extractLine(/const inBoardPool=.*$/m, 'inBoardPool')}
    return { inQueue, inBoardPool, isRemoved, isOut };
  `)(store, jobs);
}

const OUT_STATUS = '👕 Awaiting Goods (Outsourced - In Production)👕';
const emptyStore = () => ({ arrived: {}, invsvc: {}, pptype: {}, removed: {}, parked: {}, stations: {} });

/* ───────── 1-2: Jean's own case — 27401-1, no time and no station yet ───────── */
{
  const store = emptyStore();
  const jobs = [{ imprint: '27401 - 1', invoice: '27401', station: '', date: '', minutes: 0, status: '👕 Paid / Terms - Blanks To Order 👕', postProdType: 'N/A', typeOfWork: 'In-House Production' }];
  const { inQueue, inBoardPool } = makeFns(store, jobs);
  check('1. 27401-1 (no station yet) -> IN the Queue', inQueue(jobs[0]) === true, 'inQueue = ' + inQueue(jobs[0]));
  check('2. 27401-1 -> NOT in the Board pool (the duplication Jean reported)', inBoardPool(jobs[0]) === false, 'inBoardPool = ' + inBoardPool(jobs[0]));
}

/* ───────── 3-4: the same job once the Queue releases it (station assigned) ───────── */
{
  const store = emptyStore();
  const jobs = [{ imprint: '27401 - 1', invoice: '27401', station: 'Auto Press (In Season)', stationAssigned: true, date: '', minutes: 80, status: '👕 Paid / Terms - Blanks To Order 👕', postProdType: 'N/A', typeOfWork: 'In-House Production' }];
  const { inQueue, inBoardPool } = makeFns(store, jobs);
  check('3. 27401-1 with a station -> OUT of the Queue', inQueue(jobs[0]) === false, 'inQueue = ' + inQueue(jobs[0]));
  check('4. 27401-1 with a station -> IN the Board pool (stage 2)', inBoardPool(jobs[0]) === true, 'inBoardPool = ' + inBoardPool(jobs[0]));
}

/* ───────── 5-6: Jean's other case — 27553-1, ✕ removed from the Queue ───────── */
{
  const store = emptyStore();
  store.removed['27553 - 1'] = { ts: 1, by: 'Jean' };
  const jobs = [{ imprint: '27553 - 1', invoice: '27553', station: 'Auto Press (In Season)', stationAssigned: true, date: '', minutes: 0, status: '👕 Paid / Terms - Blanks To Order 👕', postProdType: 'N/A', typeOfWork: '' }];
  const { inBoardPool, isRemoved } = makeFns(store, jobs);
  check('5. 27553-1 is flagged removed', isRemoved(jobs[0]) === true);
  check('6. 27553-1 -> NOT in the Board pool (removed leaves BOTH stages)', inBoardPool(jobs[0]) === false, 'inBoardPool = ' + inBoardPool(jobs[0]));
}

/* ───────── 7: a dated job is on a day row, in neither staging surface ───────── */
{
  const store = emptyStore();
  const jobs = [{ imprint: '27500 - 1', invoice: '27500', station: 'Auto Press (In Season)', stationAssigned: true, date: '2026-07-30', minutes: 60, status: '👕 Blanks Received 👕', postProdType: 'N/A', typeOfWork: '' }];
  const { inQueue, inBoardPool } = makeFns(store, jobs);
  check('7. dated job -> in neither the Queue nor the Board pool (it is on its day row)',
    inQueue(jobs[0]) === false && inBoardPool(jobs[0]) === false);
}

/* ───────── 8: outsourced vendor legs belong to Arrivals, never the Board pool ───────── */
{
  const store = emptyStore();
  const jobs = [
    { imprint: '25414 - 1', invoice: '25414', station: '', date: '', minutes: 0, status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'Outsource' },
    { imprint: '25414 - 2', invoice: '25414', station: '', date: '', minutes: 0, status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'In-House Production' },
  ];
  const { inQueue, inBoardPool } = makeFns(store, jobs);
  check('8a. 25414-1 (vendor leg) -> in neither surface (Arrivals only)', inQueue(jobs[0]) === false && inBoardPool(jobs[0]) === false);
  check('8b. 25414-2 (in-house leg) -> Queue only, not the Board pool', inQueue(jobs[1]) === true && inBoardPool(jobs[1]) === false);
}

/* ───────── 9: THE INVARIANT — over a wide matrix of job shapes, no job is ever in both
   stages, and every undated in-house job that isn't removed is in exactly one of them.
   This is the property the fix exists to guarantee; the cases above are just its landmarks. ───────── */
{
  const STATIONS = ['', 'Auto Press (In Season)', 'Heat Press', 'Post Production', 'Some Retired Station'];
  const STATUSES = ['👕 Blanks Received 👕', OUT_STATUS];
  const TOW = ['', 'Outsource', 'In-House Production'];
  let both = [], neither = [], n = 0;
  for (const assigned of [true, false])
  for (const removed of [true, false])
  for (const date of ['', '2026-07-30'])
  for (const station of STATIONS)
  for (const status of STATUSES)
  for (const typeOfWork of TOW) {
    const imprint = '99' + (n++) + ' - 1';
    const store = emptyStore();
    if (removed) store.removed[imprint] = { ts: 1 };
    const j = { imprint, invoice: imprint.split(' - ')[0], station, stationAssigned: assigned, date, minutes: 0, status, postProdType: 'N/A', typeOfWork };
    const { inQueue, inBoardPool, isOut } = makeFns(store, [j]);
    const q = inQueue(j), b = inBoardPool(j);
    const shape = JSON.stringify({ station, status, typeOfWork, assigned, removed, date });
    if (q && b) both.push(imprint + ' ' + shape);
    // "must be somewhere" only applies to live in-house work: undated, not removed, not a vendor leg
    if (!q && !b && !date && !removed && !isOut(j)) neither.push(imprint + ' ' + shape);
  }
  check('9a. no job is in BOTH the Queue and the Board pool (' + n + ' shapes)', both.length === 0, both.slice(0, 4).join(' | '));
  check('9b. no undated in-house job falls through BOTH (' + n + ' shapes)', neither.length === 0, neither.slice(0, 4).join(' | '));
}

console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
