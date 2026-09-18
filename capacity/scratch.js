/* ============================================================================
   SCHEDULING ADVISOR v3 — the planning scratchpad, re-homed INTO the
   availability tool (capacity/index.html) as management mode's back-of-card
   view. Re-homed from the retired capacity/plan/plan.js on 2026-09-18.

   A scratchpad with the rules enforced. NOT a solver.

   SHOW, DO NOT SOLVE. Choosing what to eject and where it lands is a cascading
   search: expensive, hard to trust, and it takes the judgement off the person
   holding it. The moment the human does the moving it becomes live
   recalculation, which is cheap and honest. So: this file never moves anything
   by itself. It may say "these days would hold it"; every move is the human's.

   🔑 A PROJECT move goes through ONE function: place(key, iso). A FEED-JOB move
   (v3, Tier A) goes through ONE function: moveFeed(key, iso). Both end in
   render(); iso === origin resets a feed job; iso === null ejects a project.
   Drag-and-drop and click-then-click both call them. The click path is a
   first-class interaction, not a test affordance — it is faster in a jam and it
   is the accessible one.

   Rules come from ../estimator/fit-core.js. Nothing here re-implements one.
   Minutes come from ../estimator/estimate.js, the same engine the Estimator and
   the Schedule board use. The Queue CSV is read by the shared
   ../estimator/queue-csv.js — there is no second parser.

   🔴 ISOLATION. This file is LAZY-LOADED by capacity/index.html only when
   management mode is on, into its own DOM subtree (#mgmt-scratch, ids all
   sp-prefixed). It never touches the gauge's render(), its #cal, or its inline
   globals. Its boot is wrapped in try/catch so a throw here can NEVER blank the
   PM gauge. capacity/index.html's own gauge script has already run and rendered
   before this file is ever fetched.

   ⚠ NOTHING IS COMMITTED. No write to Printavo, no write to the gauge feed, no
   override saved. Moving a committed (feed) job here is a PROPOSAL on a private
   clone of the feed — Printavo is still the schedule.
   ========================================================================== */
