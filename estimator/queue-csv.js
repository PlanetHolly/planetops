/* ============================================================================
   PA QUEUE CSV — one reader for the Printavo Power Scheduler export.
   Loaded by the Estimator's Advisor panel AND by capacity/plan/. There must
   never be a second parser: the two surfaces have to agree on what a row says.

   Deliberately its own parser rather than the Estimator page's `parseCSV` —
   that function is inside the inline block that owns the Google Sheets
   writeback and is not to be touched, called or depended on.

   What the Queue export actually carries (verified against real exports):
     Nickname · Imprint · Prod. Date · Prod. Due · Cust. Due · Quantity ·
     Project Type · Screen Count · Ink/Application Type · Ink Change · Pallet ·
     Post Production Type · Films · Burn Screens · Blanks · Inks ·
     Press Check · Setup · Printing / Heat Application · Post Production ·
     Minutes · Station · Invoice Status
   In a QUEUE view export, Prod. Date / Station / Minutes are blank — the
   station is chosen in Printavo after the Calculator. A full board export has
   them filled. Column ORDER varies between exports, so every lookup is by name.
   ========================================================================== */
(function (g) {
  'use strict';

  function parse(text) {
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

  // Name lookup that ignores spacing and dots, so "Prod. Due" == "Prod Due".
  function col(o, names) {
    for (var n = 0; n < names.length; n++) {
      var want = names[n].toLowerCase().replace(/[\s.]/g, '');
      for (var k in o) {
        if (k.toLowerCase().replace(/[\s.]/g, '') === want) return String(o[k] == null ? '' : o[k]).trim();
      }
    }
    return '';
  }

  function normImprint(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* One CSV row, normalised. Keeps the raw row so a caller can reach a column
     this shape does not name yet. */
  function readRow(o) {
    return {
      imprint:   normImprint(col(o, ['Imprint'])),
      nickname:  col(o, ['Nickname']),
      qty:       col(o, ['Quantity']),
      product:   col(o, ['Project Type']),
      colors:    col(o, ['Screen Count']),
      ink:       col(o, ['Ink/Application Type', 'Ink / Application Type']),
      inkChange: col(o, ['Ink Change']),
      pallet:    col(o, ['Pallet']),
      postType:  col(o, ['Post Production Type']),
      station:   col(o, ['Station']),
      prodDate:  col(o, ['Prod. Date', 'Prod Date']),
      prodDue:   col(o, ['Prod. Due', 'Prod Due']),
      custDue:   col(o, ['Cust. Due', 'Cust Due', 'Customer Due']),
      blanks:    col(o, ['Blanks']),
      minutes:   col(o, ['Minutes']),
      status:    col(o, ['Invoice Status']),
      raw: o
    };
  }

  function readAll(text) { return parse(text).map(readRow); }

  // imprint -> row, for joining against anything keyed by the Imprint string.
  function byImprint(text) {
    var m = {};
    readAll(text).forEach(function (r) { if (r.imprint) m[r.imprint] = r; });
    return m;
  }

  function readFile(file) {
    return new Promise(function (res, rej) {
      try {
        var rd = new FileReader();
        rd.onload = function () { try { res(String(rd.result || '')); } catch (e) { rej(e); } };
        rd.onerror = function () { rej(new Error('could not read that file')); };
        rd.readAsText(file);
      } catch (e) { rej(e); }
    });
  }

  g.PA_QUEUE_CSV = {
    parse: parse, col: col, normImprint: normImprint,
    readRow: readRow, readAll: readAll, byImprint: byImprint, readFile: readFile
  };
})(typeof window !== 'undefined' ? window : this);
