/* Acceptance test for the Queue/Arrivals visibility fix (2026-07-22, extended 2026-07-22b
   for in-house post-production legs, and 2026-07-23 round 2 for the Sched-column date field
   in Queue mode — see PLAN-inhouse-postpro.md).
   Extracts the REAL `inQueue`, `isOut`, `OUTSOURCED`, `invReleasable`, `pptOf`, `realPP`,
   `isPrintavoPost`, `exitsOnDate`, `laneOf`, and `LANES` definitions out of schedule/index.html
   by regex/brace-balancing and evaluates them as live functions, so this test asserts against
   the shipped source — not a reimplementation of it.
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
  // Comment-aware (needed for LANES, whose inline /* … */ comment contains an apostrophe —
  // "Jean's number" — which would otherwise be mistaken for a string-literal open/close by
  // the plain string scanner below and desync the brace count for the rest of the file).
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
const outsourcedConst = extractLine(/const OUTSOURCED=.*$/m, 'const OUTSOURCED=');
const isOutConst = extractLine(/const isOut=.*$/m, 'const isOut=');
const pptOfConst = extractLine(/const pptOf=.*$/m, 'const pptOf=');
const realPPConst = extractLine(/const realPP=.*$/m, 'const realPP=');
const vendorTowConst = extractLine(/const vendorTow=.*$/m, 'const vendorTow=');
const inHouseLegConst = extractLine(/const inHouseLeg=.*$/m, 'const inHouseLeg=');
const invReleasableConst = extractConst('invReleasable');
const isPrintavoPostConst = extractLine(/const isPrintavoPost=.*$/m, 'const isPrintavoPost=');
const inQueueConst = extractLine(/const inQueue=.*$/m, 'const inQueue=');
const exitsOnDateConst = extractLine(/const exitsOnDate=.*$/m, 'const exitsOnDate=');
const lanesConst = extractConst('LANES');
const laneOfConst = extractLine(/const laneOf=.*$/m, 'const laneOf=');

/* ───────── evaluate the extracted source into real, callable functions ───────── */
function makeFns(store, jobs) {
  const factory = new Function('store', 'jobs', `
    ${lanesConst}
    ${laneOfConst}
    ${outsourcedConst}
    ${isOutConst}
    ${pptOfConst}
    ${realPPConst}
    ${vendorTowConst}
    ${inHouseLegConst}
    ${invReleasableConst}
    ${isPrintavoPostConst}
    ${inQueueConst}
    ${exitsOnDateConst}
    return { inQueue, isOut, OUTSOURCED, invReleasable, pptOf, realPP, isPrintavoPost, exitsOnDate, laneOf, LANES, vendorTow, inHouseLeg };
  `);
  return factory(store, jobs);
}
function makeInQueue(store, jobs) { return makeFns(store, jobs).inQueue; }
function makeExitsOnDate(store, jobs) { return makeFns(store, jobs).exitsOnDate; }

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

/* ───────── assertions 9-14: in-house post-production legs (2026-07-22b follow-up to PR #28)
   Printavo pre-stamps Station="Post Production" on in-house packaging/fold+bag/barcode legs
   too, hiding them from the Queue the same way it did for outsourced legs. Fix is scoped to
   the Post Production lane only (isPrintavoPost) — Jean's own queue-assigned station
   (stationAssigned) must still graduate the job to the board immediately, and press-lane
   Printavo stations (Auto/Heat/Manual) must stay out (they merely await a date). ───────── */
{
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [];
  const inQueue = makeInQueue(store, jobs);

  const foldBagBarcode = { imprint: '27524 - 2', station: 'Post Production', postProdType: 'Fold + Bag + Barcode', date: '', status: '👕 Blanks to Pull from Inventory 👕' };
  check(
    "9. 27524-2, Printavo-stamped Post Production, no date -> IN QUEUE (the bug being fixed)",
    inQueue(foldBagBarcode) === true,
    'inQueue(27524 - 2) = ' + inQueue(foldBagBarcode)
  );

  const packagingApparel = { imprint: '27365 - 3', station: 'Post Production', postProdType: 'Packaging (Apparel)', date: '', status: '👕 Blanks Received 👕' };
  check(
    "10. 27365-3, Printavo-stamped Post Production, no date -> IN QUEUE (the bug being fixed)",
    inQueue(packagingApparel) === true,
    'inQueue(27365 - 3) = ' + inQueue(packagingApparel)
  );

  const packagingApparelDated = { ...packagingApparel, date: '2026-07-30' };
  check(
    "11. same job once given a production date -> NOT in queue (placed on the board)",
    inQueue(packagingApparelDated) === false,
    'inQueue(27365 - 3 dated) = ' + inQueue(packagingApparelDated)
  );

  const packagingApparelJeanAssigned = { ...packagingApparel, stationAssigned: true };
  check(
    "12. same job with stationAssigned:true (Jean assigned Post Production himself) -> NOT in queue (graduation regression guard)",
    inQueue(packagingApparelJeanAssigned) === false,
    'inQueue(27365 - 3 stationAssigned) = ' + inQueue(packagingApparelJeanAssigned)
  );

  const autoPress = { imprint: '27550 - 1', station: 'Auto Press (In Season)', date: '', status: '👕 Blanks to Pull from Inventory 👕' };
  check(
    "13. Auto Press, Printavo-stamped station, no date -> NOT in queue (press lanes stay out, scope guard)",
    inQueue(autoPress) === false,
    'inQueue(27550 - 1) = ' + inQueue(autoPress)
  );

  const heatPress = { imprint: '27503 - 2', station: 'Heat Press', date: '', status: '✅ Art / Invoice Approved - Awaiting Payment ✅' };
  check(
    "14. Heat Press, Printavo-stamped station, no date -> NOT in queue (press lanes stay out, scope guard)",
    inQueue(heatPress) === false,
    'inQueue(27503 - 2) = ' + inQueue(heatPress)
  );
}

