/* ============================================================================
   PA FIT — the scheduling rules, as pure functions. No DOM, no page globals.
   Loaded by the Estimator's Scheduling Advisor (estimator/advisor.js).
   Built to be loaded by capacity/index.html too, the same way schedule/ and
   capacity/ already load ../estimator/estimate.js — so the front door (a PM
   asking "can I promise this date") and the Calculator (Rosa placing a paid
   job) run ONE fit calculation, not two that can disagree.
   ⚠ capacity/index.html does NOT load this yet. Pointing it here and deleting
   its private copies of eff()/slack()/the date math is a follow-up PR.

   RULES, and where they come from (Nov_Leave_Prep_2026/Scheduling_Rules.md):
     - Standard day: PLAN 400, HOLDS 420. OT day: PLAN 500, HOLDS 525.
       🔑 Neither number is wrong - they answer different questions (Jean,
       2026-09-16). 420 is what the day actually holds; 400 is what you plan to;
       the twenty between them are a DELIBERATE BUFFER for work running long and
       for downtime. So a day at 405 is neither full nor free - it is SPENDING
       BUFFER, which is a real third state and the honest one. Three bands:
         under/at PLAN  -> plan freely, cushion intact
         PLAN..CAP      -> it holds, and it SAYS SO. Allowed, never silent.
         over CAP       -> refused.
       Same pattern as the readiness horizon: state the cost, do not block. It
       matters most in the case this tool exists for - a jam is exactly when
       spending buffer is the right call, because that is what it is reserved
       for. A tool that silently refused the 400-420 band would be wrong in the
       one situation it was built for.
       ⚠ As of 2026-09-18 (PR #60) the gauge, capacity/index.html, also caps the
       day at 400 (500 OT) — it now measures against the PLAN, not the 420/525
       ceiling. So the gauge and this file agree on the number; the extra thing
       the Advisor knows is that the last twenty minutes (25 on OT) are a NAMED
       buffer band rather than flat capacity, so spending them is surfaced out
       loud instead of counted silently.
     - 4-5 imprints a day = the changeover cap. Counts IMPRINTS, not invoices
       (Jean 2026-09-16): front/back/sleeve on one invoice is three setups,
       three registrations, three teardowns. v1 SURFACES at/over-cap days, it
       does not refuse them - the cap may have been fitted when "project" meant
       invoice, so Jean sees real days before it starts blocking.
     - The 15-business-day lead floor is NOT enforced here. It governs what a
       PM may PROMISE, not where an already-paid job gets plotted. Warn only.
     - Never suggests overtime. It MAY place onto a day already on OT (that
       call was made ahead of time by Holly) and labels it.
   ========================================================================== */
