/* Acceptance test for the Queue/Arrivals outsourced-visibility fix (2026-07-22).
   Extracts the REAL `inQueue`, `isOut`, `OUTSOURCED`, `invReleasable`, `pptOf`, and
   `realPP` definitions out of schedule/index.html by regex/brace-balancing and evaluates
   them as live functions, so this test asserts against the shipped source — not a
   reimplementation of it.
   Run: node tests/test_inqueue.js */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(REPO_ROOT, 'schedule', 'index.html');
const src = fs.readFileSync(INDEX_HTML, 'utf8');

let passCount = 0, failCount = 0;
function check(name, cond, detail) {
  if (cond) { console.log('PASS - ' + name); passCount++; }
  else { console.log('FAIL - ' + name + (detail ? ('  :: ' + detail) : '')); failCount++; }
}

/* ───────── pull the exact statements out of the live file by name ─────────
   Single-line consts (OUTSOURCED, isOut, pptOf, realPP, inQueue) are grabbed to end-of-line.
   invReleasable spans multiple lines/braces, so it's pulled with a brace/paren/string-aware
   scanner that stops at the top-level terminating semicolon (same technique as
   tests/test_2b_render.js's extractConst helper). */
function extractLine(re, label) {
  const m = re.exec(src);
  if (!m) throw new Error('could not find ' + label + ' in schedule/index.html');
  return m[0];
}
function extractConst(name) {
  const re = new RegExp('const\\s+' + name + '\\s*=');
  const m = re.exec(src);
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
const outsourcedConst = extractLine(/const OUTSOURCED=.*$/m, 'const OUTSOURCED=');
const isOutConst = extractLine(/const isOut=.*$/m, 'const isOut=');
const pptOfConst = extractLine(/const pptOf=.*$/m, 'const pptOf=');
const realPPConst = extractLine(/const realPP=.*$/m, 'const realPP=');
const invReleasableConst = extractConst('invReleasable');
const inQueueConst = extractLine(/const inQueue=.*$/m, 'const inQueue=');

/* ───────── evaluate the extracted source into real, callable functions ───────── */
function makeInQueue(store, jobs) {
  const factory = new Function('store', 'jobs', `
    ${outsourcedConst}
    ${isOutConst}
    ${pptOfConst}
    ${realPPConst}
    ${invReleasableConst}
    ${inQueueConst}
    return { inQueue, isOut, OUTSOURCED, invReleasable, pptOf, realPP };
  `);
  return factory(store, jobs).inQueue;
}

const OUT_STATUS = '👕 Awaiting Goods (Outsourced - In Production)👕';

/* ───────── assertions 1-5 (original 5, from PLAN-queue-outsourced.md — must keep passing) ───────── */
{
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [];
  const inQueue = makeInQueue(store, jobs);

  const outsourcedNoDate = { imprint: '27155 - 2', invoice: '27155', station: 'Post Production', date: '', status: OUT_STATUS, postProdType: 'Packaging (Bandana)' };
  check(
    "1. outsourced imprint, Post Production station, no prod date -> IN QUEUE (the bug being fixed)",
    inQueue(outsourcedNoDate) === true,
    'inQueue(27155 - 2) = ' + inQueue(outsourcedNoDate)
  );

  const outsourcedWithDate = { ...outsourcedNoDate, date: '2026-07-30' };
  check(
    "2. same outsourced imprint once given a prod date -> NOT in queue (placed on the board)",
    inQueue(outsourcedWithDate) === false,
    'inQueue(27155 - 2 dated) = ' + inQueue(outsourcedWithDate)
  );

  const normalStationed = { imprint: '27550 - 1', station: 'Auto Press (In Season)', date: '', status: '👕 Blanks to Pull from Inventory 👕' };
  check(
    "3. normal stationed job, no date -> NOT in queue (regression guard, unchanged behaviour)",
    inQueue(normalStationed) === false,
    'inQueue(27550 - 1) = ' + inQueue(normalStationed)
  );

  const normalUnstationed = { imprint: '99999 - 1', station: '', date: '', status: '👕 Blanks Received 👕' };
  check(
    "4. normal unstationed job -> IN QUEUE (unchanged behaviour)",
    inQueue(normalUnstationed) === true,
    'inQueue(99999 - 1) = ' + inQueue(normalUnstationed)
  );

  const placeholder = { placeholder: true, station: '', date: '' };
  check(
    "5. placeholder row -> NOT in queue",
    inQueue(placeholder) === false,
    'inQueue(placeholder) = ' + inQueue(placeholder)
  );
}

/* ───────── assertion 6: Jean's own example — 27155-1 (pure vendor leg, unlabeled)
   stays OUT while 27155-2 (labeled Packaging (Bandana)) is IN, both at once ───────── */
{
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [
    { imprint: '27155 - 1', invoice: '27155', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A' },
    { imprint: '27155 - 2', invoice: '27155', station: 'Post Production', date: '', status: OUT_STATUS, postProdType: 'Packaging (Bandana)' },
  ];
  const inQueue = makeInQueue(store, jobs);
  check(
    "6a. 27155-2 (labeled in-house packaging leg) -> IN QUEUE",
    inQueue(jobs[1]) === true,
    'inQueue(27155 - 2) = ' + inQueue(jobs[1])
  );
  check(
    "6b. 27155-1 (unlabeled pure vendor print leg, sibling IS labeled) -> NOT in queue (Arrivals only)",
    inQueue(jobs[0]) === false,
    'inQueue(27155 - 1) = ' + inQueue(jobs[0])
  );
}

/* ───────── assertion 7: invoice marked "no 2nd service" never releases to the queue ───────── */
{
  const store = { arrived: {}, invsvc: { '27999': 'none' }, pptype: {} };
  const jobs = [
    { imprint: '27999 - 1', invoice: '27999', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A' },
  ];
  const inQueue = makeInQueue(store, jobs);
  check(
    '7. invoice with invsvc="none" (ships direct from vendor) -> NOT in queue',
    inQueue(jobs[0]) === false,
    'inQueue(27999 - 1) = ' + inQueue(jobs[0])
  );
}

/* ───────── assertion 8: no sibling labeled yet -> legacy flow releases ALL siblings ───────── */
{
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [
    { imprint: '28100 - 1', invoice: '28100', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A' },
    { imprint: '28100 - 2', invoice: '28100', station: 'Post Production', date: '', status: OUT_STATUS, postProdType: 'N/A' },
  ];
  const inQueue = makeInQueue(store, jobs);
  check(
    '8a. unlabeled outsourced invoice, no sibling labeled yet -> imprint 1 IN QUEUE (legacy release path)',
    inQueue(jobs[0]) === true,
    'inQueue(28100 - 1) = ' + inQueue(jobs[0])
  );
  check(
    '8b. unlabeled outsourced invoice, no sibling labeled yet -> imprint 2 IN QUEUE (legacy release path)',
    inQueue(jobs[1]) === true,
    'inQueue(28100 - 2) = ' + inQueue(jobs[1])
  );
}

console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
