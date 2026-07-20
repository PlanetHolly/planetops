/* Planet Apparel — Front Door shell.
   Everything renders from registry.json — no content lives in this file.
   AUTH IS SERVER-SIDE: the frontdoor-gate service (gate/index.js, Codex-reviewed)
   challenges for the PIN before this page is served. No client gate here. */

const ENUMS = {
  kind: ['hub', 'surface'],
  group: ['hubs', 'library'],
  type: ['live-app', 'dashboard', 'system-map', 'tool', 'report', 'reference', 'training'],
  status: ['live', 'stale', 'wip', 'planned'],
  access: ['open', 'pin']
};
const BADGE = { live: 'LIVE', stale: 'STALE', wip: 'WIP', planned: 'PLANNED' };
const PINS_KEY = 'frontdoor.pins';
const DEFAULT_PINS = ['floor-board', 'schedule', 'command-center', 'qc-gate-form', 'signals', 'capacity', 'bandana-quote-team', 'apparel-quote-team'];

/* Registry URLs may only be same-origin paths or approved external domains —
   a bad registry edit must never send the team to a lookalike site. */
const APPROVED_EXTERNAL = ['https://docs.google.com/'];
function isAllowedUrl(u) {
  if (!u) return false;
  if (/^(\.\.?\/|\/(?!\/))/.test(u)) return true;                       // relative or root-relative, not //
  return APPROVED_EXTERNAL.some(pre => u.startsWith(pre));
}
function openUrl(u) {
  if (isAllowedUrl(u)) window.open(u, '_blank');
  else alert('Blocked: this registry URL is not on the approved list:\n' + u);
}

/* ── Branded circular icons (QuickBooks-style: bright glyph in a dark Ø circle) ──
   Marquee hubs + the Floor App get hand-built flat SVG glyphs; every other surface
   keeps its distinct emoji, rendered inside the same dark circle. */
