/* GENERATED COPY — do NOT edit here. Source of truth: ~/Dropbox/Claude_Holly/_Claude/AgenticOS/os-data.js
   Re-copied on deploy (2026-07-14). Edit the Dropbox source, then re-run the copy. */
/* alerts[]  — the Alert Center. Only status:"active" renders on os.html.
   To OPEN an alert:  push a new {…, status:"active", fixedOn:null}.
   To CLOSE an alert: set its status:"fixed" and fixedOn:"YYYY-MM-DD"
                      AND append a changelog row {type:"fix", …}.
   Fixed alerts render NOWHERE on the page — the changelog is the durable record.
   changelog[] — the Change Log. Append one row per break/fix/ship; never edit history.
   All strings are PLAIN TEXT (os.html HTML-escapes them). */

/* =====================================================================
   Planet Apparel — Agentic OS : SINGLE SOURCE OF TRUTH
   ---------------------------------------------------------------------
   Both architecture.html (the map) and dashboard.html (the buttons)
   render from this file. Add / edit a skill here in ONE place and both
   artifacts update.

   run:    "manual" 👆  |  "auto" ☁️  |  "sched" ⏰
   launch: { type:"prompt", text:"/today" }   -> button copies this to run in Claude Code
           { type:"info" }                     -> informational (already runs automatically)
           { type:"webhook", url:"..." }       -> FUTURE: fire an n8n webhook directly
   children: optional sub-menu (e.g. the Marketing Toolkit)
   ===================================================================== */
