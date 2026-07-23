// Due dates must track the LIVE intake feed, not the stale CSV snapshot — while the CSV still
// wins on Prod. Date/station/minutes. Extracts the REAL functions from schedule/index.html.
const fs=require('fs'), vm=require('vm');
const src=fs.readFileSync(__dirname+'/../schedule/index.html','utf8');
function grabFn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('fn '+name);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){const c=src[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0){j++;break;}}}return src.slice(i,j);}
function grabLine(s){const i=src.indexOf(s);if(i<0)throw new Error('line '+s);return src.slice(i,src.indexOf('\n',i));}
const ctx={console};vm.createContext(ctx);
vm.runInContext('let histCsv=null,store={},liveCsv="",intakeJobs=null,intakeAdded=0,intakeStale=0;const document={getElementById:()=>({textContent:""})};',ctx);
[grabLine('const API_STEPS='),grabFn('parseCSV'),grabFn('rowToJob'),grabFn('apiToJob'),grabFn('feedBase')].forEach(c=>vm.runInContext(c,ctx));
const setG=(name,val)=>vm.runInContext(name+'='+JSON.stringify(val)+';',ctx);
const run=js=>vm.runInContext(js,ctx);

const CSV=[
 '"Minutes","Quantity","Prod. Date","Station","Imprint","Prod. Due","Cust. Due"',
 '"50","100","","Auto Press (In Season)","27486 - 1","2026-07-29","2026-07-31"',
 '"60","200","2026-07-25","Auto Press (In Season)","27500 - 1","2026-07-20","2026-07-22"',
 '"40","150","2026-07-24","Auto Press (In Season)","27073 - 1a","2026-06-01","2026-06-02"',
 '"40","150","2026-07-24","Auto Press (In Season)","27073 - 1b","2026-06-01","2026-06-02"',
 '"30","80","2026-07-26","Auto Press (In Season)","27700 - 1","2026-07-28","2026-07-30"'
].join('\n');
const INTAKE=[
 {imprint:'27486 - 1',prodDue:'2026-08-04',custDue:'2026-08-05',qty:100},
 {imprint:'27073 - 1',prodDue:'2026-08-10',custDue:'2026-08-11',qty:150},
 {imprint:'27600 - 1',prodDue:'2026-08-01',custDue:'2026-08-02',qty:50},
 {imprint:'27700 - 1',prodDue:'',custDue:'2026-08-15',qty:80}
];
setG('histCsv',null);setG('store',{});setG('liveCsv',CSV);setG('intakeJobs',INTAKE);
let base=run('feedBase()');
const by=k=>base.find(j=>j.imprint===k);
let pass=0,fail=0;const t=(n,c)=>{c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+n);};

const a=by('27486 - 1');
t('27486 due dates = LIVE intake (8/04, 8/05)', a&&a.prodDue==='2026-08-04'&&a.custDue==='2026-08-05');
t('27486 keeps CSV Prod.Date/station/minutes (blank date, Auto Press, 50)', a&&a.date===''&&a.station==='Auto Press (In Season)'&&a.minutes===50);
const b=by('27500 - 1');
t('27500 (not in intake) keeps CSV dues (7/20, 7/22)', b&&b.prodDue==='2026-07-20'&&b.custDue==='2026-07-22');
const s1=by('27073 - 1a'), s2=by('27073 - 1b');
t('split 27073-1a inherits invoice live dues (8/10, 8/11)', s1&&s1.prodDue==='2026-08-10'&&s1.custDue==='2026-08-11');
t('split 27073-1b inherits invoice live dues', s2&&s2.prodDue==='2026-08-10'&&s2.custDue==='2026-08-11');
t('split keeps its own CSV Prod.Date (7/24)', s1&&s1.date==='2026-07-24');
const g=by('27700 - 1');
t('27700 empty intake prodDue -> CSV prodDue kept (7/28)', g&&g.prodDue==='2026-07-28');
t('27700 custDue overlaid from intake (8/15)', g&&g.custDue==='2026-08-15');
const iOnly=by('27600 - 1');
t('27600 intake-only job still added with its dues', iOnly&&iOnly.prodDue==='2026-08-01'&&iOnly.custDue==='2026-08-02');

setG('histCsv',CSV);setG('liveCsv','');
base=run('feedBase()');
const h=by('27486 - 1');
t('HISTORY mode: no overlay, 27486 keeps CSV dues (7/29, 7/31)', h&&h.prodDue==='2026-07-29'&&h.custDue==='2026-07-31');

console.log('');console.log(pass+' passed, '+fail+' failed');process.exit(fail?1:0);
