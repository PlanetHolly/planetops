// Generated 2026-07-30. Generated from live_statuses_FINAL_2026-07-27.json, build_status_reference.py REF, composer_workflow.json Config.NUDGE_TRIGGERS, resolver.js, taxonomy_mock.html.
const SIM_FALLBACK_STATUSES = [
  {
    "id": "390316",
    "name": "Quote",
    "type": "QUOTE",
    "color": "#6FB6F2"
  },
  {
    "id": "548869",
    "name": "🗣️ In Conversation",
    "type": "QUOTE",
    "color": "#6FB6F2"
  },
  {
    "id": "548870",
    "name": "⏳ Waiting on Customer",
    "type": "QUOTE",
    "color": "#F79A45"
  },
  {
    "id": "548871",
    "name": "🎾 In Our Court",
    "type": "QUOTE",
    "color": "#6FB6F2"
  },
  {
    "id": "548872",
    "name": "📌 Follow-Up Pre-Quote (Streak Task)",
    "type": "QUOTE",
    "color": "#E84FA8"
  },
  {
    "id": "548006",
    "name": "🛒 Sample Pack – Prep & Ship",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "548873",
    "name": "🛒 Sample Pack Purchased → Samples Sent",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "428338",
    "name": "📮 Quote Approval - Drafted, Ready To Send",
    "type": "QUOTE",
    "color": "#C9C4BA"
  },
  {
    "id": "548874",
    "name": "📮 Quote 1st Check In - Drafted, Ready To Send",
    "type": "QUOTE",
    "color": "#1E7BD1"
  },
  {
    "id": "548875",
    "name": "📮 Quote 2nd Check In - Drafted, Ready To Send",
    "type": "QUOTE",
    "color": "#1663B0"
  },
  {
    "id": "548876",
    "name": "📮 Quote 3rd Check In - Drafted, Ready To Send",
    "type": "QUOTE",
    "color": "#0F4C8C"
  },
  {
    "id": "548987",
    "name": "📮 Quote Revised - Drafted, Ready To Send",
    "type": "QUOTE",
    "color": "#2D97F1"
  },
  {
    "id": "390317",
    "name": "🚀 Quote Approval - Auto Sent ",
    "type": "QUOTE",
    "color": "#C9C4BA"
  },
  {
    "id": "433065",
    "name": "🚀 Quote 1st Check In - Auto Sent ",
    "type": "QUOTE",
    "color": "#C9C4BA"
  },
  {
    "id": "433066",
    "name": "🚀 Quote 2nd Check In - Auto Sent ",
    "type": "QUOTE",
    "color": "#C9C4BA"
  },
  {
    "id": "433067",
    "name": "🚀 Quote 3rd Check In - Auto Sent",
    "type": "QUOTE",
    "color": "#C9C4BA"
  },
  {
    "id": "427399",
    "name": "🚀Quote Revised - Auto Sent ",
    "type": "QUOTE",
    "color": "#9AADBD"
  },
  {
    "id": "548877",
    "name": "📌 Quote Sent Manually (Streak Task)",
    "type": "QUOTE",
    "color": "#C9C4BA"
  },
  {
    "id": "427398",
    "name": "✏️ Quote Declined — Update Needed",
    "type": "QUOTE",
    "color": "#E2445C"
  },
  {
    "id": "548878",
    "name": "❌ Quote Declined — Lost",
    "type": "QUOTE",
    "color": "#AEA38E"
  },
  {
    "id": "390318",
    "name": "✅ Quote Approved — Ready for Mockup",
    "type": "QUOTE",
    "color": "#00C875"
  },
  {
    "id": "427405",
    "name": "🎨 Art — In-House",
    "type": "QUOTE",
    "color": "#C5A9EF"
  },
  {
    "id": "427406",
    "name": "🎨 Art — Seps.io",
    "type": "QUOTE",
    "color": "#C5A9EF"
  },
  {
    "id": "548879",
    "name": "🖼️ Mockup Options — Awaiting Feedback",
    "type": "QUOTE",
    "color": "#F79A45"
  },
  {
    "id": "548880",
    "name": "🛠️ Files Being Reworked — Seps.io",
    "type": "QUOTE",
    "color": "#C5A9EF"
  },
  {
    "id": "464181",
    "name": "Pre-Approval Payment Export",
    "type": "QUOTE",
    "color": "#C9C4BA"
  },
  {
    "id": "427878",
    "name": "📮→️🚀 Art/Order — Ready for Approval (Terms Only) ",
    "type": "QUOTE",
    "color": "#2D97F1"
  },
  {
    "id": "390319",
    "name": "📮→️🚀 Art / Invoice Approval Sent",
    "type": "QUOTE",
    "color": "#2D97F1"
  },
  {
    "id": "483858",
    "name": "📮→️🚀 Follow Up — Art / Invoice Approval Sent",
    "type": "QUOTE",
    "color": "#2D97F1"
  },
  {
    "id": "427879",
    "name": "📮→️🚀 Revised Art / Invoice Approval Sent ",
    "type": "QUOTE",
    "color": "#2D97F1"
  },
  {
    "id": "427880",
    "name": "✏️ Art/Invoice Declined — Update Needed ",
    "type": "QUOTE",
    "color": "#E2445C"
  },
  {
    "id": "548881",
    "name": "❌ Art/Invoice Declined — Lost",
    "type": "QUOTE",
    "color": "#AEA38E"
  },
  {
    "id": "390320",
    "name": "💰 Approved — Awaiting Payment",
    "type": "INVOICE",
    "color": "#F9D724"
  },
  {
    "id": "548882",
    "name": "✅ Approved — No Payment Required",
    "type": "INVOICE",
    "color": "#00C875"
  },
  {
    "id": "427882",
    "name": "▶️ Paid / Terms — Ready for Production",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "548883",
    "name": "\t⚠️ Back to PM — Update Needed",
    "type": "INVOICE",
    "color": "#E2445C"
  },
  {
    "id": "548884",
    "name": "📝 Need to Order Apparel",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "548885",
    "name": "🔻 Need to Order Bandanas",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "548886",
    "name": "🔻📦 Bandanas Pull & Ship (Bear Designz)",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "428346",
    "name": "🏠 Bandanas to Pull   from In-House Inventory",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "454916",
    "name": "⏳ Awaiting Blanks — Ordered",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "428347",
    "name": "📥 Blanks Partially Received ",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "427884",
    "name": "📥 Blanks Received - Not Checked In",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "428348",
    "name": "🔢 Blanks Counted In — Ready for Production",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "548888",
    "name": "🚛 Awaiting DTF Transfers",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "548889",
    "name": "🚛 Awaiting DTF Transfers — Blanks Received",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "548890",
    "name": "🚛 Awaiting DTF Transfers — Blanks Counted / Ready",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "548891",
    "name": "✅ QC Passed ",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "548892",
    "name": "🔜 Next Up (Queued for Production)",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "390322",
    "name": "🖨️ In Production",
    "type": "INVOICE",
    "color": "#9C69E7"
  },
  {
    "id": "390328",
    "name": "⏸️ Production On Hold",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "427885",
    "name": "➡️ Ready for Post Production ",
    "type": "INVOICE",
    "color": "#9C69E7"
  },
  {
    "id": "483386",
    "name": "🧵 In Post Production",
    "type": "INVOICE",
    "color": "#9C69E7"
  },
  {
    "id": "390323",
    "name": "📦 Production Completed — Ready to Package",
    "type": "INVOICE",
    "color": "#9C69E7"
  },
  {
    "id": "548887",
    "name": "📤 Need to Send PO (Outsourced)",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "548893",
    "name": "📤 PO Sent — In Production (Outsourced)",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "548985",
    "name": "📍 Ready at Vendor (Outsourced)",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "548894",
    "name": "🪡 Out for Service (Outsourced — Sewing)",
    "type": "INVOICE",
    "color": "#9AADBD"
  },
  {
    "id": "548895",
    "name": "🧶 Out for Service (Outsourced — Embroidery)",
    "type": "INVOICE",
    "color": "#9AADBD"
  },
  {
    "id": "548896",
    "name": "🖌️ Out for Service (Outsourced — Screen Print)",
    "type": "INVOICE",
    "color": "#9AADBD"
  },
  {
    "id": "541429",
    "name": "🚚 In Transit to PA (Outsourced)",
    "type": "INVOICE",
    "color": "#9AADBD"
  },
  {
    "id": "467925",
    "name": "📥 Goods Partially Received ",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "467926",
    "name": "📥 Goods Received",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "467927",
    "name": "🔢 Goods Counted In — Ready for Post Production ",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "485579",
    "name": "🏷️ Production Completed — Waiting for ShipBob ",
    "type": "INVOICE",
    "color": "#F79A45"
  },
  {
    "id": "390324",
    "name": "🛍️ Order Ready for Pickup",
    "type": "INVOICE",
    "color": "#394759"
  },
  {
    "id": "427877",
    "name": "🚙 Order Ready for Delivery",
    "type": "INVOICE",
    "color": "#394759"
  },
  {
    "id": "390325",
    "name": "✈️ Order Shipped",
    "type": "INVOICE",
    "color": "#394759"
  },
  {
    "id": "431010",
    "name": "🏁 Delivered / Picked Up",
    "type": "INVOICE",
    "color": "#00C875"
  },
  {
    "id": "427400",
    "name": "🗄️ Archived Quote",
    "type": "QUOTE",
    "color": "#AEA38E"
  },
  {
    "id": "428340",
    "name": " 📁 Archived Options 📁",
    "type": "QUOTE",
    "color": "#AEA38E"
  }
];