/* ───────── assertions 15-18: exitsOnDate (2026-07-23 round 2 — Sched column in Queue mode)
   Rows that already carry a Printavo station (outsourced, or an in-house post-pro leg
   Printavo stamped) have no station assignment left to make, so a production DATE is their
   only exit from the Queue. Normal jobs still graduate on station assignment and are unaffected. ───────── */
{
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [];
  const exitsOnDate = makeExitsOnDate(store, jobs);

  const outsourcedLeg = { imprint: '27155 - 2', invoice: '27155', station: 'Post Production', date: '', status: OUT_STATUS, postProdType: 'Packaging (Bandana)' };
  check(
    "15. 27155-2 (outsourced leg) -> exitsOnDate true",
    exitsOnDate(outsourcedLeg) === true,
    'exitsOnDate(27155 - 2) = ' + exitsOnDate(outsourcedLeg)
  );

  const printavoPostLeg = { imprint: '27524 - 2', station: 'Post Production', postProdType: 'Fold + Bag + Barcode', date: '', status: '👕 Blanks to Pull from Inventory 👕' };
  check(
    "16. 27524-2 (Printavo-stamped Post Production, in-house) -> exitsOnDate true",
    exitsOnDate(printavoPostLeg) === true,
    'exitsOnDate(27524 - 2) = ' + exitsOnDate(printavoPostLeg)
  );

  const normalUnstationed = { imprint: '99999 - 1', station: '', date: '', status: '👕 Blanks Received 👕' };
  check(
    "17. normal unstationed job -> exitsOnDate false (graduates on station assignment instead)",
    exitsOnDate(normalUnstationed) === false,
    'exitsOnDate(99999 - 1) = ' + exitsOnDate(normalUnstationed)
  );

  const jeanAssigned = { imprint: '27365 - 3', station: 'Post Production', postProdType: 'Packaging (Apparel)', date: '', status: '👕 Blanks Received 👕', stationAssigned: true };
  check(
    "18. job with stationAssigned:true (Jean assigned it himself) -> exitsOnDate false",
    exitsOnDate(jeanAssigned) === false,
    'exitsOnDate(27365 - 3 stationAssigned) = ' + exitsOnDate(jeanAssigned)
  );
}

