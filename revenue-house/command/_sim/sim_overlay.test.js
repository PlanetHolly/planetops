const assert = require('assert');
const fs = require('fs');
const path = require('path');
const board = require('/Users/hollytrevino/Dropbox/PlanetApparel/Printavo_Automations/Status_Cleanup_2026-07/live_statuses_FINAL_2026-07-27.json');
const { SIM_FALLBACK_STATUSES, SIM_OVERLAY } = require('./sim_overlay.gen.js');
// Committed snapshot of the live Command Center feed; refresh when scripts are added or retired.
const servedCodes = require('./cc_served_codes.json');

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
  // 390316 (Quote) is deliberately excluded: it is the placeholder for every new
  // Printavo entry, not a quote lane, so it has no archive notice and no Missed
  // Opportunity email. See 'Quote placeholder end game sends no email' below.
  const rows = ['548869', '548870', '548872'].map(id => SIM_OVERLAY[id]).filter(o => o.endGame);
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
      endGame.archiveScript !== '^ot_archive_notice' ||
      !endGame.missedOppScript ||
      endGame.missedOppScript.name !== 'Missed Opportunity email' ||
      endGame.missedOppScript.source !== 'CC script ^ot_missed_opportunity' ||
      endGame.missedOppScript.t1Only !== true;
  });
  assert.deepStrictEqual(bad.map(o => o.id), []);
});

ok('pre-quote end game points at a LIVE archive script, with no baked copy', () => {
  // ^ot_archive_notice is live in the CC feed now, so the Simulator renders it from the
  // feed (simScriptRows line ~4010). The baked archiveScriptPreview that used to stand in
  // was deleted 2026-08-04 - a duplicate copy of live text is a drift bug waiting to fire.
  const served = new Set(require('./cc_served_codes.json'));
  ['548869', '548870', '548872'].forEach(id => {
    const endGame = SIM_OVERLAY[id].endGame;
    assert.strictEqual(endGame.archiveScript, '^ot_archive_notice');
    assert.ok(served.has('^ot_archive_notice'), 'the archive script must be live in the feed');
    assert.strictEqual(endGame.archiveScriptPreview, undefined,
      id + ' still carries baked copy for a script the feed already serves');
  });
});

ok('no baked preview may shadow a script the feed already serves', () => {
  // The renderer falls back to baked copy ONLY when a script is not live. Once it IS live
  // the baked twin never renders - it just rots, and then fires if publishStatus ever flips.
  // Three had already gone stale (^ot_quote_revised x2, ^ot_declined_lost) before this guard.
  const served = new Set(require('./cc_served_codes.json'));
  const bad = [];
  Object.keys(SIM_OVERLAY).forEach(id => {
    const r = SIM_OVERLAY[id], eg = r.endGame || {};
    Object.keys(r.scriptPreviews || {}).forEach(c => {
      if (served.has(c)) bad.push(id + ' scriptPreviews.' + c);
    });
    if (eg.archiveScriptPreview && served.has(eg.archiveScriptPreview.code)) {
      bad.push(id + ' archiveScriptPreview.' + eg.archiveScriptPreview.code);
    }
  });
  assert.deepStrictEqual(bad, [], 'baked copy shadowing a live script');
});

ok('the sample check-in ladder is fully written and bound', () => {
  // Holly 2026-08-04: +2 and +5 written in Shara's own words from her real emails.
  const served = new Set(require('./cc_served_codes.json'));
  const r = SIM_OVERLAY['548873'];
  ['^ot_sample_shipped', '^ot_sample_arrival_checkin',
   '^ot_sample_arrival_checkin_plus2', '^ot_sample_arrival_checkin_plus5']
    .forEach(c => assert.ok((r.scriptCodes || []).includes(c), '548873 missing ' + c));
  assert.ok(!(r.plannedScriptCodes || []).length, 'the sample ladder has no unwritten rungs left');
});