(function () {
  'use strict';

  var GAUGE_URL = 'https://primary-production-079f9.up.railway.app/webhook/gauge';
  var WEEKS_OUT = 20;          // business days of runway drawn past today

  var F = null;                 // PA_FIT
  var BOARD = null;             // built from a DEEP CLONE of the feed load (mutable)
  var PROJECTS = [];            // everything read from the CSV that we can place
  var PLACED = {};              // project key -> iso   (the rail scratchpad state)
  var SEL = null;               // selected project key
  var SELFEED = null;           // selected feed-job key
  var DAYS = [];                // every business day in range (logic scans all of them)
  var WEEK_MON = null;          // Monday of the week currently shown (the window)
  var FEED_BYKEY = {};          // feed-job key -> the live job object (lives inside BOARD.load)

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function warn(e) { try { console.warn('[scratch]', e && e.message ? e.message : e); } catch (_) {} }
  function setStatus(s) { var el = $('sp-status'); if (el) el.textContent = s; }

  /* ---------------- week windowing (v3) ---------------- */
  function mondayOf(iso) {
    // walk back to the Monday of this iso's week
    var d = iso, guard = 0;
    while (guard++ < 8) { if (dow(d) === 1) return d; d = F.addDays(d, -1); }
    return iso;
  }
  function dow(iso) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function weekDays(mon) {
    // the Mon–Fri business days of this week that are also inside DAYS' range
    var out = [], d = mon;
    for (var i = 0; i < 5; i++) { if (F.isBiz(d) && DAYS.indexOf(d) >= 0) out.push(d); d = F.addDays(d, 1); }
    return out;
  }
  function clampWeek(mon) {
    if (!DAYS.length) return mon;
    var first = mondayOf(DAYS[0]), last = mondayOf(DAYS[DAYS.length - 1]);
    if (mon < first) return first;
    if (mon > last) return last;
    return mon;
  }
  function stepWeek(delta) {
    var mon = clampWeek(F.addDays(WEEK_MON, delta * 7));
    // skip empty weeks (holidays etc.) in the step direction, but never past the ends
    var guard = 0;
    while (guard++ < 20 && !weekDays(mon).length) {
      var next = clampWeek(F.addDays(mon, delta * 7));
      if (next === mon) break;
      mon = next;
    }
    WEEK_MON = mon;
    render();
  }

  /* ---------------- board + reservations ----------------
     BOARD.reserved is rebuilt from PLACED every time, never mutated
     incrementally. PLACED is the single source of truth for RAIL placements, so
     the board can never drift away from what is on screen. FEED-JOB moves are a
     separate overlay: they mutate BOARD.load (a private clone), splicing the job
     from one day's list and pushing it onto another and moving its minutes with
     it — because a committed job is part of the day's load, not a reservation. */
  function rebuildReserved(excludeKey) {
    BOARD.reserved = {};
    Object.keys(PLACED).forEach(function (k) {
      if (k === excludeKey) return;
      var p = byKey(k); if (!p) return;
      F.reserve(BOARD, PLACED[k], p.need, 1);
    });
  }
  function byKey(k) {
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].key === k) return PROJECTS[i];
    return null;
  }
  function placedOn(iso) {
    return PROJECTS.filter(function (p) { return PLACED[p.key] === iso; });
  }
  function feedJobsOn(iso) {
    return (BOARD.load[iso] && Array.isArray(BOARD.load[iso].jobs)) ? BOARD.load[iso].jobs : [];
  }
  function feedMoved(j) { return j.__cur !== j.__origin; }
  // A job's print-timing on a print day is GRADUATED (v3.3): F.printTiming
  // returns ok / expedite / late — no binary "late" flag any more.
  function anyFeedMoved() {
    for (var k in FEED_BYKEY) if (feedMoved(FEED_BYKEY[k])) return true;
    return false;
  }

  /* Evaluate a PROJECT against a day AS IF it were not already placed anywhere,
     so moving a job onto the day it is already on does not count it twice. */
  function evalFor(p, iso) {
    rebuildReserved(p.key);
    var ev = F.evaluateDay(BOARD, iso, p.need, p.custDue, BOARD.today);
    rebuildReserved();
    // capacity reds (unchanged, v3.3): over the day's hard cap, or over the changeover cap
    var cap = [];
    if (ev.band === 'over') cap.push('more than the day holds — ' + ev.after + ' of ' + ev.day.cap + ' minutes');
    if (ev.capState === 'over') cap.push('over the changeover cap — ' + (ev.day.imprints + 1) + ' imprints, the cap is ' + F.RULES.CHANGEOVER_MAX);
    ev.capBroken = cap;
    // print-timing is GRADUATED now (v3.3): ok / expedite / late, from the two dates.
    ev.timing = F.printTiming(iso, { pd: p.prodDue, cd: p.custDue });
    var onOrBeforeDue = !p.prodDue || iso <= p.prodDue;
    // "available" — rail earliest + all-available + candidate highlight: fits AND on/before prod due
    ev.legal = cap.length === 0 && onOrBeforeDue;
    // "placeable" — drop preview: fits AND not a TRUE date failure (expedite is allowed)
    ev.placeable = cap.length === 0 && ev.timing.state !== 'late';
    // "broken" — a placed box's RED: a capacity red, or a true date failure (past the client date)
    ev.broken = cap.concat(ev.timing.state === 'late'
      ? ['at or past its client date (' + (p.custDue ? F.fmt(p.custDue) : '—') + ') — will not make it even overnight']
      : []);
    return ev;
  }

  function anywhereLegal(p) {
    for (var i = 0; i < DAYS.length; i++) if (evalFor(p, DAYS[i]).legal) return DAYS[i];
    return null;
  }
  // Every day in range the project can ACTUALLY go: has room AND is on/before its
  // PRODUCTION DUE AND under the changeover cap (evalFor's legal test). Live: it
  // accounts for other placements + feed moves already made.
  function allLegal(p) {
    var out = [];
    for (var i = 0; i < DAYS.length; i++) if (evalFor(p, DAYS[i]).legal) out.push(DAYS[i]);
    return out;
  }

  /* A hover preview for a feed-job drop: would the target day still hold it, and
     would the job still print by its own production due. Approximate on purpose —
     the honest answer lands on the real render after the drop. */
  function feedPreview(j, iso) {
    if (iso === j.__cur) return true;
    var d = F.dayInfo(BOARD, iso);            // excludes j (j sits on its from-day)
    var over = (d.minutes + (Number(j.m) || 0)) > d.cap;
    var overCap = (d.imprints + 1) > F.RULES.CHANGEOVER_MAX;
    var late = F.printTiming(iso, { pd: j.pd, cd: j.cd }).state === 'late'; // expedite is OK to drop onto
    return !over && !overCap && !late;
  }

  /* ---------------- THE TWO MOVES ---------------- */
  // A PROJECT (unplaced rail item). iso === null ejects back to the rail.
  function place(key, iso) {
    var p = byKey(key);
    if (!p) return false;
    if (iso === null || iso === undefined) delete PLACED[key];
    else PLACED[key] = iso;
    rebuildReserved();
    render();
    return true;
  }
  // A FEED JOB (already on the schedule). iso === its origin resets it. It never
  // leaves the board — a committed job is always ON some day — so there is no
  // null/eject here, only a move to another day (or back home).
  function moveFeed(key, iso) {
    var j = FEED_BYKEY[key];
    if (!j || !iso) return false;
    var from = j.__cur;
    if (from === iso) return false;
    var fromDay = BOARD.load[from];
    if (fromDay && Array.isArray(fromDay.jobs)) {
      var ix = fromDay.jobs.indexOf(j);
      if (ix >= 0) fromDay.jobs.splice(ix, 1);
      fromDay.minutes = Math.max(0, (Number(fromDay.minutes) || 0) - (Number(j.m) || 0));
    }
    if (!BOARD.load[iso]) BOARD.load[iso] = { minutes: 0, station: 'Standard', jobs: [] };
    if (!Array.isArray(BOARD.load[iso].jobs)) BOARD.load[iso].jobs = [];
    BOARD.load[iso].jobs.push(j);
    BOARD.load[iso].minutes = (Number(BOARD.load[iso].minutes) || 0) + (Number(j.m) || 0);
    j.__cur = iso;
    render();
    return true;
  }
  function resetFeed(key) { var j = FEED_BYKEY[key]; if (j) moveFeed(key, j.__origin); }
  function resetAllFeed() {
    Object.keys(FEED_BYKEY).forEach(function (k) { var j = FEED_BYKEY[k]; if (feedMoved(j)) moveFeed(k, j.__origin); });
  }

  /* ---------------- day state ---------------- */
  function dayState(iso) {
    var d = F.dayInfo(BOARD, iso);
    var mine = placedOn(iso);
    var inBuffer = d.minutes > d.plan && d.minutes <= d.cap;
    var overCap = d.minutes > d.cap;
    var overChangeover = d.imprints > F.RULES.CHANGEOVER_MAX;
    var late = mine.filter(function (p) { return F.printTiming(iso, { pd: p.prodDue, cd: p.custDue }).state === 'late'; });
    var lateFeed = feedJobsOn(iso).filter(function (j) { return feedMoved(j) && F.printTiming(iso, { pd: j.pd, cd: j.cd }).state === 'late'; });
    var readyDays = F.bizBetween(BOARD.today, iso);
    return {
      iso: iso, d: d, mine: mine,
      inBuffer: inBuffer, overCap: overCap, overChangeover: overChangeover,
      late: late, lateFeed: lateFeed,
      bufferUsed: inBuffer ? d.minutes - d.plan : 0,
      broken: overCap || overChangeover || late.length > 0 || lateFeed.length > 0,
      readyDays: readyDays,
      tight: (mine.length > 0 || feedJobsOn(iso).some(feedMoved)) && readyDays < F.RULES.READINESS_DAYS,
      inLead: iso < F.bizAdd(BOARD.today, BOARD.minLead)
    };
  }

  /* ---------------- rendering ---------------- */
  function render() {
    try { renderRail(); renderWeekNav(); renderWeek(); renderFeedReset(); } catch (e) { warn(e); }
  }

  function renderFeedReset() {
    var b = $('sp-resetfeed'); if (!b) return;
    b.disabled = !anyFeedMoved();
  }

  function renderRail() {
    var rail = $('sp-rail');
    var un = PROJECTS.filter(function (p) { return !PLACED[p.key]; });
    $('sp-railn').textContent = '(' + un.length + ')';
    if (!PROJECTS.length) {
      rail.innerHTML = '<div class="muted">Drop a Queue CSV to load unplaced projects.</div>';
      return;
    }
    if (!un.length) { rail.innerHTML = '<div class="muted">Everything is on a day.</div>'; return; }
    rail.innerHTML = un.map(function (p) {
      var legal = allLegal(p);
      var earliest = legal.length ? legal[0] : null;
      var cls = 'proj' + (SEL === p.key ? ' sel' : '') + (earliest ? '' : ' stuck');
      var meta = p.need + ' min · ' + esc(p.qty) + ' pcs';
      // DUE dates are CONTEXT, never a recommendation. prodDue is the Power
      // Scheduler "Prod. Due" — the date the job is aiming for, which can be a
      // day the job cannot even fit. So it is labelled a due date, plainly, and
      // the green "recommended" treatment lives on the fit-days below instead.
      // Production due is the print deadline AND context; no derived "must print
      // by" any more (the flat shipping assumption is gone — re-key 2026-09-18).
      var due = p.prodDue ? '<div class="pdue">Production due: ' + esc(F.fmt(p.prodDue)) + '</div>' : '';
      var cust = p.custDue ? '<div class="pdue">Client due: ' + esc(F.fmt(p.custDue)) + '</div>' : '';
      var rec;
      if (earliest) {
        var days = legal.map(function (d) { return esc(F.fmt(d).replace(/^\w+,\s*/, '')); });
        rec = '<div class="prec">Earliest day that holds it: ' + esc(F.fmt(earliest)) + '</div>' +
          '<div class="pall">All available days: <b>' + days.join('</b>, <b>') + '</b></div>';
      } else {
        rec = '<div class="pwarn">Nowhere legal on or before its production due — every day breaks a rule.</div>';
      }
      return '<div class="' + cls + '" draggable="true" data-key="' + esc(p.key) + '">' +
        '<div class="pid">' + esc(p.imprintId) + '</div>' +
        '<div class="pnick" title="' + esc(p.jobName) + '">' + esc(p.jobName) + '</div>' +
        '<div class="pmeta">' + meta + '</div>' +
        due + cust + rec +
        (p.alreadyOnBoard && p.alreadyOnBoard.length
          ? '<div class="pwarn">Invoice already on the board ' + esc(F.fmt(p.alreadyOnBoard[0].iso)) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function renderWeekNav() {
    var lbl = $('sp-weeklabel'); if (!lbl) return;
    var days = weekDays(WEEK_MON);
    if (!days.length) { lbl.textContent = 'No press days this week'; }
    else {
      var a = days[0], b = days[days.length - 1];
      lbl.innerHTML = 'Week of <b>' + esc(F.fmt(WEEK_MON)) + '</b> · ' +
        esc(F.fmt(a).replace(/^\w+, /, '')) + ' – ' + esc(F.fmt(b).replace(/^\w+, /, ''));
    }
    var first = DAYS.length ? mondayOf(DAYS[0]) : WEEK_MON;
    var last = DAYS.length ? mondayOf(DAYS[DAYS.length - 1]) : WEEK_MON;
    var prev = $('sp-prev'), next = $('sp-next');
    if (prev) prev.disabled = WEEK_MON <= first;
    if (next) next.disabled = WEEK_MON >= last;
  }

  function renderWeek() {
    var wk = $('sp-week');
    var days = weekDays(WEEK_MON);
    if (!days.length) { wk.innerHTML = '<div class="muted" style="padding:1rem">No press days in this week. Step to another week.</div>'; return; }
    wk.innerHTML = days.map(function (iso) {
      var s = dayState(iso);
      var d = s.d;
      var base = Math.max(0, d.minutes - d.reserved);
      var loadPct = Math.min(100, Math.round(base / d.cap * 100));
      var propPct = Math.min(100 - loadPct, Math.round(d.reserved / d.cap * 100));
      var planMark = Math.round(d.plan / d.cap * 100);
      var tier = base === 0 ? '' : (Math.round(base / d.cap * 100) >= 100 ? ' full'
        : Math.round(base / d.cap * 100) >= 70 ? ' limited' : '');
      var candidate = (SEL && evalFor(byKey(SEL), iso).legal) ||
        (SELFEED && FEED_BYKEY[SELFEED] && feedPreview(FEED_BYKEY[SELFEED], iso));

      var tags = '';
      if (d.ot) tags += '<span class="tag ot">OT</span>';
      if (s.inLead) tags += '<span class="tag lead">lead</span>';
      if (d.beyondBoard) tags += '<span class="tag tail">past the board</span>';

      var jobs = '';
      // what the schedule already carries — MOVABLE (Tier A). Box FILL is one
      // shared vocabulary (v3.4): RED = real failure (over cap/changeover, or
      // at/past the client date) · PURPLE = expedite (prints past prod due but
      // ships → "needs N-day"; or on-schedule expedite headroom, no badge) ·
      // BLUE = wiggle (on schedule, room to move) · neutral = locked. Detail in
      // the hover. "moved" is a ring + pill, never a fill.
      feedJobsOn(iso).forEach(function (j) {
        var moved = feedMoved(j);
        var mv = F.moveKind(iso, { pd: j.pd, cd: j.cd });
        var pt = F.printTiming(iso, { pd: j.pd, cd: j.cd });
        var state = boxState(pt.state === 'late', pt, mv);
        var cls = 'job feed' + (SELFEED === j.__k ? ' sel' : '') + (moved ? ' moved' : '') + state;
        var flag = pt.state === 'late' ? ' ⚠'
          : pt.state === 'expedite' ? ' <span class="exp-b">needs ' + esc(F.expediteLabel(pt.level)) + '</span>' : '';
        jobs += '<div class="' + cls + '" draggable="true" data-feedkey="' + esc(j.__k) + '" title="' + esc(hoverFor(j, pt, mv, moved)) + '">' +
          (moved ? '<span class="jx" data-reset="' + esc(j.__k) + '" title="put it back on ' + esc(F.fmt(j.__origin)) + '">↩</span>' : '') +
          esc(j.id) + ' · ' + j.m + 'm' +
          (moved ? ' <span class="mv">moved</span>' : '') +
          flag + '</div>';
      });
      // the scratchpad's own rail placements — same vocabulary, + a green "placed"
      // ring & pill (mirrors the indigo "moved" ring & pill on a rescheduled feed job).
      s.mine.forEach(function (p) {
        var ev = evalFor(p, iso);
        var mv = F.moveKind(iso, { pd: p.prodDue, cd: p.custDue });
        var red = ev.broken.length > 0;
        var state = boxState(red, ev.timing, mv);
        var flag = red ? ' ⚠'
          : ev.timing.state === 'expedite' ? ' <span class="exp-b">needs ' + esc(F.expediteLabel(ev.timing.level)) + '</span>' : '';
        var title = red ? ev.broken.join(' · ') : hoverFor({ pd: p.prodDue, cd: p.custDue }, ev.timing, mv, false);
        jobs += '<div class="job mine placed' + (SEL === p.key ? ' sel' : '') + state + '" draggable="true" data-key="' +
          esc(p.key) + '" title="' + esc(title) + '"><span class="jx" data-eject="' + esc(p.key) + '" title="take it off this day">✕</span>' +
          esc(p.imprintId) + ' · ' + p.need + 'm <span class="pl">placed</span>' + flag + '</div>';
      });

      var broke = '';
      if (s.broken) {
        var reasons = [];
        if (s.overCap) reasons.push('More than the day holds: ' + d.minutes + ' of ' + d.cap + ' minutes.');
        if (s.overChangeover) reasons.push('Over the changeover cap: ' + d.imprints + ' imprints, the cap is ' + F.RULES.CHANGEOVER_MAX + '.');
        s.late.forEach(function (p) {
          reasons.push(esc(p.imprintId) + ' is at or past its client date (' + (p.custDue ? F.fmt(p.custDue) : '—') + ') — will not make it even overnight.');
        });
        s.lateFeed.forEach(function (j) {
          reasons.push(esc(j.id) + ' is at or past its client date (' + (j.cd ? F.fmt(j.cd) : '—') + ') — will not make it even overnight.');
        });
        broke = '<div class="broke">' + reasons.map(esc).join('<br>') + '</div>';
      }

      var cond = '';
      if (s.inBuffer && !s.overCap) {
        cond += '<div class="cond buf">This puts the day into its <b>buffer</b> — ' + s.bufferUsed +
          ' of the ' + d.buffer + ' minutes held back for things running long. It holds, ' +
          'and the cushion is what absorbs a job that overruns.</div>';
      }
      if (s.tight) {
        cond += '<div class="cond">This is ' + s.readyDays + ' business day' + (s.readyDays === 1 ? '' : 's') +
          ' out. Blanks, films and a burn cycle would all have to be arranged deliberately. ' +
          'If production is told today, it is possible.</div>';
      }
      if (d.ot && (s.mine.length || feedJobsOn(iso).some(feedMoved))) {
        cond += '<div class="cond">This day is already on overtime — someone made that call ahead of time. ' +
          'You are filling a decision, not empty space. Planned to ' + d.plan + ', capped at ' + d.cap + '.</div>';
      }

      return '<div class="day' + (s.broken ? ' broken' : s.inBuffer ? ' buffered' : '') + (s.inLead ? ' lead' : '') +
        (candidate ? ' cand' : '') + '" data-iso="' + iso + '">' +
        '<div class="dh"><div class="dd">' + esc(F.fmt(iso)) + '</div>' +
        '<div class="tags">' + tags + '</div>' +
        '<div class="meter"><i class="load' + tier + '" style="width:' + loadPct + '%"></i>' +
          (propPct > 0 ? '<i class="prop" style="width:' + propPct + '%"></i>' : '') +
          '<u class="planline" style="left:' + planMark + '%" title="the plan line — past here is buffer"></u></div>' +
        '<div class="nums"><span><b class="' + (s.overCap ? 'over' : s.inBuffer ? 'buf' : '') + '">' + d.minutes +
          '</b> / ' + d.plan + (s.inBuffer || s.overCap ? ' <i>(holds ' + d.cap + ')</i>' : '') + ' min</span>' +
        '<span><b' + (s.overChangeover ? ' class="over"' : '') + '>' + d.imprints + '</b> / ' + F.RULES.CHANGEOVER_MAX + ' imp</span></div>' +
        '</div><div class="body">' + jobs + '</div>' + broke + cond + '</div>';
    }).join('');
  }

  /* A job's hover DETAIL (item 2), phrased as information not instruction — show,
     don't solve. pt = printTiming (ok/expedite/late). When the job is past its
     production due the timing read leads (needs overnight / N-day, or a true
     miss); when it is on schedule the movability reads lead (wiggle / expedite
     room). j = {pd, cd}; mv from moveKind; moved bool. */
  /* The box FILL class from the shared move/timing reads (v3.4):
       red (a real failure) → bad
       past prod due but ships → exp (purple, + a "needs N-day" badge elsewhere)
       on schedule + wiggle → wiggle (blue)
       on schedule + expedite headroom only → exp-room (purple, no badge)
       else neutral. */
  function boxState(red, pt, mv) {
    if (red) return ' bad';
    if (pt.state === 'expedite') return ' exp';
    if (mv.wiggle) return ' wiggle';
    if (mv.expedite) return ' exp-room';
    return '';
  }

  function hoverFor(j, pt, mv, moved) {
    var parts = [];
    if (pt.state === 'late') {
      parts.push('At or past its client date' + (j.cd ? ' (' + F.fmt(j.cd) + ')' : '') + ' — will not make it even overnight.');
    } else if (pt.state === 'expedite') {
      parts.push('Prints after its production due' + (j.pd ? ' (' + F.fmt(j.pd) + ')' : '') +
        ' — needs ' + F.expediteLabel(pt.level) + ' shipping to hit the client date' + (j.cd ? ' (' + F.fmt(j.cd) + ')' : '') +
        '. The PM and production manager coordinate.');
    } else {
      if (mv.wiggle) parts.push('Wiggle room: ' + mv.ps + ' business day' + (mv.ps === 1 ? '' : 's') +
        ' before its production due' + (j.pd ? ' (' + F.fmt(j.pd) + ')' : '') + '.');
      if (mv.expedite) parts.push('Room to expedite: client due is ' + mv.ship + ' business days after the production due.');
      if (!mv.movable) parts.push('Locked to this day — no room before its production due' + (j.pd ? ' (' + F.fmt(j.pd) + ')' : '') + '.');
    }
    if (moved) parts.push('Moved from ' + F.fmt(j.__origin) + '.');
    return parts.join(' ');
  }

  /* ---------------- loading ---------------- */
  function loadGauge() {
    setStatus('Reading the availability gauge…');
    return fetch(GAUGE_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('gauge feed returned ' + r.status); return r.json(); })
      .then(function (feed) { applyFeed(feed); });
  }

  // Split out so the headless harness can feed a fixture without a network call.
  function applyFeed(feed) {
    feed = feed || {};
    // DEEP CLONE the load: feed-job moves mutate it, and nothing we touch here
    // is ever written back, but we still keep our hands off the source object.
    var clone = JSON.parse(JSON.stringify(feed));
    BOARD = F.buildBoard(clone);
    // tag every feed job with a stable key + its origin day, and index it
    FEED_BYKEY = {};
    var n = 0;
    Object.keys(BOARD.load).forEach(function (iso) {
      var jobs = BOARD.load[iso].jobs;
      if (!Array.isArray(jobs)) return;
      jobs.forEach(function (j) { j.__k = 'f' + (n++); j.__origin = iso; j.__cur = iso; FEED_BYKEY[j.__k] = j; });
    });
    var last = BOARD.lastLoadedDay || BOARD.today;
    var end = F.bizAdd(BOARD.today, WEEKS_OUT);
    if (F.bizAdd(last, 3) > end) end = F.bizAdd(last, 3);
    DAYS = [];
    var iso = F.addDays(BOARD.today, 1), guard = 0;
    while (iso <= end && guard++ < 300) { if (F.isBiz(iso)) DAYS.push(iso); iso = F.addDays(iso, 1); }
    BOARD.reserved = {};
    WEEK_MON = clampWeek(DAYS.length ? mondayOf(DAYS[0]) : mondayOf(BOARD.today));
    if (!weekDays(WEEK_MON).length) stepWeekSilently(1);
    var stamp = $('sp-stamp'); if (stamp) stamp.textContent = 'gauge ' + (feed.asOf || 'unknown');
    setStatus('Gauge loaded — schedule is built out to ' +
      (BOARD.lastLoadedDay ? F.fmt(BOARD.lastLoadedDay) : 'nothing scheduled') +
      '. Days after that are genuinely empty, not missing. The jobs already on the schedule are draggable too.');
    render();
  }
  function stepWeekSilently(delta) {
    var mon = WEEK_MON, guard = 0;
    while (guard++ < 30 && !weekDays(mon).length) {
      var next = clampWeek(F.addDays(mon, delta * 7));
      if (next === mon) break;
      mon = next;
    }
    WEEK_MON = mon;
  }

  function ingest(text) {
    var rows = window.PA_QUEUE_CSV.readAll(text);
    var made = [], skipped = 0;
    rows.forEach(function (r, i) {
      var e = window.PA_ESTIMATE.estimate({
        jobName: r.nickname, imprintId: r.imprint, product: r.product, colors: r.colors,
        qty: r.qty, ink: r.ink, pallet: r.pallet, postType: r.postType,
        inkChange: r.inkChange, station: r.station
      });
      if (e.status !== 'OK' || e.workType !== 'screen_print' || e.press === 'manual') { skipped++; return; }
      var meta = F.placeProject(BOARD, {
        imprintId: r.imprint, jobName: r.nickname, need: e.total, qty: r.qty,
        custDue: r.custDue, prodDue: r.prodDue
      });
      made.push({
        key: r.imprint + '#' + i,
        imprintId: r.imprint, jobName: r.nickname, qty: r.qty,
        // prodDue is the print deadline (re-key 2026-09-18); custDue is context.
        need: Math.ceil(e.total), prodDue: r.prodDue, custDue: r.custDue,
        lane: meta.lane, alreadyOnBoard: meta.alreadyOnBoard || null
      });
    });
    PROJECTS = made; PLACED = {}; SEL = null; SELFEED = null;
    BOARD.reserved = {};
    setStatus(made.length + ' project(s) loaded' +
      (skipped ? ' · ' + skipped + ' not shown (manual press, heat press, post production or incomplete — the gauge carries auto-press load only)' : '') +
      '. Click one then click a day, or drag it. The scheduled jobs move too.');
    render();
  }

  /* ---------------- interaction ----------------
     Drag and click both end at place() or moveFeed(). Nothing else moves. */
  function wire() {
    var week = $('sp-week'), rail = $('sp-rail');

    // -- click path (first class) --
    rail.addEventListener('click', function (e) {
      var el = e.target.closest('.proj'); if (!el) return;
      SEL = (SEL === el.dataset.key) ? null : el.dataset.key; SELFEED = null;
      render();
    });
    week.addEventListener('click', function (e) {
      var reset = e.target.closest('[data-reset]');
      if (reset) { resetFeed(reset.dataset.reset); return; }
      var x = e.target.closest('[data-eject]');
      if (x) { place(x.dataset.eject, null); return; }
      var feed = e.target.closest('.job.feed');
      if (feed) { SELFEED = (SELFEED === feed.dataset.feedkey) ? null : feed.dataset.feedkey; SEL = null; render(); return; }
      var job = e.target.closest('.job.mine');
      if (job) { SEL = (SEL === job.dataset.key) ? null : job.dataset.key; SELFEED = null; render(); return; }
      var day = e.target.closest('.day');
      if (day) {
        if (SEL) { place(SEL, day.dataset.iso); SEL = null; render(); }
        else if (SELFEED) { moveFeed(SELFEED, day.dataset.iso); SELFEED = null; render(); }
      }
    });

    // -- drag path -- (dataTransfer is typed: "proj:<key>" or "feed:<key>")
    function onDragStart(e) {
      var el = e.target.closest('[data-key],[data-feedkey]'); if (!el) return;
      var tag;
      if (el.dataset.feedkey) { SELFEED = el.dataset.feedkey; SEL = null; tag = 'feed:' + SELFEED; }
      else { SEL = el.dataset.key; SELFEED = null; tag = 'proj:' + SEL; }
      try { e.dataTransfer.setData('text/plain', tag); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    }
    rail.addEventListener('dragstart', onDragStart);
    week.addEventListener('dragstart', onDragStart);

    week.addEventListener('dragover', function (e) {
      var day = e.target.closest('.day'); if (!day) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
      var ok = false;
      if (SEL) { var p = byKey(SEL); ok = !!p && evalFor(p, day.dataset.iso).placeable; }
      else if (SELFEED) { var j = FEED_BYKEY[SELFEED]; ok = !!j && feedPreview(j, day.dataset.iso); }
      else return;
      day.classList.toggle('drop-ok', ok);
      day.classList.toggle('drop-bad', !ok);
    });
    week.addEventListener('dragleave', function (e) {
      var day = e.target.closest('.day'); if (day) day.classList.remove('drop-ok', 'drop-bad');
    });
    week.addEventListener('drop', function (e) {
      var day = e.target.closest('.day'); if (!day) return;
      e.preventDefault();
      var raw = ''; try { raw = e.dataTransfer.getData('text/plain'); } catch (_) {}
      dispatchDrop(raw, day.dataset.iso);
      SEL = null; SELFEED = null; render();
    });

    // drag a rail PROJECT back onto the rail = eject. A feed job cannot be
    // ejected (it is always on some day); dropping one on the rail is a no-op.
    rail.addEventListener('dragover', function (e) { e.preventDefault(); });
    rail.addEventListener('drop', function (e) {
      e.preventDefault();
      var raw = ''; try { raw = e.dataTransfer.getData('text/plain'); } catch (_) {}
      if (raw.slice(0, 5) === 'proj:') place(raw.slice(5), null);
      else if (SEL) place(SEL, null);
      SEL = null; SELFEED = null; render();
    });

    // -- CSV --
    var drop = $('sp-drop'), file = $('sp-file');
    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('drag');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        window.PA_QUEUE_CSV.readFile(e.dataTransfer.files[0]).then(ingest).catch(warn);
      }
    });
    file.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) {
        window.PA_QUEUE_CSV.readFile(e.target.files[0]).then(ingest).catch(warn);
      }
    });

    var reload = $('sp-reload'); if (reload) reload.addEventListener('click', function () { loadGauge().catch(bad); });
    var clear = $('sp-clear'); if (clear) clear.addEventListener('click', function () { PLACED = {}; SEL = null; SELFEED = null; rebuildReserved(); render(); });
    var rf = $('sp-resetfeed'); if (rf) rf.addEventListener('click', function () { resetAllFeed(); });
    var prev = $('sp-prev'); if (prev) prev.addEventListener('click', function () { stepWeek(-1); });
    var next = $('sp-next'); if (next) next.addEventListener('click', function () { stepWeek(1); });
  }
  function dispatchDrop(raw, iso) {
    if (raw.slice(0, 5) === 'feed:') moveFeed(raw.slice(5), iso);
    else if (raw.slice(0, 5) === 'proj:') place(raw.slice(5), iso);
    else if (SELFEED) moveFeed(SELFEED, iso);
    else if (SEL) place(SEL, iso);
  }

  function bad(e) {
    setStatus('Could not read the availability gauge (' + (e && e.message ? e.message : e) +
      '). Nothing was changed.');
    warn(e);
  }

  /* ---------------- boot ----------------
     Runs on injection. Wrapped so a throw here can never reach the gauge. */
  try {
    F = window.PA_FIT;
    if (!F) throw new Error('PA_FIT (fit-core.js) not loaded');
    wire();
    if (window.PA_ESTIMATE && window.PA_ESTIMATE.loadRates) window.PA_ESTIMATE.loadRates().catch(function () {});
    loadGauge().catch(bad);
    // exposed for the headless harness + the page's flip loader
    window.__SCRATCH = {
      place: place, moveFeed: moveFeed, resetFeed: resetFeed, resetAllFeed: resetAllFeed,
      applyFeed: applyFeed, ingest: ingest, stepWeek: stepWeek,
      evalFor: function (k, iso) { return evalFor(byKey(k), iso); },
      feedPreview: function (k, iso) { return feedPreview(FEED_BYKEY[k], iso); },
      dayState: dayState, board: function () { return BOARD; }, week: function () { return WEEK_MON; },
      state: function () { return { placed: PLACED, sel: SEL, selFeed: SELFEED, days: DAYS, projects: PROJECTS, feedByKey: FEED_BYKEY, weekMon: WEEK_MON }; }
    };
  } catch (e) { warn(e); }
})();