window.OS_DATA = {
  brand: {
    name: "Planet Apparel",
    system: "Agentic OS",
    tagline: "Ask Simon to route it — or run a skill",
    updated: "2026-07-14",
    orchestrator: { name: "Simon", role: "Chief of Staff — routes any request or complaint to the right director", cmd: "/simon" }
  },

  domains: [
    {
      id: "daily", name: "Daily Ops", icon: "☀️", tag: "rhythm", agent: "Monica",
      blurb: "Start the day, work it, close it.",
      skills: [
        { name: "Morning Brief", cmd: "/today", run: "auto",  launch:{type:"prompt", text:"/today"} },
        { name: "Inbox Triage",  cmd: "gmail → drafts", run: "manual", launch:{type:"prompt", text:"Triage my Gmail inbox: surface what needs me and draft replies."} },
        { name: "Day Wrap",      cmd: "/tldr · /checkpoint", run: "auto", launch:{type:"prompt", text:"/tldr"} },
        { name: "Screenshots",   cmd: "/ss · /name-ss", run: "manual", launch:{type:"prompt", text:"/ss"} },
        { name: "Quick Calc",    cmd: "/ca", run: "manual", launch:{type:"prompt", text:"/ca"} },
        { name: "Calendar Glance",cmd:"calendar mcp", run: "manual", launch:{type:"prompt", text:"Show today's calendar and suggest open slots."} }
      ]
    },
    {
      id: "sales", name: "Sales Ops", icon: "💰", tag: "pipeline", agent: "Rachel",
      blurb: "Capture the lead, qualify it, win it, keep it warm.",
      skills: [
        { name: "Lead Capture",     cmd: "WhatConverts→Streak→Printavo", run: "auto", launch:{type:"info"} },
        { name: "Booking Alerts",   cmd: "calendly · n8n", run: "auto", launch:{type:"info"} },
        { name: "Enrich a Deal",    cmd: "/fill-streak", run: "auto", launch:{type:"prompt", text:"/fill-streak"} },
        { name: "Sales Email",      cmd: "/sales", run: "manual", launch:{type:"prompt", text:"/sales"} },
        { name: "Bandana Desk",     cmd: "bandanas@ drafting", run: "manual", launch:{type:"prompt", text:"Open the bandana desk: read inbound and draft a reply in Holly's voice."} },
        { name: "Pipeline Snapshot",cmd: "streak pipeline", run: "manual", launch:{type:"prompt", text:"Give me a Streak Sale Pipeline snapshot: stages, at-risk, follow-ups due."} },
        { name: "Retention Touch",  cmd: "reorder · check-in · cross-sell", run: "manual", launch:{type:"prompt", text:"Draft a retention touch (reorder / check-in / cross-sell) for this customer."} }
      ]
    },
    {
      id: "systems", name: "Systems Lab", icon: "🛠️", tag: "build", agent: "Chandler",
      blurb: "Turn a recurring problem into a permanent system.",
      skills: [
        { name: "Treeger — Fix Agent", cmd: "n8n fail → investigate → self-heal", run: "auto", launch:{type:"link", url:"https://claude.ai/code/routines"} },
        { name: "Incident Log",  cmd: "one row per failure · shared drive", run: "auto", launch:{type:"link", url:"https://docs.google.com/spreadsheets/d/1aQEKhsjYYngueQ0MOZJAJG6eZU9-jyKW-wN34R-h8mw"} },
        { name: "System Alerts", cmd: "🔧 healed · 🚨 needs you · 📋 Sun digest", run: "auto", launch:{type:"link", url:"https://chat.google.com/room/AAQALGfUVos"} },
        { name: "Create a Skill",     cmd: "skill-creator", run: "manual", launch:{type:"prompt", text:"Use skill-creator to build a new skill for:"} },
        { name: "Stress-Test a Plan", cmd: "/codex-review · /grill-me", run: "manual", launch:{type:"prompt", text:"/codex-review"} },
        { name: "Knowledge Graph",    cmd: "/graphify", run: "manual", launch:{type:"prompt", text:"/graphify"} },
        { name: "Deep Research",      cmd: "/deep-research", run: "manual", launch:{type:"prompt", text:"/deep-research"} },
        { name: "Last 30 Days",       cmd: "/last30days", run: "manual", launch:{type:"prompt", text:"/last30days"} },
        { name: "NotebookLM",         cmd: "/notebooklm", run: "manual", launch:{type:"prompt", text:"/notebooklm"} },
        { name: "Humanize Copy",      cmd: "/humanizer", run: "manual", launch:{type:"prompt", text:"/humanizer"} },
        { name:"Orchestrate a Build", cmd:"/orchestrate · Fable plans · Codex builds", run:"manual", launch:{ type:"prompt", text:"/orchestrate" } }
      ]
    },
    {
      id: "growth", name: "PlanetGrowth", icon: "🌐", tag: "attract", agent: "Joey",
      blurb: "The public storefront — get found, get attention, generate demand.",
      skills: [
        { name: "planetapparel.com",    cmd: "main website", run: "auto", launch:{type:"link", url:"https://www.planetapparel.com"} },
        { name: "Bandana Revamp Site",  cmd: "bandana storefront", run: "auto", launch:{type:"link", url:"https://planetholly.github.io/planetops/bandana-revamp/"} },
        { name: "SEO Audit",            cmd: "/seo-audit", run: "manual", launch:{type:"prompt", text:"/seo-audit"} },
        { name: "AI-SEO",               cmd: "/ai-seo", run: "manual", launch:{type:"prompt", text:"/ai-seo"} },
        { name: "Web Analytics",        cmd: "GA4 · Search Console", run: "manual", launch:{type:"prompt", text:"/analytics"} },
        { name: "Social",               cmd: "/social", run: "manual", launch:{type:"prompt", text:"/social"} },
        { name: "Email Campaigns",      cmd: "/emails", run: "manual", launch:{type:"prompt", text:"/emails"} },
        { name: "PR / Backlinks",       cmd: "/public-relations · bandana press", run: "manual", launch:{type:"prompt", text:"/public-relations"} },
        { name: "Marketing Toolkit",    cmd: "40+ skills", run: "manual", launch:{type:"menu"}, children: [
            { name:"Copywriting", cmd:"/copywriting" }, { name:"Content Strategy", cmd:"/content-strategy" },
            { name:"Ad Creative", cmd:"/ad-creative" }, { name:"Ads", cmd:"/ads" },
            { name:"Cold Email", cmd:"/cold-email" }, { name:"SMS", cmd:"/sms" },
            { name:"CRO", cmd:"/cro" }, { name:"Pricing", cmd:"/pricing" },
            { name:"Launch", cmd:"/launch" }, { name:"Referrals", cmd:"/referrals" },
            { name:"Competitors", cmd:"/competitors" }, { name:"Schema", cmd:"/schema" },
            { name:"Site Architecture", cmd:"/site-architecture" }, { name:"Programmatic SEO", cmd:"/programmatic-seo" }
        ]}
      ]
    },
    {
      id: "deliverables", name: "Deliverables", icon: "📄", tag: "the press", agent: "Ross",
      blurb: "Stamp finished thinking into a 4-format artifact.",
      skills: [
        { name: "Build a Document",   cmd: "/build-doc", run: "manual", launch:{type:"prompt", text:"/build-doc"} },
        { name: "Kick Off a Project", cmd: "/kickoff", run: "manual", launch:{type:"prompt", text:"/kickoff"} },
        { name: "Convert Media",      cmd: "/media", run: "manual", launch:{type:"prompt", text:"/media"} },
        { name: "Brand a Deck",       cmd: "self-contained HTML", run: "manual", launch:{type:"prompt", text:"Build a single self-contained click-through HTML deck for:"} },
        { name: "Audit / Count Sheets",cmd:"print-ready landscape", run: "manual", launch:{type:"prompt", text:"Make a print-ready landscape count/audit sheet for:"} }
      ]
    },
    {
      id: "planetiq", name: "PlanetIQ", icon: "📊", tag: "the numbers", agent: "Gunther",
      blurb: "Know the truth about the money, then price and decide on it.",
      skills: [
        { name: "Feed PlanetIQ",  cmd: "/feed", run: "auto", launch:{type:"prompt", text:"/feed"} },
        { name: "IQ Gate",        cmd: "/planetiq", run: "manual", launch:{type:"prompt", text:"/planetiq"} },
        { name: "Month-End Close",cmd: "invoice tracker + report", run: "auto", launch:{type:"info"} },
        { name: "Pricing Matrix", cmd: "30-tier × 6-color ENGINE", run: "manual", launch:{type:"prompt", text:"Quote off the pricing matrix (use the ENGINE tab) for:"} },
        { name: "Categorize / P&L",cmd:"subs audit · anomaly scan", run: "manual", launch:{type:"prompt", text:"Run finance: categorize transactions / monthly P&L / anomaly scan."} }
      ]
    },
    {
      id: "production", name: "Production Ops", icon: "🏭", tag: "the floor", agent: "Pete",
      blurb: "Make the work move through the building.",
      skills: [
        { name: "PlanetOps Dashboard", cmd: "tray · search · writeback", run: "auto", launch:{type:"link", url:"https://planetholly.github.io/planetops"} },
        { name: "Press Capacity",      cmd: "heatmap · 420/600 cap", run: "auto", launch:{type:"link", url:"https://planetholly.github.io/planetops/capacity/"} },
        { name: "Refresh the Gauge",   cmd: "/gauge · after scheduling", run: "manual", launch:{type:"prompt", text:"/gauge"} },
        { name: "Scheduling Policy",   cmd: "12-day turn · rush gate", run: "manual", launch:{type:"link", url:"https://planetholly.github.io/planetops/priority-guide/"} },
        { name: "ShipStation Inventory",cmd:"V2 API · bins · barcodes", run: "auto", launch:{type:"info"} },
        { name: "Packaging Tracking",  cmd: "in-house QC / rebox / ship", run: "manual", launch:{type:"prompt", text:"Log the in-house Packaging imprint (QC/rebox/ship) for this outsourced job."} },
        { name: "Fulfillment / Split-Ship",cmd:"I&V · $39.99/location", run: "manual", launch:{type:"prompt", text:"Set up fulfillment / split-shipment handling for:"} }
      ]
    },
    {
      id: "brain", name: "The Brain", icon: "🧠", tag: "upkeep", agent: "Toby",
      blurb: "Keep the whole OS remembering, healthy, and organized.",
      skills: [
        { name: "Dream",            cmd: "/dream · 24h consolidate", run: "sched", launch:{type:"prompt", text:"/dream"} },
        { name: "Checkpoint",       cmd: "/checkpoint · per-session", run: "auto", launch:{type:"prompt", text:"/checkpoint"} },
        { name: "File Organization",cmd: "/file-organization", run: "manual", launch:{type:"prompt", text:"/file-organization"} },
        { name: "Sort Drive",       cmd: "/sort-drive", run: "manual", launch:{type:"prompt", text:"/sort-drive"} },
        { name: "Vault Health",     cmd: "raw→wiki→output", run: "manual", launch:{type:"prompt", text:"Check vault health: raw→wiki→output upkeep and MEMORY.md index."} }
      ]
    },
    {
      id: "decisions", name: "Decisions", icon: "🧭", tag: "the room", agent: "Phoebe",
      blurb: "The room you walk into when the answer isn't obvious.",
      skills: [
        { name: "Push an Idea 10x", cmd: "/phoebe", run: "manual", launch:{type:"prompt", text:"/phoebe"} },
        { name: "The Boardroom",  cmd: "/boardroom", run: "manual", launch:{type:"prompt", text:"/boardroom"} },
        { name: "Decision Walk",  cmd: "/tony · OOC/EMR", run: "manual", launch:{type:"prompt", text:"/tony"} },
        { name: "Career Context", cmd: "/career", run: "manual", launch:{type:"prompt", text:"/career"} },
        { name: "Constitution",   cmd: "/constitution", run: "manual", launch:{type:"prompt", text:"/constitution"} }
      ]
    }
  ],

  tools: ["GitHub","Anthropic API","Gmail","Google Calendar","Google Drive","Streak CRM",
          "Printavo","n8n · Railway","Fireflies","NotebookLM","ShipStation","WhatConverts","Obsidian"],


  /* The live fleet — every scheduled/automatic agent action. Snapshot from the
     n8n API + Claude routines; refresh by telling Claude: "refresh the fleet list". */
  fleet: {
    snapshot: "2026-07-02",
    timed: [
      { n:"ESTELLE · ARB Hot Alert (Inbox #6)",              who:"Chandler", when:"every 3 min" },
      { n:"RELAY · One Thread — Printavo Status Detector (mutex + ledger)", who:"Rachel", when:"every 5 min (DRY_RUN until cutover)" },
      { n:"SOPHIE · WhatConverts ↔ Streak ↔ Printavo Sync", who:"Rachel",   when:"every 7 min" },
      { n:"Calendly booking watcher → email",      who:"Rachel",   when:"every 10 min" },
      { n:"URSULA · Spam Highlight — quote@",               who:"Rachel",   when:"every 30 min" },
      { n:"RUNNER · Bandana Blanks — Order Queue Feed",     who:"Pete",     when:"hourly at :15 & :45" },
      { n:"GREEN CREW · Retention ① Convert (paid → box)",      who:"Rachel",   when:"hourly at :00" },
      { n:"HECKLES · Retention ② Open-Deal Guard",           who:"Rachel",   when:"hourly at :00" },
      { n:"LEDGER · Invoice Tracker — LIVE POLL",           who:"Gunther",  when:"hourly at :15" },
      { n:"SCOUT · Expenses — AI inbox sweep",     who:"Gunther",  when:"hourly at :20 (1am–1pm PT)" },
      { n:"SOPHIE · Sale Box — PM Enrich (Pass 1)",         who:"Rachel",   when:"hourly at :30 (1:30am–1:30pm PT)" },
      { n:"SOPHIE · Sale Box — Conversion Finalize (2a)",   who:"Rachel",   when:"hourly at :50 (1:50am–1:50pm PT)" },
      { n:"SCOUT · Expenses — EXP self-email intake",      who:"Gunther",  when:"every 2h at :10" },
      { n:"GREEN CREW · Retention ③ Enrich (invoice correction)",who:"Rachel",  when:"daily 2:00am PT" },
      { n:"LEDGER · Invoice Tracker — TERMS & AGED sweep",  who:"Gunther",  when:"daily 3:40am PT" },
      { n:"SOPHIE · WC Trigger 2 — payment re-label",       who:"Rachel",   when:"daily 6:00am PT" },
      { n:"MARCEL · Production Time Capture v2",            who:"Pete",     when:"daily 6:00am PT" },
      { n:"JANICE · Inbox Classifier-Dispatcher (config: _Claude/Janice/config.json; wfs: \"Janice — Inbox Classifier\" + \"Janice — Customer-Replied Alert\")", who:"Chandler", when:"2×/day 6:30a & 12:30p PT" },
      { n:"GREEN CREW · Retention — Daily Recompute (A.1)",     who:"Rachel",   when:"daily 9:00pm PT" },
      { n:"LEDGER · Month-End — next-month tab",            who:"Gunther",  when:"daily 11:00pm PT (acts at month roll)" },
      { n:"GAUGE · Press-capacity feed",who:"Pete",    when:"4×/day, working hours PT" },
      { n:"GAUGE · Freshness monitor",   who:"Pete",     when:"4×/day at :40 PT" },
      { n:"PULSE · PlanetPulse — FEED WATCHDOG",           who:"Gunther",  when:"4×/day at :23" },
      { n:"PULSE · PRODUCTION-COST WATCHDOG",who:"Gunther",  when:"weekdays 9:20am PT" },
      { n:"PAYDAY · Fork A payroll auto-ingest", who:"Gunther",  when:"2:15am & 7:15am PT, payroll-window days" },
      { n:"PAYDAY · payroll folder watch → Kelly",who:"Gunther", when:"hourly 2:45–9:45am PT, payroll-window days" },
      { n:"TREEGER · weekly fleet digest",       who:"Chandler", when:"Sundays ~6:00am PT" },
      { n:"TOBY · /dream — memory consolidation",         who:"Toby",     when:"every 24h (session-start hook)" },
    ],
    event: [
      { n:"TREEGER · any workflow fails → investigate, self-heal, alert", who:"Chandler", when:"on error, instantly" },
      { n:"TAG · WC form lead → Streak box (create/enrich/dedupe)",  who:"Rachel", when:"on form submit" },
      { n:"TAG · WC transaction → Streak box",                        who:"Rachel", when:"on payment event" },
      { n:"MARK · Bandana Quick-Quote (Engines 1-5: EasyPost ship est · sheet price · reply from bandanas@ in minutes · Streak scaffold · Printavo fill) — TEST MODE, go-live pending gate", who:"Rachel", when:"on quote-form email (poll 1 min)" },
      { n:"RELAY · One Thread Composer — status event → threaded email/draft into the ONE project thread + PM Chat nudge + silent approve/pay actions (DRY_RUN until cutover)", who:"Rachel", when:"on Printavo status change (via detector)" },
      { n:"PlanetOps app services (Printavo · ShipStation · inventory · deduct · timers · gauge · estimator)", who:"Pete", when:"on app use — 7 webhook endpoints" },
      { n:"Google Workspace MCP servers (Holly · Kelly · Jean terminals)", who:"Chandler", when:"on demand from Claude Code" },
      { n:"TOBY · /checkpoint — session memory save",                  who:"Toby",   when:"on every session close" }
    ]
  },

  memory: [
    { folder:"raw/",  desc:"Landing zone — dump anything: research, screenshots, PDFs, transcripts." },
    { folder:"wiki/ = Brain/", desc:"LLM-maintained. 152 distilled notes, auto-indexed by /dream & /checkpoint." },
    { folder:"output/", desc:"Finished deliverables — the 4-format docs you hand to a client." }
  ],

  alerts: [
    { id:"streak-merge", sev:"red", title:"Streak lead-merge intermittent on new leads", detail:"Per-user Gmail sync failure on Streak's side; some new leads don't auto-merge. 9 boxes chip-less, so Shara must use the extension to 'Add to Box'.", owner:"Rachel", since:"2026-07-13", status:"active", fixedOn:null },
    { id:"qc-hosting", sev:"amber", title:"QC gate form has no host yet", detail:"QC v2 rebuilt and trialed; hosting is undecided, which blocks Malia running QC solo.", owner:"Pete", since:"2026-07-14", status:"active", fixedOn:null }
  ],

  changelog: [
    { date:"2026-07-14", type:"ship", component:"Systems", what:"/orchestrate skill added — Fable plans, Codex builds", owner:"Chandler" },
    { date:"2026-07-13", type:"break", component:"Streak", what:"Lead ingestion/merge outage begins (Streak-side Gmail sync)", owner:"Rachel" },
    { date:"2026-07-13", type:"fix", component:"Retention", what:"Back-fill wrote wrong data 2 wks (silent) — corrected; watchdog now live daily 08:45", owner:"Rachel" },
    { date:"2026-07-13", type:"ship", component:"PlanetOps", what:"Timer system deployed live (7 commits); Printavo write-back proven", owner:"Pete" }
  ]
};
