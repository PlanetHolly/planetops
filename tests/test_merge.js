// Per-item merge — the crux. Extracts the REAL merge/stamp functions from schedule/index.html.
// A bug here loses schedule data, so this is exhaustive.
const fs=require('fs'), vm=require('vm');
const src=fs.readFileSync(__dirname+'/../schedule/index.html','utf8');
function grabFn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('fn '+name);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){const c=src[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0){j++;break;}}}return src.slice(i,j);}
function grabLine(s){const i=src.indexOf(s);if(i<0)throw new Error('line '+s);return src.slice(i,src.indexOf('\n',i));}
const ctx={console,JSON,Object,Set,Date};vm.createContext(ctx);
vm.runInContext('let store={},_syncCache={};',ctx);
[grabLine('const SYNC_KEYED='),grabLine('const SYNC_WHOLE='),grabLine('const _REC_VOLATILE='),
 grabFn('_valHash'),grabFn('_reseedSyncCache'),grabFn('_stampChanged'),grabFn('mergeSharedStores'),grabFn('_tombstoneAll')].forEach(c=>vm.runInContext(c,ctx));
const run=js=>vm.runInContext(js,ctx);
let pass=0,fail=0;const t=(n,c)=>{c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+n);};
const M=(local,remote)=>{ctx.__l=local;ctx.__r=remote;return run('mergeSharedStores(__l,__r)');};
const L=(local)=>run('(function(){var x=__l;return x;})()'); // no-op, we read ctx.__l after

// ---- mergeSharedStores ----
console.log('mergeSharedStores:');
// M1 different keys both survive (THE core win)
let l={moves:{A:'d1'},_ts:{moves:{A:1}}}, r={moves:{B:'d2'},_ts:{moves:{B:2}},_savedAt:2};
M(l,r); t('M1 different keys — A and B both survive', l.moves.A==='d1'&&l.moves.B==='d2');
// M2 same key remote newer
l={moves:{A:'x'},_ts:{moves:{A:1}}}; r={moves:{A:'y'},_ts:{moves:{A:2}}}; M(l,r);
t('M2 same key, remote newer -> remote value', l.moves.A==='y'&&l._ts.moves.A===2);
// M3 same key local newer
l={moves:{A:'x'},_ts:{moves:{A:2}}}; r={moves:{A:'y'},_ts:{moves:{A:1}}}; M(l,r);
t('M3 same key, local newer -> keep local', l.moves.A==='x'&&l._ts.moves.A===2);
// M4 local tombstone (deleted@2) vs remote old value@1 -> stays deleted
l={moves:{},_ts:{moves:{A:2}}}; r={moves:{A:'old'},_ts:{moves:{A:1}}}; M(l,r);
t('M4 local tombstone beats older remote value (no resurrect)', !('A' in l.moves));
// M5 remote tombstone@2 vs local value@1 -> deleted locally
l={moves:{A:'old'},_ts:{moves:{A:1}}}; r={moves:{},_ts:{moves:{A:2}}}; M(l,r);
t('M5 remote tombstone (newer) deletes local value', !('A' in l.moves)&&l._ts.moves.A===2);
// M6 union: remote key local never saw
l={moves:{},_ts:{moves:{}}}; r={moves:{C:'z'},_ts:{moves:{C:1}}}; M(l,r);
t('M6 union — never-seen remote key adopted', l.moves.C==='z');
// M7 local tombstone@1 vs remote re-add@2 (newer) -> re-added
l={moves:{},_ts:{moves:{A:1}}}; r={moves:{A:'new'},_ts:{moves:{A:2}}}; M(l,r);
t('M7 remote re-add (newer) beats local tombstone', l.moves.A==='new');
// M8 whole-value operator
l={operator:'X',_ts:{operator:1}}; r={operator:'Y',_ts:{operator:2}}; M(l,r);
t('M8 operator whole-value, remote newer', l.operator==='Y');
l={operator:'X',_ts:{operator:2}}; r={operator:'Y',_ts:{operator:1}}; M(l,r);
t('M8b operator whole-value, local newer -> keep', l.operator==='X');
// M9 placeholders whole-array newest wins
l={placeholders:[{id:1}],_ts:{placeholders:1}}; r={placeholders:[{id:1},{id:2}],_ts:{placeholders:2}}; M(l,r);
t('M9 placeholders whole-array, remote newer replaces', l.placeholders.length===2);
// M10 changed flag
l={moves:{A:'x'},_ts:{moves:{A:1}}}; t('M10 changed=true when remote wins', M(l,{moves:{A:'y'},_ts:{moves:{A:2}}})===true);
l={moves:{A:'x'},_ts:{moves:{A:2}}}; t('M10b changed=false when nothing newer', M(l,{moves:{A:'y'},_ts:{moves:{A:1}}})===false);
// M11 two different maps don't interfere
l={moves:{A:'d'},stations:{},_ts:{moves:{A:2},stations:{}}}; r={moves:{},stations:{A:'auto'},_ts:{moves:{A:1},stations:{A:3}}}; M(l,r);
t('M11 station adopted, local move preserved', l.moves.A==='d'&&l.stations.A==='auto');