(function (g) {
  'use strict';

  var RULES = {
    CAP:  { Standard: 420, OT: 525 },   // hard ceiling of the day
    PLAN: { Standard: 400, OT: 500 },   // what we actually fill to
    CHANGEOVER_MAX: 5,                  // imprints/day; 6+ is over the cap
    CHANGEOVER_BAND: 4,                 // 4-5 = at the cap, allowed but full
    LEAD_DEFAULT: 15,                   // business days a PM must quote out
    SHIP_DAYS: 3,                       // biz days print -> client, normal shipping
    READINESS_DAYS: 6                   // blanks ~1wk + a coat-and-burn cycle
  };

  /* ---------------- date math (business days, Pacific) ---------------- */
  function isoLA(d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d || new Date());
  }
  function addDays(iso, n) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }
  function dowOf(iso) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); // 0 = Sun
  }
  function isBiz(iso) { var w = dowOf(iso); return w >= 1 && w <= 5; }
  // n business days AFTER iso (iso itself never counted)
  function bizAdd(iso, n) { var d = iso, k = 0; while (k < n) { d = addDays(d, 1); if (isBiz(d)) k++; } return d; }
  // n business days BEFORE iso
  function bizSub(iso, n) { var d = iso, k = 0; while (k < n) { d = addDays(d, -1); if (isBiz(d)) k++; } return d; }
  // business days strictly after a, up to and including b. Negative if b < a.
  function bizBetween(a, b) {
    if (b === a) return 0;
    var back = b < a, lo = back ? b : a, hi = back ? a : b, d = lo, k = 0;
    while (d < hi) { d = addDays(d, 1); if (isBiz(d)) k++; }
    return back ? -k : k;
  }
  function fmt(iso) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]))
      .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  // "2026-10-07" out of "28068 - 1" style ids: strip the imprint suffix
  function invoiceOf(imprint) { return String(imprint || '').split('-')[0].replace(/\s/g, ''); }
  function normImprint(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* ---------------- board: the gauge feed, made queryable ---------------- */
  /* The feed (GET /webhook/gauge) is AUTO PRESS ONLY. load[iso].station is the
     day MODE ("Standard"/"OT"), not the Printavo station. load[iso].capacity is
     NOT trusted - it still emits 600 on OT days; we recompute from the mode.
     load only carries days that have scheduled work: a day past the last one is
     genuinely empty (verified 2026-09-16 against the live source CSV), but we
     mark it beyondBoard so the UI can say so instead of claiming 420 free. */
  function buildBoard(feed, today) {
    feed = feed || {};
    var load = (feed.load && typeof feed.load === 'object') ? feed.load : {};
    var ovRaw = (feed.overrides && typeof feed.overrides === 'object') ? feed.overrides : {};
    var overrides = {}, minLead = RULES.LEAD_DEFAULT;
    for (var k in ovRaw) {
      if (k === '__minLead') {
        var ml = Number(ovRaw[k]);
        if (isFinite(ml) && ml >= 0) minLead = Math.min(60, Math.round(ml));
      } else if (k.slice(0, 2) !== '__') {
        overrides[k] = ovRaw[k];
      }
    }
    var dates = Object.keys(load).sort();
    return {
      load: load,
      overrides: overrides,
      // Provisional placements made earlier in THIS batch. The Advisor answers one
      // row at a time against a shared board, so without this six projects would
      // each be told to take the same 205 free minutes - a 490-minute batch into a
      // 205-minute hole. "Never oversubscribe" is a LAW, so the minutes are spent
      // as we go and later rows see the board the earlier ones left behind.
      reserved: {},
      minLead: minLead,
      today: today || isoLA(),
      asOf: feed.asOf || '',
      pulledAt: feed.pulledAt || '',
      firstLoadedDay: dates.length ? dates[0] : null,
      lastLoadedDay: dates.length ? dates[dates.length - 1] : null
    };
  }

  function dayInfo(board, iso) {
    var base = board.load[iso] || null;
    var ov = board.overrides[iso] || {};
    var mode = ov.mode || (base && base.station) || 'Standard';
    if (mode !== 'OT') mode = 'Standard';
    var cap = RULES.CAP[mode], plan = RULES.PLAN[mode];
    var holds = Array.isArray(ov.holds)
      ? ov.holds.reduce(function (t, h) { return t + (Number(h.min) || 0); }, 0) : 0;
    var rsv = (board.reserved && board.reserved[iso]) || null;
    var minutes = Math.max(0, ((base && Number(base.minutes)) || 0) + (Number(ov.add) || 0)) + holds
      + (rsv ? rsv.minutes : 0);
    var jobs = (base && Array.isArray(base.jobs)) ? base.jobs : [];
    return {
      iso: iso, mode: mode, ot: mode === 'OT', cap: cap, plan: plan,
      minutes: minutes, jobs: jobs,
      reserved: rsv ? rsv.minutes : 0,
      reservedImprints: rsv ? rsv.imprints : 0,
      imprints: jobs.length + (rsv ? rsv.imprints : 0),   // RULING: imprints, not invoices
      invoices: uniq(jobs.map(function (j) { return String(j.id); })).length,
      room: Math.max(0, plan - minutes),           // room before the buffer is touched
      roomToCap: Math.max(0, cap - minutes),       // room before the day is refused
      buffer: Math.max(0, cap - plan),             // the deliberate cushion, 20 std / 25 OT
      pct: cap ? Math.round(minutes / cap * 100) : 0,
      onBoard: !!base,
      beyondBoard: !!(board.lastLoadedDay && iso > board.lastLoadedDay)
    };
  }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

  // Spend a day's minutes provisionally, so the next row in the batch sees them gone.
  function reserve(board, iso, minutes, imprints) {
    if (!board.reserved) board.reserved = {};
    var r = board.reserved[iso] || (board.reserved[iso] = { minutes: 0, imprints: 0 });
    r.minutes += Math.max(0, Math.ceil(Number(minutes) || 0));
    r.imprints += (imprints == null ? 1 : imprints);
    return r;
  }

  function capState(d, adding) {
    var after = d.imprints + (adding || 1);
    if (after > RULES.CHANGEOVER_MAX) return 'over';
    if (after >= RULES.CHANGEOVER_BAND) return 'at';
    return 'ok';
  }

  /* ---------------- the placement ----------------
     project: {imprintId, jobName, need, qty, custDue, prodDue}
     Returns {lane, latestPrint, endOfBoard, candidates[], moves[], costedMoves[], refusal, notes[]}
     lane 1 = it can wait (place at the end of the built schedule)
     lane 2 = it must fit inside the built schedule (genuine slack)
     lane 3 = it fits nowhere
  */
  function placeProject(board, project, opts) {
    opts = opts || {};
    var today = board.today;
    var need = Math.ceil(Number(project.need) || 0);
    var custDue = project.custDue || '';
    var out = {
      imprintId: project.imprintId, jobName: project.jobName, need: need, qty: project.qty,
      custDue: custDue, prodDue: project.prodDue || '',
      lane: 0, latestPrint: null, endOfBoard: null,
      candidates: [], moves: [], costedMoves: [], refusal: '', notes: []
    };
    if (!need) { out.lane = 0; out.refusal = 'No projected minutes for this row.'; return out; }

    var endOfBoard = board.lastLoadedDay ? bizAdd(board.lastLoadedDay, 1) : bizAdd(today, 1);
    out.endOfBoard = endOfBoard;

    // The one question that starts everything: what is the LATEST day this can
    // print and still reach the client on normal shipping?
    var latestPrint = custDue ? bizSub(custDue, RULES.SHIP_DAYS) : null;
    out.latestPrint = latestPrint;

    // Is this invoice ALREADY on the board? A Queue export can still list a job that
    // has been plotted (seen live 2026-09-16: 27993 sits on 9/23 in the feed and in the
    // queue CSV at the same time). The feed carries invoice numbers only, not imprint
    // ids, so this can never be decided automatically - it is a NOTE, never a refusal.
    var already = onBoardAlready(board, project.imprintId);
    if (already.length) {
      out.alreadyOnBoard = already;
      out.notes.push('Invoice ' + invoiceOf(project.imprintId) + ' already has ' +
        already.map(function (a) { return a.minutes + ' min on ' + fmt(a.iso); }).join(' and ') +
        '. Check this imprint is not one of them before you place it again.');
    }

    if (!custDue) {
      out.notes.push('No client due date on this row, so the latest print day is unknown. Ranked by readiness only.');
    } else if (latestPrint <= today) {
      out.lane = 3;
      out.refusal = custDue < today
        ? 'The client date (' + fmt(custDue) + ') has already passed.'
        : 'The latest day this can print and still ship normally is ' + fmt(latestPrint) +
          ', which is today or earlier.';
      out.notes.push('This is already a date conversation, not a placement. Take it to the project manager first.');
      return out;
    }

    // Lane 1 vs 2: can it simply go at the end of the built schedule?
    var horizonEnd = latestPrint || bizAdd(today, 30);
    out.lane = (!latestPrint || latestPrint >= endOfBoard) ? 1 : 2;

    // ---- enumerate every business day it could legally print on ----
    var scanned = [], iso = bizAdd(today, 1), guard = 0;
    while (iso <= horizonEnd && guard++ < 400) {
      if (isBiz(iso)) scanned.push(evaluateDay(board, iso, need, custDue, today));
      iso = addDays(iso, 1);
    }
    if (!scanned.length) {
      out.lane = 3;
      out.refusal = 'No business days between today and ' + fmt(horizonEnd) + '.';
      return out;
    }

    var fits = scanned.filter(function (c) { return c.fits; });

    if (fits.length) {
      // Lane 1 is "it can wait", and the instruction that goes with it is PLACE IT AT
      // THE END. Ranking it by shipping headroom would do the opposite - it would burn
      // scarce near-term slack on the one job that does not need it. So lane 1 prefers
      // the empty tail past the built schedule, earliest day first; lane 2 (which has
      // to squeeze into days that already have work) uses the headroom ranking.
      fits.sort(out.lane === 1 ? rankTail : rank);
      out.candidates = fits.slice(0, 3);
      return out;
    }

    // ---- nothing fits: lane 3. Look for a FREE move, one level deep. ----
    out.lane = 3;
    var found = findFreeMoves(board, scanned, need, today);
    out.moves = found.free;
    out.costedMoves = found.free.length ? [] : found.costed.slice(0, 2);
    if (!out.moves.length) {
      var best = scanned.slice().sort(function (a, b) { return b.room - a.room; })[0];
      out.refusal = 'No day between now and ' + fmt(horizonEnd) + ' can hold ' + need +
        ' minutes, even into its buffer. The roomiest day is ' + fmt(best.iso) + ' with ' +
        best.day.roomToCap + ' before it would be over cap.';
    }
    return out;
  }

  function onBoardAlready(board, imprintId) {
    var inv = invoiceOf(imprintId), hits = [];
    if (!inv) return hits;
    for (var iso in board.load) {
      var jobs = board.load[iso].jobs;
      if (!Array.isArray(jobs)) continue;
      var m = 0;
      for (var i = 0; i < jobs.length; i++) if (String(jobs[i].id) === inv) m += Number(jobs[i].m) || 0;
      if (m) hits.push({ iso: iso, minutes: m });
    }
    return hits.sort(function (a, b) { return a.iso < b.iso ? -1 : 1; });
  }

  /* Which of the three bands does `need` land this day in?
     at-or-under plan = 'plan' · plan..cap = 'buffer' (allowed, must be said out
     loud) · past cap = 'over' (refused). Boundaries are inclusive downward, so
     exactly 400 is still 'plan' and exactly 420 is still 'buffer'. */
  function bandFor(d, need) {
    var after = d.minutes + (Number(need) || 0);
    if (after <= d.plan) return 'plan';
    if (after <= d.cap) return 'buffer';
    return 'over';
  }

  function evaluateDay(board, iso, need, custDue, today) {
    var d = dayInfo(board, iso);
    var cs = capState(d, 1);
    var readyDays = bizBetween(today, iso);
    var headroom = custDue ? bizBetween(iso, custDue) : null;
    var after = d.minutes + need;
    var band = bandFor(d, need);
    return {
      iso: iso, day: d, room: d.room, need: need,
      band: band,                                   // plan | buffer | over
      // minutes of the day's cushion this placement would spend, and what is left
      bufferUsed: band === 'buffer' ? after - d.plan : 0,
      bufferLeft: Math.max(0, d.cap - Math.max(after, d.plan)),
      fits: band !== 'over',                        // the HARD limit is the cap
      after: after,
      pctAfter: d.cap ? Math.round((d.minutes + need) / d.cap * 100) : 0,
      capState: cs,                                   // ok | at | over  (surfaced, never blocking in v1)
      ot: d.ot,
      readyDays: readyDays,
      tight: readyDays < RULES.READINESS_DAYS,        // inside the readiness horizon
      shipHeadroom: headroom,                         // biz days from print to client due
      inLead: iso < bizAdd(today, board.minLead),     // warn only, never a refusal
      beyondBoard: d.beyondBoard
    };
  }

  /* Ranking. Readiness first (a day we can actually be ready for beats a day we
     cannot), then the changeover cap, then SHIPPING HEADROOM descending - Jean's
     criterion: prefer dates that leave more room to get it to the client. */
  /* Lane 1 ranking: put it at the end. Days past the built schedule first (they cost
     nobody anything), then the changeover cap, then earliest. */
  function rankTail(a, b) {
    if (a.beyondBoard !== b.beyondBoard) return a.beyondBoard ? -1 : 1;
    var bw = { plan: 0, buffer: 1, over: 2 };
    if (bw[a.band] !== bw[b.band]) return bw[a.band] - bw[b.band];
    var w = { ok: 0, at: 1, over: 2 };
    if (w[a.capState] !== w[b.capState]) return w[a.capState] - w[b.capState];
    if (a.tight !== b.tight) return a.tight ? 1 : -1;
    return a.iso < b.iso ? -1 : 1;
  }

  function rank(a, b) {
    if (a.tight !== b.tight) return a.tight ? 1 : -1;
    // a day whose cushion survives beats one that spends it, every time
    var bw = { plan: 0, buffer: 1, over: 2 };
    if (bw[a.band] !== bw[b.band]) return bw[a.band] - bw[b.band];
    var w = { ok: 0, at: 1, over: 2 };
    if (w[a.capState] !== w[b.capState]) return w[a.capState] - w[b.capState];
    if (a.shipHeadroom != null && b.shipHeadroom != null && a.shipHeadroom !== b.shipHeadroom) {
      return b.shipHeadroom - a.shipHeadroom;
    }
    if (a.pctAfter !== b.pctAfter) return a.pctAfter - b.pctAfter;
    return a.iso < b.iso ? -1 : 1;
  }

  /* One move, one level deep, NO CASCADE. A move is FREE when the displaced job
     still lands SHIP_DAYS business days before its own client date on its new
     day. Anything that costs a client date, expedited shipping or a promise is
     tier adjudication - we name the cost and hand it to a human. */
  function findFreeMoves(board, scanned, need, today) {
    var free = [], costed = [], seen = {};
    for (var i = 0; i < scanned.length; i++) {
      var c = scanned[i];
      var jobs = c.day.jobs;
      for (var k = 0; k < jobs.length; k++) {
        var j = jobs[k], m = Number(j.m) || 0;
        if (!m) continue;
        // would moving this one actually solve the problem?
        if (c.room + m < need) continue;
        var key = j.id + '@' + c.iso + '#' + k;
        if (seen[key]) continue; seen[key] = 1;

        var target = findLanding(board, c.iso, m, j.cd, today);
        if (!target) continue;
        var rec = {
          id: j.id, minutes: m, from: c.iso, to: target.iso,
          custDue: j.cd || '', prodDue: j.pd || '',
          headroomAfter: target.headroom, frees: m,
          roomAfterOnFrom: c.room + m, need: need,
          cost: target.cost
        };
        if (target.cost) { costed.push(rec); } else { free.push(rec); }
        if (free.length >= 3) return { free: free, costed: costed };
      }
    }
    return { free: free, costed: costed };
  }

  // Find the earliest later day that can hold `m` minutes. cost === '' means free.
  function findLanding(board, from, m, custDue, today) {
    var latest = custDue ? bizSub(custDue, RULES.SHIP_DAYS) : bizAdd(from, 20);
    var iso = addDays(from, 1), guard = 0, fallback = null;
    var hardStop = custDue ? custDue : bizAdd(from, 20);
    while (iso <= hardStop && guard++ < 120) {
      if (isBiz(iso)) {
        var d = dayInfo(board, iso);
        if (d.room >= m && capState(d, 1) !== 'over') {
          var headroom = custDue ? bizBetween(iso, custDue) : null;
          if (!custDue || iso <= latest) {
            return { iso: iso, headroom: headroom, cost: '' };   // FREE
          }
          if (!fallback) {
            fallback = {
              iso: iso, headroom: headroom,
              cost: headroom > 0
                ? 'lands ' + headroom + ' business day' + (headroom === 1 ? '' : 's') +
                  ' before the client date — needs expedited shipping'
                : 'lands on or after the client date'
            };
          }
        }
      }
      iso = addDays(iso, 1);
    }
    return fallback;
  }

  /* The five blind spots. Same five, every time, on every answer. The tool
     naming what it cannot check is the product, not a disclaimer. */
  var BLIND_SPOTS = [
    'whether the darkroom has screens burned for that morning',
    'whether the dryer is free if this needs a second pass',
    'whether anyone is out that day',
    'whether the blanks are in inventory or on order',
    'anything off the auto press — the feed carries no manual, heat or post-production load'
  ];

  g.PA_FIT = {
    RULES: RULES, BLIND_SPOTS: BLIND_SPOTS,
    isoLA: isoLA, addDays: addDays, isBiz: isBiz, bizAdd: bizAdd, bizSub: bizSub,
    bizBetween: bizBetween, fmt: fmt, invoiceOf: invoiceOf, normImprint: normImprint,
    buildBoard: buildBoard, dayInfo: dayInfo, capState: capState, reserve: reserve, bandFor: bandFor,
    evaluateDay: evaluateDay, placeProject: placeProject, findLanding: findLanding
  };
})(typeof window !== 'undefined' ? window : this);
