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

function simulatorSource() {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const simStart = index.indexOf('const SIM_OVERLAY = ');
  const simEnd = index.indexOf('/* ─────────────────────────── AUTOMATIONS', simStart);
  assert.notStrictEqual(simStart, -1);
  assert.notStrictEqual(simEnd, -1);
  return index.slice(simStart, simEnd);
}

function nudgeExample(id) {
  return SIM_OVERLAY[id] && SIM_OVERLAY[id].nudge && SIM_OVERLAY[id].nudge.example;
}

function nudgeTypeLabel(id) {
  const row = SIM_OVERLAY[id];
  const key = String(row && row.nudge && row.nudge.chatKey || '').toUpperCase();
  if (key === 'DRAFT') return '📮 Draft nudge';
  if (key === 'STALE') return '🐌 Stale nudge';
  return 'PM nudge';
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
  const rows = ['390316', '548869', '548870', '548872'].map(id => SIM_OVERLAY[id]).filter(o => o.endGame);
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
      !/T1/.test(endGame.text) ||
      endGame.archiveScript !== '^ot_missed_opportunity' ||
      !endGame.missedOppScript ||
      endGame.missedOppScript.name !== 'Missed Opportunity email' ||
      endGame.missedOppScript.source !== 'CC script ^ot_missed_opportunity' ||
      endGame.missedOppScript.t1Only !== true;
  });
  assert.deepStrictEqual(bad.map(o => o.id), []);
});

ok('pre-quote end game archives with ready Missed Opportunity preview', () => {
  const ids = ['390316', '548869', '548870', '548872'];
  ids.forEach(id => {
    const endGame = SIM_OVERLAY[id].endGame;
    assert.strictEqual(endGame.archiveScript, '^ot_missed_opportunity');
    assert(endGame.archiveScriptPreview);
    assert.strictEqual(endGame.archiveScriptPreview.code, '^ot_missed_opportunity');
    assert(endGame.archiveScriptPreview.subject && endGame.archiveScriptPreview.subject.trim());
    assert(endGame.archiveScriptPreview.bodyText && endGame.archiveScriptPreview.bodyText.trim());
    assert.doesNotMatch(endGame.archiveScriptPreview.bodyText, /bandana/i);
    assert.doesNotMatch(endGame.archiveScriptPreview.bodyText, /quote/i);
  });
});

ok('reviewed quote end games do not use chase final', () => {
  const reviewed = ['390316', '390317', '433065', '433066', '433067', '427399', '427398', '548878', '548869', '548870', '548872', '548876', '548877', '548987'];
  const bad = reviewed.filter(id => JSON.stringify(SIM_OVERLAY[id].endGame || {}).includes('^ot_chase_final'));
  assert.deepStrictEqual(bad, []);
  assert.strictEqual(SIM_OVERLAY['390316'].endGame.archiveScript, '^ot_missed_opportunity');
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

ok('draft-chase nudge labels and connected text describe draft auto-advance lane', () => {
  const draftIds = ['428338', '548874', '548875', '548876'];
  draftIds.forEach(id => {
    const row = SIM_OVERLAY[id];
    assert.strictEqual(row.flavor, 'nudge');
    assert.strictEqual(nudgeTypeLabel(id), '📮 Draft nudge');
    assert.match(row.automation, /auto-advance/i);
    assert.match(row.automation, /\+1/);
    assert.match(row.automation, /never auto-send/i);
    assert.match(row.cadence, /\+1wd/i);
    assert.match(row.cadence, /Draft-mode/i);
  });
  assert.strictEqual(nudgeTypeLabel('548869'), '🐌 Stale nudge');

  const sim = simulatorSource();
  assert.match(sim, /function simNudgeTypeLabel/);
  assert.match(sim, /key==="DRAFT"\) return "📮 Draft nudge"/);
  assert.match(sim, /key==="STALE"\) return "🐌 Stale nudge"/);
  assert.match(sim, /function simFlavorChipLabel/);
  assert.doesNotMatch(sim, /fl\.ic\+'\s+'\+esc\(fl\.lab\)/);
});

