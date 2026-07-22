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

console.log('');console.log(pass+' passed, '+fail+' failed');process.exit(fail?1:0);