// ---- _stampChanged / _valHash ----
console.log('_stampChanged:');
run('store=JSON.parse(JSON.stringify({moves:{A:"d1"},jobRecords:{},_ts:{}})); _syncCache={}; _reseedSyncCache();');
// baseline seeded; now no change -> stamping should NOT set _ts (cache matches)
run('_stampChanged();'); t('S1 unchanged after reseed -> no stamp', run('Object.keys(store._ts.moves||{}).length')===0);
// change a value
run('store.moves.A="d2"; _stampChanged();'); t('S2 changed value -> stamped', run('store._ts.moves.A>0'));
// new key
run('store.moves.B="e"; _stampChanged();'); t('S3 new key -> stamped', run('store._ts.moves.B>0'));
// delete a key -> tombstone
run('delete store.moves.A; _stampChanged();'); t('S4 deleted key -> tombstone (ts set, value gone)', run('store._ts.moves.A>0 && !("A" in store.moves)'));
// jobRecords volatile: only lastFeedSeen changes -> NOT stamped
run('store=JSON.parse(JSON.stringify({jobRecords:{"1-1":{prodDue:"a",lastFeedSeen:1}},moves:{},_ts:{}})); _syncCache={}; _reseedSyncCache();');
run('store.jobRecords["1-1"].lastFeedSeen=999; _stampChanged();');
t('S5 jobRecords lastFeedSeen-only change -> NOT stamped', run('Object.keys(store._ts.jobRecords||{}).length')===0);
run('store.jobRecords["1-1"].prodDue="b"; _stampChanged();');
t('S6 jobRecords real field change -> stamped', run('store._ts.jobRecords["1-1"]>0'));

// ---- round-trip: two devices, different jobs, no loss ----
console.log('round-trip:');
// A schedules job A; B schedules job B; each stamps then B pulls A then A pulls B
run('store=JSON.parse(JSON.stringify({moves:{},_ts:{}})); _syncCache={}; _reseedSyncCache(); store.moves.JOBA="mon"; _stampChanged();');
const A=JSON.parse(run('JSON.stringify(store)'));
run('store=JSON.parse(JSON.stringify({moves:{},_ts:{}})); _syncCache={}; _reseedSyncCache(); store.moves.JOBB="tue"; _stampChanged();');
const B=JSON.parse(run('JSON.stringify(store)'));
ctx.__l=B; ctx.__r=A; run('mergeSharedStores(__l,__r)');
t('R1 B merges A -> B has both JOBA and JOBB', B.moves.JOBA==='mon'&&B.moves.JOBB==='tue');
ctx.__l=A; ctx.__r=B; run('mergeSharedStores(__l,__r)');
t('R1b A merges B -> A has both', A.moves.JOBA==='mon'&&A.moves.JOBB==='tue');


// ---- Fix #1 regression: Reset tombstones cover keys only OTHER devices held ----
(function(){
  console.log('reset-union:');
  // local knows only JOBA; pull remote that has JOBB; then tombstone-all must stamp BOTH
  run('store=JSON.parse(JSON.stringify({moves:{JOBA:"mon"},_ts:{moves:{JOBA:1}}})); _syncCache={}; _reseedSyncCache();');
  ctx.__l=null; run('__l=store'); ctx.__r={moves:{JOBB:"tue"},_ts:{moves:{JOBB:5}},_savedAt:5};
  run('mergeSharedStores(store,__r);');   // simulate the pre-reset remote pull
  run('_tombstoneAll();');
  const bothStamped = run('store._ts.moves.JOBA>0 && store._ts.moves.JOBB>0');
  t('T1 reset tombstones cover local+remote keys', bothStamped);
  // and after wipe, a stale device holding JOBB@older gets it deleted on merge
  const ts=JSON.parse(run('JSON.stringify(store._ts)'));
  const wiped={moves:{},_ts:ts,_savedAt:9};   // the reset payload: empty values, tombstone _ts
  const stale={moves:{JOBB:"tue"},_ts:{moves:{JOBB:5}}};   // stale tab still holds JOBB@5
  ctx.__l=stale; ctx.__r=wiped; run('mergeSharedStores(__l,__r)');
  t('T1b stale tab adopts the reset deletion (JOBB removed)', !('JOBB' in stale.moves));
})();

console.log('');console.log(pass+' passed, '+fail+' failed');process.exit(fail?1:0);
