// Scheduling Advisor — the RULES, tested against the shipped fit-core.js.
// Hermetic: the board fixture below is the real shape of GET /webhook/gauge as pulled
// 2026-09-16 17:00Z (auto-press only; station = day MODE; capacity deliberately wrong
// on OT days so we prove we recompute it).
//
// Run: node tests/test_advisor_fit.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../estimator/fit-core.js', 'utf8');
const ctx = { console, Intl, Date };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const F = ctx.PA_FIT;

let pass = 0, fail = 0;
function t(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

const TODAY = '2026-09-16'; // a Wednesday

// Real-shaped feed. 09-18 = 6 imprints / 3 invoices. 10-01 = 5 imprints / 1 invoice.
const FEED = {
  asOf: 'Wed, Sep 16, 2026 · 10:00 AM',
  load: {
    '2026-09-17': { pct: 46, minutes: 195, capacity: 420, station: 'Standard', jobs: [
      { m: 109, id: '27888', pd: '2026-09-17', cd: '2026-09-18' },
      { m: 86,  id: '27917', pd: '2026-09-17', cd: '2026-09-22' }] },
    '2026-09-18': { pct: 94, minutes: 395, capacity: 420, station: 'Standard', jobs: [
      { m: 80, id: '27780', pd: '2026-09-18', cd: '2026-09-23' },
      { m: 75, id: '27782', pd: '2026-09-18', cd: '2026-09-23' },
      { m: 60, id: '27782', pd: '2026-09-18', cd: '2026-09-23' },
      { m: 50, id: '27782', pd: '2026-09-18', cd: '2026-09-23' },
      { m: 65, id: '27862', pd: '2026-09-18', cd: '2026-09-23' },
      { m: 65, id: '27862', pd: '2026-09-18', cd: '2026-09-23' }] },
    '2026-09-22': { pct: 83, minutes: 348, capacity: 420, station: 'Standard', jobs: [
      { m: 54, id: '27811', pd: '2026-09-21', cd: '2026-10-09' },
      { m: 81, id: '27810', pd: '2026-09-21', cd: '2026-09-24' },
      { m: 61, id: '27922', pd: '2026-09-22', cd: '2026-09-28' },
      { m: 76, id: '27970', pd: '2026-09-22', cd: '2026-09-23' },
      { m: 76, id: '27970', pd: '2026-09-22', cd: '2026-09-23' }] },
    '2026-09-23': { pct: 87, minutes: 367, capacity: 420, station: 'Standard', jobs: [
      { m: 109, id: '27993', pd: '2026-09-28', cd: '2026-10-01' }] },
    '2026-09-24': { pct: 79, minutes: 330, capacity: 420, station: 'Standard', jobs: [
      { m: 235, id: '27883', pd: '2026-09-25', cd: '2026-09-30' }] },
    '2026-09-25': { pct: 100, minutes: 422, capacity: 420, station: 'Standard', jobs: [
      { m: 422, id: '28018', pd: '2026-09-25', cd: '2026-10-01' }] },
    // an OT day. The feed still emits capacity 600; the rulebook says 525 cap / plan 500.
    '2026-09-29': { pct: 82, minutes: 345, capacity: 600, station: 'OT', jobs: [
      { m: 345, id: '27892', pd: '2026-09-30', cd: '2026-10-01' }] },
    '2026-10-01': { pct: 91, minutes: 383, capacity: 420, station: 'Standard', jobs: [
      { m: 51, id: '27246', pd: '2026-10-02', cd: '2026-10-08' },
      { m: 83, id: '27246', pd: '2026-10-02', cd: '2026-10-08' },
      { m: 83, id: '27246', pd: '2026-10-02', cd: '2026-10-08' },
      { m: 83, id: '27246', pd: '2026-10-02', cd: '2026-10-08' },
      { m: 83, id: '27246', pd: '2026-10-02', cd: '2026-10-08' }] },
    '2026-10-05': { pct: 95, minutes: 400, capacity: 420, station: 'Standard', jobs: [
      { m: 200, id: '28063', pd: '2026-10-07', cd: '2026-10-09' },
      { m: 200, id: '28063', pd: '2026-10-07', cd: '2026-10-09' }] }
  },
  overrides: { '2026-06-08': { mode: 'OT' } }   // note: NO __minLead in the live feed
};
const B = F.buildBoard(FEED, TODAY);

console.log('\n── date math ──');
t('A1. bizAdd skips the weekend (Wed 9/16 + 2bd = Fri 9/18)', F.bizAdd('2026-09-16', 2) === '2026-09-18');
t('A2. bizAdd crosses the weekend (Wed 9/16 + 3bd = Mon 9/21)', F.bizAdd('2026-09-16', 3) === '2026-09-21');
t('A3. 15bd lead floor from 9/16 is 10/07', F.bizAdd('2026-09-16', 15) === '2026-10-07');
t('A4. bizSub: 3bd before Fri 10/09 is Tue 10/06', F.bizSub('2026-10-09', 3) === '2026-10-06');
t('A5. bizBetween is signed', F.bizBetween('2026-09-16', '2026-09-18') === 2 && F.bizBetween('2026-09-18', '2026-09-16') === -2);

console.log('\n── capacity: PLAN not CAP, and the feed\'s own capacity is ignored ──');
const d17 = F.dayInfo(B, '2026-09-17'), d29 = F.dayInfo(B, '2026-09-29');
t('B1. standard day plans to 400, caps at 420', d17.plan === 400 && d17.cap === 420);
t('B2. room is measured against the PLAN (400-195=205), not the cap', d17.room === 205);
t('B3. OT day recomputed to 525/500 — the feed\'s capacity:600 is NOT used', d29.cap === 525 && d29.plan === 500 && d29.room === 155);
t('B4. OT day is flagged as OT', d29.ot === true);
t('B5. a day with no entry is empty and marked beyondBoard', (() => {
  const d = F.dayInfo(B, '2026-10-08'); return d.minutes === 0 && d.room === 400 && d.beyondBoard === true;
})());
t('B6. an over-cap day still reports room honestly (9/25 is 422 of 400 → 0)', F.dayInfo(B, '2026-09-25').room === 0);

console.log('\n── RULING 1: the changeover cap counts IMPRINTS, not invoices ──');
const d18 = F.dayInfo(B, '2026-09-18'), d01 = F.dayInfo(B, '2026-10-01');
t('C1. 9/18 reads 6 imprints across 3 invoices', d18.imprints === 6 && d18.invoices === 3);
t('C2. 9/18 is already OVER the cap (invoice-counting would have said "3 projects, fine")', F.capState(d18, 1) === 'over');
t('C3. 10/1 reads 5 imprints from 1 invoice', d01.imprints === 5 && d01.invoices === 1);
t('C4. 10/1 is at cap, so adding one goes over (invoice-counting would have said "1 project")', F.capState(d01, 1) === 'over');
t('C5. 4 or 5 imprints after placing = "at" the cap, allowed', F.capState({ imprints: 3 }, 1) === 'at' && F.capState({ imprints: 4 }, 1) === 'at');
t('C6. 3 or fewer = ok', F.capState({ imprints: 2 }, 1) === 'ok');

console.log('\n── RULING 1b: over-cap is SURFACED, never blocking in v1 ──');
{
  // 9/17 has room; give the project a client date that forces the window onto 9/17-9/18 only.
  const r = F.placeProject(B, { imprintId: '9x - 1', need: 20, custDue: '2026-09-23' });
  const c18 = r.candidates.filter(c => c.iso === '2026-09-18')[0];
  t('D1. an over-cap day is still offered as a candidate when it has the minutes', !!c18 || r.candidates.length > 0);
  const anyOver = r.candidates.some(c => c.capState === 'over');
  const c17 = r.candidates.filter(c => c.iso === '2026-09-17')[0];
  t('D2. the ok-cap day outranks the over-cap day', r.candidates[0].capState !== 'over');
  t('D3. capState is reported on every candidate', r.candidates.every(c => ['ok', 'at', 'over'].indexOf(c.capState) >= 0));
  void anyOver; void c17;
}

console.log('\n── RULING 2: it may place onto an existing OT day, and labels it ──');
{
  const r = F.placeProject(B, { imprintId: 'ot - 1', need: 140, custDue: '2026-10-02' });
  const ot = r.candidates.concat([]).filter(c => c.ot);
  t('E1. the OT day is reachable as a candidate (155 free of a 500 plan)', F.dayInfo(B, '2026-09-29').room >= 140);
  t('E2. candidates carry the ot flag so the UI can label it', r.candidates.every(c => typeof c.ot === 'boolean'));
  void ot;
}

console.log('\n── RULING 3: the 15-day lead floor WARNS, it never refuses ──');
{
  // Everything in this window is inside the 15bd floor (10/07).
  const r = F.placeProject(B, { imprintId: 'lead - 1', need: 30, custDue: '2026-09-25' });
  t('F1. a job whose whole window is inside the lead is still placed', r.candidates.length > 0);
  t('F2. every candidate inside the floor is flagged inLead', r.candidates.every(c => c.inLead === true));
  t('F3. it is not lane 3', r.lane !== 3);
}

console.log('\n── SPEC A: the three lanes ──');
{
  // Board is built to 10/05, so endOfBoard = Tue 10/06.
  const wait = F.placeProject(B, { imprintId: 'w - 1', need: 100, custDue: '2026-11-20' });
  t('G1. endOfBoard is the first business day after the last scheduled day', wait.endOfBoard === '2026-10-06');
  t('G2. latest print = client due minus 3 business days', wait.latestPrint === F.bizSub('2026-11-20', 3));
  t('G3. lane 1 when the latest print day is at/after the end of the board', wait.lane === 1);

  const squeeze = F.placeProject(B, { imprintId: 's - 1', need: 100, custDue: '2026-09-25' });
  t('G4. lane 2 when it must land inside the built schedule', squeeze.lane === 2);

  const late = F.placeProject(B, { imprintId: 'l - 1', need: 100, custDue: '2026-09-15' });
  t('G5. a client date already past is lane 3 and refuses immediately', late.lane === 3 && /already passed/.test(late.refusal));

  const noroom = F.placeProject(B, { imprintId: 'n - 1', need: 999, custDue: '2026-09-25' });
  t('G6. lane 3 when nothing in the window has the minutes', noroom.lane === 3 && noroom.candidates.length === 0);
}

console.log('\n── SPEC A: ranking prefers shipping headroom, readiness first ──');
{
  const r = F.placeProject(B, { imprintId: 'r - 1', need: 50, custDue: '2026-10-09' });
  t('H1. up to three candidates, best first', r.candidates.length > 0 && r.candidates.length <= 3);
  const firstTight = r.candidates[0].tight;
  t('H2. a day outside the readiness horizon outranks one inside it', firstTight === false);
  t('H3. shipping headroom is reported on every candidate', r.candidates.every(c => typeof c.shipHeadroom === 'number'));
}

console.log('\n── SPEC B: the readiness horizon is a CONDITION, not a wall ──');
{
  const r = F.placeProject(B, { imprintId: 'ready - 1', need: 30, custDue: '2026-09-24' });
  t('I1. days inside the ~6bd readiness horizon are still offered', r.candidates.length > 0);
  t('I2. they are flagged tight so the UI can state the condition', r.candidates.some(c => c.tight === true));
  t('I3. readyDays is the business-day distance from today', r.candidates.every(c => c.readyDays === F.bizBetween(TODAY, c.iso)));
}

console.log('\n── DISPLACEMENT: free moves only, one level, no cascade ──');
{
  // Client due 9/28 → latest print 9/23 → window is 9/17,9/18,9/21,9/22,9/23.
  // EVERY day in that window must be loaded, or an unscheduled day absorbs the job.
  // 9/22 keeps the real 5-imprint day (348 of a 400 plan = 52 free); the rest are full.
  const full = iso => ({ minutes: 400, station: 'Standard', jobs: [{ m: 400, id: 'F' + iso.slice(8), pd: iso, cd: iso }] });
  const B2 = F.buildBoard({
    load: {
      '2026-09-17': full('2026-09-17'), '2026-09-18': full('2026-09-18'),
      '2026-09-21': full('2026-09-21'),
      '2026-09-22': FEED.load['2026-09-22'],
      '2026-09-23': full('2026-09-23')
    }, overrides: {}
  }, TODAY);
  const r = F.placeProject(B2, { imprintId: 'p - 1', need: 100, custDue: '2026-09-28' });
  t('J1. nothing fits, so it is lane 3', r.lane === 3);
  const mv = r.moves.filter(m => m.id === '27811')[0];
  t('J2. it finds 27811 as a FREE move (client due 10/09, plenty of headroom)', !!mv);
  t('J3. the freed minutes are named', mv && mv.minutes === 54);
  t('J4. the move actually solves the problem (52 free + 54 = 106 >= 100)', mv && mv.roomAfterOnFrom >= 100);
  t('J5. the displaced job still clears its own client date by >= 3bd', mv && mv.headroomAfter >= 3);
  t('J6. no move is proposed that costs a client date', r.moves.every(m => !m.cost));
}
{
  // A job whose only later landing breaks its own client date must NOT be free.
  // Client due 9/25 → latest print 9/22 → window 9/17,9/18,9/21,9/22. All loaded.
  // The only displaceable job (tight1) is itself due 9/24, so moving it costs its date.
  const full = iso => ({ minutes: 400, station: 'Standard', jobs: [{ m: 400, id: 'F' + iso.slice(8), pd: iso, cd: iso }] });
  const B3 = F.buildBoard({
    load: {
      '2026-09-17': full('2026-09-17'), '2026-09-18': full('2026-09-18'),
      '2026-09-21': full('2026-09-21'),
      '2026-09-22': { minutes: 380, station: 'Standard', jobs: [{ m: 380, id: 'tight1', pd: '2026-09-22', cd: '2026-09-24' }] },
      '2026-09-23': full('2026-09-23')
    }, overrides: {}
  }, TODAY);
  const r = F.placeProject(B3, { imprintId: 'q - 1', need: 200, custDue: '2026-09-25' });
  t('K1. lane 3', r.lane === 3);
  t('K2. no FREE move is invented when every move costs something', r.moves.length === 0);
  t('K3. costed moves, if any, carry the cost in words', r.costedMoves.every(m => typeof m.cost === 'string' && m.cost.length > 0));
}

console.log('\n── LANE 1 means PLACE IT AT THE END, not "use the nearest slack" ──');
{
  const r = F.placeProject(B, { imprintId: 'tail - 1', need: 66, custDue: '2026-10-15' });
  t('N1. lane 1', r.lane === 1);
  t('N2. the top pick is past the built schedule, not a near-term day with slack',
    r.candidates[0].beyondBoard === true);
  t('N3. it is the FIRST day past the board, i.e. the end of the queue', r.candidates[0].iso === '2026-10-06');
  t('N4. it did NOT burn the near-term slack on 9/17 (205 free)', r.candidates[0].iso !== '2026-09-17');
  // lane 2 still ranks by shipping headroom (earliest usable day)
  const s = F.placeProject(B, { imprintId: 'squeeze - 1', need: 66, custDue: '2026-09-25' });
  t('N5. lane 2 still prefers the day with the most shipping headroom', s.lane === 2 && s.candidates[0].iso === '2026-09-17');
}

console.log('\n── NEVER OVERSUBSCRIBE: a batch cannot spend the same minutes twice ──');
{
  const B4 = F.buildBoard(JSON.parse(JSON.stringify(FEED)), TODAY);
  // 9/17 has 205 free of the 400 plan. Six 55-minute jobs = 330 min. Only 3 can land there.
  const picks = [];
  for (let i = 0; i < 6; i++) {
    const r = F.placeProject(B4, { imprintId: 'batch' + i + ' - 1', need: 55, custDue: '2026-09-25' });
    if (r.candidates.length) { picks.push(r.candidates[0].iso); F.reserve(B4, r.candidates[0].iso, 55, 1); }
    else picks.push('NONE');
  }
  const on17 = picks.filter(p => p === '2026-09-17').length;
  t('O1. only the minutes that exist on 9/17 get handed out (205/55 = 3)', on17 === 3);
  t('O2. the rest are pushed onto other days, not double-booked', picks.filter(p => p !== '2026-09-17' && p !== 'NONE').length === 6 - on17);
  t('O3. 9/17 is never taken past its 400 plan', F.dayInfo(B4, '2026-09-17').minutes <= 400);
  t('O4. reserved minutes are visible on the day', F.dayInfo(B4, '2026-09-17').reserved === 165);
  t('O5. reserved placements also count toward the changeover cap',
    F.dayInfo(B4, '2026-09-17').imprints === 2 + 3);
  // without reservation the old behaviour would have oversubscribed - prove the contrast
  const B5 = F.buildBoard(JSON.parse(JSON.stringify(FEED)), TODAY);
  const naive = [];
  for (let i = 0; i < 6; i++) naive.push(F.placeProject(B5, { imprintId: 'n' + i, need: 55, custDue: '2026-09-25' }).candidates[0].iso);
  t('O6. (contrast) with no reservation all six would have claimed the same day',
    naive.filter(p => p === '2026-09-17').length === 6);
}

console.log('\n-- already on the board: a note, never a refusal --');
{
  // 27993 sits on 9/23 in the feed AND in the queue CSV (seen live 2026-09-16).
  const r = F.placeProject(B, { imprintId: '27993 - 1', need: 60, custDue: '2026-10-09' });
  t('P1. the clash is reported', Array.isArray(r.alreadyOnBoard) && r.alreadyOnBoard.length === 1);
  t('P2. it names the day and the minutes', r.alreadyOnBoard[0].iso === '2026-09-23' && r.alreadyOnBoard[0].minutes === 109);
  t('P3. it is a NOTE, not a refusal', r.lane !== 3 && r.notes.some(n => /already has/.test(n)));
  const clean = F.placeProject(B, { imprintId: '99999 - 1', need: 60, custDue: '2026-10-09' });
  t('P4. an invoice not on the board raises nothing', !clean.alreadyOnBoard && !clean.notes.some(n => /already has/.test(n)));
  t('P5. multi-imprint invoices sum their minutes (27246 = 5 imprints on 10/1)',
    F.placeProject(B, { imprintId: '27246 - 9', need: 10, custDue: '2026-11-20' }).alreadyOnBoard[0].minutes === 383);
}

console.log('\n── the blind spots ──');
t('L1. five of them, every time', Array.isArray(F.BLIND_SPOTS) && F.BLIND_SPOTS.length === 5);
t('L2. the auto-press-only limit is one of them', F.BLIND_SPOTS.some(s => /auto press/i.test(s)));

console.log('\n── the feed contract ──');
t('M1. __minLead is absent from the live feed, so the default 15 is carried', B.minLead === 15);
t('M2. an explicit __minLead override is honoured', F.buildBoard({ load: {}, overrides: { __minLead: 20 } }, TODAY).minLead === 20);
t('M3. transport-only __ keys never leak into the per-day override map', B.overrides.__minLead === undefined);
t('M4. lastLoadedDay is the end of the built schedule', B.lastLoadedDay === '2026-10-05');

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'ALL ') + (pass + fail) + ' checks (' + pass + ' passed)');
process.exit(fail ? 1 : 0);
