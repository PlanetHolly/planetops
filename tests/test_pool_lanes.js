/* The Board's unscheduled pool is grouped by STATION (2026-07-27, Jean's request).
   Everything in the pool already carries a station — that's what released it from the Queue — so
   a flat list buried the fact that decides where a job can land.

   The property that matters: grouping must NOT drop a row. Every job handed to poolLanes() must
   come out in exactly one station block, including jobs whose Printavo station matches no lane.
   Extracts the REAL poolLanes/LANES/laneOf from schedule/index.html with jobCard stubbed.
   Run: node tests/test_pool_lanes.js */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'schedule', 'index.html'), 'utf8');
let passCount = 0, failCount = 0;
function check(name, cond, detail) {
  if (cond) { console.log('PASS - ' + name); passCount++; }
  else { console.log('FAIL - ' + name + (detail ? ('  :: ' + detail) : '')); failCount++; }
}
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('fn not found: ' + name);
  let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return src.slice(i, j);
}
function grabConst(name) {
  const m = new RegExp('const\\s+' + name + '\\s*=').exec(src);
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
// jobCard is stubbed to a marker so we can count rows without dragging in the whole card renderer.
const poolLanes = new Function(`
  ${grabConst('LANES')}
  ${/const laneOf=.*$/m.exec(src)[0]}
  const jobCard=j=>'<card imp="'+j.imprint+'">';
  ${grabFn('poolLanes')}
  return poolLanes;
`)();

const J = (imprint, station, minutes) => ({ imprint, station, minutes, date: '', invoice: imprint.split(' - ')[0] });

/* ───────── 1-4: the four stations Jean named, each its own block ───────── */
{
  const un = [
    J('27561 - 1', 'Auto Press (In Season)', 758),
    J('27542 - 1', 'Auto Press (In Season)', 40),
    J('27600 - 1', 'Manual Press', 30),
    J('27601 - 1', 'Heat Press', 25),
    J('27602 - 2', 'Post Production', 45),
  ];
  const html = poolLanes(un);
  check('1. Auto Press block present, both its jobs inside', /AUTO|Auto Press/.test(html) && (html.match(/<card imp="275(61|42) - 1">/g) || []).length === 2);
  check('2. Manual Press, Heat Press and Post Production each get a block',
    html.includes('Manual Press') && html.includes('Heat Press') && html.includes('Post Production'));
  check('3. every job rendered exactly once (' + un.length + ' cards)', (html.match(/<card /g) || []).length === un.length);
  check('4. Auto Press header sums its minutes (798)', /798 min waiting for a date/.test(html), html.slice(0, 300));
}

/* ───────── 5: blocks follow LANES order, so the pool reads like the day rows below it ───────── */
{
  const un = [J('1 - 1', 'Post Production', 10), J('2 - 1', 'Heat Press', 10), J('3 - 1', 'Auto Press (In Season)', 10), J('4 - 1', 'Manual Press', 10)];
  const html = poolLanes(un);
  const order = ['Auto Press', 'Heat Press', 'Manual Press', 'Post Production'].map(l => html.indexOf('>' + l + '<'));
  check('5. station blocks render in LANES order regardless of input order',
    order.every((v, i) => v > -1 && (i === 0 || v > order[i - 1])), JSON.stringify(order));
}

/* ───────── 6-7: THE INVARIANT — an unrecognized Printavo station still gets a block.
   A job that reaches the pool always has a station, but nothing guarantees it matches a lane
   (a retired or renamed Printavo station). Grouping must never silently drop it. ───────── */
{
  const un = [J('27700 - 1', 'Auto Press (In Season)', 60), J('27701 - 1', 'Embroidery Bay 3', 20), J('27702 - 1', '', 15)];
  const html = poolLanes(un);
  check('6. unmatched station lands in the "Other station" block', html.includes('Other station'));
  check('7. no row is dropped by grouping (' + un.length + ' in, ' + (html.match(/<card /g) || []).length + ' out)',
    (html.match(/<card /g) || []).length === un.length);
}

/* ───────── 8: empty pool renders nothing (the section itself is hidden by renderBoard) ───────── */
check('8. empty pool -> empty string, no stray station headers', poolLanes([]) === '');

console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