const GLYPHS = {
  planetops:     '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3.5" fill="#F7BE00"/><circle cx="12" cy="12" r="3.2" fill="#232323"/></svg>',
  'revenue-house':'<svg viewBox="0 0 24 24"><path d="M12 4.5 20 14h-4.6v5.5H8.6V14H4z" fill="#10b981"/></svg>',
  planetiq:      '<svg viewBox="0 0 24 24"><rect x="4.5" y="12" width="3.6" height="7" rx="1" fill="#38bdf8"/><rect x="10.2" y="8" width="3.6" height="11" rx="1" fill="#38bdf8"/><rect x="15.9" y="5" width="3.6" height="14" rx="1" fill="#38bdf8"/></svg>',
  systems:       '<svg viewBox="0 0 24 24"><circle cx="9.5" cy="12" r="4.3" fill="none" stroke="#a78bfa" stroke-width="2.6"/><circle cx="14.5" cy="12" r="4.3" fill="none" stroke="#a78bfa" stroke-width="2.6"/></svg>',
  references:    '<svg viewBox="0 0 24 24"><path d="M12 6.5C10.3 5.6 6.7 5.6 5 6.3V18c1.7-.7 5.3-.7 7 .2z" fill="#fbbf24"/><path d="M12 6.5c1.7-.9 5.3-.9 7-.2V18c-1.7-.7-5.3-.7-7 .2z" fill="#fbbf24" opacity=".65"/></svg>',
  'time-labor':  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="#22d3ee" stroke-width="2.4"/><path d="M12 8.2V12l3 2" fill="none" stroke="#22d3ee" stroke-width="2.4" stroke-linecap="round"/></svg>',
  growth:        '<svg viewBox="0 0 24 24"><path d="M12 19v-7.5" stroke="#34d399" stroke-width="2.4" stroke-linecap="round"/><path d="M12 12.5C8 12.5 6.5 8 6.5 8c4 0 5.5 4.5 5.5 4.5z" fill="#34d399"/><path d="M12 13.5c3.5 0 4.8-3.2 4.8-3.2-3.6 0-4.8 3.2-4.8 3.2z" fill="#34d399" opacity=".8"/></svg>',
  brain:         '<svg viewBox="0 0 24 24"><path d="M8 9.5 16 9.5 12 16.5z" fill="none" stroke="#f472b6" stroke-width="1.6"/><circle cx="8" cy="9.5" r="2.1" fill="#f472b6"/><circle cx="16" cy="9.5" r="2.1" fill="#f472b6"/><circle cx="12" cy="16.5" r="2.1" fill="#f472b6"/></svg>',
  decisions:     '<svg viewBox="0 0 24 24"><path d="M12 5.5v6M12 11.5l-5 5M12 11.5l5 5" fill="none" stroke="#cbd5e1" stroke-width="2.4" stroke-linecap="round"/></svg>',
  floor:         '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="4" height="13" rx="1.4" fill="#F7BE00"/><rect x="10" y="5.5" width="4" height="8.5" rx="1.4" fill="#F7BE00"/><rect x="16" y="5.5" width="4" height="10.5" rx="1.4" fill="#F7BE00"/></svg>',
  guides:        '<svg viewBox="0 0 24 24"><path d="M6 5.5h7.2c2 0 3.6 1.6 3.6 3.6v9.4H9.6A3.6 3.6 0 0 1 6 14.9z" fill="#fbbf24"/><path d="M9.3 9h4.9M9.3 12h4.9" stroke="#232323" stroke-width="1.6" stroke-linecap="round"/></svg>',
  graphics:      '<svg viewBox="0 0 24 24"><rect x="4.5" y="5" width="15" height="12.5" rx="2.5" fill="#f472b6"/><circle cx="8.5" cy="9" r="1.7" fill="#fff"/><path d="M5 15.5l4.5-4.5 3 3 3.5-4 3.5 5.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  qc:            '<svg viewBox="0 0 24 24"><path d="M12 3.8l6.8 2.6v5.1c0 4-2.9 6.9-6.8 8.2-3.9-1.3-6.8-4.2-6.8-8.2V6.4z" fill="#4ade80"/><path d="M8.8 12.1l2.2 2.2 4.2-4.5" fill="none" stroke="#232323" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'qc-gate-form':'<svg viewBox="0 0 24 24"><rect x="5" y="3.6" width="14" height="16.8" rx="2.6" fill="#4ade80"/><path d="M8.4 8.6h7.2M8.4 12h7.2M8.4 15.4h4.2" fill="none" stroke="#232323" stroke-width="1.8" stroke-linecap="round"/></svg>',
  // ── Revenue House + Desks (QB-style: distinct bright glyph per surface) ──
  // Quote desks
  'apparel-quote-team':   '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" fill="#F7BE00"/></svg>',
  'apparel-mix-quote':    '<svg viewBox="0 0 24 24"><circle cx="9.5" cy="10" r="4.4" fill="#F7BE00"/><circle cx="14.5" cy="10" r="4.4" fill="#38bdf8" opacity=".9"/><circle cx="12" cy="15" r="4.4" fill="#f472b6" opacity=".9"/></svg>',
  'bandana-quote-team':   '<svg viewBox="0 0 24 24"><path d="M4 7.5h16l-8 10.5z" fill="#fb7185"/></svg>',
  'promo-quote-desk':     '<svg viewBox="0 0 24 24"><path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" fill="#a78bfa"/></svg>',
  'dtf-quote-desk':       '<svg viewBox="0 0 24 24"><path d="M12 4.5l8 13.5H4z" fill="#fb923c"/></svg>',
  'embroidery-quote-desk':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="#34d399" stroke-width="3.2"/></svg>',
  desks:                  '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="6" height="6" rx="1.6" fill="#38bdf8"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.6" fill="#38bdf8"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.6" fill="#38bdf8"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.6" fill="#38bdf8"/></svg>',
  'bandana-quoting-glance-card': '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="15" rx="2.2" fill="#fb7185"/><path d="M8 9h8l-4 5.5z" fill="#232323"/></svg>',
  'bandana-matrix-cheat-card': '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="15" rx="2.2" fill="#fbbf24"/><path d="M4.5 10h15M4.5 14.5h15M10 4.5v15M15 4.5v15" stroke="#232323" stroke-width="1.6"/></svg>',
  // Revenue House surfaces
  watchtower:         '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2" fill="none" stroke="#2dd4bf" stroke-width="2"/><circle cx="12" cy="12" r="2.6" fill="#2dd4bf"/></svg>',
  retention:          '<svg viewBox="0 0 24 24"><path d="M12 18.6S4.8 14.3 4.8 9.6A3.6 3.6 0 0 1 12 8.1a3.6 3.6 0 0 1 7.2 1.5c0 4.7-7.2 9-7.2 9z" fill="#f472b6"/></svg>',
  'command-center':   '<svg viewBox="0 0 24 24"><path d="M6 8h12M6 12h12M6 16h12" stroke="#c084fc" stroke-width="2.2" stroke-linecap="round"/><circle cx="9" cy="8" r="2.1" fill="#c084fc"/><circle cx="15.5" cy="12" r="2.1" fill="#c084fc"/><circle cx="10" cy="16" r="2.1" fill="#c084fc"/></svg>',
  'status-simulator': '<svg viewBox="0 0 24 24"><path d="M9 7l8 5-8 5z" fill="#38bdf8"/></svg>',
  signals:            '<svg viewBox="0 0 24 24"><rect x="5" y="13" width="3.2" height="5.5" rx="1" fill="#3b82f6"/><rect x="10.4" y="9" width="3.2" height="9.5" rx="1" fill="#3b82f6"/><rect x="15.8" y="5" width="3.2" height="13.5" rx="1" fill="#3b82f6"/></svg>',
  pricing:            '<svg viewBox="0 0 24 24"><path d="M4.5 4.5h7l8.5 8.5-7 7-8.5-8.5z" fill="#34d399"/><circle cx="8.3" cy="8.3" r="1.7" fill="#0b3d2e"/></svg>',
  'bandana-pricing':  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.6" fill="#fbbf24"/><path d="M12 7.4v9.2M9.9 9.6c0-1.1 1-1.8 2.1-1.8s2.1.7 2.1 1.8-1 1.6-2.1 1.6-2.1.6-2.1 1.7 1 1.8 2.1 1.8 2.1-.7 2.1-1.8" fill="none" stroke="#7c4a03" stroke-width="1.5" stroke-linecap="round"/></svg>',
  'apparel-matrix-review':'<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="#818cf8" stroke-width="2"/><path d="M5 10h14M5 14.3h14M10 5v14M14.3 5v14" stroke="#818cf8" stroke-width="1.4"/></svg>',
  'bandana-quote-fin':'<svg viewBox="0 0 24 24"><path d="M4 7.5h16l-8 10.5z" fill="none" stroke="#fb7185" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  'apparel-quote-calc':'<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="2.2" fill="#F7BE00"/><rect x="8" y="6.4" width="8" height="3" rx="1" fill="#232323"/><circle cx="9" cy="13" r="1.2" fill="#232323"/><circle cx="12" cy="13" r="1.2" fill="#232323"/><circle cx="15" cy="13" r="1.2" fill="#232323"/><circle cx="9" cy="16.6" r="1.2" fill="#232323"/><circle cx="12" cy="16.6" r="1.2" fill="#232323"/><circle cx="15" cy="16.6" r="1.2" fill="#232323"/></svg>',
  'bandana-pricing-desk':'<svg viewBox="0 0 24 24"><path d="M4 7.5h16l-8 10.5z" fill="#fda4af"/></svg>',
  'revenue-discovery':'<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.2" fill="none" stroke="#94a3b8" stroke-width="2.4"/><path d="M14.6 14.6l4 4" stroke="#94a3b8" stroke-width="2.4" stroke-linecap="round"/></svg>',
  // ── Production surfaces (batch 1) ──
  schedule:          '<svg viewBox="0 0 24 24"><rect x="4.5" y="6" width="15" height="13" rx="3" fill="#38bdf8"/><rect x="7.5" y="3.5" width="2" height="4.5" rx="1" fill="#0ea5e9"/><rect x="14.5" y="3.5" width="2" height="4.5" rx="1" fill="#0ea5e9"/><rect x="7.5" y="11" width="9" height="1.8" rx=".9" fill="#232323"/><rect x="7.5" y="14.5" width="6" height="1.8" rx=".9" fill="#232323"/></svg>',
  capacity:          '<svg viewBox="0 0 24 24"><path d="M4.5 17a7.5 7.5 0 0 1 15 0" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/><path d="M12 17l4.5-4" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.7" fill="#f59e0b"/></svg>',
  estimator:         '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="2.5" fill="#a78bfa"/><rect x="8.5" y="6.5" width="7" height="3" rx="1" fill="#232323"/><circle cx="9.5" cy="13" r="1.1" fill="#232323"/><circle cx="12" cy="13" r="1.1" fill="#232323"/><circle cx="14.5" cy="13" r="1.1" fill="#232323"/><circle cx="9.5" cy="16.5" r="1.1" fill="#232323"/><circle cx="12" cy="16.5" r="1.1" fill="#232323"/><circle cx="14.5" cy="16.5" r="1.1" fill="#232323"/></svg>',
  "priority-guide":  '<svg viewBox="0 0 24 24"><path d="M12 4.5l7.5 14h-15z" fill="#f87171"/><rect x="11" y="9.5" width="2" height="4.5" rx="1" fill="#232323"/><circle cx="12" cy="16.2" r="1.1" fill="#232323"/></svg>',
  rush:              '<svg viewBox="0 0 24 24"><path d="M13 3.5l-7.5 10H10l-1.5 7 8-10.5H11z" fill="#fb923c"/></svg>',
  boxes:             '<svg viewBox="0 0 24 24"><path d="M12 3.5l7.5 4.2v8.6L12 20.5 4.5 16.3V7.7z" fill="#d4a373"/><path d="M4.7 7.8L12 12l7.3-4.2M12 12v8.3" fill="none" stroke="#232323" stroke-width="1.5"/></svg>',
  "prod-flow-map":   '<svg viewBox="0 0 24 24"><path d="M6 6v5.5a3 3 0 0 0 3 3h6" fill="none" stroke="#2dd4bf" stroke-width="2.4"/><path d="M13 11l4 3.5-4 3.5" fill="none" stroke="#2dd4bf" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="5.5" r="2.2" fill="#2dd4bf"/></svg>',
  "graphics-suite":  '<svg viewBox="0 0 24 24"><rect x="4.5" y="5" width="15" height="12.5" rx="2.5" fill="#f472b6"/><circle cx="8.5" cy="9" r="1.7" fill="#fff"/><path d="M5 15.5l4.5-4.5 3 3 3.5-4 3.5 5.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  clock:             '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#22d3ee"/><path d="M12 7.5V12l3.2 2" fill="none" stroke="#232323" stroke-width="2.2" stroke-linecap="round"/></svg>',
  "timesheets-report":'<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="13" height="16" rx="2.2" fill="#60a5fa"/><path d="M8.5 9h7M8.5 12.2h7M8.5 15.4h4.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  "team-admin":      '<svg viewBox="0 0 24 24"><circle cx="9" cy="9.5" r="2.7" fill="#fbbf24"/><circle cx="15.6" cy="10" r="2.2" fill="#fbbf24"/><path d="M4.4 18c0-2.7 2.1-4.4 4.6-4.4s4.6 1.7 4.6 4.4" fill="none" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round"/><path d="M14.5 18c0-2 1.4-3.4 3.2-3.4S20.9 16 20.9 18" fill="none" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round"/></svg>',
  "screen-readiness":'<svg viewBox="0 0 24 24"><rect x="4.5" y="5" width="15" height="14" rx="2.5" fill="#c084fc"/><path d="M8.3 5v14M12 5v14M15.7 5v14M4.5 9h15M4.5 13h15" stroke="#232323" stroke-width="0.9" opacity=".6"/></svg>',
  // ── Revenue House surfaces ──
  "retention-map":   '<svg viewBox="0 0 24 24"><path d="M7 5v6a5 5 0 0 0 10 0V5h-3v6a2 2 0 0 1-4 0V5z" fill="#ef4444"/><rect x="7" y="4.3" width="3" height="2.6" fill="#e5e7eb"/><rect x="14" y="4.3" width="3" height="2.6" fill="#e5e7eb"/></svg>',
  "save-touch":      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="#f97316" stroke-width="3"/><circle cx="12" cy="12" r="2.8" fill="#f97316"/></svg>',
  "retention-playbook":'<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="13" height="16" rx="2" fill="#8b5cf6"/><path d="M13.5 4v7l2-1.4 2 1.4V4z" fill="#c4b5fd"/></svg>',
  "ship-estimate":   '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="10" height="7" rx="1" fill="#f59e0b"/><path d="M13 10h4l3 3v2h-7z" fill="#f59e0b"/><circle cx="7" cy="16.5" r="1.8" fill="#232323"/><circle cx="16.5" cy="16.5" r="1.8" fill="#232323"/></svg>',
  "retention-registry":'<svg viewBox="0 0 24 24"><rect x="4.5" y="6" width="15" height="12" rx="2" fill="#14b8a6"/><path d="M7.5 10h9M7.5 13h9M7.5 15.5h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
  // ── PlanetIQ surfaces ──
  "planetiq-panel":  '<svg viewBox="0 0 24 24"><path d="M4 17l5-5 3 3 7-8" fill="none" stroke="#38bdf8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19" cy="7" r="1.8" fill="#38bdf8"/></svg>',
  "pricing-dashboard":'<svg viewBox="0 0 24 24"><path d="M11 4h5l4 4v5l-8 8-9-9z" fill="#fbbf24"/><circle cx="15.3" cy="8.7" r="1.5" fill="#232323"/></svg>',
  "kpi-tracker":     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="#f43f5e" stroke-width="2.2"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="#f43f5e" stroke-width="2.2"/><circle cx="12" cy="12" r="1.3" fill="#f43f5e"/></svg>',
  "iq-data-layer":   '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="7" rx="7" ry="2.8" fill="#818cf8"/><path d="M5 7v10c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V7M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" fill="none" stroke="#818cf8" stroke-width="2"/></svg>',
  "invoice-tracker": '<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="13" height="16" rx="2" fill="#22c55e"/><path d="M12 8v8M14 10.3c0-1-1-1.5-2-1.5s-2 .5-2 1.4 1 1.3 2 1.5 2 .6 2 1.6-1 1.4-2 1.4-2-.5-2-1.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
  "employee-orders": '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="10" rx="2" fill="#f472b6"/><path d="M4 10.5h16" stroke="#232323" stroke-width="1.6"/><rect x="7" y="13" width="5" height="1.8" rx=".9" fill="#232323"/></svg>',
  // ── Growth surfaces ──
  "bandana-templates":'<svg viewBox="0 0 24 24"><path d="M12 5l7 7-7 7-7-7z" fill="#ec4899"/><path d="M9 12l3 3 3-3-3-3z" fill="#fff"/></svg>',
  "bandana-web-pricing":'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="#10b981"/><path d="M4.5 12h15M12 4.5c3 3 3 12 0 15M12 4.5c-3 3-3 12 0 15" fill="none" stroke="#fff" stroke-width="1.3"/></svg>',
  "photo-tagger":    '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="11" rx="2" fill="#0ea5e9"/><rect x="8.5" y="5" width="7" height="3" rx="1" fill="#0ea5e9"/><circle cx="12" cy="12.5" r="3" fill="#232323"/></svg>',
  "mockup-vs-real":  '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2" fill="#fb7185"/><path d="M12 6v12" stroke="#232323" stroke-width="1.6"/><circle cx="8" cy="10" r="1.3" fill="#fff"/></svg>',
  // ── Brain surfaces ──
  graphify:          '<svg viewBox="0 0 24 24"><circle cx="6" cy="8" r="2" fill="#22d3ee"/><circle cx="18" cy="8" r="2" fill="#22d3ee"/><circle cx="12" cy="17" r="2" fill="#22d3ee"/><circle cx="12" cy="9" r="2" fill="#22d3ee"/><path d="M6 8l6 1M18 8l-6 1M12 11v6" stroke="#22d3ee" stroke-width="1.3"/></svg>',
  "agentic-os":      '<svg viewBox="0 0 24 24"><rect x="5.5" y="7" width="13" height="11" rx="3" fill="#818cf8"/><circle cx="9.5" cy="12" r="1.6" fill="#232323"/><circle cx="14.5" cy="12" r="1.6" fill="#232323"/><path d="M12 4.5v2.5" stroke="#818cf8" stroke-width="2"/><circle cx="12" cy="4" r="1.3" fill="#818cf8"/></svg>',
  // ── Systems surfaces ──
  "order-flow-map":  '<svg viewBox="0 0 24 24"><path d="M5 6h6M5 6v12h6" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/><path d="M11 4l3 2-3 2M11 16l3 2-3 2" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "bandana-bot-map": '<svg viewBox="0 0 24 24"><path d="M4 6h16v10h-8l-4 3v-3H4z" fill="#2dd4bf"/><circle cx="8.5" cy="11" r="1.1" fill="#232323"/><circle cx="12" cy="11" r="1.1" fill="#232323"/><circle cx="15.5" cy="11" r="1.1" fill="#232323"/></svg>',
  planetpulse:       '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 3 10 2-6 2 3h5" fill="none" stroke="#f43f5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "planetpulse-audit":'<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="#f59e0b" stroke-width="2.4"/><path d="M14.5 14.5l4 4" stroke="#f59e0b" stroke-width="2.6" stroke-linecap="round"/></svg>',
  hashtags:          '<svg viewBox="0 0 24 24"><path d="M8 4l-1.5 16M15.5 4L14 20M4 9h16M3.5 15h16" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/></svg>',
  "state-api":       '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="12" height="6" rx="1.5" fill="#94a3b8"/><rect x="6" y="13" width="12" height="6" rx="1.5" fill="#94a3b8"/><circle cx="9" cy="8" r="1" fill="#232323"/><circle cx="9" cy="16" r="1" fill="#232323"/></svg>',
  "invoice-tracker-test":'<svg viewBox="0 0 24 24"><path d="M10 4v5l-4 8a2 2 0 0 0 1.8 3h8.4a2 2 0 0 0 1.8-3l-4-8V4" fill="#34d399"/><path d="M9 4h6" stroke="#232323" stroke-width="2" stroke-linecap="round"/></svg>',
  // ── Training surfaces ──
  "qc-gate":         '<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="13" height="16" rx="2" fill="#22c55e"/><path d="M8 9l1.4 1.4L12 8M8 14l1.4 1.4L12 13" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 9h3M13.5 14h3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
  "bandana-blanks":  '<svg viewBox="0 0 24 24"><path d="M4 5h2l2 9h9l2-6H7" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="18" r="1.6" fill="#f59e0b"/><circle cx="16" cy="18" r="1.6" fill="#f59e0b"/></svg>',
  "how-organized":   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#0ea5e9" stroke-width="2.2"/><path d="M12 12l4.5-4.5-2 6-6 2z" fill="#0ea5e9"/></svg>',
  "followup-gameplan":'<svg viewBox="0 0 24 24"><path d="M6 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2C11 19 5 13 5 6a2 2 0 0 1 1-2z" fill="#ec4899"/></svg>',
  // ── References surfaces ──
  "file-naming":     '<svg viewBox="0 0 24 24"><path d="M4 8a2 2 0 0 1 2-2h6l8 6-6 8-8-6z" fill="#38bdf8"/><circle cx="8.5" cy="9.5" r="1.4" fill="#232323"/></svg>',
  "feed-guide":      '<svg viewBox="0 0 24 24"><path d="M5 13v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4h-3.5a2.5 2.5 0 0 1-5 0z" fill="#10b981"/><path d="M12 4v7m0 0l-3-3m3 3l3-3" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "invoice-column-guide":'<svg viewBox="0 0 24 24"><rect x="4.5" y="5" width="15" height="14" rx="2" fill="#f59e0b"/><path d="M9.5 5v14M14.5 5v14M4.5 9h15" stroke="#232323" stroke-width="1.1"/></svg>',
  "data-summary-2025":'<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="13" height="16" rx="2" fill="#8b5cf6"/><rect x="8" y="13" width="2" height="3" fill="#fff"/><rect x="11" y="11" width="2" height="5" fill="#fff"/><rect x="14" y="9" width="2" height="7" fill="#fff"/></svg>',
  "status-taxonomy-mock":'<svg viewBox="0 0 24 24"><path d="M6 6h12v4H6zM6 14h12v4H6z" fill="#38bdf8"/><path d="M9 10v4M15 10v4" stroke="#38bdf8" stroke-width="2"/></svg>',
  // ── The Floor sections ──
  "floor-board":     '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="4" height="13" rx="1.4" fill="#F7BE00"/><rect x="10" y="5.5" width="4" height="8.5" rx="1.4" fill="#F7BE00"/><rect x="16" y="5.5" width="4" height="10.5" rx="1.4" fill="#F7BE00"/></svg>',
  "floor-prepress":  '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="15" height="11.5" rx="2" fill="#a78bfa"/><path d="M8 4.5v11.5M12 4.5v11.5M16 4.5v11.5M4.5 8h15M4.5 12h15" stroke="#232323" stroke-width="0.8" opacity=".5"/><rect x="6" y="18" width="12" height="2.4" rx="1.2" fill="#7c3aed"/></svg>',
  "floor-running":   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="#22c55e"/><path d="M10 8.3l6 3.7-6 3.7z" fill="#fff"/></svg>',
  "floor-reports":   '<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="13" height="16" rx="2" fill="#0ea5e9"/><rect x="8" y="13" width="2" height="3" fill="#fff"/><rect x="11" y="11" width="2" height="5" fill="#fff"/><rect x="14" y="9" width="2" height="7" fill="#fff"/></svg>',
  "floor-fulfillment":'<svg viewBox="0 0 24 24"><path d="M12 3.5l7.5 4.2v8.6L12 20.5 4.5 16.3V7.7z" fill="#f59e0b"/><path d="M9 11l3 3 3-3" fill="none" stroke="#232323" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shipment:          '<svg viewBox="0 0 24 24"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#0ea5e9"/><path d="M5.5 9 7 5.5h10L18.5 9" fill="none" stroke="#0ea5e9" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 17v-4.5M9.8 14.2 12 12l2.2 2.2" fill="none" stroke="#232323" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'retention-rollout-part-1': '<svg viewBox="0 0 24 24"><path d="M4.5 10v4l3 .6 6.5 4V5.4l-6.5 4z" fill="#f472b6"/><path d="M16.5 9.2a4.4 4.4 0 0 1 0 5.6" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round"/><path d="M19 7.2a7.4 7.4 0 0 1 0 9.6" fill="none" stroke="#f472b6" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>',
  'graphics-templates': '<svg viewBox="0 0 24 24"><rect x="7.5" y="7.5" width="12" height="12" rx="2" fill="#c084fc" opacity=".55"/><rect x="4.5" y="4.5" width="12" height="12" rx="2" fill="#c084fc"/><circle cx="8.5" cy="8.5" r="1.6" fill="#232323"/></svg>',
  'art-namer':        '<svg viewBox="0 0 24 24"><path d="M4 8a2 2 0 0 1 2-2h6.5l7.5 6-5.5 7.5L4 14z" fill="#f472b6"/><circle cx="8.6" cy="9.6" r="1.5" fill="#232323"/><path d="M11 14.5h5" stroke="#232323" stroke-width="1.7" stroke-linecap="round"/></svg>',
  'photo-namer':      '<svg viewBox="0 0 24 24"><rect x="4" y="4.5" width="16" height="10" rx="2" fill="#34d399"/><circle cx="8.5" cy="8" r="1.6" fill="#232323"/><path d="M11 12.5 14 9.5l4 5" fill="none" stroke="#232323" stroke-width="1.7" stroke-linejoin="round"/><path d="M5.5 17.8h9M5.5 20.3h6" stroke="#34d399" stroke-width="1.7" stroke-linecap="round"/></svg>',
};
function iconInner(node) {
  if (GLYPHS[node.id]) return GLYPHS[node.id];
  return `<span class="bEmoji">${esc(node.icon || (node.kind === 'hub' ? '🗂️' : '📄'))}</span>`;
}
function ringClass(node) { const t = railHubFor(node); return t ? ' ring-' + t.id : ''; }
function badge(node, size) { return `<span class="iconBadge ib-${size}${ringClass(node)}">${iconInner(node)}</span>`; }