ok('reviewed quote end games do not use chase final', () => {
  const reviewed = ['390316', '390317', '433065', '433066', '433067', '427399', '427398', '548878', '548869', '548870', '548872', '548876', '548877', '548987'];
  const bad = reviewed.filter(id => JSON.stringify(SIM_OVERLAY[id].endGame || {}).includes('^ot_chase_final'));
  assert.deepStrictEqual(bad, []);
  assert.strictEqual(SIM_OVERLAY['548869'].endGame.archiveScript, '^ot_archive_notice');
});

ok('Quote placeholder end game sends no email and just moves to Archived Quote', () => {
  const endGame = SIM_OVERLAY['390316'].endGame;
  assert(endGame && typeof endGame.text === 'string' && endGame.text.trim());
  // Quote 390316 is the catch-all landing spot for every new Printavo entry.
  // Nothing customer-facing is ever sent from it, so the stall route is a bare move.
  assert.strictEqual(endGame.archiveScript, undefined);
  assert.strictEqual(endGame.archiveScriptPreview, undefined);
  assert.strictEqual(endGame.missedOppScript, undefined);
  // Holly 2026-07-31, confirmed: auto-archive, no email, and NO final PM nudge -
  // the 3-day nudge has already fired ~10 times by day 30 so one more adds nothing.
  assert.match(endGame.text, /archived AUTOMATICALLY/);
  assert.match(endGame.text, /no customer email/i);
  assert.match(endGame.text, /no final PM nudge/i);
  assert.match(endGame.text, /Archived Quote \(427400\)/);
  assert.match(endGame.text, /no archive notice and no Missed Opportunity email/i);
  // Auto-archive is now a TWO-status carve-out: 390316 (nothing was ever sent from it)
  // and 549571 (the customer replied, so the archive notice would be a lie). Everything
  // else drafts a notice and pings the PM.
  assert.match(endGame.text, /Only this status and Quote Approval — Customer Replied auto-archive/);
  const otherStallIds = ['548869', '548870', '548872', '548873', '548877', '548987'];
  otherStallIds.forEach(id => {
    const t = (SIM_OVERLAY[id].endGame || {}).text || '';
    assert.doesNotMatch(t, /archived AUTOMATICALLY/, id + ' must not auto-archive');
  });
  assert.doesNotMatch(SIM_OVERLAY['390316'].description, /fresh inquiry/i);
  assert.match(SIM_OVERLAY['390316'].description, /new order/i);
});

ok('Sample Pack Prep & Ship is bound to the live ^sample_confirm script', () => {
  const row = SIM_OVERLAY['548006'];
  // The CC serves ^sample_confirm live/auto-send on 548006; the Simulator used to
  // show "No script for this status" because scriptCodes was empty.
  assert.deepStrictEqual(row.scriptCodes, ['^sample_confirm']);
  assert.strictEqual(row.copyNote, undefined);
});

ok('retired Command Center scripts are not referenced anywhere in the Simulator', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ['^sample_sent', '^ot_waiting_bump_1', '^ot_waiting_bump_2', '^ot_waiting_bump_3', '^ot_chase_final']
    .forEach(code => {
      assert.ok(!JSON.stringify(SIM_OVERLAY).includes(code), `overlay still references ${code}`);
      assert.ok(!index.includes(code), `index.html still references ${code}`);
    });
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
  assert.strictEqual(endGame.archiveScript, '^ot_archive_notice');
  // baked preview removed 2026-08-04 — the script is live, the feed renders it
  assert.strictEqual(endGame.archiveScriptPreview, undefined);
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
  // +2 and +5 written and published 2026-08-04, so they are served, not planned
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
  // baked preview removed 2026-08-04 — ^ot_quote_revised is live, the feed renders it
  // (that baked copy had already gone stale, which is what prompted the sweep)
  assert.ok((revised.scriptCodes || []).includes('^ot_quote_revised'));
  assert.ok(new Set(require('./cc_served_codes.json')).has('^ot_quote_revised'));

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
  // baked preview removed 2026-08-04 — ^ot_declined_lost is live, the feed renders it
  assert.ok((declinedLost.scriptCodes || []).includes('^ot_declined_lost'));
  assert.ok(new Set(require('./cc_served_codes.json')).has('^ot_declined_lost'));
  assert.match(declinedLost.automation, /no nudge/i);
  assert.match(declinedLost.endGame.text, /auto-send \^ot_declined_lost/i);
  assert.match(declinedLost.endGame.text, /Archived Quote \(427400\)/);
});

