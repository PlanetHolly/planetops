/* ============================================================================
   PA ESTIMATE — the ONE place production time formulas live.
   Loaded by BOTH the Estimator tab (/estimator/) and the Schedule (/schedule/).
   Change a number HERE, push, and every projected time everywhere recomputes.
   Extracted verbatim from Jean's Project Estimator so numbers match exactly.
   2026-07-03: EST_CONFIG values below are the BAKED FALLBACK. loadRates()
   pulls the live values from Jean's Project Calculator sheet (n8n
   /webhook/estimator-rates) and deep-merges them — the Sheet is the source
   of truth for the curve; this file only carries the formulas + defaults.
   ========================================================================== */
(function(g){
  // ---- EDIT FORMULAS HERE ---------------------------------------------------
  const EST_CONFIG = {
    rate:        { screen_print:140, heat_press:34, post_prod:26 }, // $/hr (cost only)
    palletAuto:  {'8':7,'10':8,'16':10,'22':12,'4':6},   // screen-print sec/unit by pallet size
    palletDefaultSec: 12,                                 // fallback if pallet unknown
    dry:         { plastisol:0, waterbase:6, discharge:6 }, // sec/unit DOUBLE-DRY — Jean's stopwatch 7/6: 100 units/10 min = 6 s/u; blanket rule: ALL waterbase + discharge double-dry (#8/#10)
    dryConcurrentMaxQty: 100,                             // ≤100 pcs: dry rides ALONG SIDE the next job on press — tracked but NOT schedule-blocking; >100: separate dryer block (end of day)
    heatPalletSec: 70,                                    // heat = 70 sec/unit regardless of pallet
    heatInk:     {'heat applied - apparel':10, 'heat applied - hat':25}, // sec/unit
    heatInkDefaultSec: 10,
    heatSetup:   10,                                      // heat press setup minutes
    finish:      {'fold':15,'bag':10,'barcode':5,'fold + bag':22,'packaging':5,'custom':60,
                  'fold + belly band':30,'fold + bag + barcode':27,'belly band':15,'hang tag':25,
                  '2-side sewn label':60,'4-side sewn label':120,'special fold & belly band':35,
                  'fold + belly band + barcode':32,'inside neck removal':5,'double drying':25,
                  'premium packaging service':25,'none':0,'n/a':0}, // post-prod sec/unit by finish
    productScaler: { Bandana:0.80, Apparel:1.35 },        // screen-print per-unit multiplier
    defStrokes:  2,
    // screen-print setup minutes: Standard = base + perColor*colors ; Specialty = specColor*colors
    setupStandardBase: 10, setupStandardPerColor: 12, setupSpecialtyPerColor: 25,
    // RECURVE v2 (2026-09-01) - print is fixed + variable, fitted on 169 measured jobs.
    // MUST stay identical to the n8n Estimator Engine or the page and the sheet disagree.
    recurve: 'v2',
    printCurve: { Bandana:{f:8.1,v:0.2828}, Apparel:{f:28.1,v:0.2218} },
    teardownBase: 5, teardownPerColor: 2,
    // MANUAL PRESS print curve (2026-09-04, Jean) - PROVISIONAL. Pooled min/piece from the first
    // timed manual runs (total minutes / total pieces, never per-job averages): Bandana 227 pcs /
    // 140 min (27519-1, 27557-1c); Apparel 278 pcs / 204 min (27769-1, 27769-27, 27766-1, 27762-1).
    // No fixed term yet (n=6, colors effect unproven). Setup + teardown ride the auto formulas
    // until manual setup is timed. Picked when the job's Station contains "Manual".
    manualCurve: { Bandana:{f:0,v:0.62}, Apparel:{f:0,v:0.73} },
    // What the floor has agreed is manual-press work (Jean 2026-09-04): 1-2 colors, plastisol or
    // waterbase, NO discharge (ink complexity) and NO 3+ colors (registration). Inside-neck prints
    // are always manual. A manual job outside these is still estimated, just flagged.
    manualRules: { maxColors:2, inks:['plastisol','waterbase'] },
  };
  // ---- END EDIT ZONE --------------------------------------------------------

  const C = EST_CONFIG;
  const num=v=>{const n=Number(String(v==null?'':v).replace(/,/g,''));return isNaN(n)?null:n;};
  const inkkey=s=>{s=String(s||'').toLowerCase();return s.includes('discharge')?'discharge':s.includes('waterbase')?'waterbase':s.includes('plastisol')?'plastisol':'other';};
  const palletKey=s=>String(s||'').replace(/[^0-9]/g,'');
  const normFinish=s=>String(s||'').replace(/\([^)]*\)/g,'').trim().toLowerCase();
  const r1=x=>Math.round(x*10)/10;
  const money=(t,rate)=>Math.round(t/60*rate*100)/100;

  function classify(product,inkRaw,postType){
    const pt=normFinish(postType);
    if(pt && pt!=='n/a' && pt!=='none' && pt!=='select finishing type' && pt!=='select project status') return 'post_prod';
    if(String(inkRaw||'').toLowerCase().includes('heat applied')) return 'heat_press';
    if((product==='Bandana'||product==='Apparel') && inkkey(inkRaw)!=='other') return 'screen_print';
    return 'incomplete';
  }

  // inp: {product, qty, ink, colors, pallet, postType, inkChange?, strokes?, presses?, setupType?, station?}
  //      station: the Printavo station text - anything containing "manual" switches print to the manual curve.
  function estimate(inp){
    const product=String(inp.product||'').trim();
    const qty=num(inp.qty);
    const inkRaw=String(inp.ink||'').trim();
    const wt=classify(product,inkRaw,inp.postType);
    const base={workType:wt, product, qty, ink:inkRaw, colors:num(inp.colors), pallet:String(inp.pallet||''),
                finishing:String(inp.postType||''), inkChange:String(inp.inkChange||''),
                jobName:String(inp.jobName||''), imprintId:String(inp.imprintId||'')};
    if(wt==='incomplete' || !qty) return Object.assign({status:'INCOMPLETE'},base);

    if(wt==='post_prod'){
      const sec=C.finish[normFinish(inp.postType)];
      if(sec===undefined) return Object.assign({status:'INCOMPLETE',reason:'Unknown finishing type'},base);
      const perUnit=sec/60, total=perUnit*qty;
      return Object.assign({status:'OK',rate:C.rate.post_prod,setup:0,process:r1(total),dry:0,total:r1(total),
        cost:money(total,C.rate.post_prod),unitsPerHr:perUnit?Math.round(60/perUnit):null,provisional:false,procLabel:'Finishing'},base);
    }
    if(wt==='heat_press'){
      const presses=num(inp.presses)||1;
      const palletMin=C.heatPalletSec/60;
      const inkMin=(C.heatInk[inkRaw.toLowerCase()]!==undefined?C.heatInk[inkRaw.toLowerCase()]:C.heatInkDefaultSec)/60;
      const perUnit=palletMin*presses+inkMin;
      const printMin=perUnit*qty, setup=C.heatSetup, total=printMin+setup;
      return Object.assign({status:'OK',rate:C.rate.heat_press,setup:r1(setup),process:r1(printMin),dry:0,total:r1(total),
        cost:money(total,C.rate.heat_press),unitsPerHr:perUnit?Math.round(60/perUnit):null,provisional:true,procLabel:'Heat apply'},base);
    }
    // screen_print
    const colors=num(inp.colors);
    if(!colors) return Object.assign({status:'INCOMPLETE',reason:'Missing colors'},base);
    const ink=inkkey(inkRaw);
    const setupType=inp.setupType?String(inp.setupType).trim():((ink==='waterbase'||ink==='discharge')?'Specialty':'Standard');
    const strokes=num(inp.strokes)||C.defStrokes;
    const setup=setupType==='Standard'?(C.setupStandardBase+C.setupStandardPerColor*colors):(C.setupSpecialtyPerColor*colors);
    const palletSec=C.palletAuto[palletKey(inp.pallet)]!==undefined?C.palletAuto[palletKey(inp.pallet)]:C.palletDefaultSec;
    const printPerUnit=(palletSec/60)*strokes*(C.productScaler[product]||C.productScaler.Apparel);
    const manual=/manual/i.test(String(inp.station||''));
    const PC=manual?(C.manualCurve[product]||C.manualCurve.Apparel):(C.printCurve[product]||C.printCurve.Bandana);
    const printMin=PC.f+PC.v*qty, dry=((C.dry[ink]||0)/60)*qty;
    // manual-press eligibility (rules above) - informational, never blocks the estimate
    let manualIssue='';
    if(manual){ if(colors>C.manualRules.maxColors)manualIssue=colors+' colors (max '+C.manualRules.maxColors+')';
      else if(C.manualRules.inks.indexOf(ink)<0)manualIssue=ink+' ink'; }
    // #8/#10 double-dry model (Jean 2026-07-06): small jobs (≤ dryConcurrentMaxQty) dry CONCURRENT
    // with the next job on press — tracked as data but excluded from the blocking total.
    // Large jobs dry in a separate block (like a post-prod service) — added to the total.
    const dryConcurrent=dry>0&&qty<=(C.dryConcurrentMaxQty||100);
    const teardown=C.teardownBase+C.teardownPerColor*colors;
    const total=setup+printMin+(dryConcurrent?0:dry)+teardown;
    return Object.assign({status:'OK',rate:C.rate.screen_print,setupType,strokes,scaler:(C.productScaler[product]||C.productScaler.Apparel),
      setup:r1(setup),process:r1(printMin),dry:r1(dry),dryConcurrent,teardown:r1(teardown),total:r1(total),
      recurve:C.recurve, press:manual?'manual':'auto', manualIssue,
      derivation:('setup '+(setupType==='Standard'?(C.setupStandardBase+'+'+C.setupStandardPerColor+'x'+colors):(C.setupSpecialtyPerColor+'x'+colors))+'='+r1(setup)
        +' | print '+(manual?'MANUAL (provisional) ':'')+PC.f+'+'+PC.v+'x'+qty+'='+r1(printMin)
        +' | dry '+(dryConcurrent?'concurrent':r1(dry))
        +' | teardown '+C.teardownBase+'+'+C.teardownPerColor+'x'+colors+'='+r1(teardown)
        +' | TOTAL '+r1(total)+' | recurve '+C.recurve),
      cost:money(total,C.rate.screen_print),
      unitsPerHr:printMin>0?Math.round(qty/(printMin/60)):null,provisional:manual,procLabel:'Print'},base);
  }

  /* ---- live rates: Jean's sheet is the source of truth for the curve ---- */
  const RATES_URL='https://primary-production-079f9.up.railway.app/webhook/estimator-rates';
  function mergeCfg(payload){
    if(!payload||typeof payload!=='object')return false;let hit=false;
    for(const k in payload){ if(!(k in EST_CONFIG))continue;
      const cur=EST_CONFIG[k], val=payload[k];
      if(typeof cur==='object'&&val&&typeof val==='object'){Object.assign(cur,val);hit=true;}
      else if(typeof cur==='number'&&typeof val==='number'&&isFinite(val)){EST_CONFIG[k]=val;hit=true;}
    }
    return hit;
  }
  async function loadRates(url){
    let src={mode:'baked',at:null};
    try{
      const r=await fetch(url||RATES_URL,{cache:'no-store'});
      if(r.ok){const d=await r.json();const cfg=d&&(d.config||d);
        if(mergeCfg(cfg)){src={mode:'live',at:d.updatedAt||null};
          try{localStorage.setItem('pa_est_rates',JSON.stringify({cfg,at:d.updatedAt||''}));}catch(e){}}}
    }catch(e){
      try{const c=JSON.parse(localStorage.getItem('pa_est_rates'));
        if(c&&mergeCfg(c.cfg))src={mode:'cache',at:c.at||null};}catch(_){}
    }
    g.PA_ESTIMATE.source=src;
    return src;
  }

  g.PA_ESTIMATE = { config:EST_CONFIG, classify, estimate, loadRates, source:{mode:'baked',at:null} };
})(typeof window!=='undefined'?window:this);