let REG = null;          // the registry
let BYID = new Map();    // id -> node
let PARENT = new Map();  // id -> parent node (null for roots)

const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = s => (s == null ? '' : String(s)).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));

/* ── validation: fail loudly, never render half an app ── */
function validate(reg) {
  const errs = [];
  const warnings = [];
  if (!reg || typeof reg !== 'object') return { errs: ['registry.json is not an object'], warnings };
  if (!reg.app || !reg.app.name) errs.push('app.name missing');
  if (!Array.isArray(reg.tree)) return { errs: errs.concat('tree is not an array'), warnings };
  const seen = new Set();
  const names = new Map();
  const walk = (node, path, depth) => {
    const where = path + '/' + (node.id || '?');
    if (!node.id) errs.push(`node at ${where}: missing id`);
    else if (seen.has(node.id)) errs.push(`duplicate id "${node.id}"`);
    else seen.add(node.id);
    if (node.name && node.access !== 'pin') {
      const key = node.name.trim().toLowerCase();
      const prior = names.get(key) || [];
      prior.push(node.id || where);
      names.set(key, prior);
    }
    if (!ENUMS.kind.includes(node.kind)) errs.push(`"${node.id}": bad kind "${node.kind}"`);
    if (!node.name) errs.push(`"${node.id}": missing name`);
    if (depth === 0 && !ENUMS.group.includes(node.group)) errs.push(`"${node.id}": top-level node needs group hubs|library`);
    if (node.kind === 'hub') {
      if (!Array.isArray(node.children)) errs.push(`hub "${node.id}": children must be an array`);
      else node.children.forEach(c => walk(c, where, depth + 1));
    } else {
      if (node.type && !ENUMS.type.includes(node.type)) errs.push(`"${node.id}": bad type "${node.type}"`);
      if (node.status && !ENUMS.status.includes(node.status)) errs.push(`"${node.id}": bad status "${node.status}"`);
      if (node.access && !ENUMS.access.includes(node.access)) errs.push(`"${node.id}": bad access "${node.access}"`);
      if (node.display && node.display !== 'fullscreen') warnings.push(`"${node.id}": unknown display "${node.display}" (ignored)`);
    }
  };
  reg.tree.forEach(n => walk(n, '', 0));
  names.forEach((ids, name) => {
    if (ids.length > 1) warnings.push(`duplicate display name "${name}" on ids: ${ids.join(', ')}`);
  });
  return { errs, warnings };
}

