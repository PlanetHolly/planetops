const assert = require('assert');
const fs = require('fs');
const path = require('path');
const board = require('/Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/Status_Cleanup_2026-07/live_statuses_FINAL_2026-07-27.json');
const { SIM_OVERLAY } = require('./sim_overlay.gen.js');

const validFlavors = new Set(['customer', 'nudge', 'silent', 'internal', 'start']);
let pass = 0;
const tests = [];

function ok(name, fn) {
  tests.push([name, fn]);
}

function overlayText() {
  return JSON.stringify(SIM_OVERLAY);
}

function nudgeExample(id) {
  return SIM_OVERLAY[id] && SIM_OVERLAY[id].nudge && SIM_OVERLAY[id].nudge.example;
}

ok('coverage of all live status ids still holds', () => {
  const missing = board.filter(s => {
    const row = SIM_OVERLAY[String(s.id)];
    return !row || !row.description || !validFlavors.has(row.flavor);
  });
  assert.deepStrictEqual(missing.map(s => s.id + ' ' + s.name), []);
});

ok('no orphan overlay ids', () => {
  const ids = new Set(board.map(s => String(s.id)));
  const orphans = Object.keys(SIM_OVERLAY).filter(id => !ids.has(id));
  assert.deepStrictEqual(orphans, []);
});

ok('stall statuses have Streak factor and end game', () => {
  const stallIds = ['548869', '548870', '548872', '548873'];
  const bad = stallIds.filter(id => !SIM_OVERLAY[id].streakFactor || !SIM_OVERLAY[id].endGame);
  assert.deepStrictEqual(bad, []);
});

ok('end game contract names archive and Missed Opportunity flow', () => {
  const rows = Object.values(SIM_OVERLAY).filter(o => o.endGame);
  assert(rows.length > 0);
  const bad = rows.filter(row => {
    const endGame = row.endGame;
    return !endGame ||
      typeof endGame !== 'object' ||
      typeof endGame.text !== 'string' ||
      !endGame.text.trim() ||
      /cross-sell/i.test(endGame.text) ||
      /auto-archives?/i.test(endGame.text) ||
      !/(DRAFT|drafted)/i.test(endGame.text) ||
      !/Draft chat/.test(endGame.text) ||
      !/Archived Quote \(427400\)/.test(endGame.text) ||
      !/Close Date/.test(endGame.text) ||
      !/Close Date is NOT stamped here/i.test(endGame.text) ||
      !/stamped by a trigger on the Archived Quote \(427400\) status/i.test(endGame.text) ||
      !/T1/.test(endGame.text) ||
      endGame.archiveScript !== '^ot_chase_final' ||
      !endGame.missedOppScript ||
      endGame.missedOppScript.name !== 'Missed Opportunity email' ||
      endGame.missedOppScript.source !== 'Printavo template' ||
      endGame.missedOppScript.t1Only !== true;
  });
  assert.deepStrictEqual(bad.map(o => o.id), []);
});

ok('archive-notice script is rendered as a Draft chat draft, not an auto-send', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /DRAFT to .*Draft chat/);
  assert.doesNotMatch(index, /archive-notice email is sent/i);
});

ok('Waiting on Customer is recurring 7-day nudge only', () => {
  const row = SIM_OVERLAY['548870'];
  assert.strictEqual(row.flavor, 'nudge');
  assert.match(row.nudge.ruleText, /7/);
  assert.doesNotMatch(row.nudge.ruleText, /bump/i);
  assert.doesNotMatch(row.nudge.ruleText, /3\s*\/\s*5\s*\/\s*7/i);
  assert.doesNotMatch(row.automation, /bump/i);
  assert.doesNotMatch(row.automation, /3\s*\/\s*5\s*\/\s*7/i);
});

ok('Follow-Up Pre-Quote nudge is 14 days', () => {
  assert.match(SIM_OVERLAY['548872'].nudge.ruleText, /14/);
});

ok('In Conversation says before an official quote', () => {
  assert.match(SIM_OVERLAY['548869'].description, /before an official quote/i);
});

ok('nudge examples have no suggestion and no Snooze, include Done, and include contact name', () => {
  const bad = Object.values(SIM_OVERLAY).filter(o => o.nudge).filter(o => {
    const ex = o.nudge.example || {};
    const labels = (ex.buttons || []).map(b => b.label);
    return Object.prototype.hasOwnProperty.call(ex, 'suggestion') ||
      labels.some(label => /snooze/i.test(label || '')) ||
      !labels.includes('Done') ||
      !labels.includes('Open in Streak') ||
      !ex.customerName ||
      !ex.contactName ||
      !ex.statusName ||
      !ex.why ||
      !ex.totalDays;
  });
  assert.deepStrictEqual(bad.map(o => o.id), []);
});

ok('nudge example card renders contact name with literal no contact fallback', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /const contactName=ex\.contactName\|\|"no contact"/);
  assert.match(index, /<span class="k">Customer<\/span><span>'\+esc\(contactName\)/);
  assert.strictEqual(nudgeExample('548870').contactName, 'Jessica Ramos');
});

ok('word bump appears nowhere in overlay or simulator render text', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const simStart = index.indexOf('const SIM_OVERLAY = ');
  const simEnd = index.indexOf('/* ─────────────────────────── AUTOMATIONS', simStart);
  assert.notStrictEqual(simStart, -1);
  assert.notStrictEqual(simEnd, -1);
  assert.doesNotMatch(overlayText(), /bump/i);
  assert.doesNotMatch(index.slice(simStart, simEnd), /bump/i);
});

ok('sample-pack statuses match approved display contract', () => {
  const prep = SIM_OVERLAY['548006'];
  assert.match(prep.nudge.ruleText, /2 days/);
  assert.strictEqual(prep.endGame, '');
  assert.match(prep.automation, /Streak box and thread/i);

  const sent = SIM_OVERLAY['548873'];
  assert.strictEqual(sent.timed, true);
  assert(sent.scriptCodes.includes('^ot_sample_shipped'));
  assert(sent.scriptCodes.includes('^ot_sample_arrival_checkin'));
  assert(sent.scriptCodes.includes('^ot_sample_arrival_checkin_plus2'));
  assert(sent.scriptCodes.includes('^ot_sample_arrival_checkin_plus5'));
  assert(sent.nudge);
});

ok('timed statuses expose clock-ready flag', () => {
  assert.strictEqual(SIM_OVERLAY['548873'].timed, true);
});

for (const [name, fn] of tests) {
  try {
    fn();
    pass++;
    console.log('PASS ' + pass + '/' + tests.length + ' ' + name);
  } catch (e) {
    console.error('FAIL ' + name);
    throw e;
  }
}

console.log('PASS ' + pass + '/' + tests.length);