ok('draft-chase end games advance until 3rd draft archive notice', () => {
  ['428338', '548874', '548875'].forEach(id => {
    const endGame = SIM_OVERLAY[id].endGame;
    assert.match(endGame.text, /Auto-advances to the next check-in draft/i);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(endGame, 'archiveScript'), false);
  });

  const endGame = SIM_OVERLAY['548876'].endGame;
  assert.match(endGame.text, /5 working days after the 3rd check-in draft/i);
  assert.match(endGame.text, /No auto-send/i);
  assert.strictEqual(endGame.archiveScript, '^ot_missed_opportunity');
  assert(endGame.archiveScriptPreview);
  assert.strictEqual(endGame.archiveScriptPreview.code, '^ot_missed_opportunity');
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
  assert.match(prep.endGame.text, /never archived/i);
  assert.match(prep.streakFactor, /matched by EMAIL/i);
  assert.match(prep.streakFactor, /sample pack" column/i);

  const sent = SIM_OVERLAY['548873'];
  assert.strictEqual(sent.flavor, 'nudge');
  assert.match(sent.automation, /PM NUDGE/i);
  assert.match(sent.streakFactor, /any customer reply stops/i);
  assert(sent.scriptCodes.includes('^ot_sample_shipped'));
  assert(sent.scriptCodes.includes('^ot_sample_arrival_checkin'));
  assert(sent.scriptCodes.includes('^ot_sample_arrival_checkin_plus2'));
  assert(sent.scriptCodes.includes('^ot_sample_arrival_checkin_plus5'));
  assert(sent.nudge);
});

ok('timed statuses expose clock-ready flag', () => {
  assert.strictEqual(SIM_OVERLAY['548873'].timed, false);
});

ok('review sessions 6, 8, and 9 simulator overrides are represented', () => {
  const revised = SIM_OVERLAY['548987'];
  assert.strictEqual(nudgeTypeLabel('548987'), '📮 Draft nudge');
  assert.strictEqual(revised.scriptPreviews['^ot_quote_revised'].code, '^ot_quote_revised');
  assert.match(revised.scriptPreviews['^ot_quote_revised'].subject, /revised quote is ready/i);

  const manual = SIM_OVERLAY['548877'];
  assert.match(manual.endGame.text, /30 days/i);
  assert.match(manual.endGame.text, /archive-notice email is DRAFTED/i);
  assert.match(manual.endGame.text, /never auto-archived/i);

  const updateNeeded = SIM_OVERLAY['427398'];
  assert.match(updateNeeded.automation, /ACTION REQUIRED/);
  assert.match(updateNeeded.automation, /move the status/i);
  assert.match(updateNeeded.endGame.text, /Revised/i);
  assert.doesNotMatch(updateNeeded.endGame.text, /Archived Quote \(427400\)|archive-notice email/i);

  const declinedLost = SIM_OVERLAY['548878'];
  assert.strictEqual(declinedLost.flavor, 'customer');
  assert.strictEqual(declinedLost.scriptPreviews['^ot_declined_lost'].code, '^ot_declined_lost');
  assert.match(declinedLost.automation, /no nudge/i);
  assert.match(declinedLost.endGame.text, /auto-send \^ot_declined_lost/i);
  assert.match(declinedLost.endGame.text, /Archived Quote \(427400\)/);
});

ok('auto-chase lane end games are hands-off auto-sent missed opportunity archive notices', () => {
  ['390317', '433065', '433066', '433067', '427399'].forEach(id => {
    const endGame = SIM_OVERLAY[id].endGame;
    assert(endGame);
    assert.match(endGame.text, /AUTO-SENT/);
    assert.match(endGame.text, /hands-off/i);
    assert.strictEqual(endGame.archiveScript, '^ot_missed_opportunity');
    assert.strictEqual(endGame.archiveSendMode, 'AUTO-SENT');
    assert.strictEqual(endGame.archiveScriptPreview.code, '^ot_missed_opportunity');
  });
});

