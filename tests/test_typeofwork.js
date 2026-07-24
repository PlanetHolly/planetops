// typeOfWork must survive the record round-trip so isOut()/Arrivals routing works when
// the board renders from records. Extracts the REAL functions/consts from schedule/index.html.
const fs=require('fs'), vm=require('vm');
const src=fs.readFileSync(__dirname+'/../schedule/index.html','utf8');

function grabLine(startStr){ // a single-line `const NAME=...;`
  const i=src.indexOf(startStr); if(i<0)throw new Error('not found: '+startStr);
  return src.slice(i, src.indexOf('\n',i));
}
function grabFn(name){ // function NAME(...){...} by brace-matching
  const i=src.indexOf('function '+name+'('); if(i<0)throw new Error('fn not found: '+name);
  let j=src.indexOf('{',i), d=0;
  for(;j<src.length;j++){const c=src[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0){j++;break;}}}
  return src.slice(i,j);
}
const ctx={console};vm.createContext(ctx);
vm.runInContext('let store={},histCsv=null,liveCsv="x",intakeJobs=null,_recordsDirty=false,_recordDiag=null;',ctx);
[grabLine('const OUTSOURCED='),grabLine('const API_STEPS='),grabFn('_recMeaningfulEqual'),grabFn('ingestRecords'),grabFn('recordBase'),grabLine('const isOut=')].forEach(c=>vm.runInContext(c,ctx));

let pass=0,fail=0;
function t(n,c){c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+n);}
const run=js=>vm.runInContext(js,ctx);
const reset=()=>run('store={jobRecords:{}};_recordsDirty=false;liveCsv="x";histCsv=null;');

reset();
run(`ingestRecords([{imprint:'99001 - 1',invoice:'99001',qty:50,date:'',station:'',minutes:0,status:'👕 Paid / Terms - Blanks To Order 👕',typeOfWork:'Outsource',apiIntake:true}]);`);
t('A. intake job -> record.typeOfWork = "Outsource"', run(`store.jobRecords['99001 - 1'].typeOfWork`)==='Outsource');
const b=run(`recordBase().find(j=>j.imprint==='99001 - 1')`);
t('B. recordBase emits typeOfWork', b&&b.typeOfWork==='Outsource');
t('B. isOut true via typeOfWork despite non-outsourced status', run(`isOut(recordBase().find(j=>j.imprint==='99001 - 1'))`)===true);
run(`ingestRecords([{imprint:'99001 - 1',invoice:'99001',qty:50,date:'2026-07-25',station:'Auto Press (In Season)',minutes:80,status:'👕 Blanks Received 👕'}]);`);
t('C. CSV upsert (no typeOfWork) PRESERVES it', run(`store.jobRecords['99001 - 1'].typeOfWork`)==='Outsource');
t('C. still outsourced-classified after CSV upsert', run(`isOut(recordBase().find(j=>j.imprint==='99001 - 1'))`)===true);
reset();
run(`ingestRecords([{imprint:'99002 - 1',invoice:'99002',qty:10,date:'2026-07-24',station:'Auto Press (In Season)',minutes:40,status:'👕 Blanks Received 👕'}]);`);
t('D. CSV job, normal status, no typeOfWork -> isOut false', run(`isOut(recordBase().find(j=>j.imprint==='99002 - 1'))`)===false);
t('D. typeOfWork is "" not undefined', run(`store.jobRecords['99002 - 1'].typeOfWork`)==='');
run(`ingestRecords([{imprint:'99003 - 2',invoice:'99003',qty:10,date:'',station:'',minutes:0,status:'👕 Awaiting Goods (Outsourced - In Production)👕'}]);`);
t('E. outsourced STATUS still classifies via the status fallback', run(`isOut(recordBase().find(j=>j.imprint==='99003 - 2'))`)===true);
t('F. _recMeaningfulEqual tracks typeOfWork (change != equal)', run(`_recMeaningfulEqual({typeOfWork:'a'},{typeOfWork:'b'})`)===false);

/* ───────── G-J (2026-07-24): feedBase() copies Printavo's per-imprint Type of Work from the
   intake feed onto CSV rows. The CSV has no such column and wins at invoice level, so without
   this the Queue's vendor-leg gate would go blind on every CSV-known invoice. The copy is
   all-or-nothing per invoice: PS imprint ordinals can drift from the API's, so a partial key
   match must leave the whole invoice blank rather than mislabel a leg. ───────── */
vm.runInContext('var intakeAdded=0,intakeStale=0;var document={getElementById:()=>({textContent:""})};',ctx);
[grabFn('parseCSV'),grabFn('rowToJob'),grabFn('apiToJob'),grabFn('feedBase')].forEach(c=>vm.runInContext(c,ctx));
const CSV2=[
 '"Minutes","Quantity","Prod. Date","Station","Imprint","Post Production Type"',
 '"0","257","","","25414 - 1","N/A"',
 '"0","257","","","25414 - 2","N/A"',
 '"0","100","","","27260 - 1","N/A"',
 '"0","100","","","27260 - 2","N/A"',
 '"0","50","","","27900 - 1","N/A"',
 '"0","50","","","27900 - 4","N/A"'      // PS ordinal 4 vs the API's 2 — the drift case
].join('\n');
const INTAKE2=[
 {imprint:'25414 - 1',typeOfWork:'Outsource',qty:257},
 {imprint:'25414 - 2',typeOfWork:'In-House Production',qty:257},
 {imprint:'27260 - 1',typeOfWork:'Outsource',qty:100},
 {imprint:'27260 - 2',typeOfWork:'Outsource',qty:100},
 {imprint:'27900 - 1',typeOfWork:'Outsource',qty:50},
 {imprint:'27900 - 2',typeOfWork:'In-House Production',qty:50}
];
run('store={};histCsv=null;liveCsv='+JSON.stringify(CSV2)+';intakeJobs='+JSON.stringify(INTAKE2)+';');
const fb=run('feedBase()'), fbBy=k=>fb.find(j=>j.imprint===k);
t('G. CSV row 25414-1 picks up typeOfWork "Outsource" from intake', fbBy('25414 - 1').typeOfWork==='Outsource');
t('G. CSV row 25414-2 picks up "In-House Production"', fbBy('25414 - 2').typeOfWork==='In-House Production');
t('H. all-vendor invoice 27260 stamped on both rows', fbBy('27260 - 1').typeOfWork==='Outsource'&&fbBy('27260 - 2').typeOfWork==='Outsource');
t('I. ordinal drift (27900: CSV 1/4 vs API 1/2) leaves the WHOLE invoice unstamped, no guessing',
  !fbBy('27900 - 1').typeOfWork&&!fbBy('27900 - 4').typeOfWork);
run('store={csvText:'+JSON.stringify(CSV2)+'};');
const fbImp=run('feedBase()');
t('J. manual CSV import stays pure — no intake overlay at all', fbImp.find(j=>j.imprint==='25414 - 2').typeOfWork===undefined);

console.log('');console.log(pass+' passed, '+fail+' failed');process.exit(fail?1:0);