function index(reg) {
  BYID.clear(); PARENT.clear();
  const walk = (node, parent) => {
    BYID.set(node.id, node); PARENT.set(node.id, parent);
    (node.children || []).forEach(c => walk(c, node));
  };
  reg.tree.forEach(n => walk(n, null));
}

/* ── pins ── */
const getPins = () => { try { return JSON.parse(localStorage.getItem(PINS_KEY)) || []; } catch { return []; } };
const setPins = p => localStorage.setItem(PINS_KEY, JSON.stringify(p));
function scrubStoredIds(key, limit) {
  const raw = (() => { try { return JSON.parse(localStorage.getItem(key)); } catch { return []; } })();
  const clean = (Array.isArray(raw) ? raw : []).filter((id, i, arr) => BYID.has(id) && arr.indexOf(id) === i);
  const out = typeof limit === 'number' ? clean.slice(0, limit) : clean;
  localStorage.setItem(key, JSON.stringify(out));
  return out;
}
function initPins() {
  if (localStorage.getItem(PINS_KEY) == null) {
    setPins(DEFAULT_PINS.filter(id => BYID.has(id)));
    return;
  }
  scrubStoredIds(PINS_KEY);
}
function togglePin(id) {
  const pins = getPins();
  const i = pins.indexOf(id);
  i >= 0 ? pins.splice(i, 1) : pins.push(id);
  setPins(pins); renderPinned(); renderPane();
}
function renderPinned() {
  const wrap = document.getElementById('pinnedChips');
  wrap.innerHTML = '';
  scrubStoredIds(PINS_KEY).map(id => BYID.get(id)).filter(Boolean).forEach(node => {
    const c = el('span', 'chip', badge(node, 'xs') + esc(safeName(node)));
    c.onclick = () => openNode(node);
    wrap.appendChild(c);
  });
}

/* ── home summary (the gate's /api/home/summary — health, flags, finance) ──
   Finance rendering is LOCKED-BY-DEFAULT: until the summary arrives we trust
   the registry's display label (`access:"pin"`); once it arrives, the server-
   classified id list wins. Names render generically when locked (shared-device
   hygiene) — the server is what actually enforces the finance zone. */
let SUMMARY = null;
function isFinanceNode(n) {
  if (!n) return false;
  return SUMMARY && Array.isArray(SUMMARY.financeSurfaceIds)
    ? SUMMARY.financeSurfaceIds.includes(n.id)
    : n.access === 'pin';
}
const financeVisible = n => !isFinanceNode(n) || !!(SUMMARY && SUMMARY.financeUnlocked === true);
const safeName  = n => financeVisible(n) ? n.name : '🔒 Financials';

const RECENT_KEY = 'frontdoor.recent';
const getRecents = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
function noteRecent(node) {
  if (node.kind !== 'surface' || isFinanceNode(node)) return;   // finance surfaces never persist
  const r = getRecents().filter(id => id !== node.id);
  r.unshift(node.id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 6)));
}