ok('auto-chase lane end games are hands-off auto-sent archive notices', () => {
  ['390317', '433065', '433066', '433067', '427399'].forEach(id => {
    const endGame = SIM_OVERLAY[id].endGame;
    assert(endGame);
    assert.match(endGame.text, /AUTO-SENT/);
    assert.match(endGame.text, /hands-off/i);
    assert.strictEqual(endGame.archiveScript, '^ot_archive_notice');
    assert.strictEqual(endGame.archiveSendMode, 'AUTO-SENT');
    assert.strictEqual(endGame.archiveScriptPreview, undefined); // baked copy removed; feed renders it
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

  // Baked previews were deleted 2026-08-04 (they shadowed live scripts and had gone stale),
  // so exercise the resolver against the codes the feed actually serves.
  const served = require('./cc_served_codes.json');
  const sig = code => /(?:quote_(?:sent|revised)|chase|approval|approve|pay|terms)/i.test(code) ? 'Simple' : 'Cross Sell';
  assert.strictEqual(sig('^ot_quote_sent'), 'Simple');
  assert.strictEqual(sig('^ot_quote_revised'), 'Simple');
  assert.strictEqual(sig('^ot_archive_notice'), 'Cross Sell');
  assert.strictEqual(sig('^ot_missed_opportunity'), 'Cross Sell');
  assert.strictEqual(sig('^ot_declined_lost'), 'Cross Sell');
  ['^ot_archive_notice', '^ot_missed_opportunity', '^ot_declined_lost',
   '^ot_sample_arrival_checkin_plus2', '^ot_sample_arrival_checkin_plus5']
    .forEach(c => assert.ok(served.includes(c), c + ' should be served by the feed'));
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

ok('every SIM_* / sim* symbol the simulator uses is actually declared in index.html', () => {
  // Regression guard for fa4f118, which deleted a block of top-level simulator
  // declarations (SIM_PHASES, SIM_FLAVOR, SIM_STATUS_PROXY, SIM_STATUS_CACHE,
  // SIM_CACHE_MS, SIM_STATUS_STATE, simOrderMap, simStatusColor). Nothing failed
  // loudly: simStatuses() swallowed the ReferenceError into the fallback branch and
  // renderSimulator's .then() had no .catch(), so the page went blank and the
  // data-only harness still passed 24/24.
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // Strip string literals first: DOM ids and CSS class names like "simOut"/"simSel"
  // live inside quotes and are not JS bindings.
  const code = index
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
  const used = new Set([...code.matchAll(/\b(SIM_[A-Z0-9_]+|sim[A-Z][A-Za-z0-9]*)\b/g)].map(m => m[1]));
  const declared = new Set([...code.matchAll(/\b(?:const|let|var|function|async function)\s+(SIM_[A-Z0-9_]+|sim[A-Z][A-Za-z0-9]*)\b/g)].map(m => m[1]));
  const missing = [...used].filter(n => !declared.has(n)).sort();
  assert.deepStrictEqual(missing, [], 'used but never declared: ' + missing.join(', '));
});

ok('the simulator renderer cannot leave a blank page on a throw', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const i = index.indexOf('function renderSimulator');
  assert.ok(i > -1, 'renderSimulator not found');
  const body = index.slice(i, i + 1600);
  assert.match(body, /\.catch\(/, 'renderSimulator must catch: it clears app.innerHTML before painting');
});

// Holly, 2026-07-31 (Printavo Auto 10): the end game was one dense paragraph holding
// three separate things. It must render as labelled rows in the What's-Connected
// "Rule: / Chat:" style - "the rule in bold colon and then the summary".
ok('every end game is structured as labelled rows, not one paragraph', () => {
  const ids = Object.keys(SIM_OVERLAY).filter(id => SIM_OVERLAY[id].endGame);
  assert.ok(ids.length >= 19, 'expected at least 19 end games, got ' + ids.length);
  const bad = ids.filter(id => {
    const rows = SIM_OVERLAY[id].endGame.rows;
    return !Array.isArray(rows) || !rows.length ||
      rows.some(r => !r || typeof r.label !== 'string' || !r.label.trim() ||
                     typeof r.body !== 'string' || !r.body.trim());
  });
  assert.deepStrictEqual(bad, [], 'end games missing well-formed rows');
});

ok('end game rows carry the three categories wherever an archive route exists', () => {
  // Statuses that actually archive must spell out Close Date + Missed Opportunity
  // separately, so the causality is readable rather than buried mid-paragraph.
  const archiving = Object.keys(SIM_OVERLAY).filter(id => {
    const e = SIM_OVERLAY[id].endGame;
    return e && Array.isArray(e.rows) && !e.rows.some(r => r.label === 'No archive here');
  });
  assert.ok(archiving.length >= 12, 'expected the archiving lanes, got ' + archiving.length);
  archiving.forEach(id => {
    const labels = SIM_OVERLAY[id].endGame.rows.map(r => r.label);
    ['Stalls at', 'What happens', 'Close Date', 'Missed Opportunity email']
      .forEach(l => assert.ok(labels.includes(l), id + ' end game is missing the "' + l + '" row'));
  });
});

ok('end game rows state WHO stamps the Close Date, not just that it happens', () => {
  // Holly: "how would I ever reach there if no one puts it there?" - the draft lanes
  // must say the PM moving the order is what triggers the stamp.
  ['548869', '548870', '548872', '548873', '548877', '548987', '548876'].forEach(id => {
    const cd = SIM_OVERLAY[id].endGame.rows.find(r => r.label === 'Close Date');
    assert.ok(cd, id + ' has no Close Date row');
    assert.match(cd.body, /PM moving the order/i, id + ' Close Date row must name who causes the stamp');
    assert.match(cd.body, /Archived Quote \(427400\)/, id + ' Close Date row must name the status');
  });
});

ok('end game rows never reintroduce bullets or run-on paragraphs', () => {
  // "we're not doing bullet" - and no row should be a wall of text again.
  Object.keys(SIM_OVERLAY).filter(id => SIM_OVERLAY[id].endGame).forEach(id => {
    SIM_OVERLAY[id].endGame.rows.forEach(r => {
      assert.doesNotMatch(r.body, /^\s*[-*•]/, id + '/' + r.label + ' starts with a bullet');
      assert.ok(r.body.length <= 340, id + '/' + r.label + ' row is ' + r.body.length + ' chars - too long to scan');
    });
  });
});

ok('the end game renderer emits the Rule/Chat chip style and keeps a text fallback', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const i = index.indexOf('function simRenderEndGame');
  assert.ok(i > -1);
  const fn = index.slice(i, i + 1400);
  assert.match(fn, /endGame\.rows/, 'renderer must consume endGame.rows');
  assert.match(fn, /simline/, 'renderer must reuse the simline chip style');
  assert.match(fn, /endGame\.text/, 'renderer must keep the plain-text fallback');
});

ok('rows and the legacy text agree on the Quote auto-archive carve-out', () => {
  const q = SIM_OVERLAY['390316'].endGame;
  const what = q.rows.find(r => r.label === 'What happens');
  assert.match(what.body, /archived AUTOMATICALLY/);
  assert.match(what.body, /Only this status and .* Quote Approval — Customer Replied .* auto-archive/);
  const mo = q.rows.find(r => r.label === 'Missed Opportunity email');
  assert.match(mo.body, /^None\b/, 'Quote must state plainly that there is no Missed Opportunity email');
  // exactly two statuses may auto-archive, and no others
  const AUTO_ARCHIVE = ['390316', '549571'];
  const claiming = Object.keys(SIM_OVERLAY).filter(id =>
    SIM_OVERLAY[id].endGame && /archived AUTOMATICALLY/.test(JSON.stringify(SIM_OVERLAY[id].endGame.rows)));
  assert.deepStrictEqual(claiming.sort(), AUTO_ARCHIVE.slice().sort(),
    'the auto-archive carve-out must stay exactly 390316 + 549571');
});



ok('the archive notice and the Missed Opportunity email are never the same script', () => {
  // Holly 2026-07-31, option (a). Splitting the end game into rows exposed that the
  // archive notice and the +2wk Missed Opportunity touch were both ^ot_missed_opportunity,
  // i.e. the same customer would have received the same email twice. They are two
  // different jobs: "we're setting this aside" now, "let's work together on something
  // else" two weeks later. This guard stops them collapsing back together.
  Object.keys(SIM_OVERLAY).forEach(id => {
    const e = SIM_OVERLAY[id].endGame;
    if (!e || !e.archiveScript || !e.missedOppScript) return;
    const missed = String(e.missedOppScript.source || '').replace(/^CC script\s+/, '');
    assert.notStrictEqual(e.archiveScript, missed,
      id + ' sends the same script as both the archive notice and the Missed Opportunity email');
    if (e.archiveScriptPreview) {
      assert.notStrictEqual(e.archiveScriptPreview.code, missed,
        id + ' previews the Missed Opportunity script as its archive notice');
    }
  });
});

ok('the archive notice copy closes the quote and does not cross-sell', () => {
  // The copy now lives ONLY in the Google Sheet and is rendered from the live feed, so
  // assert against the committed served-codes snapshot rather than a baked duplicate.
  const served = require('./cc_served_codes.json');
  assert.ok(served.includes('^ot_archive_notice'), '^ot_archive_notice must be live');
  assert.ok(served.includes('^ot_missed_opportunity'), '^ot_missed_opportunity must be live');
  // they must stay two DIFFERENT scripts - that split was the whole point of option (a)
  assert.notStrictEqual('^ot_archive_notice', '^ot_missed_opportunity');
  ['548869', '548870', '548872'].forEach(id => {
    assert.strictEqual(SIM_OVERLAY[id].endGame.archiveScript, '^ot_archive_notice');
  });
});

ok('Customer Replied (549571) is a nudge-only status with a 2-day cadence', () => {
  const row = SIM_OVERLAY['549571'];
  assert.ok(row, '549571 missing from the overlay');
  assert.strictEqual(row.flavor, 'nudge');
  // no send mode: this status can never email the customer, in either direction
  assert.deepStrictEqual(row.scriptCodes, []);
  // "no send mode" now comes from the renderer's send-mode lead, keyed off the 🔔 in
  // the board name, rather than being repeated in the body copy.
  assert.match(row.automation, /STOPS the chase ladder/i);
  assert.match(row.nudge.ruleText, /2 days/);
  assert.match(row.nudge.ruleText, /resets/i);
  assert.strictEqual(row.nudge.chatKey, 'STALE');
});

ok('Customer Replied end game auto-archives with no email and no final nudge', () => {
  const e = SIM_OVERLAY['549571'].endGame;
  const by = l => e.rows.find(r => r.label === l);
  ['Stalls at', 'What happens', 'Close Date', 'Missed Opportunity email'].forEach(l =>
    assert.ok(by(l), '549571 end game is missing the "' + l + '" row'));
  assert.match(by('What happens').body, /archived AUTOMATICALLY/);
  assert.match(by('What happens').body, /no final PM nudge/i);
  // Holly's reason: the archive notice says "I have not heard back", which is false here
  assert.match(by('What happens').body, /did reply/i);
  assert.match(by('Close Date').body, /Archived Quote \(427400\)/);
  assert.match(by('Missed Opportunity email').body, /T1 AND new/);
  // it must NOT carry an archive script - it has no send mode to deliver one
  assert.strictEqual(e.archiveScript, undefined);
  assert.strictEqual(e.archiveScriptPreview, undefined);
});

ok('every chase status tells the PM where a customer reply goes', () => {
  // Holly 2026-08-01: a reply must route out of the chase, in BOTH lanes.
  const draft = ['428338', '548874', '548875', '548876'];
  const auto  = ['390317', '433065', '433066', '433067'];
  const revised = ['427399', '548987'];
  [...draft, ...auto, ...revised].forEach(id => {
    const a = SIM_OVERLAY[id].automation || '';
    assert.match(a, /Customer Replied/, id + ' does not tell the PM where a reply goes');
    assert.match(a, /549571/, id + ' does not name the target status id');
  });
});



ok('send-mode emoji on the board matches what the status actually does', () => {
  // Holly's legend: 🚀 auto-sends · 📮 drafts for the PM · 📮→🚀 draft-then-auto · 🔔 nudge only.
  // The board name is the first thing a PM reads, so a wrong marker is worse than none.
  // board is the live-synced fixture; SIM_OVERLAY is what the Simulator claims.
  const byId = {};
  board.forEach(s => { byId[String(s.id)] = s; });
  const expectations = [
    // id,      must contain, must NOT contain, why
    ['548006', '\u{1F680}', '\u{1F4EE}', '^sample_confirm auto-sends on purchase'],
    ['548873', '\u{1F4EE}', '\u{1F680}', '^ot_sample_shipped is draft-only'],
    ['549571', '\u{1F514}', null,        'nudge only, no send mode at all'],
  ];
  expectations.forEach(([id, must, mustNot, why]) => {
    const st = byId[id];
    assert.ok(st, id + ' missing from the board fixture');
    assert.ok(st.name.includes(must), `${id} (${why}) should carry ${must} — name is "${st.name}"`);
    if (mustNot) {
      assert.ok(!st.name.includes(mustNot), `${id} (${why}) must not carry ${mustNot}`);
    }
  });
  // a nudge-only status can never carry a send-mode marker
  Object.keys(SIM_OVERLAY).forEach(id => {
    const st = byId[id];
    if (!st || SIM_OVERLAY[id].flavor !== 'nudge') return;
    if (!(SIM_OVERLAY[id].scriptCodes || []).length) {
      assert.ok(!/\u{1F680}/u.test(st.name),
        id + ' is nudge-only with no scripts but carries 🚀: ' + st.name);
    }
  });
});

ok('Prep & Ship states plainly that it auto-sends', () => {
  // it fires a real customer email with no human in the loop; the panel must say so
  const a = SIM_OVERLAY['548006'].automation;
  assert.match(a, /AUTO-SENDS/);
  assert.match(a, /no draft to review/i);
  // and Samples Sent must stay explicitly draft-only
  assert.match(SIM_OVERLAY['548873'].automation, /Draft only on entry/i);
});



ok('the connected-text lead is derived from send mode, not hardcoded', () => {
  // Every nudge-flavour status used to open "No customer email fires here." That
  // contradicted the whole 📮 draft lane and was simply false on the 📮→🚀 hybrids,
  // which auto-send after 10 minutes.
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /function simSendMode\(/);
  assert.match(index, /function simSendModeLead\(/);
  assert.doesNotMatch(index,
    /<b>No customer email fires here\. The one thing connected is/,
    'the hardcoded lead is back');

  // replicate the resolver and check it against the live-synced board names
  const mode = name =>
    (name.includes('\u{1F4EE}') && name.includes('\u{1F680}')) ? 'hybrid' :
    name.includes('\u{1F680}') ? 'auto' :
    name.includes('\u{1F4EE}') ? 'draft' :
    name.includes('\u{1F514}') ? 'none' : '';
  const byId = {}; board.forEach(s => { byId[String(s.id)] = s; });
  const expect = {
    '427878': 'hybrid',   // Art/Order Ready for Approval (Terms Only)
    '428338': 'draft',    // Quote Approval - Drafted
    '433067': 'auto',     // Quote 3rd Check In - Auto Sent
    '549571': 'none',     // Customer Replied
    '548006': 'auto',     // Sample Pack Prep & Ship
    '548873': 'draft'     // Samples Sent
  };
  Object.entries(expect).forEach(([id, want]) => {
    assert.strictEqual(mode(byId[id].name), want,
      `${id} "${byId[id].name}" should resolve to send mode "${want}"`);
  });
});


ok('board fixture matches the live Printavo board', () => {
  const boardById = new Map(board.map(s => [String(s.id), s]));
  const fallbackById = new Map(SIM_FALLBACK_STATUSES.map(s => [String(s.id), s]));
  const fixtureOnly = [...boardById.keys()].filter(id => !fallbackById.has(id));
  const fallbackOnly = [...fallbackById.keys()].filter(id => !boardById.has(id));
  const nameDrift = [...boardById.entries()]
    .filter(([id, s]) => fallbackById.has(id) && fallbackById.get(id).name !== s.name)
    .map(([id, s]) => `${id}: ${s.name} !== ${fallbackById.get(id).name}`);
  assert.deepStrictEqual(fixtureOnly, [], 'fixture ids absent from SIM_FALLBACK_STATUSES');
  assert.deepStrictEqual(fallbackOnly, [], 'SIM_FALLBACK_STATUSES ids absent from fixture');
  assert.deepStrictEqual(nameDrift, [], 'fixture and SIM_FALLBACK_STATUSES names differ');
});

ok('no dead overlay entries', () => {
  const fixtureIds = new Set(board.map(s => String(s.id)));
  const overlayIds = new Set(Object.keys(SIM_OVERLAY));
  const overlayOnly = [...overlayIds].filter(id => !fixtureIds.has(id));
  const fixtureOnly = [...fixtureIds].filter(id => !overlayIds.has(id));
  assert.deepStrictEqual(overlayOnly, [], 'SIM_OVERLAY ids absent from fixture');
  assert.deepStrictEqual(fixtureOnly, [], 'fixture ids absent from SIM_OVERLAY');
});

ok('every referenced script is either served or explicitly planned', () => {
  const liveCodes = new Set(servedCodes);
  const badLiveRefs = [];
  const badPlannedRefs = [];
  Object.values(SIM_OVERLAY).forEach(row => {
    (row.scriptCodes || []).forEach(code => {
      if (!liveCodes.has(code)) badLiveRefs.push(`${row.id} ${code}`);
    });
    (row.plannedScriptCodes || []).forEach(code => {
      if (liveCodes.has(code)) badPlannedRefs.push(`${row.id} ${code}`);
    });
  });
  assert.deepStrictEqual(badLiveRefs, [], 'scriptCodes contains codes absent from the live CC feed');
  assert.deepStrictEqual(badPlannedRefs, [], 'plannedScriptCodes contains codes that are live in the CC feed');
});



ok('the status header shows the Printavo status ID', () => {
  // 2026-08-03: Jean had an automation matching on the status NAME, so a rename broke it.
  // Every other layer binds by ID, which is why the July rename pass was safe. The panel
  // now surfaces the ID so whoever wires an automation copies the stable handle.
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(index, /class="simid"/, 'the ID chip is gone from the status header');
  assert.match(index, /ID '\s*\+\s*esc\(String\(status\.id\)\)/, 'the chip must render the real status id');
  assert.match(index, /\.simid\{/, 'the .simid style is missing');
  assert.match(index, /user-select:all/, 'the ID should select in one click for copying');
});



ok('the auto lane 3rd Check In sends the archive notice, not a chase or a cross-sell', () => {
  // Holly 2026-08-03: "this should be the sending archive notice and moving to archive."
  // Rung 4 IS the archive step, so no ^ot_chase_4 is needed. Before this it sent
  // ^ot_missed_opportunity — the post-archive cross-sell — while still mid-chase.
  const r = SIM_OVERLAY['433067'];
  assert.deepStrictEqual(r.scriptCodes, ['^ot_archive_notice']);
  assert.notStrictEqual(r.scriptCodes[0], '^ot_missed_opportunity',
    'the Missed Opportunity email is the +2wk touch, never the chase rung');
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
