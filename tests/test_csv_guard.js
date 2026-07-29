/* Acceptance test for the CSV truncation guard (2026-07-29).
   The Railway exporter intermittently truncates (a ~7KB/23-row export vs a healthy ~32KB/82-row
   one); before this guard, a truncated feed reached ingestRecords() and blanked record dates
   (Unscheduled jumped 5->29 live on 7/28). This extracts the REAL csvTruncationVerdict() out of
   schedule/index.html, evaluates it, and also asserts the guard is actually WIRED into
   loadLiveCsv(). Not a reimplementation. Run: node tests/test_csv_guard.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX_HTML = path.join(path.resolve(__dirname, '..'), 'schedule', 'index.html');
const src = fs.readFileSync(INDEX_HTML, 'utf8');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log('PASS - ' + name); pass++; }
  else { console.log('FAIL - ' + name + (detail ? ('  :: ' + detail) : '')); fail++; }
}

/* Pull the real pure helper out of the shipped source and eval it. Function declarations
   attach to the vm context global, so ctx.csvTruncationVerdict is defined after the run. */
function extractFn(name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('function not found in schedule/index.html: ' + name);
  const braceStart = src.indexOf('{', m.index);
  let depth = 0, j = braceStart;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(m.index, j);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(extractFn('csvTruncationVerdict'), ctx);
const V = ctx.csvTruncationVerdict;

// 1. Healthy feed against a healthy baseline -> accept
check('1. 82 rows vs last-good 82 -> accept', V(82, 82).accept === true);

// 2. The exact failure from 7/28: a truncated feed against a healthy baseline -> REJECT
check('2. 23 rows vs last-good 82 -> REJECT (the bug being fixed)', V(23, 82).accept === false);

// 3. Severe truncation (6-row export seen from the Railway cron) -> REJECT
check('3. 6 rows vs last-good 82 -> REJECT', V(6, 82).accept === false);

// 4. Cold start — no baseline yet -> accept (nothing to compare; becomes the baseline)
check('4a. any rows, baseline 0 -> accept (cold start)', V(23, 0).accept === true);
check('4b. any rows, baseline null -> accept (cold start)', V(23, null).accept === true);

// 5. Recovery — a healthy feed against a low baseline -> accept (baseline ratchets back up)
check('5. 82 rows vs low baseline 23 -> accept (recovery)', V(82, 23).accept === true);

// 6. Normal day-to-day variation stays under the cliff -> accept
check('6. 60 rows vs last-good 82 -> accept (normal variation, not a cliff)', V(60, 82).accept === true);

// 7. Boundary: <50% rejects, exactly 50% accepts
check('7a. exactly 50% (41 vs 82) -> accept', V(41, 82).accept === true);
check('7b. just below 50% (40 vs 82) -> REJECT', V(40, 82).accept === false);

// 8. Wiring — the guard must actually be USED in loadLiveCsv, not just defined
const llcStart = src.indexOf('async function loadLiveCsv()');
const after = src.indexOf('\nasync function ', llcStart + 1);
const body = src.slice(llcStart, after > 0 ? after : llcStart + 2000);
check('8a. loadLiveCsv calls csvTruncationVerdict', /csvTruncationVerdict\s*\(/.test(body));
check('8b. loadLiveCsv reads/persists sb_csv_lastgood_rows', /sb_csv_lastgood_rows/.test(body));
check('8c. loadLiveCsv early-returns on a rejected feed', /if\(!v\.accept\)\{[\s\S]*?return;/.test(body));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
