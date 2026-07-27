/* Acceptance test for the RENDER_FROM_RECORDS default flip (2026-07-27).
   Extracts the REAL `let RENDER_FROM_RECORDS=...try{...}catch(e){}` resolution block
   out of schedule/index.html and evaluates it in a vm sandbox with mocked localStorage
   + location, asserting the exact tri-state semantics of the flip. Runs the shipped
   source, not a reimplementation. Run: node tests/test_render_default.js */
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

/* Pull the block from `let RENDER_FROM_RECORDS=` through its closing `}catch(e){}`. */
function extractBlock(name) {
  const start = src.indexOf('let ' + name + '=');
  if (start < 0) throw new Error('flag not found: ' + name);
  const end = src.indexOf('}catch(e){}', start);
  if (end < 0) throw new Error('no try/catch terminator for ' + name);
  return src.slice(start, end + '}catch(e){}'.length);
}
const BLOCK = extractBlock('RENDER_FROM_RECORDS');

/* Evaluate the real block against a mocked browser. `throwOnGet` simulates storage
   throwing at load (private browsing / partitioned iframe). Returns {flag, store}. */
function run({ search = '', store = {}, throwOnGet = false } = {}) {
  const backing = Object.assign({}, store);
  const localStorage = {
    getItem(k) { if (throwOnGet) throw new Error('storage blocked'); return k in backing ? backing[k] : null; },
    setItem(k, v) { backing[k] = String(v); },
    removeItem(k) { delete backing[k]; },
  };
  const ctx = { localStorage, location: { search }, URLSearchParams };
  vm.createContext(ctx);
  // `let RENDER_FROM_RECORDS` is lexically scoped and does NOT attach to the context
  // object; the trailing bare expression is what runInContext returns.
  const flag = vm.runInContext(BLOCK + '\n;RENDER_FROM_RECORDS', ctx);
  return { flag, store: backing };
}

// 1. Fresh device, nothing stored, no param -> ON (records). This is the flip, and it is
//    the ONLY way records reach the front-door-embedded page (URL params don't reach it).
check('1. no param + empty storage -> RENDER_FROM_RECORDS true (new default)', run().flag === true);

// 2. Explicit opt-out via ?render=feed -> OFF, and it PERSISTS as 'feed'
{
  const r = run({ search: '?render=feed' });
  check('2a. ?render=feed -> RENDER_FROM_RECORDS false', r.flag === false);
  check('2b. ?render=feed persists the opt-out as "feed"', r.store.sb_render_source === 'feed', 'stored=' + r.store.sb_render_source);
}

// 3. Explicit opt-in via ?render=records -> ON, persists as 'records'
{
  const r = run({ search: '?render=records' });
  check('3a. ?render=records -> RENDER_FROM_RECORDS true', r.flag === true);
  check('3b. ?render=records persists "records"', r.store.sb_render_source === 'records');
}

// 4. A stored opt-out survives a reload with no param (the opt-out must stick)
check('4. stored "feed", no param -> RENDER_FROM_RECORDS false (opt-out sticks)', run({ store: { sb_render_source: 'feed' } }).flag === false);

// 5. A stored opt-in survives a reload with no param
check('5. stored "records", no param -> RENDER_FROM_RECORDS true', run({ store: { sb_render_source: 'records' } }).flag === true);

// 6. Storage throws at load -> default ON (must never fall back to feed post-flip)
check('6. storage throws -> RENDER_FROM_RECORDS true (default survives the exception)', run({ throwOnGet: true }).flag === true);

// 7. Migration: a device that opted out under the OLD ?render=feed (key removed -> absent)
//    reads as default ON. Intended — the flip wants everyone on records; a genuine post-flip
//    opt-out now stores 'feed' and is covered by case 4.
check('7. legacy feed opt-out (key absent) -> RENDER_FROM_RECORDS true (folds into the new default)', run({ store: {} }).flag === true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
