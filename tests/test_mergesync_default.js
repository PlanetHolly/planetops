/* Acceptance test for the MERGE_SYNC default flip (2026-07-27).
   Extracts the REAL `let MERGE_SYNC=...try{...}catch(e){}` resolution block out of
   schedule/index.html and evaluates it in a vm sandbox with mocked localStorage +
   location, asserting the exact tri-state semantics of the flip. Not a reimplementation
   — it runs the shipped source. Run: node tests/test_mergesync_default.js */
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

/* Pull the block from `let MERGE_SYNC=` through its closing `}catch(e){}`. */
function extractBlock(name) {
  const start = src.indexOf('let ' + name + '=');
  if (start < 0) throw new Error('flag not found: ' + name);
  const end = src.indexOf('}catch(e){}', start);
  if (end < 0) throw new Error('no try/catch terminator for ' + name);
  return src.slice(start, end + '}catch(e){}'.length);
}
const BLOCK = extractBlock('MERGE_SYNC');

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
  // `let MERGE_SYNC` is lexically scoped and does NOT attach to the context object;
  // the trailing bare expression is what runInContext returns.
  const flag = vm.runInContext(BLOCK + '\n;MERGE_SYNC', ctx);
  return { flag, store: backing };
}

// 1. Fresh device, nothing stored, no param -> ON (the flip's whole point)
check('1. no param + empty storage -> MERGE_SYNC true (new default)', run().flag === true);

// 2. Explicit opt-out via ?sync=blob -> OFF, and it PERSISTS as '0' (old code did removeItem, which didn't stick)
{
  const r = run({ search: '?sync=blob' });
  check('2a. ?sync=blob -> MERGE_SYNC false', r.flag === false);
  check('2b. ?sync=blob persists the opt-out as "0"', r.store.sb_sync_merge === '0', 'stored=' + r.store.sb_sync_merge);
}

// 3. Explicit opt-in via ?sync=merge -> ON, persists as '1'
{
  const r = run({ search: '?sync=merge' });
  check('3a. ?sync=merge -> MERGE_SYNC true', r.flag === true);
  check('3b. ?sync=merge persists "1"', r.store.sb_sync_merge === '1');
}

// 4. A stored opt-out survives a reload with no param (the opt-out must stick)
check('4. stored "0", no param -> MERGE_SYNC false (opt-out sticks)', run({ store: { sb_sync_merge: '0' } }).flag === false);

// 5. A stored opt-in survives a reload with no param
check('5. stored "1", no param -> MERGE_SYNC true', run({ store: { sb_sync_merge: '1' } }).flag === true);

// 6. Storage throws at load -> default ON (must never fall back to OFF post-flip)
check('6. storage throws -> MERGE_SYNC true (default survives the exception)', run({ throwOnGet: true }).flag === true);

// 7. Migration: a device that opted out under the OLD ?sync=blob (key removed -> absent) reads as default ON.
//    Intended — the flip wants everyone on; a genuine post-flip opt-out now stores '0' and is covered by case 4.
check('7. legacy blob opt-out (key absent) -> MERGE_SYNC true (folds into the new default)', run({ store: {} }).flag === true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