async function fetchSummary() {
  try {
    const r = await fetch('/api/home/summary');
    if (r.status === 401) { location.href = '/gate?r=%2Ffrontdoor%2F'; return; }
    if (!r.ok) { SUMMARY = { error: r.status }; return; }
    const d = await r.json();
    if (!d || !d.health || !Array.isArray(d.flags) || typeof d.financeUnlocked !== 'boolean') { SUMMARY = { error: 'malformed' }; return; }
    d.flags = d.flags.filter(f => ['red', 'amber', 'info'].includes(f.tier) && typeof f.label === 'string' && BYID.has(f.surfaceId));
    d.financeSurfaceIds = (Array.isArray(d.financeSurfaceIds) ? d.financeSurfaceIds : []).filter(id => BYID.has(id));
    SUMMARY = d;
    // recents self-heal: drop dead ids + anything the server now classifies as finance
    const fin = new Set(d.financeSurfaceIds);
    localStorage.setItem(RECENT_KEY, JSON.stringify(getRecents().filter(id => BYID.has(id) && !fin.has(id)).slice(0, 6)));
  } catch { SUMMARY = { error: 'network' }; }
}

/* ── home signal row: Watchtower open incidents + this week's sales ──
   Both read things that ALREADY exist. Fetched once per page load, in boot();
   renderSignalRow() re-renders from module state on every home render.
   FAIL SILENT: a dead feed renders NOTHING (console.warn only) — a permanently
   lit "unavailable" chip trains people to ignore the row (the 3-amber-flags lesson). */

// Same webhook the command center's Watchtower view reads (its FLIGHTLOG_ENDPOINT).
// NOT the retention-activity feed — that one cold-assembles for 15-40s; never call it here.
const WATCHTOWER_FLIGHTLOG = 'https://primary-production-079f9.up.railway.app/webhook/watchtower-flightlog';
let WATCH = undefined;   // undefined = not yet fetched/failed · number = open-incident count
let SALES = undefined;   // undefined = none · {week, quoted, converted}

async function fetchSignals() {
  try {   // payload contract (command center L2131): { agents:[{ incidents:[...open only...] , ...}] }
    const r = await fetch(WATCHTOWER_FLIGHTLOG, { signal: AbortSignal.timeout(3500) });
    const d = await r.json();
    if (d && Array.isArray(d.agents))
      WATCH = d.agents.reduce((n, a) => n + (Array.isArray(a.incidents) ? a.incidents.length : 0), 0);
  } catch (e) { console.warn('watchtower signal unavailable:', e.message); }
  try {   // signals/scoreboard-data.json: { weeks:[{iso_week, rows:[{rep:'Company', quotes_dollar, converted_dollar}]}] }
    const r = await fetch('../signals/scoreboard-data.json', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const wk = Array.isArray(d.weeks) && d.weeks[d.weeks.length - 1];
    const co = wk && (wk.rows || []).find(x => x.rep === 'Company');
    if (co) SALES = { week: wk.iso_week, quoted: co.quotes_dollar || 0, converted: co.converted_dollar || 0 };
  } catch (e) { console.warn('sales signal unavailable:', e.message); }
  renderSignalRow();
}

function renderSignalRow() {
  const row = document.getElementById('sigRow');
  if (!row) return;                                    // not on home right now
  row.innerHTML = '';
  const wt = BYID.get('watchtower');
  if (WATCH === undefined) { /* failed or pending → render nothing for Watchtower */ }
  else if (WATCH === 0) {                              // QUIET at zero: one slim, low-contrast line
    const c = el('div', 'sigQuiet', '🟢 Watchtower — all clear');
    if (wt) { c.classList.add('clickable'); c.onclick = () => openNode(wt); }
    row.appendChild(c);
  } else {                                             // LOUD when not: full-width red strip
    const c = el('div', 'sigAlert');
    const label = el('span');                          // fetched-adjacent → textContent, never innerHTML
    label.textContent = `🚨 Watchtower — ${WATCH} open incident${WATCH === 1 ? '' : 's'}`;
    c.appendChild(label);
    const go = el('span', 'flagGo', 'Go →');
    c.appendChild(go);
    if (wt) c.onclick = () => openNode(wt);
    row.appendChild(c);
  }
  if (SALES) {
    const sn = BYID.get('signals');
    const c = el('div', 'sigChip');
    c.textContent = `📡 W${SALES.week}: $${Math.round(SALES.quoted).toLocaleString()} quoted · $${Math.round(SALES.converted).toLocaleString()} won`;
    if (sn) { c.classList.add('clickable'); c.onclick = () => openNode(sn); }
    row.appendChild(c);
  }
}

/* ── navigation (hash routing: #/planetops/time-labor) ── */
function pathOf(node) {
  const ids = [];
  let n = node;
  while (n) { ids.unshift(n.id); n = PARENT.get(n.id); }
  return ids;
}
function navTo(node) { location.hash = '#/' + pathOf(node).join('/'); }
function navHome() {                                   // the Ø logo's job: home, flyout closed, search cleared
  const f = document.getElementById('flyout'); if (f) f.hidden = true;
  const s = document.getElementById('search'); if (s) s.value = '';
  const sr = document.getElementById('searchResults'); if (sr) sr.hidden = true;
  if (currentNode() === null) renderPane(); else location.hash = '#/';
}
const isExternal = u => APPROVED_EXTERNAL.some(pre => u && u.startsWith(pre));
const isInWorks = n => n && n.kind === 'surface' && !n.url;
function splitWorks(nodes) {
  return {
    ready: (nodes || []).filter(n => !isInWorks(n)),
    works: (nodes || []).filter(isInWorks)
  };
}
/* The node the hash points at — hub OR surface. null = HOME (explicit route:
   empty hash / #/ / #/home / any unresolvable stale hash all land on home). */
function currentNode() {
  const ids = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!ids.length || (ids.length === 1 && ids[0] === 'home')) return null;
  let node = null;
  for (const id of ids) { const n = BYID.get(id); if (n) node = n; }
  return node;                                        // unknown ids → null → home
}
function railHubFor(node) {                 // which top-level hub to highlight in the rail
  let t = node; while (t && PARENT.get(t.id)) t = PARENT.get(t.id); return t;
}
function openNode(node) {
  if (node.kind === 'hub') { navTo(node); return; }
  noteRecent(node);
  if (node.display === 'fullscreen' && node.url) { openUrl(node.url); return; }   // kiosk/own-router apps: new tab, no shell chrome
  if (!node.url) { navTo(PARENT.get(node.id) || REG.tree[0]); return; }
  if (isExternal(node.url)) { openUrl(node.url); return; }   // Google Sheets etc. → new tab
  navTo(node);                                               // internal → embed in the pane
}

/* ── slim rail + hover flyout (QuickBooks: tucked icon+short-label, dashboards on hover) ── */
const RAIL_LABEL = { planetops: 'Production', 'revenue-house': 'Revenue', planetiq: 'PlanetIQ', systems: 'Systems', references: 'Resources' };
function renderRail() {
  const rail = document.getElementById('rail');
  rail.innerHTML = '';
  const cur = currentNode();
  const activeTop = cur ? railHubFor(cur) : null;
  [['hubs', 'Hubs'], ['library', 'Library']].forEach(([g, label]) => {
    rail.appendChild(el('div', 'railGroup', esc(label)));
    REG.tree.filter(n => n.group === g).forEach(node => {
      const item = el('div', 'railItem' + (activeTop && activeTop.id === node.id ? ' active' : ''),
        `${badge(node, 'sm')}<span class="riName">${esc(RAIL_LABEL[node.id] || node.name)}</span>`);
      item.onmouseenter = () => showFlyout(node, item);
      item.onmouseleave = scheduleHideFlyout;
      item.onclick = () => { hideAllFly(); navTo(node); };   // click = landing; hover = flyout; landing is the touch path
      rail.appendChild(item);
    });
  });
}

