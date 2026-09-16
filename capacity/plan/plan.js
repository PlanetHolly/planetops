/* ============================================================================
   SCHEDULING ADVISOR v2 — the interactive week.
   A scratchpad with the rules enforced. NOT a solver.

   SHOW, DO NOT SOLVE. Choosing what to eject and where it lands is a cascading
   search: expensive, hard to trust, and it takes the judgement off the person
   holding it. The moment the human does the moving it becomes live
   recalculation, which is cheap and honest. So: this file never moves anything
   by itself. It may say "these days would hold it"; every move is Jean's.

   🔑 EVERY move goes through ONE function: place(key, iso). Drag-and-drop and
   click-project-then-click-day both call it, and iso === null is an eject.
   The click path is a first-class interaction, not a test affordance — it is
   faster in an actual jam and it is the accessible one.

   Rules come from ../../estimator/fit-core.js. Nothing here re-implements one.
   Minutes come from ../../estimator/estimate.js, the same engine the Estimator
   and the Schedule board use. The Queue CSV is read by the shared
   ../../estimator/queue-csv.js — there is no second parser.

   ⚠ capacity/index.html is NOT touched by this file. It is the project-manager
   facing gauge; its render() is a full teardown that runs on boot, so a throw
   in a layer hooked into it would blank the calendar for every PM.

   ⚠ NOTHING IS COMMITTED. No write to Printavo, no write to the gauge feed, no
   override saved. Printavo is still the schedule.
   ========================================================================== */
