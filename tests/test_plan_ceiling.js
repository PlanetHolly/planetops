// The planning ceiling (Jean 2026-08-05). capFor() = the PHYSICAL day (420 std / 600 OT).
// planCap() = the line we SCHEDULE to, 85% of physical. Placement (freeMin/recommendFor)
// reasons about plan so the ⚡ fits chip stops offering a day once it is full by plan,
// while reserve (plan -> physical) stays reachable by hand. Guards:
//   - the constant and the two derived numbers
//   - per-day cap overrides still win, and the plan line scales with them
//   - freeMin measures against plan, not physical (the actual behaviour change)
//   - the 4-state ladder is applied everywhere and the dead 70%-of-physical amber is gone
//   - the cap editor reads the physical cap from data-cap, not the displayed plan
//   - the Gauge's PLAN_PCT stays in step with the Scheduler's
const fs=require('fs'), vm=require('vm');
const src=fs.readFileSync(__dirname+'/../schedule/index.html','utf8');
const gauge=fs.readFileSync(__dirname+'/../capacity/index.html','utf8');
function grabFn(name){ const i=src.indexOf('function '+name+'('); if(i<0)throw new Error('fn not found: '+name);
  let j=src.indexOf('{',i),d=0; for(;j<src.length;j++){const c=src[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0){j++;break;}}} return src.slice(i,j); }

let pass=0,fail=0;
function t(n,c){c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+n);}

// ── the real capFor + planCap, lifted from source ──
const ctx={console}; vm.createContext(ctx);
vm.runInContext("let store={caps:{}}; var AUTO={key:'auto',cap:420,otCap:600}; var POST={key:'post',cap:240};", ctx);
vm.runInContext(src.match(/const PLAN_PCT=[\d.]+;/)[0], ctx);
vm.runInContext(grabFn('capFor'), ctx);
vm.runInContext(grabFn('planCap'), ctx);
const run=e=>vm.runInContext(e,ctx);

t('A. PLAN_PCT is 0.85', run('PLAN_PCT')===0.85);
t('B. standard press day: physical 420 -> plan 357', run("planCap(AUTO,'2026-08-10',false)")===357);
t('C. OT press day: physical 600 -> plan 510', run("planCap(AUTO,'2026-08-10',true)")===510);
t('D. plan never exceeds physical', run("planCap(AUTO,'d',false) < capFor(AUTO,'d',false)")===true);
t('E. a non-auto lane scales too: post 240 -> 204', run("planCap(POST,'2026-08-10',false)")===204);

// per-day override sets the PHYSICAL day; plan rides on top of it
run("store.caps['2026-08-11|auto']=500;");
t('F. per-day override still wins for physical', run("capFor(AUTO,'2026-08-11',false)")===500);
t('G. plan scales with the override (500 -> 425)', run("planCap(AUTO,'2026-08-11',false)")===425);

// ── the behaviour change: free room is measured against plan ──
vm.runInContext(`
  var jobs=[], LANES=[AUTO];
  var laneOf=s=>String(s||'').startsWith('Auto Press')?AUTO:null;
`, ctx);
vm.runInContext(grabFn('usedMin'), ctx);
vm.runInContext(grabFn('freeMin'), ctx);
run("jobs=[{date:'2026-08-12',station:'Auto Press (In Season)',minutes:300}];");
t('H. 300 of a 357 plan leaves 57 free (not 120 against physical)', run("freeMin(AUTO,'2026-08-12')")===57);
run("jobs=[{date:'2026-08-12',station:'Auto Press (In Season)',minutes:380}];");
t('I. a day inside reserve reports NEGATIVE free room, so it stops being recommended',
  run("freeMin(AUTO,'2026-08-12')")===-23);
t('J. ...even though it is still under the physical day', run("380 < capFor(AUTO,'2026-08-12',false)")===true);

// overPlanMin: the minutes that become OT or a move
vm.runInContext(grabFn('overPlanMin'), ctx);
t('K. overPlanMin counts only the excess past plan',
  run("overPlanMin([{date:'d',station:'Auto Press (In Season)',minutes:380}],false,'d')")===23);
t('L. overPlanMin is 0 for a day sitting on the plan line',
  run("overPlanMin([{date:'d',station:'Auto Press (In Season)',minutes:357}],false,'d')")===0);
t('M. overPlanMin ignores empty stations rather than charging them',
  run("overPlanMin([],false,'d')")===0);

// ── the 4-state ladder, everywhere, with the dead amber removed ──
const ladders=[...src.matchAll(/used>=cap\?'over(?:c)?':used>plan\?'reserve(?:c)?':used>=plan\*\.85\?'warn(?:c)?':'ok(?:c)?'/g)];
const calLadders=[...src.matchAll(/\.used>=\w+\.cap\?'overc':\w+\.used>\w+\.plan\?'reservec':\w+\.used>=\w+\.plan\*\.85\?'warnc':'okc'/g)];
t('N. 4-state ladder present at the lane bar + day chips', ladders.length===2);
t('O. 4-state ladder present at both calendar chip sites', calLadders.length===2);
t('P. no dead "70% of physical" amber left anywhere', !/used>=cap\*\.7|\.cap\*\.7/.test(src));