let flyHideTimer, subHideTimer;
function hideAllFly() { const f = document.getElementById('flyout'); if (f) { f.hidden = true; f.classList.remove('collapsed'); } const sf = document.getElementById('subflyout'); if (sf) sf.hidden = true; }
function scheduleHideFlyout() { clearTimeout(flyHideTimer); flyHideTimer = setTimeout(hideAllFly, 350); }
function keepFlyout() { clearTimeout(flyHideTimer); }
function hideSubFlyout(now) {
  clearTimeout(subHideTimer);
  const sf = document.getElementById('subflyout');
  if (!sf) return;
  if (now) { sf.hidden = true; document.getElementById('flyout')?.classList.remove('collapsed'); }
  else subHideTimer = setTimeout(() => { sf.hidden = true; document.getElementById('flyout')?.classList.remove('collapsed'); }, 350);
}
function flyRow(n) {
  const lock = isFinanceNode(n) ? ' <span class="lock" title="Financials — needs the finance PIN">🔒</span>' : '';
  const ext = (n.kind === 'surface' && isExternal(n.url)) ? ' <span class="ext" title="Opens in a new tab">↗</span>' : '';
  const st = (n.kind === 'surface' && n.status && n.status !== 'live') ? ` <span class="badge ${esc(n.status)}">${esc(BADGE[n.status])}</span>` : '';
  const row = el('div', 'flyRow' + (isInWorks(n) ? ' inWorks' : ''), `${badge(n, 'sm')}<span class="flyName">${esc(safeName(n))}</span>${st}${lock}${ext}`);
  row.title = safeName(n);
  row.onclick = () => { openNode(n); hideAllFly(); };
  return row;
}
function cascadeRow(hub) {                                    // a sub-hub → hover fans out its flyout, CLICK navigates into its section
  const row = el('div', 'flyRow hasKids', `${badge(hub, 'sm')}<span class="flyName">${esc(hub.name)}</span><span class="flyCaret">›</span>`);
  row.title = hub.name;
  row.onmouseenter = () => showSubFlyout(hub, row);
  row.onclick = () => { hideAllFly(); navTo(hub); };
  return row;
}
function fillFlyout(fly, hub) {
  fly.innerHTML = '';
  /* NOTE: plain rows must NOT hide the sub-flyout on hover — the diagonal
     mouse path from a cascade row to the sub-flyout crosses them, and hiding
     here made the sub-menu unreachable. It hides via hideAllFly/other cascades. */
  const groups = splitWorks(hub.children || []);
  groups.ready.forEach(c => {
    if (c.kind === 'hub') fly.appendChild(cascadeRow(c));
    else fly.appendChild(flyRow(c));
  });
  if (groups.works.length) {
    fly.appendChild(el('div', 'flyGroupHead inWorksHead', 'In the works'));
    groups.works.forEach(c => fly.appendChild(flyRow(c)));
  }
  if (!(hub.children || []).length) fly.appendChild(el('div', 'flyEmpty', 'Nothing here yet.'));
}
function placeFly(fly, leftPx, topAnchor) {
  fly.style.left = leftPx + 'px';
  fly.style.top = Math.max(52, Math.min(topAnchor, window.innerHeight - Math.min(fly.scrollHeight + 24, 420))) + 'px';
  fly.hidden = false;
}
function showFlyout(hub, anchorEl) {
  keepFlyout(); hideSubFlyout(true);
  const fly = document.getElementById('flyout');
  fly.classList.remove('collapsed');
  fillFlyout(fly, hub);
  placeFly(fly, document.getElementById('rail').getBoundingClientRect().right, anchorEl.getBoundingClientRect().top);
}
function showSubFlyout(hub, rowEl) {
  keepFlyout(); clearTimeout(subHideTimer);
  const fly = document.getElementById('flyout');
  const sf = document.getElementById('subflyout');
  fillFlyout(sf, hub);
  /* The parent stays fully open. Collapsing it to an icon strip was tried and
     reverted 2026-07-19: stacked against the section side-nav it produced three
     competing columns and read as clutter, not focus. The source row is
     highlighted instead — same "you are here" signal, no layout churn. */
  [...fly.querySelectorAll('.flyRow')].forEach(r => r.classList.toggle('srcRow', r === rowEl));
  placeFly(sf, fly.getBoundingClientRect().right - 4, rowEl.getBoundingClientRect().top - 6);
}

/* ── main pane ── */
function renderCrumbs(node) {
  const c = document.getElementById('crumbs');
  c.innerHTML = '';
  const chain = pathOf(node).map(id => BYID.get(id));
  chain.forEach((n, i) => {
    if (i) c.appendChild(el('span', 'sep', '›'));
    if (i === chain.length - 1) c.appendChild(el('span', 'here', esc(n.name)));
    else { const a = el('a', '', esc(n.name)); a.onclick = () => navTo(n); c.appendChild(a); }
  });
}
function tileFor(node) {
  const pins = getPins();
  const isHub = node.kind === 'hub';
  const t = el('div', 'tile' + (isHub || node.url ? ' clickable' : '') + (isInWorks(node) ? ' inWorks' : ''));
  const statusBadge = !isHub && node.status ? ` <span class="badge ${esc(node.status)}">${esc(BADGE[node.status])}</span>` : '';
  const lock = node.access === 'pin' ? ' <span class="lock" title="Financials — needs the finance PIN">🔒</span>' : '';
  const ext = !isHub && isExternal(node.url) ? ' <span class="ext" title="Opens in a new tab">↗</span>' : '';
  const typeTag = !isHub && node.type ? ` <span class="typeTag">${esc(node.type)}</span>` : '';
  const vis = financeVisible(node);                       // locked finance → generic tile, no blurb/source/notes
  t.innerHTML =
    `<h3>${badge(node, 'lg')}` +
    `<span class="tName">${esc(safeName(node))}</span>${statusBadge}${lock}${ext}${vis ? typeTag : ''}</h3>` +
    (vis && node.blurb ? `<p>${esc(node.blurb)}</p>` : '') +
    (vis && node.dataSource ? `<div class="meta">⛁ ${esc(node.dataSource)}</div>` : '') +
    (isHub ? `<div class="meta">${(node.children || []).length} inside →</div>` : '') +
    (vis && node.note ? `<div class="note">${esc(node.note)}</div>` : '');
  const pin = el('button', 'pinBtn' + (pins.includes(node.id) ? ' pinned' : ''), '📌');
  pin.title = pins.includes(node.id) ? 'Unpin' : 'Pin to top bar';
  pin.onclick = e => { e.stopPropagation(); togglePin(node.id); };
  t.appendChild(pin);
  t.onclick = () => openNode(node);
  return t;
}
function renderPane() {
  const node = currentNode();
  const pane = document.getElementById('pane');
  if (!node) { renderHome(pane); return; }              // explicit HOME route
  renderCrumbs(node);
  pane.innerHTML = '';

  /* Surface with an embeddable URL → load it right here in the pane.
     If its parent is a SECTION (a sub-hub like The Floor), the section's keys
     render as a side-nav on the left of the frame — click keys to switch. */
  if (node.kind === 'surface' && node.url && !isExternal(node.url)) {
    document.body.classList.add('embedding');
    const section = (() => { const p = PARENT.get(node.id); return p && PARENT.get(p.id) ? p : null; })();
    const bar = el('div', 'surfBar');
    bar.innerHTML =
      `<button class="surfBack" title="Back to ${esc(PARENT.get(node.id)?.name || 'hub')}">‹ Back</button>` +
      `<span class="surfTitle">${badge(node, 'sm')}${esc(node.name)}</span>` +
      `<button class="surfFull" title="Open full screen in a new tab">⤢ Full screen</button>`;
    bar.querySelector('.surfBack').onclick = () => navTo(PARENT.get(node.id) || REG.tree[0]);
    bar.querySelector('.surfFull').onclick = () => openUrl(node.url);
    const frame = el('iframe', 'surfFrame');
    frame.src = node.url; frame.title = node.name;
    frame.setAttribute('loading', 'eager');
    pane.appendChild(bar);
    if (section) {
      const wrap = el('div', 'sectionWrap');
      const nav = el('div', 'sectionNav');
      nav.appendChild(el('div', 'snHead', `${badge(section, 'sm')}<span>${esc(section.name)}</span>`));
      (section.children || []).filter(k => !isInWorks(k)).forEach(k => {
        const ext = (k.kind === 'surface' && isExternal(k.url)) ? ' <span class="ext" title="Opens in a new tab">↗</span>' : '';
        const key = el('div', 'snKey' + (k.id === node.id ? ' active' : ''),
          `${badge(k, 'sm')}<span class="snName">${esc(safeName(k))}</span>${ext}`);
        key.onclick = () => openNode(k);
        nav.appendChild(key);
      });
      wrap.appendChild(nav); wrap.appendChild(frame);
      pane.appendChild(wrap);
    } else pane.appendChild(frame);
    return;
  }

  /* surface without an embeddable url (external) → bounce to its hub-home */
  if (node.kind === 'surface') { navTo(PARENT.get(node.id) || REG.tree[0]); return; }

  /* a SECTION hash (sub-hub like The Floor) → open its first embeddable key,
     which renders with the section side-nav on the left */
  if (PARENT.get(node.id)) {
    const first = (node.children || []).find(c => c.kind === 'surface' && c.url && !isExternal(c.url));
    if (first) { navTo(first); return; }
  }

  /* any other hub (top-level, or a sub-hub with nothing embeddable) → its landing page */
  renderHubLanding(node, pane);
}

