/* ============================================================================
   SCHEDULING ADVISOR — "where does this project fit?"
   Loaded LAST, after the page's inline <script>, deliberately in its own file.
   Everything below runs inside one IIFE with try/catch: if this file throws,
   the CSV import, Quick Estimate and the Save-to-Calculator path are untouched.

   ⚠ This file NEVER touches postSave, WEBHOOK_URL, WRITEBACK_PAUSED, the save
   button handler, parseCSV, render(), draw() or estimate.js. It READS the
   inline script's `lastResults` binding (a script-scope `let` — visible to a
   later classic script by bare name, but NOT present on window) and it attaches
   its OWN extra listeners to #file and #drop. addEventListener is additive: the
   page's existing handlers still run, first, unchanged.

   Why the extra listeners: render() keeps only ten CSV columns and Prod. Due /
   Cust. Due are not among them — but the whole question "where does this fit"
   starts from the client date. So we parse the same File a second time, on our
   own, and join to lastResults on the Imprint string.
   ========================================================================== */
(function () {
  'use strict';

  var GAUGE_URL = 'https://primary-production-079f9.up.railway.app/webhook/gauge';
  var FEED_TTL_MS = 5 * 60 * 1000;

  var CSV_BY_IMPRINT = {};   // normalised Imprint -> the raw CSV row we care about
  var CSV_STAMP = 0;
  var feedCache = null, feedAt = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- Queue CSV: the SHARED reader (estimator/queue-csv.js) ----------
     Lifted out of this file 2026-09-16 so capacity/plan/ reads the same export
     exactly the same way. There must never be a second parser. The page's own
     parseCSV stays untouched and unused — it lives in the inline block that
     owns the Google Sheets writeback. */
  function ingestCsvText(text) {
    var map = PA_QUEUE_CSV.byImprint(text);
    var n = Object.keys(map).length;
    CSV_BY_IMPRINT = map;
    CSV_STAMP = Date.now();
    var el = $('adv-csv');
    if (el) {
      el.textContent = n
        ? 'Due dates read from the CSV for ' + n + ' imprint(s).'
        : 'No rows found in that CSV.';
    }
  }
  function readFileForAdvisor(f) {
    PA_QUEUE_CSV.readFile(f)
      .then(function (t) { try { ingestCsvText(t); } catch (e) { advWarn(e); } })
      .catch(advWarn);
  }
  function advWarn(e) {
    try { console.warn('[advisor]', e && e.message ? e.message : e); } catch (_) {}
  }

  /* ---------- the gauge feed ---------- */
  function loadFeed() {
    if (feedCache && (Date.now() - feedAt) < FEED_TTL_MS) return Promise.resolve(feedCache);
    return fetch(GAUGE_URL, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('gauge feed returned ' + r.status);
      return r.json();
    }).then(function (d) { feedCache = d; feedAt = Date.now(); return d; });
  }

  /* ---------- reading the page's results without touching them ---------- */
  function readResults() {
    try {
      // bare identifier on purpose: `let lastResults` is script-scope, not window.
      return (typeof lastResults !== 'undefined' && Array.isArray(lastResults)) ? lastResults : [];
    } catch (e) { return []; }
  }

  /* ---------- rendering ---------- */
  var F = null; // PA_FIT, resolved at click time

  function laneBadge(lane) {
    if (lane === 1) return '<span class="adv-lane l1">1 · it can wait</span>';
    if (lane === 2) return '<span class="adv-lane l2">2 · must fit inside the schedule</span>';
    if (lane === 3) return '<span class="adv-lane l3">3 · fits nowhere</span>';
    return '<span class="adv-lane l0">not placed</span>';
  }

  function candidateLine(c) {
    var d = c.day;
    var bits = [];
    bits.push('<b>' + esc(F.fmt(c.iso)) + '</b>');
    if (c.beyondBoard && !d.reserved) bits.push('nothing scheduled there yet');
    else if (c.band === 'buffer') bits.push('into the day\'s buffer — ' + c.bufferUsed + ' of ' + d.buffer + ' cushion minutes');
    else bits.push(c.room + ' of ' + d.plan + ' min free' +
      (d.reserved ? ' (' + d.reserved + ' of it already given to rows above)' : ''));
    bits.push(d.imprints + (d.imprints === 1 ? ' imprint' : ' imprints') + ' on it'
      + (d.invoices && d.invoices !== d.imprints ? ' (' + d.invoices + ' invoice' + (d.invoices === 1 ? '' : 's') + ')' : ''));
    bits.push(c.readyDays + ' business day' + (c.readyDays === 1 ? '' : 's') + ' out');
    if (c.shipHeadroom != null) {
      bits.push(c.shipHeadroom + ' bd of shipping headroom');
    }
    var html = '<li>' + bits.join(' · ') + ' → <b>' + c.pctAfter + '%</b> after';
    var tags = [];
    if (c.band === 'buffer') tags.push('<span class="adv-tag warn">spends the day\'s buffer</span>');
    if (c.ot) tags.push('<span class="adv-tag ot">OT DAY</span>');
    if (c.capState === 'over') tags.push('<span class="adv-tag bad">OVER the 4–5 changeover cap</span>');
    else if (c.capState === 'at') tags.push('<span class="adv-tag warn">at the changeover cap</span>');
    if (c.inLead) tags.push('<span class="adv-tag warn">inside the ' + (F.RULES.LEAD_DEFAULT) + '-day lead</span>');
    if (tags.length) html += ' ' + tags.join(' ');
    if (c.ot) {
      html += '<div class="adv-sub">This day is already on overtime. That call was made ahead of time — ' +
        'you are filling a decision someone else made, not empty space. Planned to ' + d.plan + ', capped at ' + d.cap + '.</div>';
    }
    if (c.capState === 'over') {
      html += '<div class="adv-sub">That would be ' + (d.imprints + 1) + ' imprints on one day. The cap is 4–5. ' +
        'Shown, not blocked — Jean is looking at real days before this starts refusing.</div>';
    }
    if (c.band === 'buffer') {
      html += '<div class="adv-sub tight">This puts the day into its buffer — ' + c.bufferUsed + ' of the ' +
        d.buffer + ' minutes held back for work running long. It holds, and in a jam that is what the ' +
        'cushion is for. Just do it knowingly.</div>';
    }
    if (c.tight) {
      html += '<div class="adv-sub tight">' + readinessSentence(c) + '</div>';
    }
    if (c.inLead && !c.tight) {
      html += '<div class="adv-sub">Inside the ' + F.RULES.LEAD_DEFAULT + '-business-day lead. That is a limit on what a ' +
        'project manager may promise a new client, not on where a paid job gets plotted. Fine here.</div>';
    }
    return html + '</li>';
  }

  /* The readiness sentence. This is the product: it converts a surprise into a
     plan and leaves the decision with a person. Do not turn it into a refusal. */
  function readinessSentence(c) {
    var n = c.readyDays;
    return esc(F.fmt(c.iso)) + ' has ' + c.room + ' minutes free and would hold this. It is ' +
      n + ' business day' + (n === 1 ? '' : 's') + ' out. Blanks, films and a burn cycle would all have to be ' +
      'arranged deliberately. If production is told today, it is possible.';
  }

  function moveLine(m) {
    return '<li><b>' + esc(m.id) + '</b> on ' + esc(F.fmt(m.from)) + ' could move to <b>' + esc(F.fmt(m.to)) +
      '</b> and still land ' + m.headroomAfter + ' business day' + (m.headroomAfter === 1 ? '' : 's') +
      ' before its client date. That frees <b>' + m.minutes + ' minutes</b> on ' + esc(F.fmt(m.from)) + '.</li>';
  }
  function costedLine(m) {
    return '<li><b>' + esc(m.id) + '</b> on ' + esc(F.fmt(m.from)) + ' could move to ' + esc(F.fmt(m.to)) +
      ', but it ' + esc(m.cost) + '. That is a cost, so it is not mine to spend.</li>';
  }

  /* ---------- the day strip ----------
     Fifteen text blocks have no shape, and the one thing that must be obvious is
     FOUR PLACEMENTS PILED ONTO ONE DAY AND NOTHING ON THE NEXT. That reads wrong
     instantly as a picture and is invisible in a list. It is also the visible proof
     that reserve-as-you-go is working.
     Colour language is the availability gauge's own — same green/amber/red tiers,
     and the same striped sky blue the gauge uses for "held, not booked", which is
     exactly what a proposal is. A second vocabulary for the same idea would cost
     Rosa something and buy nothing. */
  function tierOf(minutes, cap) {
    if (!minutes) return 'empty';
    var pct = Math.round(minutes / cap * 100);
    return pct >= 100 ? 'full' : pct >= 70 ? 'limited' : 'open';
  }
  function dayStrip(board, proposals) {
    var last = board.lastLoadedDay || F.addDays(board.today, 1);
    Object.keys(proposals).forEach(function (k) { if (k > last) last = k; });
    var days = [], iso = F.addDays(board.today, 1), guard = 0;
    while (iso <= last && guard++ < 200) { if (F.isBiz(iso)) days.push(iso); iso = F.addDays(iso, 1); }
    if (!days.length) return '';

    var anyProposed = false;
    var cells = days.map(function (d) {
      var info = F.dayInfo(board, d);
      var prop = proposals[d] || [];
      if (prop.length) anyProposed = true;
      var base = Math.max(0, info.minutes - info.reserved);
      var plan = info.plan;
      var baseH = Math.min(100, Math.round(base / plan * 100));
      var propH = Math.min(100 - baseH, Math.round(info.reserved / plan * 100));
      var over = (base + info.reserved) > plan;
      var t = tierOf(base, info.cap);
      var title = F.fmt(d) + ' — ' + base + ' min already scheduled' +
        (info.reserved ? ', ' + info.reserved + ' min proposed here (' + prop.map(function (p) { return p.id; }).join(', ') + ')' : '') +
        ' · plan ' + plan + ' · ' + info.imprints + ' imprint(s)';
      return '<div class="ds-day' + (over ? ' over' : '') + (info.ot ? ' ot' : '') +
        (F.isBiz(F.addDays(d, 1)) ? '' : ' weekend-next') + '" title="' + esc(title) + '">' +
        '<div class="ds-bar">' +
          '<div class="ds-fill t-' + t + '" style="height:' + baseH + '%"></div>' +
          (propH > 0 ? '<div class="ds-prop" style="height:' + propH + '%"></div>' : '') +
        '</div>' +
        '<div class="ds-n">' + (prop.length ? '+' + prop.length : '') + '</div>' +
        '<div class="ds-lab">' + esc(F.fmt(d).replace(/^(\w+), \w+ /, '$1 ')) + '</div>' +
        (info.ot ? '<div class="ds-ot">OT</div>' : '') +
      '</div>';
    }).join('');

    return '<div class="adv-strip">' +
      '<div class="ds-title">The week you are building</div>' +
      '<div class="ds-row">' + cells + '</div>' +
      '<div class="ds-legend">' +
        '<span><i class="sw t-open"></i> open</span>' +
        '<span><i class="sw t-limited"></i> limited</span>' +
        '<span><i class="sw t-full"></i> full</span>' +
        '<span><i class="sw sw-prop"></i> proposed here — not placed</span>' +
        '<span><i class="sw sw-over"></i> would go past the day\'s plan</span>' +
        '<span>bars are measured against the day\'s plan (' + F.RULES.PLAN.Standard + ' / ' + F.RULES.PLAN.OT + ' on OT)</span>' +
      '</div>' +
      (anyProposed ? '' : '<div class="adv-sub">Nothing was proposed onto a day — every row either had no room or is not on the auto press.</div>') +
    '</div>';
  }

  function blindSpots() {
    return '<div class="adv-blind"><b>I could not check:</b> ' +
      F.BLIND_SPOTS.map(esc).join(' · ') + '.</div>';
  }

  /* The two PRODUCTION dates. Jean's language, and it is also what stops the card
     being misread: "must print by Oct 1" cannot be heard as an offer the way
     "latest it can print is Oct 1" could. Prod. Due is what the job INTENDS to
     print; the computed latest print is the physical limit before shipping has to
     be expedited. When they disagree the computed one wins, and the gap between
     them is the real slack - so both are shown. Client due is derivation, not lead. */
  function prodDateLine(res) {
    if (!res.latestPrint && !res.prodDue) return '';
    var bits = [];
    if (res.prodDue) bits.push('Wants <b>' + esc(F.fmt(res.prodDue)) + '</b>');
    if (res.latestPrint) bits.push('must print by <b>' + esc(F.fmt(res.latestPrint)) + '</b>');
    var h = '<div class="adv-dates">' + bits.join(' · ') + '</div>';
    if (res.prodDue && res.latestPrint) {
      var gap = F.bizBetween(res.prodDue, res.latestPrint);
      if (gap > 0) h += '<div class="adv-sub">' + gap + ' business day' + (gap === 1 ? '' : 's') +
        ' of slack between the date it intends to print and the last date it physically can.</div>';
      else if (gap < 0) h += '<div class="adv-sub warnrow">Its production date is <b>' + (-gap) +
        ' business day' + (gap === -1 ? '' : 's') + ' past</b> the last day it can print and still ship normally. ' +
        'The computed limit wins.</div>';
      else h += '<div class="adv-sub">No slack — the date it intends to print is the last one it can.</div>';
    }
    return h;
  }

  function verdict(res) {
    if (res.lane === 3) {
      return '<div class="adv-verdict no"><span class="vmark">✕</span><span class="vtext">No room</span>' +
        '<span class="vsub">' + esc(shortRefusal(res)) + '</span></div>';
    }
    var c = res.candidates[0];
    return '<div class="adv-verdict ok"><span class="vmark">✓</span>' +
      '<span class="vtext">Print ' + esc(F.fmt(c.iso)) + '</span>' +
      '<span class="vsub">' + (res.lane === 1 ? 'it can wait — placed at the end of the schedule'
        : 'fitted into the built schedule') + '</span></div>';
  }
  function shortRefusal(res) {
    if (res.moves.length) return 'but one free move would make room';
    if (/already passed/.test(res.refusal)) return 'the client date has already passed';
    if (/today or earlier/.test(res.refusal)) return 'it is already past the last day it could print';
    return 'nothing in the window has the minutes';
  }

  function projectCard(res, r) {
    var h = '<div class="adv-card' + (res.lane === 3 ? ' l3' : '') + '">';
    h += '<div class="adv-head"><span class="adv-id">' + esc(r.imprintId || '(no imprint)') + '</span> ' +
      '<span class="adv-nick">' + esc(r.jobName || '') + '</span>' +
      '<span class="adv-need">' + Math.ceil(r.total) + ' min · ' + esc(r.qty) + ' pcs</span>' +
      laneBadge(res.lane) + '</div>';

    // VERDICT FIRST. The eye must land on placed-or-not before any reasoning.
    h += verdict(res);
    h += prodDateLine(res);

    res.notes.forEach(function (n) { h += '<div class="adv-why">' + esc(n) + '</div>'; });

    if (res.candidates.length) {
      if (res.lane === 1) {
        h += '<div class="adv-why">No pressure on this one — the schedule does not reach its latest print day yet, ' +
          'so it goes at the end rather than eating slack someone else needs.</div>';
      } else {
        h += '<div class="adv-why">This has to land inside days that already have work on them. These have genuine room:</div>';
      }
      h += '<ol class="adv-cands">' + res.candidates.map(candidateLine).join('') + '</ol>';
    } else {
      h += '<div class="adv-refuse"><b>Nothing fits.</b> ' + esc(res.refusal) + '</div>';
      if (res.moves.length) {
        h += '<div class="adv-why">These moves are <b>free</b> — the displaced job still makes its own client date with ' +
          'shipping headroom intact, so nothing is sacrificed and nobody gets bad news:</div>';
        h += '<ul class="adv-moves">' + res.moves.map(moveLine).join('') + '</ul>';
        h += '<div class="adv-sub">One move, one level deep. If freeing that space needs a second displacement, I stop.</div>';
      } else if (res.costedMoves.length) {
        h += '<div class="adv-why">Every move I can see <b>costs something</b>, so it is a human decision, not mine:</div>';
        h += '<ul class="adv-moves costed">' + res.costedMoves.map(costedLine).join('') + '</ul>';
        h += moveOrder();
      } else {
        h += moveOrder();
      }
    }
    h += workingOut(res);
    h += blindSpots();
    return h + '</div>';
  }

  /* Client due lives here, behind a disclosure — it is how the limit was derived,
     not the thing to act on. Rosa acts on production dates. */
  function workingOut(res) {
    if (!res.custDue) return '';
    var h = '<details class="adv-work"><summary>How that print date was worked out</summary><div>';
    h += 'Client due <b>' + esc(F.fmt(res.custDue)) + '</b>. Normal shipping needs ' +
      F.RULES.SHIP_DAYS + ' business days, so the last day it can go on press is <b>' +
      esc(F.fmt(res.latestPrint)) + '</b>.';
    if (res.prodDue) h += ' Printavo\'s production due date on this row is ' + esc(F.fmt(res.prodDue)) + '.';
    h += ' Days are planned to ' + F.RULES.PLAN.Standard + ' of ' + F.RULES.CAP.Standard +
      ' minutes (' + F.RULES.PLAN.OT + ' of ' + F.RULES.CAP.OT + ' on an overtime day); the rest is held ' +
      'for teardown and changeover, which no estimate counts.';
    h += '</div></details>';
    return h;
  }

  function moveOrder() {
    return '<div class="adv-order"><b>The move order, in order:</b> ' +
      '<ol><li>The client-date conversation, through the project manager.</li>' +
      '<li>Absorb it on the manual press.</li>' +
      '<li>Take it to Holly.</li></ol>' +
      '<span class="adv-sub">Overtime is Holly\'s call and this tool does not spend it. ' +
      'Which tier yields is a human decision too.</span></div>';
  }

  function skipped(r, why) {
    return '<div class="adv-card skip"><div class="adv-head"><span class="adv-id">' + esc(r.imprintId || '(no imprint)') +
      '</span> <span class="adv-nick">' + esc(r.jobName || '') + '</span>' + laneBadge(0) + '</div>' +
      '<div class="adv-why">' + esc(why) + '</div></div>';
  }

  /* ---------- the run ---------- */
  function run() {
    var out = $('adv-out'), btn = $('adv-go'), status = $('adv-status');
    var rows = readResults();
    if (!rows.length) {
      status.textContent = 'Import a Power Scheduler CSV first — the Advisor reads the rows the Calculator already projected.';
      out.innerHTML = '';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Reading the availability gauge…';
    loadFeed().then(function (feed) {
      F = window.PA_FIT;
      var board = F.buildBoard(feed);
      var today = board.today;
      var haveCsv = Object.keys(CSV_BY_IMPRINT).length > 0;

      var ok = rows.filter(function (r) { return r.status === 'OK'; });
      var html = '';

      html += '<div class="adv-meta">Gauge as of <b>' + esc(board.asOf || 'unknown') + '</b>. ' +
        'The schedule is built out to <b>' + (board.lastLoadedDay ? esc(F.fmt(board.lastLoadedDay)) : 'nothing scheduled') +
        '</b>; days after that are genuinely empty, not missing. ' +
        'Standard days are planned to ' + F.RULES.PLAN.Standard + ' of ' + F.RULES.CAP.Standard +
        ' minutes, OT days to ' + F.RULES.PLAN.OT + ' of ' + F.RULES.CAP.OT +
        '. The held-back minutes are for teardown and changeover, which are in no estimate. ' +
        '<b>Each row below is answered as if the rows above it were placed on the day they were given</b>, ' +
        'so the same free hour is never handed to two projects.' +
        (haveCsv ? '' : ' <b>⚠ No due dates loaded</b> — re-drop the CSV so the Advisor can read Cust. Due.') +
        '</div>';

      var placed = 0, lane3 = 0, proposals = {}, cards = '';
      ok.forEach(function (r) {
        if (r.workType !== 'screen_print') {
          cards += skipped(r, r.workType === 'heat_press'
            ? 'Heat press. The availability feed carries auto-press load only, so there is no denominator to place this against.'
            : 'Post production. The availability feed carries auto-press load only, so there is no denominator to place this against.');
          return;
        }
        if (r.press === 'manual') {
          cards += skipped(r, 'Manual press. It runs in parallel with the auto press and has no capacity feed of its own.');
          return;
        }
        var key = F.normImprint(r.imprintId);
        var csv = CSV_BY_IMPRINT[key] || null;
        var res = F.placeProject(board, {
          imprintId: r.imprintId, jobName: r.jobName, need: r.total, qty: r.qty,
          custDue: csv ? csv.custDue : '', prodDue: csv ? csv.prodDue : ''
        });
        if (res.lane === 3) { lane3++; }
        else {
          placed++;
          // Spend the recommended day's minutes before the next row is answered, so
          // the batch cannot hand the same free hour to six different projects.
          var day = res.candidates[0].iso;
          F.reserve(board, day, res.need, 1);
          (proposals[day] || (proposals[day] = [])).push({ id: r.imprintId, min: res.need });
        }
        cards += projectCard(res, r);
      });

      status.textContent = ok.length + ' projected row(s) · ' + placed + ' placed · ' + lane3 + ' with nowhere to go';
      // strip is built AFTER the loop so it shows the final shape of the batch
      out.innerHTML = html + dayStrip(board, proposals) + cards;
      btn.disabled = false;
    }).catch(function (e) {
      status.textContent = 'Could not read the availability gauge (' + (e && e.message ? e.message : e) +
        '). Nothing was changed. Try again, or schedule from the gauge page directly.';
      btn.disabled = false;
      advWarn(e);
    });
  }

  /* ---------- wire up ---------- */
  try {
    var fileEl = $('file'), dropEl = $('drop'), goEl = $('adv-go');
    // ADDITIVE listeners. The page's own handlers were registered first and
    // still run first; an exception in ours cannot stop theirs.
    if (fileEl) fileEl.addEventListener('change', function (e) {
      try { if (e.target.files && e.target.files[0]) readFileForAdvisor(e.target.files[0]); } catch (err) { advWarn(err); }
    });
    if (dropEl) dropEl.addEventListener('drop', function (e) {
      try { if (e.dataTransfer && e.dataTransfer.files[0]) readFileForAdvisor(e.dataTransfer.files[0]); } catch (err) { advWarn(err); }
    });
    if (goEl) goEl.addEventListener('click', function () { try { run(); } catch (err) { advWarn(err); } });
  } catch (e) {
    advWarn(e);
  }
})();
