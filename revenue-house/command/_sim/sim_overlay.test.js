const assert = require('assert');
const path = require('path');
const board = require('/Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/Status_Cleanup_2026-07/live_statuses_FINAL_2026-07-27.json');
const { SIM_OVERLAY } = require('./sim_overlay.gen.js');
const { resolveNudge } = require('/Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/OneThread_Build/nudge/resolver.js');
const workflow = require('/Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/OneThread_Build/composer_workflow.json');
function cfg(){ const out={}; const node=workflow.nodes.find(n=>n.name==='Config'); for (const a of node.parameters.assignments.assignments) out[a.name]=a.value; return out; }
const config = cfg();
const validFlavors = new Set(['customer','nudge','silent','internal','start']);
let pass=0, total=6;
function ok(name, fn){ try { fn(); pass++; console.log('PASS '+pass+'/'+total+' '+name); } catch(e){ console.error('FAIL '+name); throw e; } }
ok('coverage of all 71 ids', () => {
  const missing = board.filter(s => !SIM_OVERLAY[String(s.id)] || !SIM_OVERLAY[String(s.id)].description || !validFlavors.has(SIM_OVERLAY[String(s.id)].flavor));
  assert.deepStrictEqual(missing.map(s => s.id+' '+s.name), []);
});
ok('no orphan overlay ids', () => {
  const ids = new Set(board.map(s => String(s.id)));
  const orphans = Object.keys(SIM_OVERLAY).filter(id => !ids.has(id));
  assert.deepStrictEqual(orphans, []);
});
ok('nudge completeness', () => {
  const bad = Object.values(SIM_OVERLAY).filter(o => o.flavor === 'nudge').filter(o => !o.nudge || !o.nudge.chatName || !o.nudge.ruleText || !o.nudge.example || !o.nudge.example.why || !o.nudge.example.suggestion || !Array.isArray(o.nudge.example.buttons) || o.nudge.example.buttons.length < 1);
  assert.deepStrictEqual(bad.map(o => o.id), []);
});
ok('customer completeness', () => {
  const bad = Object.values(SIM_OVERLAY).filter(o => o.flavor === 'customer').filter(o => !Array.isArray(o.scriptCodes) || o.scriptCodes.length < 1);
  assert.deepStrictEqual(bad.map(o => o.id), []);
});
ok('cadence correctness', () => {
  assert.match(SIM_OVERLAY['548869'].nudge.ruleText, /3 business days/);
  assert.match(SIM_OVERLAY['548879'].nudge.ruleText, /5 business days/);
  assert.match(SIM_OVERLAY['548872'].nudge.ruleText, /7 business days/);
  assert.match(SIM_OVERLAY['548872'].nudge.ruleText, /repeats every 7 business days/);
  assert.notStrictEqual(SIM_OVERLAY['548871'].flavor, 'nudge');
  assert.strictEqual(SIM_OVERLAY['548871'].nudge, undefined);
});
ok('example fidelity vs resolveNudge', () => {
  const sampleOrder={id:'27612', invoiceId:'27612', visualId:'27612', name:'Summit Trading Co', projectName:'Summit Trading Co', nickname:'Summit Trading Co', total:2500, tags:['#bandana'], customerName:'Summit Trading Co', contact:{firstName:'Summit', fullName:'Summit Trading Co', phone:'8585692090'}, owner:{email:'bandanas@planetapparel.com', name:'Shara'}, ownerEmail:'bandanas@planetapparel.com'};
  const live = resolveNudge({ trigger:'IN_CONVERSATION_STALLED', order:sampleOrder, tier:'T1', cfg:config });
  const baked = SIM_OVERLAY['548869'].nudge.example;
  assert.strictEqual(baked.tierBadge, live.tierBadge);
  assert.strictEqual(baked.why, live.why);
  assert.strictEqual(baked.suggestion, live.suggestion);
  assert.deepStrictEqual(baked.buttons, live.buttons.map(b => ({ label:b.label || '', kind:b.kind || 'link' })));
});
console.log('PASS '+pass+'/'+total);
