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

  /* ---------- our own CSV parser (the page's parseCSV is off limits) ---------- */
  function parseCsvOwn(text) {
    text = String(text || '').replace(/^﻿/, '');
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1)
      .filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); })
      .map(function (r) {
        var o = {};
        head.forEach(function (h, i) { o[h] = r[i] !== undefined ? r[i] : ''; });
        return o;
      });
  }
  function col(o, names) {
    for (var n = 0; n < names.length; n++) {
      var want = names[n].toLowerCase().replace(/[\s.]/g, '');
      for (var k in o) {
        if (k.toLowerCase().replace(/[\s.]/g, '') === want) return String(o[k] || '').trim();
      }
    }
    return '';
  }
  function ingestCsvText(text) {
    var rows = parseCsvOwn(text), map = {};
    rows.forEach(function (o) {
      var imp = PA_FIT.normImprint(col(o, ['Imprint']));
      if (!imp) return;
      map[imp] = {
        imprint: imp,
        prodDue: col(o, ['Prod. Due', 'Prod Due']),
        custDue: col(o, ['Cust. Due', 'Cust Due', 'Customer Due']),
        prodDate: col(o, ['Prod. Date', 'Prod Date']),
        station: col(o, ['Station']),
        blanks: col(o, ['Blanks']),
        nickname: col(o, ['Nickname'])
      };
    });
    CSV_BY_IMPRINT = map;
    CSV_STAMP = Date.now();
    var el = $('adv-csv');
    if (el) {
      el.textContent = rows.length
        ? 'Due dates read from the CSV for ' + Object.keys(map).length + ' imprint(s).'
        : 'No rows found in that CSV.';
    }
  }
  function readFileForAdvisor(f) {
    try {
      var rd = new FileReader();
      rd.onload = function () { try { ingestCsvText(rd.result); } catch (e) { advWarn(e); } };
      rd.readAsText(f);
    } catch (e) { advWarn(e); }
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

  function blindSpots() {
    return '<div class="adv-blind"><b>I could not check:</b> ' +
      F.BLIND_SPOTS.map(esc).join(' · ') + '.</div>';
  }

  function projectCard(res, r) {
    var h = '<div class="adv-card">';
    h += '<div class="adv-head"><span class="adv-id">' + esc(r.imprintId || '(no imprint)') + '</span> ' +
      '<span class="adv-nick">' + esc(r.jobName || '') + '</span>' +
      '<span class="adv-need">' + Math.ceil(r.total) + ' min · ' + esc(r.qty) + ' pcs</span>' +
      laneBadge(res.lane) + '</div>';

    if (res.custDue) {
      h += '<div class="adv-why">Client due ' + esc(F.fmt(res.custDue)) +
        (res.latestPrint ? ' → latest it can print and still ship normally is <b>' + esc(F.fmt(res.latestPrint)) + '</b>' : '') +
        '.</div>';
    }
    res.notes.forEach(function (n) { h += '<div class="adv-why">' + esc(n) + '</div>'; });

    if (res.candidates.length) {
      if (res.lane === 1) {
        h += '<div class="adv-why">There is no pressure on this one — the schedule does not reach its latest print day yet. ' +
          'Put it at the end.</div>';
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
    h += blindSpots();
    return h + '</div>';
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

      var placed = 0, lane3 = 0;
      ok.forEach(function (r) {
        if (r.workType !== 'screen_print') {
          html += skipped(r, r.workType === 'heat_press'
            ? 'Heat press. The availability feed carries auto-press load only, so there is no denominator to place this against.'
            : 'Post production. The availability feed carries auto-press load only, so there is no denominator to place this against.');
          return;
        }
        if (r.press === 'manual') {
          html += skipped(r, 'Manual press. It runs in parallel with the auto press and has no capacity feed of its own.');
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
          F.reserve(board, res.candidates[0].iso, res.need, 1);
        }
        html += projectCard(res, r);
      });

      status.textContent = ok.length + ' projected row(s) · ' + placed + ' placed · ' + lane3 + ' with nowhere to go';
      out.innerHTML = html;
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
