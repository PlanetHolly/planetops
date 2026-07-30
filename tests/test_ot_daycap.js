// OT-day capacity must survive station overrides. Queue graduation / station-assign rewrites a job's
// station to the generic "Auto Press (In Season)" (LANES[auto].printavo); OT-day detection must read the
// ORIGINAL (feed) station (j.stationOrig) so a Printavo OT day keeps its 600 cap instead of silently
// dropping to 420 (which showed e.g. 90% OT days as 150%+). Extracts the REAL capFor from the source and
// guards that all three isOT sites got the fix.
const fs=require('fs'), vm=require('vm');
const src=fs.readFileSync(__dirname+'/../schedule/index.html','utf8');
function grabFn(name){ const i=src.indexOf('function '+name+'('); if(i<0)throw new Error('fn not found: '+name);
  let j=src.indexOf('{',i),d=0; for(;j<src.length;j++){const c=src[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0){j++;break;}}} return src.slice(i,j); }

let pass=0,fail=0;
function t(n,c){c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+n);}

// ── behavioral: the shipped isOT predicate (base station via stationOrig) + the real capFor ──
const ctx={console}; vm.createContext(ctx);
vm.runInContext("let store={caps:{}}; var AUTO={key:'auto',cap:420,otCap:600};", ctx);
vm.runInContext(grabFn('capFor'), ctx);
const isOTday=(jobs,d)=>jobs.some(x=>x.date===d && /\(OT\)/.test(x.stationOrig||x.station));   // exactly as shipped

const stripped={date:'2026-07-29',stationOrig:'Auto Press (OT)',station:'Auto Press (In Season)'}; // OT feed, graduation-stripped
const plainOT ={date:'2026-07-29',station:'Auto Press (OT)'};                                       // OT, never overridden
const inSeason={date:'2026-07-31',station:'Auto Press (In Season)'};                                // never OT
t('A. override-stripped OT job still marks its day OT (the bug)', isOTday([stripped],'2026-07-29')===true);
t('B. un-overridden OT job still marks its day OT (unchanged)', isOTday([plainOT],'2026-07-29')===true);
t('C. In-Season job does NOT mark its day OT', isOTday([inSeason],'2026-07-31')===false);
t('D. base In-Season overridden TO an OT string does NOT mark OT (stationOrig wins)',
  isOTday([{date:'d',stationOrig:'Auto Press (In Season)',station:'Auto Press (OT)'}],'d')===false);

t('E. capFor auto OT day = 600', vm.runInContext("capFor(AUTO,'2026-07-29',true)",ctx)===600);
t('F. capFor auto standard day = 420', vm.runInContext("capFor(AUTO,'2026-07-31',false)",ctx)===420);
vm.runInContext("store.caps['2026-07-29|auto']=500;",ctx);
t('G. caps override still wins over the OT default', vm.runInContext("capFor(AUTO,'2026-07-29',true)",ctx)===500);

// ── source-consistency: EVERY OT-detection site must read stationOrig, none left bare ──
const otSites=[...src.matchAll(/jobs\.some\(([a-z])=>\1\.date===d&&\/\\\(OT\\\)\/\.test\([^)]*\)\)/g)].map(m=>m[0]);
t('H. exactly 3 OT-detection sites found', otSites.length===3);
t('I. all 3 sites read stationOrig', otSites.every(s=>/\.stationOrig\|\|/.test(s)));
t('J. NO OT site tests a bare (x|j).station', otSites.every(s=>!/test\([xj]\.station\)/.test(s)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