ok('every Missed Opportunity end game text includes the T1 plus new-customer gate', () => {
  const bad = Object.values(SIM_OVERLAY).filter(row => {
    const endGame = row.endGame;
    if (!endGame || !endGame.missedOppScript) return false;
    return !/T1 AND new customers only/i.test(endGame.text || '') || !/return customers are handled by the retention pipeline/i.test(endGame.text || '');
  });
  assert.deepStrictEqual(bad.map(row => row.id), []);
});

ok('simulator render does not emit Command Center side-card markers', () => {
  const sim = simulatorSource();
  assert.doesNotMatch(sim, /renderEmailFrame\s*\(/);
  assert.doesNotMatch(sim, /sideMeta\s*\(/);
  assert.doesNotMatch(sim, /<h3>Fires when|<h3[^>]*>Cadence|<h3[^>]*>Sent by|<h3[^>]*>Appears in these journeys/i);
  assert.doesNotMatch(sim, /FIRES WHEN|CADENCE|SENT BY|APPEARS IN THESE JOURNEYS/);
});

ok('customer-email statuses render clean script previews with Copy and Edit controls', () => {
  const sim = simulatorSource();
  const quoteAuto = SIM_OVERLAY['390317'];
  assert.strictEqual(quoteAuto.flavor, 'customer');
  assert(quoteAuto.scriptCodes.includes('^ot_quote_sent'));
  assert.match(sim, /function simRenderCleanEmailPreview/);
  assert.match(sim, /simpvrow.*From/);
  assert.match(sim, /simpvrow.*To/);
  assert.match(sim, /simpvsubj/);
  assert.match(sim, /copyText\(s\.bodyText\|\|""/);
  assert.match(sim, /Edit in Sheet →/);
  assert.match(sim, /Copy uses the canonical send copy \(bodyText\)\. Edit opens the exact Sheet row — Holly-only\./);
});

ok('script previews expose signature labels from approve-pay button rule', () => {
  const sim = simulatorSource();
  assert.match(sim, /function simScriptUsesApprovePayButton/);
  assert.match(sim, /function simSignatureLabel/);
  assert.match(sim, /simpvsignature/);
  assert.match(sim, /Signature: /);
  assert.match(sim, /Emails with an approve\/pay button use the Simple signature/);
  assert.match(sim, /Cross Sell lookbook signature/);

  function expectedSignature(preview) {
    const code = String(preview.code || '');
    const body = String(preview.bodyText || '');
    return /\[QUOTE LINK\]/i.test(body) || /(?:quote_(?:sent|revised)|chase|approval|approve|pay|terms)/i.test(code)
      ? 'Simple'
      : 'Cross Sell';
  }

  const previews = [];
  Object.values(SIM_OVERLAY).forEach(row => {
    Object.values(row.scriptPreviews || {}).forEach(preview => previews.push(preview));
    if (row.endGame && row.endGame.archiveScriptPreview) previews.push(row.endGame.archiveScriptPreview);
  });
  assert(previews.length > 0);
  previews.forEach(preview => assert(expectedSignature(preview)));

  const missed = previews.filter(preview => preview.code === '^ot_missed_opportunity');
  assert(missed.length > 0);
  missed.forEach(preview => assert.strictEqual(expectedSignature(preview), 'Cross Sell'));
  assert.strictEqual(expectedSignature(SIM_OVERLAY['548878'].scriptPreviews['^ot_declined_lost']), 'Cross Sell');
  assert.strictEqual(expectedSignature(SIM_OVERLAY['427398'].scriptPreviews['^ot_quote_revised']), 'Simple');
  assert.strictEqual(expectedSignature(SIM_OVERLAY['548987'].scriptPreviews['^ot_quote_revised']), 'Simple');
});

ok('auto-send connected text names one auto lane and avoids mechanism cards', () => {
  const row = SIM_OVERLAY['390317'];
  assert.match(row.automation, /auto-chase \(auto-send\) lane/i);
  assert.match(row.automation, /A PM can move an order into an auto status at any point mid-sequence/i);
  const sim = simulatorSource();
  assert.match(sim, /auto-chase \(auto-send\) lane/);
  assert.match(sim, /switch it from drafting to auto-send/);
  assert.doesNotMatch(sim, /autoChip\s*\(/);
  assert.doesNotMatch(sim, /TOUCHPOINTS col J|autoLevel/);
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