/* ───────── assertion 19: source-consistency guard against the Sched-column alignment bug.
   The Sched header cell and the row's data-schedule cell must both be UNCONDITIONAL (present
   in every row/mode, contents varying instead of the whole <td> disappearing), and the expand
   row's colspan must be the unconditional 19 — a stale/conditional colspan or header is exactly
   the column-desync bug this change exists to prevent. ───────── */
{
  check(
    "19a. Sched header cell (H('date','Sched')) is no longer wrapped in a listShowAll conditional",
    !/listShowAll\?H\('date','Sched'\):''/.test(src) && /\$\{H\('date','Sched'\)\}/.test(src),
    'listShowAll-conditional header still present, or unconditional header missing'
  );
  check(
    "19b. row's data-schedule <td> is no longer wrapped in a listShowAll conditional",
    !/\$\{listShowAll\?`<td><input type="date" class="schedinput" data-schedule/.test(src),
    'listShowAll-conditional data-schedule <td> still present'
  );
  check(
    "19c. expand row colspan is the unconditional 19, not conditional on listShowAll",
    /<tr class="xrow"><td colspan="19">/.test(src) && !/colspan="\$\{listShowAll\?19:18\}"/.test(src),
    'expand row colspan is not the unconditional 19'
  );
}

/* ───────── assertions 20-25: Printavo's per-imprint TYPE OF WORK (2026-07-24).
   Jean's report on invoice 25414 — imprint 1 is a complete outsource, imprint 2 is the in-house
   packaging leg, and BOTH were showing in the queue because neither carried a Post-Pro label yet.
   Type of Work names the in-house leg directly, and an invoice whose imprints are ALL "Outsource"
   (27260, 27417) has no in-house work at all, so none of it belongs in the queue. ───────── */
{
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [
    { imprint: '25414 - 1', invoice: '25414', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'Outsource' },
    { imprint: '25414 - 2', invoice: '25414', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'In-House Production' },
  ];
  const inQueue = makeInQueue(store, jobs);
  check(
    "20a. 25414-2 (Type of Work = In-House Production, no Post-Pro label yet) -> IN QUEUE",
    inQueue(jobs[1]) === true,
    'inQueue(25414 - 2) = ' + inQueue(jobs[1])
  );
  check(
    "20b. 25414-1 (Type of Work = Outsource, in-house sibling exists) -> NOT in queue (the bug Jean reported)",
    inQueue(jobs[0]) === false,
    'inQueue(25414 - 1) = ' + inQueue(jobs[0])
  );
}
{
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = ['1', '2', '3', '4'].map(n => ({ imprint: '27260 - ' + n, invoice: '27260', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'Outsource' }));
  const inQueue = makeInQueue(store, jobs);
  check(
    '21. 27260 — every imprint Type of Work = Outsource, no in-house leg -> NONE in queue (Arrivals only)',
    jobs.every(j => inQueue(j) === false),
    'inQueue map = ' + jobs.map(j => j.imprint + ':' + inQueue(j)).join(', ')
  );
}
{
  const store = { arrived: {}, invsvc: {}, pptype: { '26504 - 4': 'Packaging (Merch)' } };
  const jobs = ['1', '2', '3'].map(n => ({ imprint: '26504 - ' + n, invoice: '26504', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'Outsource' }));
  jobs.push({ imprint: '26504 - 4', invoice: '26504', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'In-House Production' });
  const inQueue = makeInQueue(store, jobs);
  check(
    '22a. 26504-4 (the one in-house leg of three vendor legs) -> IN QUEUE',
    inQueue(jobs[3]) === true,
    'inQueue(26504 - 4) = ' + inQueue(jobs[3])
  );
  check(
    '22b. 26504-1..3 (vendor legs) -> NOT in queue',
    jobs.slice(0, 3).every(j => inQueue(j) === false),
    'inQueue map = ' + jobs.slice(0, 3).map(j => j.imprint + ':' + inQueue(j)).join(', ')
  );
}
{
  // A Post-Pro label Jean sets in the queue still names an in-house leg even when Printavo's
  // Type of Work says "Outsource" on every imprint — the label is the human override.
  const store = { arrived: {}, invsvc: {}, pptype: { '28200 - 2': 'Fold + Bag' } };
  const jobs = [
    { imprint: '28200 - 1', invoice: '28200', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'Outsource' },
    { imprint: '28200 - 2', invoice: '28200', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'Outsource' },
  ];
  const inQueue = makeInQueue(store, jobs);
  check(
    '23a. label set by hand on an all-Outsource invoice -> that imprint IS in the queue',
    inQueue(jobs[1]) === true,
    'inQueue(28200 - 2) = ' + inQueue(jobs[1])
  );
  check(
    '23b. its unlabeled vendor sibling stays out',
    inQueue(jobs[0]) === false,
    'inQueue(28200 - 1) = ' + inQueue(jobs[0])
  );
}
{
  // No Type of Work anywhere (CSV-only invoice, ordinal drift bailout) -> legacy release, unchanged.
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [
    { imprint: '28300 - 1', invoice: '28300', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: '' },
    { imprint: '28300 - 2', invoice: '28300', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A' },
  ];
  const inQueue = makeInQueue(store, jobs);
  check(
    '24. invoice with no Type of Work and no labels -> BOTH still release (legacy fallback intact)',
    inQueue(jobs[0]) === true && inQueue(jobs[1]) === true,
    'inQueue map = ' + jobs.map(j => j.imprint + ':' + inQueue(j)).join(', ')
  );
}
{
  // The in-house leg that isn't outsourced-classified at all (normal status, no Type of Work)
  // travels the normal queue path; its vendor siblings must still be blocked.
  const store = { arrived: {}, invsvc: {}, pptype: {} };
  const jobs = [
    { imprint: '28400 - 1', invoice: '28400', station: '', date: '', status: OUT_STATUS, postProdType: 'N/A', typeOfWork: 'Outsource' },
    { imprint: '28400 - 2', invoice: '28400', station: '', date: '', status: '👕 Blanks Received 👕', postProdType: 'N/A', typeOfWork: '' },
  ];
  const inQueue = makeInQueue(store, jobs);
  check(
    '25a. non-outsourced in-house sibling -> IN QUEUE via the normal unstationed path',
    inQueue(jobs[1]) === true,
    'inQueue(28400 - 2) = ' + inQueue(jobs[1])
  );
  check(
    '25b. its vendor sibling -> NOT in queue',
    inQueue(jobs[0]) === false,
    'inQueue(28400 - 1) = ' + inQueue(jobs[0])
  );
}

console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