function countSurfaces(hub) {              // registry metadata, stated honestly — NOT business signal
  let total = 0, live = 0;
  (function w(n){ (n.children || []).forEach(c => {
    if (c.kind === 'surface') { total++; if (c.status === 'live' && c.url) live++; }
    else w(c);
  }); })(hub);
  return { total, live };
}

function renderHubLanding(node, pane) {
  document.body.classList.remove('embedding');
  renderCrumbs(node);
  pane.innerHTML = '';

  /* hero band — command-center pattern: dark card, gold kicker, big name, blurb, count top-right */
  const parent = PARENT.get(node.id);
  const { total, live } = countSurfaces(node);
  const hero = el('div', 'hubHero');
  hero.innerHTML =
    `<div class="hhKicker">${esc(parent ? parent.name : 'Planet Apparel')}</div>` +
    `<h1>${badge(node, 'lg')}<span>${esc(safeName(node))}</span></h1>` +
    (node.blurb ? `<p class="hhSub">${esc(node.blurb)}</p>` : '') +
    `<div class="hhCount">${total}<small>inside · ${live} live</small></div>`;
  pane.appendChild(hero);

  const kids = node.children || [];
  const hubKids = kids.filter(c => c.kind === 'hub');
  const surfKids = kids.filter(c => c.kind === 'surface');

  /* 1 · the rooms — child hubs as big cards */
  if (hubKids.length) {
    pane.appendChild(el('div', 'groupHead', 'Inside'));
    const hg = el('div', 'hubCards');
    hubKids.forEach(h => hg.appendChild(hubCard(h)));
    pane.appendChild(hg);
  }

  /* 2 · direct tools — reuse tileFor(); finance-locked ones aggregate to ONE tile */
  const { ready, works } = splitWorks(surfKids);
  const locked = ready.filter(n => isFinanceNode(n) && !financeVisible(n));
  const visible = ready.filter(n => !locked.includes(n));
  if (visible.length || locked.length) {
    pane.appendChild(el('div', 'groupHead', 'Tools'));
    const grid = el('div', 'tiles');
    visible.forEach(n => grid.appendChild(tileFor(n)));
    if (locked.length) grid.appendChild(lockedAggTile(locked.length));
    pane.appendChild(grid);
  }

  /* 3 · in the works — dimmed, last (same hygiene as flyouts/Browse) */
  if (works.length) {
    pane.appendChild(el('div', 'groupHead', 'In the works'));
    const wg = el('div', 'tiles');
    works.forEach(n => wg.appendChild(tileFor(n)));
    pane.appendChild(wg);
  }
  if (!kids.length) pane.appendChild(el('div', 'emptyHub', 'Nothing here yet.'));
}

function hubCard(h) {
  const { total, live } = countSurfaces(h);
  const c = el('div', 'hubCard clickable');
  c.innerHTML =
    `<div class="hcCnt">${total}<small>inside · ${live} live</small></div>` +
    `${badge(h, 'lg')}<div class="hcLab">${esc(h.name)}</div>` +
    (h.blurb ? `<div class="hcOne">${esc(h.blurb)}</div>` : '');
  c.onclick = () => openNode(h);
  return c;
}

function lockedAggTile(n) {                 // PlanetIQ answer: 6 identical masked tiles → ONE honest tile
  const t = el('div', 'tile clickable lockedAgg');
  t.innerHTML =
    `<h3><span class="iconBadge ib-lg"><svg viewBox="0 0 24 24"><rect x="6" y="10.5" width="12" height="9" rx="2" fill="#94a3b8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="#94a3b8" stroke-width="2.2"/></svg></span>` +
    `<span class="tName">🔒 Financials (${n})</span></h3>` +
    `<p>${n} locked tool${n === 1 ? '' : 's'} — enter the finance PIN to see them.</p>`;
  t.onclick = () => { location.href = '/gate/finance?r=%2Ffrontdoor%2F'; };
  return t;
}

/* ── HOME — the canvas (welcome · needs-attention · quick access · feed · browse) ── */
function renderHome(pane) {
  document.body.classList.remove('embedding');
  const c = document.getElementById('crumbs');
  c.innerHTML = ''; c.appendChild(el('span', 'here', 'Home'));
  pane.innerHTML = '';

  /* 1 · welcome band */
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const wb = el('div', 'homeWelcome',
    `<span class="hwLogo"></span><div><h2>${esc(REG.app.name || 'Planet Apparel')}</h2><p class="hwDate"></p></div>`);
  wb.querySelector('.hwLogo').appendChild(document.getElementById('paLogo').content.cloneNode(true));
  wb.querySelector('.hwDate').textContent = today;
  pane.appendChild(wb);

  /* 1.5 · live signal row — Watchtower headline + sales pulse */
  const sig = el('div', 'sigRow'); sig.id = 'sigRow';
  pane.appendChild(sig);
  renderSignalRow();

  /* 2 · needs attention */
  pane.appendChild(el('div', 'groupHead', '⚠️ Needs attention'));
  const board = el('div', 'flagBoard'); board.id = 'flagBoard';
  pane.appendChild(board);
  renderFlagBoard();

  /* 3 · quick access — pins + recents */
  const pins = scrubStoredIds(PINS_KEY).map(id => BYID.get(id)).filter(Boolean);
  pane.appendChild(el('div', 'groupHead', '📌 Quick access'));
  if (pins.length) {
    const grid = el('div', 'tiles');
    pins.forEach(n => grid.appendChild(tileFor(n)));
    pane.appendChild(grid);
  } else pane.appendChild(el('p', 'homeHint', 'Pin your go-to tools with the 📌 on any tile and they’ll live here (and in the top bar).'));
  const recents = scrubStoredIds(RECENT_KEY, 6).map(id => BYID.get(id)).filter(n => n && !getPins().includes(n.id));
  if (recents.length) {
    const row = el('div', 'recentRow', '<span class="recentLabel">Recent:</span>');
    recents.forEach(n => {
      const chip = el('span', 'chip', badge(n, 'xs') + esc(safeName(n)));
      chip.onclick = () => openNode(n);
      row.appendChild(chip);
    });
    pane.appendChild(row);
  }

  /* 4 · the Feed — intake card (links to the feed guide until the upload surface ships) */
  const feedNode = BYID.get('feed-upload') || BYID.get('feed-guide');
  if (feedNode) {
    pane.appendChild(el('div', 'groupHead', '⚡ The Feed'));
    const fc = el('div', 'feedCard',
      `<span class="iconBadge ib-lg"><svg viewBox="0 0 24 24"><path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5" stroke="#F7BE00" stroke-width="2.3" stroke-linecap="round"/></svg></span>` +
      `<div><h3>Feed the system</h3><p>Drop documents — payroll, financials, production times, anything notable — and they flow into PlanetIQ.</p></div><span class="feedGo">Open →</span>`);
    fc.onclick = () => openNode(feedNode);
    pane.appendChild(fc);
  }

  /* 5 · browse — hubs only, in-pane accordion */
  pane.appendChild(el('div', 'groupHead', '🧭 Browse'));
  const browse = el('div', 'browse');
  REG.tree.forEach(hub => {
    const sec = el('div', 'browseHub');
    const head = el('div', 'browseHead',
      `${badge(hub, 'sm')}<span class="bhName">${esc(hub.name)}</span><span class="bhCount">${(hub.children || []).length}</span><span class="bhChev">▾</span>`);
    const body = el('div', 'browseBody'); body.hidden = true;
    head.onclick = () => {
      body.hidden = !body.hidden;
      head.classList.toggle('open', !body.hidden);
      if (!body.hidden && !body.childNodes.length) {
        const addRows = (nodes) => {
          const groups = splitWorks(nodes);
          groups.ready.forEach(n => {
            if (n.kind === 'hub') { body.appendChild(el('div', 'flyGroupHead', `${badge(n, 'xs')}<span>${esc(n.name)}</span>`)); addRows(n.children || []); }
            else body.appendChild(browseRow(n));
          });
          if (groups.works.length) {
            body.appendChild(el('div', 'flyGroupHead inWorksHead', 'In the works'));
            groups.works.forEach(n => body.appendChild(browseRow(n)));
          }
        };
        addRows(hub.children || []);
      }
    };
    sec.appendChild(head); sec.appendChild(body); browse.appendChild(sec);
  });
  pane.appendChild(browse);
}
function browseRow(n) {
  const lock = isFinanceNode(n) ? ' <span class="lock" title="Financials — needs the finance PIN">🔒</span>' : '';
  const ext = (n.kind === 'surface' && isExternal(n.url)) ? ' <span class="ext" title="Opens in a new tab">↗</span>' : '';
  const row = el('div', 'flyRow' + (isInWorks(n) ? ' inWorks' : ''), `${badge(n, 'sm')}<span class="flyName">${esc(safeName(n))}</span>${lock}${ext}`);
  row.onclick = () => openNode(n);
  return row;
}