// ── the cap editor must not overwrite the physical day with the displayed plan ──
t('Q. lane bar exposes the physical cap as data-cap', /data-cap="\$\{cap\}"/.test(src));
t('R. cap editor reads dataset.cap, not the rendered denominator',
  /const cur=sp\.dataset\.cap;/.test(src) && !/sp\.textContent\.split\('\/'\)\[1\]/.test(src));

// ── the two apps must agree on the ceiling ──
const gp=gauge.match(/const PLAN_PCT=([\d.]+);/);
t('S. Gauge declares PLAN_PCT', !!gp);
t('T. Gauge PLAN_PCT matches the Scheduler', gp && Number(gp[1])===run('PLAN_PCT'));
t('U. Gauge still knows the physical day (420/600 untouched)', /const CAP=\{Standard:420,OT:600\};/.test(gauge));
t('V. Gauge grades against plan, and Full still means past the physical day',
  /minutes>=cap\)\{cls='full'/.test(gauge) && /minutes>plan\)\{cls='reserve'/.test(gauge));
t('W. Gauge "next open" follows the new open band, not a stale pct<70',
  /open:cls==='open'/.test(gauge) && !/open:pct<70/.test(gauge));

// ── real markup: run the SHIPPED laneBlock and read what it actually emits ──
// laneBlock is what the board paints. Stub only its unrelated collaborators (card
// bodies, pallet lookahead) so the capacity markup itself is the real thing.
vm.runInContext(`
  var searchQ='', expandedLanes=new Set();
  var isPrinted=()=>false, jobCard=()=>'', fmtShort=d=>d, dateRange=()=>['2026-08-12'];
`, ctx);
vm.runInContext(grabFn('laneBlock'), ctx);
const mk=mins=>`laneBlock(AUTO,[{date:'2026-08-12',station:'Auto Press (In Season)',minutes:${mins},steps:[],pallet:'22"',ink:'Plastisol'}],false,'2026-08-12')`;
const atOk=run(mk(200)), atWarn=run(mk(320)), atReserve=run(mk(380)), atOver=run(mk(440));

t('X. a light day paints green against the plan denominator',
  /class="cap okt"/.test(atOk) && /200\/357 min/.test(atOk) && !/reserve/.test(atOk));
t('Y. approaching the plan line paints amber', /class="cap warnt"/.test(atWarn));
t('Z. past plan paints the reserve state and names the overage',
  /class="cap reservet"/.test(atReserve) && /\+23 min into reserve/.test(atReserve));
t('AA. past the physical day paints red and says so',
  /class="cap overt"/.test(atOver) && /\+83 min over the day/.test(atOver));
t('AB. the plan tick is painted on the bar at 85%', /class="plantick" style="left:85%"/.test(atReserve));
t('AC. the physical cap rides along as data-cap for the editor', /data-cap="420"/.test(atReserve));

// ── the Gauge is PM-facing: run its REAL eff() and check what a PM would be told ──
function grabGaugeFn(name){ const i=gauge.indexOf('function '+name+'('); if(i<0)throw new Error('gauge fn not found: '+name);
  let j=gauge.indexOf('{',i),d=0; for(;j<gauge.length;j++){const c=gauge[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0){j++;break;}}} return gauge.slice(i,j); }
const gctx={console}; vm.createContext(gctx);
vm.runInContext(gauge.match(/const CAP=\{[^}]+\};/)[0], gctx);
vm.runInContext(gauge.match(/const PLAN_PCT=[\d.]+;/)[0], gctx);
vm.runInContext(gauge.match(/const planOf=[^;]+;/)[0], gctx);
vm.runInContext("let LOAD={},OVERRIDES={};", gctx);
vm.runInContext(grabGaugeFn('eff'), gctx);
const g=(mins,station='Standard')=>{vm.runInContext(`LOAD={'d':{minutes:${mins},station:'${station}'}};`,gctx);return vm.runInContext("eff('d')",gctx);};

t('AD. Gauge: 250 min of a 357 plan reads Open (70% of plan is 250)', g(240).st==='Open');
t('AE. Gauge: 300 min reads Limited, not Open', g(300).st==='Limited');
t('AF. Gauge: 380 min reads RESERVE — the state that did not exist before', g(380).st==='Reserve');
t('AG. Gauge: 420 min reads Full (the physical day)', g(420).st==='Full');
t('AH. Gauge: a day that used to read "Limited 95%" now reads Reserve',
  g(400).st==='Reserve' && g(400).pct===112);
t('AI. Gauge: an OT day scales — 510 plan, 600 physical',
  g(500,'OT').st==='Limited' && g(560,'OT').st==='Reserve' && g(600,'OT').st==='Full');
t('AJ. Gauge: "next open" no longer offers a day that is past plan',
  g(380).open===false && g(240).open===true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