const SIM_OVERLAY = {
  "390316": {
    "id": "390316",
    "phase": "Quote & Chase",
    "description": "A fresh inquiry or quote being built.",
    "flavor": "nudge",
    "automation": "None — the manual starting point.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "QUOTE_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "3 business days of no movement → the owner gets nudged.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "New quote has been untouched for 3 business days.",
        "suggestion": "Big one. Draft's ready below — give Summit a quick call, then send.",
        "buttons": [
          {
            "label": "Review draft",
            "kind": "link"
          },
          {
            "label": "Call",
            "kind": "link"
          },
          {
            "label": "Open",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "390317": {
    "id": "390317",
    "phase": "Quote & Chase",
    "description": "Quote approval sent — the auto-chase starts here.",
    "flavor": "customer",
    "automation": "automations.io #1150 auto-sends the quote + approval request. 🔴 never delete.",
    "scriptCodes": [
      "^ot_quote_sent"
    ]
  },
  "390318": {
    "id": "390318",
    "phase": "Quote & Chase",
    "description": "Customer approved the quote.",
    "flavor": "internal",
    "automation": "Printavo auto-moves here on approval. One Thread confirmation.",
    "scriptCodes": [
      "^ot_quote_approved_confirmation"
    ]
  },
  "390319": {
    "id": "390319",
    "phase": "Art & Approval",
    "description": "Approval + invoice sent to the customer.",
    "flavor": "customer",
    "automation": "Native: request approval + email. Draft → 10-min auto-send.",
    "scriptCodes": [
      "^ot_art_invoice_approval"
    ]
  },
  "390320": {
    "id": "390320",
    "phase": "Art & Approval",
    "description": "Approved; waiting on payment.",
    "flavor": "customer",
    "automation": "Native: request 100% + email (no-terms). Pay nudge +2 h if still unpaid.",
    "scriptCodes": [
      "^ot_pay_button_touch"
    ]
  },
  "390322": {
    "id": "390322",
    "phase": "Production Floor",
    "description": "On the press / being decorated.",
    "flavor": "internal",
    "automation": "Auto-set by the 'printing started' work-step.",
    "scriptCodes": []
  },
  "390323": {
    "id": "390323",
    "phase": "Production Floor",
    "description": "Made; ready to pack.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "390324": {
    "id": "390324",
    "phase": "Fulfillment & Done",
    "description": "Ready for customer pickup.",
    "flavor": "customer",
    "automation": "Native: email customer + request 100% payment.",
    "scriptCodes": [
      "^ot_ready_for_pickup_notice"
    ]
  },
  "390325": {
    "id": "390325",
    "phase": "Fulfillment & Done",
    "description": "Shipped.",
    "flavor": "customer",
    "automation": "Native: email customer + request 100% payment.",
    "scriptCodes": [
      "^ot_shipped_tracking"
    ]
  },
  "390328": {
    "id": "390328",
    "phase": "Production Floor",
    "description": "Paused.",
    "flavor": "internal",
    "automation": "Auto-set by the 'printing pause' work-step.",
    "scriptCodes": []
  },
  "427398": {
    "id": "427398",
    "phase": "Quote & Chase",
    "description": "Customer declined; needs a revision.",
    "flavor": "nudge",
    "automation": "Printavo auto-moves here on decline. Internal PM alert.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "DECLINED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "On entry, the owner gets nudged if the order needs a human save attempt.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Customer declined and this account still needs a human save attempt.",
        "suggestion": "Summit declined Summit Trading Co. Worth a call — see what changed, offer a revise.",
        "buttons": [
          {
            "label": "Call",
            "kind": "link"
          },
          {
            "label": "Open",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "427399": {
    "id": "427399",
    "phase": "Quote & Chase",
    "description": "A revised quote, auto-sent, that re-enters the chase. NEW name for 427399. 🔴 never delete (chase start-trigger).",
    "flavor": "customer",
    "automation": "Native emails the revised quote. Script: “Your updated quote is ready for approval. Click to approve, or let us know any changes you need.”",
    "scriptCodes": [
      "^ot_quote_revised"
    ]
  },
  "427400": {
    "id": "427400",
    "phase": "Fulfillment & Done",
    "description": "Dead-quote storage.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "427405": {
    "id": "427405",
    "phase": "Art & Approval",
    "description": "Artwork being created in-house.",
    "flavor": "internal",
    "automation": "📨 Native email to Luis on entry.",
    "scriptCodes": []
  },
  "427406": {
    "id": "427406",
    "phase": "Art & Approval",
    "description": "Artwork outsourced to Seps.io.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "427877": {
    "id": "427877",
    "phase": "Fulfillment & Done",
    "description": "Ready to deliver.",
    "flavor": "customer",
    "automation": "Native: email customer + request 100% payment.",
    "scriptCodes": [
      "^ot_ready_for_delivery_notice"
    ]
  },
  "427878": {
    "id": "427878",
    "phase": "Art & Approval",
    "description": "Approval request for terms customers.",
    "flavor": "nudge",
    "automation": "Native: request approval. One Thread drafts, then auto-sends in 10 min if untouched.",
    "scriptCodes": [
      "^ot_terms_art_approval"
    ],
    "nudge": {
      "trigger": "APPROVAL_DRAFT_READY",
      "chatKey": "DRAFT",
      "chatName": "Draft",
      "chatEmoji": "📮",
      "chatColor": "#2D97F1",
      "ruleText": "On entry, the owner gets a draft/nudge card.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Approval draft is ready for PM review.",
        "suggestion": "Approval email's drafted. Review and send.",
        "buttons": [
          {
            "label": "Open draft",
            "kind": "link"
          },
          {
            "label": "Edit",
            "kind": "link"
          },
          {
            "label": "Don't send",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "427879": {
    "id": "427879",
    "phase": "Art & Approval",
    "description": "A revised approval sent.",
    "flavor": "customer",
    "automation": "Native: request approval + email. Draft → 10-min auto-send.",
    "scriptCodes": [
      "^ot_revised_art_invoice_approval"
    ]
  },
  "427880": {
    "id": "427880",
    "phase": "Art & Approval",
    "description": "Art or invoice declined; needs an update.",
    "flavor": "nudge",
    "automation": "Printavo auto-moves here on decline. Internal PM alert.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "DECLINED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "On entry, the owner gets nudged if the order needs a human save attempt.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Customer declined and this account still needs a human save attempt.",
        "suggestion": "Summit declined Summit Trading Co. Worth a call — see what changed, offer a revise.",
        "buttons": [
          {
            "label": "Call",
            "kind": "link"
          },
          {
            "label": "Open",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "427882": {
    "id": "427882",
    "phase": "Paid & Pre-Production",
    "description": "Paid; ready to build.",
    "flavor": "nudge",
    "automation": "5 native automations at once: FoH email (Holly + Malia), Jean (blanks), Luis (prep), daily-sales tracker, and adds the job to the Power Scheduler.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "ORDER_CONVERTED",
      "chatKey": "WON",
      "chatName": "Won",
      "chatEmoji": "💰",
      "chatColor": "#0FB477",
      "ruleText": "On entry, the owner gets a draft/nudge card.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Order entered the approved/paid production-ready moment.",
        "suggestion": "Approved and paid — it is a real order now. Prep for production: confirm blanks, art, and due date. Priority build — flag it in the schedule.",
        "buttons": [
          {
            "label": "Open in Printavo",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "427884": {
    "id": "427884",
    "phase": "Paid & Pre-Production",
    "description": "Blanks arrived but not yet counted in.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "427885": {
    "id": "427885",
    "phase": "Production Floor",
    "description": "Ready for finishing.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "428338": {
    "id": "428338",
    "phase": "Quote & Chase",
    "description": "First quote send — the draft is ready; the PM reviews and sends it.",
    "flavor": "nudge",
    "automation": "Native: attaches the approve/pay button. One Thread drafts the quote email.",
    "scriptCodes": [
      "^ot_quote_sent"
    ],
    "nudge": {
      "trigger": "QUOTE_DRAFT_READY",
      "chatKey": "DRAFT",
      "chatName": "Draft",
      "chatEmoji": "📮",
      "chatColor": "#2D97F1",
      "ruleText": "On entry, the owner gets a draft/nudge card.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quote draft is ready for PM review.",
        "suggestion": "Quote's drafted. Give it a personal read, then send.",
        "buttons": [
          {
            "label": "Open draft",
            "kind": "link"
          },
          {
            "label": "Edit",
            "kind": "link"
          },
          {
            "label": "Don't send",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "428340": {
    "id": "428340",
    "phase": "Fulfillment & Done",
    "description": "Archived quote-option storage.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "428346": {
    "id": "428346",
    "phase": "Paid & Pre-Production",
    "description": "Stock confirmed; pull bandanas and decorate in-house.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "428347": {
    "id": "428347",
    "phase": "Paid & Pre-Production",
    "description": "Some blanks have arrived.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "428348": {
    "id": "428348",
    "phase": "Paid & Pre-Production",
    "description": "Counted and ready.",
    "flavor": "internal",
    "automation": "Auto-set by the 'blanks completed' work-step.",
    "scriptCodes": []
  },
  "431010": {
    "id": "431010",
    "phase": "Fulfillment & Done",
    "description": "Complete.",
    "flavor": "customer",
    "automation": "Kicks a review request — #annual accounts only.",
    "scriptCodes": [
      "^ot_review_request"
    ]
  },
  "433065": {
    "id": "433065",
    "phase": "Quote & Chase",
    "description": "Automatic follow-ups on the timer.",
    "flavor": "customer",
    "automation": "#1150 auto-sends at +1 / +2 / +5 wd. 🔴 never delete.",
    "scriptCodes": [
      "^ot_chase_2"
    ]
  },
  "433066": {
    "id": "433066",
    "phase": "Quote & Chase",
    "description": "Automatic follow-ups on the timer.",
    "flavor": "customer",
    "automation": "#1150 auto-sends at +1 / +2 / +5 wd. 🔴 never delete.",
    "scriptCodes": [
      "^ot_chase_3"
    ]
  },
  "433067": {
    "id": "433067",
    "phase": "Quote & Chase",
    "description": "Automatic follow-ups on the timer.",
    "flavor": "customer",
    "automation": "#1150 auto-sends at +1 / +2 / +5 wd. 🔴 never delete.",
    "scriptCodes": [
      "^ot_chase_final"
    ]
  },
  "454916": {
    "id": "454916",
    "phase": "Paid & Pre-Production",
    "description": "Blanks ordered, waiting on arrival.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "464181": {
    "id": "464181",
    "phase": "Outside Customer Flow",
    "description": "The sanctioned QBO pre-payment export lever.",
    "flavor": "internal",
    "automation": "Kept — load-bearing for QuickBooks. Do not touch.",
    "scriptCodes": []
  },
  "467925": {
    "id": "467925",
    "phase": "Outsourced lane",
    "description": "Some outsourced goods arrived.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "467926": {
    "id": "467926",
    "phase": "Outsourced lane",
    "description": "Outsourced goods arrived.",
    "flavor": "internal",
    "automation": "Native email to the order owner.",
    "scriptCodes": []
  },
  "467927": {
    "id": "467927",
    "phase": "Outsourced lane",
    "description": "Counted; ready for finishing.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "483386": {
    "id": "483386",
    "phase": "Production Floor",
    "description": "In finishing.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "483858": {
    "id": "483858",
    "phase": "Art & Approval",
    "description": "Follow-up on a pending approval.",
    "flavor": "customer",
    "automation": "Native: email customer + PM. Draft → 10-min auto-send.",
    "scriptCodes": [
      "^ot_art_invoice_followup"
    ]
  },
  "485579": {
    "id": "485579",
    "phase": "Fulfillment & Done",
    "description": "Done; awaiting ShipBob fulfillment.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "541429": {
    "id": "541429",
    "phase": "Outsourced lane",
    "description": "Goods shipping back to us.",
    "flavor": "internal",
    "automation": "📨 Native email to Jean.",
    "scriptCodes": []
  },
  "548006": {
    "id": "548006",
    "phase": "Quote & Chase",
    "description": "A sample-pack order to prep and ship.",
    "flavor": "customer",
    "automation": "Auto-sends the sample confirmation.",
    "scriptCodes": [
      "^ot_sample_shipped"
    ]
  },
  "548869": {
    "id": "548869",
    "phase": "Quote & Chase",
    "description": "Live back-and-forth with the customer.",
    "flavor": "nudge",
    "automation": "Silent while active; a Stale nudge fires after 3 business days of quiet.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "IN_CONVERSATION_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "3 business days of no customer reply → the owner gets nudged.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Live conversation has been quiet for 3 business days.",
        "suggestion": "Chat with Summit stalled. Draft's ready — a call would help too.",
        "buttons": [
          {
            "label": "Review draft",
            "kind": "link"
          },
          {
            "label": "Call",
            "kind": "link"
          },
          {
            "label": "Open",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548870": {
    "id": "548870",
    "phase": "Quote & Chase",
    "description": "Customer asked for time — the ball is on their side.",
    "flavor": "internal",
    "automation": "Waiting-bump ladder +3 / +5 / +7 working days, then parks.",
    "scriptCodes": []
  },
  "548871": {
    "id": "548871",
    "phase": "Quote & Chase",
    "description": "The ball is on us to move it forward.",
    "flavor": "internal",
    "automation": "Stale nudge after 3 business days.",
    "scriptCodes": []
  },
  "548872": {
    "id": "548872",
    "phase": "Quote & Chase",
    "description": "PM has a task to finish before a quote goes out.",
    "flavor": "nudge",
    "automation": "PM nudge on the set date / recurring every 7 bd.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "FOLLOW_UP_DUE",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "PM follow-up date is due; repeats every 7 business days until the owner moves it.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "PM-set follow-up is due.",
        "suggestion": "Your follow-up on Summit Trading Co is due. Do it or move the order.",
        "buttons": [
          {
            "label": "Open",
            "kind": "link"
          },
          {
            "label": "Snooze",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548873": {
    "id": "548873",
    "phase": "Quote & Chase",
    "description": "Samples have shipped to the buyer.",
    "flavor": "customer",
    "automation": "Sample check-in ladder +3 / +2 / +5 bd drafted to the PM; 3rd no-reply → chat Shara.",
    "scriptCodes": [
      "^ot_sample_arrival_checkin"
    ]
  },
  "548874": {
    "id": "548874",
    "phase": "Quote & Chase",
    "description": "Timed quote follow-ups, drafted for the PM to send.",
    "flavor": "nudge",
    "automation": "Draft check-in ladder +1 / +2 / +5 wd. Needs the cadence engine.",
    "scriptCodes": [
      "^ot_chase_2"
    ],
    "nudge": {
      "trigger": "QUOTE_DRAFT_READY",
      "chatKey": "DRAFT",
      "chatName": "Draft",
      "chatEmoji": "📮",
      "chatColor": "#2D97F1",
      "ruleText": "On entry, the owner gets a draft/nudge card.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quote draft is ready for PM review.",
        "suggestion": "Quote's drafted. Give it a personal read, then send.",
        "buttons": [
          {
            "label": "Open draft",
            "kind": "link"
          },
          {
            "label": "Edit",
            "kind": "link"
          },
          {
            "label": "Don't send",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548875": {
    "id": "548875",
    "phase": "Quote & Chase",
    "description": "Timed quote follow-ups, drafted for the PM to send.",
    "flavor": "nudge",
    "automation": "Draft check-in ladder +1 / +2 / +5 wd. Needs the cadence engine.",
    "scriptCodes": [
      "^ot_chase_3"
    ],
    "nudge": {
      "trigger": "QUOTE_DRAFT_READY",
      "chatKey": "DRAFT",
      "chatName": "Draft",
      "chatEmoji": "📮",
      "chatColor": "#2D97F1",
      "ruleText": "On entry, the owner gets a draft/nudge card.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quote draft is ready for PM review.",
        "suggestion": "Quote's drafted. Give it a personal read, then send.",
        "buttons": [
          {
            "label": "Open draft",
            "kind": "link"
          },
          {
            "label": "Edit",
            "kind": "link"
          },
          {
            "label": "Don't send",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548876": {
    "id": "548876",
    "phase": "Quote & Chase",
    "description": "Timed quote follow-ups, drafted for the PM to send.",
    "flavor": "nudge",
    "automation": "Draft check-in ladder +1 / +2 / +5 wd. Needs the cadence engine.",
    "scriptCodes": [
      "^ot_chase_final"
    ],
    "nudge": {
      "trigger": "QUOTE_DRAFT_READY",
      "chatKey": "DRAFT",
      "chatName": "Draft",
      "chatEmoji": "📮",
      "chatColor": "#2D97F1",
      "ruleText": "On entry, the owner gets a draft/nudge card.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quote draft is ready for PM review.",
        "suggestion": "Quote's drafted. Give it a personal read, then send.",
        "buttons": [
          {
            "label": "Open draft",
            "kind": "link"
          },
          {
            "label": "Edit",
            "kind": "link"
          },
          {
            "label": "Don't send",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548877": {
    "id": "548877",
    "phase": "Quote & Chase",
    "description": "PM sent a quote outside the flow; a Streak task tracks the follow-up.",
    "flavor": "internal",
    "automation": "PM nudge.",
    "scriptCodes": []
  },
  "548878": {
    "id": "548878",
    "phase": "Quote & Chase",
    "description": "Declined and dead.",
    "flavor": "nudge",
    "automation": "Nudge system auto-archives T2/T3; T1 / Retention get a call card.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "DECLINED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "On entry, the owner gets nudged if the order needs a human save attempt.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Customer declined and this account still needs a human save attempt.",
        "suggestion": "Summit declined Summit Trading Co. Worth a call — see what changed, offer a revise.",
        "buttons": [
          {
            "label": "Call",
            "kind": "link"
          },
          {
            "label": "Open",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548879": {
    "id": "548879",
    "phase": "Art & Approval",
    "description": "Mockup sent, waiting on customer feedback.",
    "flavor": "nudge",
    "automation": "Stale nudge on day 5.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "MOCKUP_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "5 business days of no movement → the owner gets nudged.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "No customer feedback on the mockup by day 5.",
        "suggestion": "No word on the mockup in 5 days. Call Summit.",
        "buttons": [
          {
            "label": "Review draft",
            "kind": "link"
          },
          {
            "label": "Call",
            "kind": "link"
          },
          {
            "label": "Open",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548880": {
    "id": "548880",
    "phase": "Art & Approval",
    "description": "Files being fixed by Seps.io.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548881": {
    "id": "548881",
    "phase": "Art & Approval",
    "description": "Declined and dead.",
    "flavor": "nudge",
    "automation": "Nudge system auto-archives (non-retention).",
    "scriptCodes": [],
    "nudge": {
      "trigger": "DECLINED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "On entry, the owner gets nudged if the order needs a human save attempt.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Customer declined and this account still needs a human save attempt.",
        "suggestion": "Summit declined Summit Trading Co. Worth a call — see what changed, offer a revise.",
        "buttons": [
          {
            "label": "Call",
            "kind": "link"
          },
          {
            "label": "Open",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548882": {
    "id": "548882",
    "phase": "Art & Approval",
    "description": "Approved, no payment needed (terms / DWC).",
    "flavor": "nudge",
    "automation": "None — moves straight to production.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "ORDER_CONVERTED",
      "chatKey": "WON",
      "chatName": "Won",
      "chatEmoji": "💰",
      "chatColor": "#0FB477",
      "ruleText": "On entry, the owner gets a draft/nudge card.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Order entered the approved/paid production-ready moment.",
        "suggestion": "Approved and paid — it is a real order now. Prep for production: confirm blanks, art, and due date. Priority build — flag it in the schedule.",
        "buttons": [
          {
            "label": "Open in Printavo",
            "kind": "link"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false
      }
    }
  },
  "548883": {
    "id": "548883",
    "phase": "Paid & Pre-Production",
    "description": "Kicked back to the PM for a fix.",
    "flavor": "internal",
    "automation": "Internal PM alert.",
    "scriptCodes": []
  },
  "548884": {
    "id": "548884",
    "phase": "Paid & Pre-Production",
    "description": "Apparel blanks to order (apparel is always ordered).",
    "flavor": "silent",
    "automation": "None — PM action.",
    "scriptCodes": []
  },
  "548885": {
    "id": "548885",
    "phase": "Paid & Pre-Production",
    "description": "In-house bandana stock is short; order more.",
    "flavor": "silent",
    "automation": "None — PM action.",
    "scriptCodes": []
  },
  "548886": {
    "id": "548886",
    "phase": "Paid & Pre-Production",
    "description": "Pull bandanas from stock and ship to Bear to decorate.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548887": {
    "id": "548887",
    "phase": "Paid & Pre-Production",
    "description": "An outsourced order that needs its purchase order sent to the vendor before production can start.",
    "flavor": "internal",
    "automation": "Internal working state — no customer email, no notification.",
    "scriptCodes": []
  },
  "548888": {
    "id": "548888",
    "phase": "Paid & Pre-Production",
    "description": "Waiting on DTF transfers.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548889": {
    "id": "548889",
    "phase": "Paid & Pre-Production",
    "description": "DTF pending, blanks in.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548890": {
    "id": "548890",
    "phase": "Paid & Pre-Production",
    "description": "DTF pending, blanks counted.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548891": {
    "id": "548891",
    "phase": "Paid & Pre-Production",
    "description": "Quality check passed.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548892": {
    "id": "548892",
    "phase": "Production Floor",
    "description": "Queued to run next.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548893": {
    "id": "548893",
    "phase": "Outsourced lane",
    "description": "PO sent; the vendor is producing.",
    "flavor": "silent",
    "automation": "None — tracked as a Streak task.",
    "scriptCodes": []
  },
  "548894": {
    "id": "548894",
    "phase": "Outsourced lane",
    "description": "Out at a sewing vendor.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548895": {
    "id": "548895",
    "phase": "Outsourced lane",
    "description": "Out at an embroidery vendor.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548896": {
    "id": "548896",
    "phase": "Outsourced lane",
    "description": "Out at a screen-print vendor.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548985": {
    "id": "548985",
    "phase": "Outsourced lane",
    "description": "Done at the vendor; awaiting our local pickup.",
    "flavor": "silent",
    "automation": "None.",
    "scriptCodes": []
  },
  "548987": {
    "id": "548987",
    "phase": "Quote & Chase",
    "description": "A revised quote (e.g. a new quantity) drafted for the PM to send. NEW.",
    "flavor": "customer",
    "automation": "Script: “Your updated quote is ready for approval. Click to approve, or let us know any changes you need.”",
    "scriptCodes": [
      "^ot_quote_revised"
    ]
  }
};

if (typeof module !== "undefined") module.exports = { SIM_FALLBACK_STATUSES, SIM_OVERLAY };