function renderFlagBoard() {
  const board = document.getElementById('flagBoard');
  if (!board) return;                                   // not on the home right now
  board.innerHTML = '';
  if (SUMMARY === null) { board.appendChild(el('div', 'flag info', 'Checking system status…')); return; }
  if (SUMMARY.error) {                                  // 503/network → status card; never blank the home
    board.appendChild(el('div', 'flag red', SUMMARY.error === 503 || SUMMARY.error === 'network'
      ? '🔴 Can’t reach the system-status service right now — the app may be having trouble.'
      : '🟡 System status is unavailable right now.'));
    return;
  }
  const healthy = SUMMARY.health.gate === 'ok' && SUMMARY.health.stateApi !== 'down';
  board.appendChild(el('div', 'flag ' + (healthy ? 'ok' : 'red'), healthy ? '🟢 All systems up' : '🔴 System trouble'));
  const chipFor = f => {
    const node = BYID.get(f.surfaceId);
    const chip = el('div', 'flag ' + (f.tier === 'red' ? 'red' : f.tier === 'amber' ? 'amber' : 'notice'));
    const label = el('span'); label.textContent = f.label;      // server strings NEVER hit innerHTML
    chip.appendChild(label);
    if (node) { const go = el('span', 'flagGo', 'Go →'); go.onclick = e => { e.stopPropagation(); openNode(node); }; chip.appendChild(go); }
    return chip;
  };
  SUMMARY.flags.filter(f => f.tier !== 'info').forEach(f => board.appendChild(chipFor(f)));
  const notices = SUMMARY.flags.filter(f => f.tier === 'info');   // quiet tier: one collapsed chip, expand on click
  if (notices.length) {
    const toggle = el('div', 'flag notice noticeToggle', `🛠 ${notices.length} in progress <span class="bhChev">▾</span>`);
    const drawer = el('div', 'noticeDrawer'); drawer.hidden = true;
    notices.forEach(f => drawer.appendChild(chipFor(f)));
    toggle.onclick = () => { drawer.hidden = !drawer.hidden; toggle.classList.toggle('open', !drawer.hidden); };
    board.appendChild(toggle); board.appendChild(drawer);
  }
  if (SUMMARY.financeUnlocked === false) {              // constant generic affordance — carries no counts/names
    const fin = el('div', 'flag lockchip', '🔒 Financials locked — unlock');
    fin.onclick = () => { location.href = '/gate/finance?r=%2Ffrontdoor%2F'; };
    board.appendChild(fin);
  }
}

/* ── search (index-only in v1; invoice/document search = Phase 2) ── */
function setupSearch() {
  const input = document.getElementById('search');
  const box = document.getElementById('searchResults');
  let results = [], sel = -1;
  const close = () => { box.hidden = true; sel = -1; };
  const run = q => {
    q = q.trim().toLowerCase();
    if (!q) { close(); return; }
    results = [...BYID.values()]
      .filter(n => n.name.toLowerCase().includes(q) || (n.blurb || '').toLowerCase().includes(q))
      .sort((a, b) => Number(isInWorks(a)) - Number(isInWorks(b)))
      .slice(0, 12);
    box.innerHTML = '';
    if (!results.length) { box.innerHTML = '<div class="sr">No matches</div>'; box.hidden = false; return; }
    results.forEach((n, i) => {
      const chain = pathOf(n).slice(0, -1).map(id => BYID.get(id).name).join(' › ');
      const r = el('div', 'sr', badge(n, 'xs') +
        `<span>${esc(safeName(n))}</span><span class="path">${esc(chain)}</span>`);
      r.onmousedown = e => { e.preventDefault(); openNode(n); close(); input.blur(); };
      r.dataset.i = i;
      box.appendChild(r);
    });
    box.hidden = false;
  };
  input.addEventListener('input', () => run(input.value));
  input.addEventListener('keydown', e => {
    const items = [...box.querySelectorAll('.sr')];
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); }
    else if (e.key === 'Enter') { const n = results[sel >= 0 ? sel : 0]; if (n) { openNode(n); close(); input.blur(); } return; }
    else if (e.key === 'Escape') { close(); input.blur(); return; }
    else return;
    e.preventDefault();
    items.forEach((it, i) => it.classList.toggle('sel', i === sel));
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}

/* ── rail show/hide (☰). Static rail — no auto-pop drawer anymore. ── */
const RAIL_KEY = 'frontdoor.rail';
function applyRailState() {
  document.body.classList.toggle('rail-collapsed', localStorage.getItem(RAIL_KEY) === 'collapsed');
}
function setupRail() {
  applyRailState();
  document.getElementById('railToggle').onclick = () => {
    const collapsed = localStorage.getItem(RAIL_KEY) === 'collapsed';
    localStorage.setItem(RAIL_KEY, collapsed ? 'open' : 'collapsed');
    applyRailState();
    document.getElementById('flyout').hidden = true;
  };
  const fly = document.getElementById('flyout');
  fly.onmouseenter = keepFlyout;
  fly.onmouseleave = scheduleHideFlyout;
  const sf = document.getElementById('subflyout');
  sf.onmouseenter = () => { keepFlyout(); clearTimeout(subHideTimer); };
  sf.onmouseleave = () => { hideSubFlyout(); scheduleHideFlyout(); };
}

/* ── boot ── */
function boot() {
  initPins();
  document.getElementById('brandName').textContent = REG.app.name;
  document.querySelector('.brand').onclick = navHome;            // the Ø always walks you home
  document.getElementById('foot').innerHTML =
    `Planet Apparel · the front door · updated ${esc(REG.app.updated)} · everything renders from <code>registry.json</code> — edit it to add a hub or surface`;
  setupRail(); renderRail(); renderPane(); renderPinned(); setupSearch();
  window.addEventListener('hashchange', () => { renderRail(); renderPane(); });
  fetchSummary().then(() => { renderFlagBoard(); renderPinned(); if (currentNode() === null) renderPane(); });
  fetchSignals();
}

async function main() {
  const tpl = document.getElementById('paLogo');
  document.getElementById('brandLogo').appendChild(tpl.content.cloneNode(true));

  let reg;
  try {
    const r = await fetch('./registry.json?_=' + Math.floor(Date.now() / 60000));
    reg = await r.json();
  } catch (e) {
    showRegError(['could not load/parse registry.json — ' + esc(e.message),
      'Open via a server (the gate or python3 -m http.server), not file://']);
    return;
  }
  const { errs, warnings } = validate(reg);
  if (errs.length) { showRegError(errs); return; }
  if (warnings.length) showRegWarnings(warnings);
  REG = reg; index(reg);
  document.getElementById('app').hidden = false;
  boot();
}
function showRegError(errs) {
  document.getElementById('app').hidden = false;
  const b = document.getElementById('regError');
  b.hidden = false;
  b.innerHTML = `<b>registry.json failed validation — fix it before this page will render:</b><br>` +
    errs.slice(0, 10).map(e => '• ' + e).join('<br>') + (errs.length > 10 ? `<br>…and ${errs.length - 10} more` : '');
}
function showRegWarnings(warnings) {
  console.warn('registry.json warnings:', warnings);
  const b = document.getElementById('regError');
  b.hidden = false;
  b.className = 'regWarning';
  b.innerHTML = `<b>registry.json warnings:</b><br>` +
    warnings.slice(0, 6).map(e => '• ' + esc(e)).join('<br>') + (warnings.length > 6 ? `<br>…and ${warnings.length - 6} more` : '');
}

main();