(function () {
  'use strict';

  var GAUGE_URL = 'https://primary-production-079f9.up.railway.app/webhook/gauge';
  var WEEKS_OUT = 20;          // business days of runway drawn past today

  var F = null;                 // PA_FIT
  var BOARD = null;
  var PROJECTS = [];            // everything read from the CSV that we can place
  var PLACED = {};              // key -> iso   (the entire scratchpad state)
  var SEL = null;               // selected project key
  var DAYS = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function warn(e) { try { console.warn('[plan]', e && e.message ? e.message : e); } catch (_) {} }
  function setStatus(s) { var el = $('status'); if (el) el.textContent = s; }

  /* ---------------- board + reservations ----------------
     BOARD.reserved is rebuilt from PLACED every time, never mutated
     incrementally. PLACED is the single source of truth for the scratchpad, so
     the board can never drift away from what is on screen. */
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

  /* Evaluate a project against a day AS IF it were not already placed anywhere,
     so moving a job onto the day it is already on does not count it twice. */
  function evalFor(p, iso) {
    rebuildReserved(p.key);
    var ev = F.evaluateDay(BOARD, iso, p.need, p.custDue, BOARD.today);
    rebuildReserved();
    var broken = [];
    // Three bands. Only past the CAP is a refusal — the plan..cap band is the
    // day's deliberate buffer and spending it is allowed, just never silent.
    if (ev.band === 'over') {
      broken.push('more than the day holds — ' + ev.after + ' of ' + ev.day.cap + ' minutes');
    }
    if (ev.capState === 'over') {
      broken.push('over the changeover cap — ' + (ev.day.imprints + 1) + ' imprints, the cap is ' +
        F.RULES.CHANGEOVER_MAX);
    }
    if (p.latestPrint && iso > p.latestPrint) {
      broken.push('past its own latest print day (' + F.fmt(p.latestPrint) + ')');
    }
    ev.broken = broken;
    ev.legal = broken.length === 0;
    return ev;
  }

  function anywhereLegal(p) {
    for (var i = 0; i < DAYS.length; i++) if (evalFor(p, DAYS[i]).legal) return DAYS[i];
    return null;
  }

  /* ---------------- THE ONE MOVE ----------------
     iso === null ejects back to the rail. Nothing else in this file writes
     PLACED. It never refuses a move: the human is allowed to create a mess and
     look at it — the rules are shown, not enforced by veto. */
  function place(key, iso) {
    var p = byKey(key);
    if (!p) return false;
    if (iso === null || iso === undefined) delete PLACED[key];
    else PLACED[key] = iso;
    rebuildReserved();
    render();
    return true;
  }

  /* ---------------- day state ---------------- */
  function dayState(iso) {
    var d = F.dayInfo(BOARD, iso);
    var mine = placedOn(iso);
    var inBuffer = d.minutes > d.plan && d.minutes <= d.cap;   // allowed, must be said
    var overCap = d.minutes > d.cap;                            // refused
    var overChangeover = d.imprints > F.RULES.CHANGEOVER_MAX;
    var late = mine.filter(function (p) { return p.latestPrint && iso > p.latestPrint; });
    var readyDays = F.bizBetween(BOARD.today, iso);
    return {
      iso: iso, d: d, mine: mine,
      inBuffer: inBuffer, overCap: overCap, overChangeover: overChangeover, late: late,
      bufferUsed: inBuffer ? d.minutes - d.plan : 0,
      broken: overCap || overChangeover || late.length > 0,
      readyDays: readyDays,
      tight: mine.length > 0 && readyDays < F.RULES.READINESS_DAYS,
      inLead: iso < F.bizAdd(BOARD.today, BOARD.minLead)
    };
  }

  /* ---------------- rendering ---------------- */
  function render() {
    try { renderRail(); renderWeek(); renderBlind(); } catch (e) { warn(e); }
  }

  function renderRail() {
    var rail = $('rail');
    var un = PROJECTS.filter(function (p) { return !PLACED[p.key]; });
    $('railn').textContent = '(' + un.length + ')';
    if (!PROJECTS.length) {
      rail.innerHTML = '<div class="muted">Drop a Queue CSV to load projects.</div>';
      return;
    }
    if (!un.length) { rail.innerHTML = '<div class="muted">Everything is on a day.</div>'; return; }
    rail.innerHTML = un.map(function (p) {
      var target = anywhereLegal(p);
      var cls = 'proj' + (SEL === p.key ? ' sel' : '') + (target ? '' : ' stuck');
      var meta = p.need + ' min · ' + esc(p.qty) + ' pcs';
      var dates = (p.prodDue ? 'wants ' + F.fmt(p.prodDue) : '') +
        (p.latestPrint ? (p.prodDue ? ' · ' : '') + 'must print by ' + F.fmt(p.latestPrint) : '');
      return '<div class="' + cls + '" draggable="true" data-key="' + esc(p.key) + '">' +
        '<div class="pid">' + esc(p.imprintId) + '</div>' +
        '<div class="pnick" title="' + esc(p.jobName) + '">' + esc(p.jobName) + '</div>' +
        '<div class="pmeta">' + meta + '</div>' +
        '<div class="pmeta">' + esc(dates) + '</div>' +
        (target
          ? '<div class="pmeta">earliest day that holds it: <b>' + esc(F.fmt(target)) + '</b></div>'
          : '<div class="pwarn">Nowhere legal in this range — every day breaks a rule.</div>') +
        (p.alreadyOnBoard && p.alreadyOnBoard.length
          ? '<div class="pwarn">Invoice already on the board ' + esc(F.fmt(p.alreadyOnBoard[0].iso)) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function renderWeek() {
    var wk = $('week');
    wk.innerHTML = DAYS.map(function (iso) {
      var s = dayState(iso);
      var d = s.d;
      // The meter runs to the CAP so the buffer zone is visible, with a marker
      // at the plan line. Anything past the marker is cushion being spent.
      var base = Math.max(0, d.minutes - d.reserved);
      var loadPct = Math.min(100, Math.round(base / d.cap * 100));
      var propPct = Math.min(100 - loadPct, Math.round(d.reserved / d.cap * 100));
      var planMark = Math.round(d.plan / d.cap * 100);
      var tier = base === 0 ? '' : (Math.round(base / d.cap * 100) >= 100 ? ' full'
        : Math.round(base / d.cap * 100) >= 70 ? ' limited' : '');
      var candidate = SEL && evalFor(byKey(SEL), iso).legal;

      var tags = '';
      if (d.ot) tags += '<span class="tag ot">OT</span>';
      if (s.inLead) tags += '<span class="tag lead">lead</span>';
      if (d.beyondBoard) tags += '<span class="tag tail">past the board</span>';

      var jobs = '';
      // what the schedule already carries — read only, it is not ours to move
      d.jobs.forEach(function (j) {
        jobs += '<div class="job" title="on the schedule already">' + esc(j.id) + ' · ' + j.m + 'm</div>';
      });
      // the scratchpad's own placements — movable
      s.mine.forEach(function (p) {
        var ev = evalFor(p, iso);
        jobs += '<div class="job mine' + (SEL === p.key ? ' sel' : '') + '" draggable="true" data-key="' +
          esc(p.key) + '"><span class="jx" data-eject="' + esc(p.key) + '" title="take it off this day">✕</span>' +
          esc(p.imprintId) + ' · ' + p.need + 'm' + (ev.legal ? '' : ' ⚠') + '</div>';
      });

      var broke = '';
      if (s.broken) {
        var reasons = [];
        if (s.overCap) reasons.push('More than the day holds: ' + d.minutes + ' of ' + d.cap + ' minutes.');
        if (s.overChangeover) reasons.push('Over the changeover cap: ' + d.imprints + ' imprints, the cap is ' + F.RULES.CHANGEOVER_MAX + '.');
        s.late.forEach(function (p) {
          reasons.push(esc(p.imprintId) + ' is past its own latest print day (' + F.fmt(p.latestPrint) + ').');
        });
        broke = '<div class="broke">' + reasons.map(esc).join('<br>') + costHint(s) + '</div>';
      }

      var cond = '';
      // The buffer band. Allowed, never silent — and in a jam it is often the
      // right call, because spending the cushion is what the cushion is for.
      if (s.inBuffer && !s.overCap) {
        cond += '<div class="cond buf">This puts the day into its <b>buffer</b> — ' + s.bufferUsed +
          ' of the ' + d.buffer + ' minutes held back for things running long. It holds, ' +
          'and the cushion is what absorbs a job that overruns.</div>';
      }
      // += not =. An earlier version assigned here and silently wiped the buffer
      // caption above it, which broke the "allowed, never silent" rule.
      // Shown even when the day is broken: the readiness condition is a separate
      // fact and a job dragged in here still needs to be told.
      if (s.tight) {
        cond += '<div class="cond">This is ' + s.readyDays + ' business day' + (s.readyDays === 1 ? '' : 's') +
          ' out. Blanks, films and a burn cycle would all have to be arranged deliberately. ' +
          'If production is told today, it is possible.</div>';
      }
      if (d.ot && s.mine.length) {
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

  /* When a day is over, show what is on it and what each job would cost to move.
     We do NOT pick. Which tier yields is a human decision. */
  function costHint(s) {
    if (!s.d.jobs.length && !s.mine.length) return '';
    var lines = s.d.jobs.slice(0, 4).map(function (j) {
      var slack = j.cd ? F.bizBetween(s.iso, j.cd) : null;
      var cost = slack == null ? 'no client date on it'
        : slack >= F.RULES.SHIP_DAYS ? 'could move later for free (' + slack + ' bd of headroom)'
        : slack > 0 ? 'only ' + slack + ' bd of headroom — moving it means expedited shipping'
        : 'already at or past its client date — moving it costs the date';
      return esc(j.id) + ': ' + cost;
    });
    if (!lines.length) return '';
    return '<div style="font-weight:400;color:var(--pa-tonal);margin-top:.3rem">' +
      'On this day already:<br>' + lines.join('<br>') +
      '<br><i>Pick what comes off. When every move costs something, that is not mine to decide.</i></div>';
  }

  function renderBlind() {
    $('blind').innerHTML = '<b>I could not check:</b> ' + F.BLIND_SPOTS.map(esc).join(' · ') + '.';
  }

  /* ---------------- loading ---------------- */
  function loadGauge() {
    setStatus('Reading the availability gauge…');
    return fetch(GAUGE_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('gauge feed returned ' + r.status); return r.json(); })
      .then(function (feed) {
        BOARD = F.buildBoard(feed);
        var last = BOARD.lastLoadedDay || BOARD.today;
        var end = F.bizAdd(BOARD.today, WEEKS_OUT);
        if (F.bizAdd(last, 3) > end) end = F.bizAdd(last, 3);
        DAYS = [];
        var iso = F.addDays(BOARD.today, 1), guard = 0;
        while (iso <= end && guard++ < 300) { if (F.isBiz(iso)) DAYS.push(iso); iso = F.addDays(iso, 1); }
        BOARD.reserved = {};
        $('stamp').textContent = 'gauge ' + (feed.asOf || 'unknown');
        setStatus('Gauge loaded — schedule is built out to ' +
          (BOARD.lastLoadedDay ? F.fmt(BOARD.lastLoadedDay) : 'nothing scheduled') +
          '. Days after that are genuinely empty, not missing.');
        render();
      });
  }

  function ingest(text) {
    var rows = PA_QUEUE_CSV.readAll(text);
    var made = [], skipped = 0;
    rows.forEach(function (r, i) {
      var e = window.PA_ESTIMATE.estimate({
        jobName: r.nickname, imprintId: r.imprint, product: r.product, colors: r.colors,
        qty: r.qty, ink: r.ink, pallet: r.pallet, postType: r.postType,
        inkChange: r.inkChange, station: r.station
      });
      // auto press only: the gauge feed carries no manual / heat / post load,
      // so there is no denominator to place those against. Named, not hidden.
      if (e.status !== 'OK' || e.workType !== 'screen_print' || e.press === 'manual') { skipped++; return; }
      var meta = F.placeProject(BOARD, {
        imprintId: r.imprint, jobName: r.nickname, need: e.total, qty: r.qty,
        custDue: r.custDue, prodDue: r.prodDue
      });
      made.push({
        key: r.imprint + '#' + i,
        imprintId: r.imprint, jobName: r.nickname, qty: r.qty,
        need: Math.ceil(e.total), prodDue: r.prodDue, custDue: r.custDue,
        latestPrint: meta.latestPrint, lane: meta.lane,
        alreadyOnBoard: meta.alreadyOnBoard || null
      });
    });
    PROJECTS = made; PLACED = {}; SEL = null;
    BOARD.reserved = {};
    setStatus(made.length + ' project(s) loaded' +
      (skipped ? ' · ' + skipped + ' not shown (manual press, heat press, post production or incomplete — the gauge carries auto-press load only)' : '') +
      '. Click one then click a day, or drag it.');
    render();
  }

  /* ---------------- interaction ----------------
     Drag and click both end at place(). Nothing else moves anything. */
  function wire() {
    var week = $('week'), rail = $('rail');

    // -- click path (first class) --
    rail.addEventListener('click', function (e) {
      var el = e.target.closest('.proj'); if (!el) return;
      var k = el.dataset.key;
      SEL = (SEL === k) ? null : k;
      render();
    });
    week.addEventListener('click', function (e) {
      var x = e.target.closest('[data-eject]');
      if (x) { place(x.dataset.eject, null); return; }
      var job = e.target.closest('.job.mine');
      if (job) { SEL = (SEL === job.dataset.key) ? null : job.dataset.key; render(); return; }
      var day = e.target.closest('.day');
      if (day && SEL) { place(SEL, day.dataset.iso); SEL = null; render(); }
    });

    // -- drag path --
    function onDragStart(e) {
      var el = e.target.closest('[data-key]'); if (!el) return;
      SEL = el.dataset.key;
      try { e.dataTransfer.setData('text/plain', el.dataset.key); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    }
    rail.addEventListener('dragstart', onDragStart);
    week.addEventListener('dragstart', onDragStart);

    week.addEventListener('dragover', function (e) {
      var day = e.target.closest('.day'); if (!day) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
      var p = SEL && byKey(SEL);
      if (!p) return;
      var ok = evalFor(p, day.dataset.iso).legal;
      day.classList.toggle('drop-ok', ok);
      day.classList.toggle('drop-bad', !ok);
    });
    week.addEventListener('dragleave', function (e) {
      var day = e.target.closest('.day'); if (day) day.classList.remove('drop-ok', 'drop-bad');
    });
    week.addEventListener('drop', function (e) {
      var day = e.target.closest('.day'); if (!day) return;
      e.preventDefault();
      var k = ''; try { k = e.dataTransfer.getData('text/plain'); } catch (_) {}
      place(k || SEL, day.dataset.iso);
      SEL = null; render();
    });

    // drag back onto the rail = eject
    rail.addEventListener('dragover', function (e) { e.preventDefault(); });
    rail.addEventListener('drop', function (e) {
      e.preventDefault();
      var k = ''; try { k = e.dataTransfer.getData('text/plain'); } catch (_) {}
      place(k || SEL, null); SEL = null; render();
    });

    // -- CSV --
    var drop = $('drop'), file = $('file');
    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('drag');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        PA_QUEUE_CSV.readFile(e.dataTransfer.files[0]).then(ingest).catch(warn);
      }
    });
    file.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) {
        PA_QUEUE_CSV.readFile(e.target.files[0]).then(ingest).catch(warn);
      }
    });

    $('reload').addEventListener('click', function () { loadGauge().catch(bad); });
    $('clear').addEventListener('click', function () { PLACED = {}; SEL = null; rebuildReserved(); render(); });
  }

  function bad(e) {
    setStatus('Could not read the availability gauge (' + (e && e.message ? e.message : e) +
      '). Nothing was changed.');
    warn(e);
  }

  /* ---------------- boot ---------------- */
  try {
    F = window.PA_FIT;
    wire();
    if (window.PA_ESTIMATE && window.PA_ESTIMATE.loadRates) window.PA_ESTIMATE.loadRates().catch(function () {});
    loadGauge().catch(bad);
    // exposed for the headless harness: the same entry points the UI uses
    window.__PLAN = {
      place: place, state: function () { return { placed: PLACED, sel: SEL, days: DAYS, projects: PROJECTS }; },
      evalFor: function (k, iso) { return evalFor(byKey(k), iso); },
      dayState: dayState, ingest: ingest, board: function () { return BOARD; }
    };
  } catch (e) { warn(e); }
})();
