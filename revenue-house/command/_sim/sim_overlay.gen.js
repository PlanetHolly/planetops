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
    "name": "🛒🚀 Sample Pack – Prep & Ship",
    "type": "INVOICE",
    "color": "#41D3DC"
  },
  {
    "id": "548873",
    "name": "🛒📮 Sample Pack Purchased → Samples Sent",
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
    "id": "549571",
    "name": "💬🔔 Quote Approval — Customer Replied",
    "type": "QUOTE",
    "color": "#2D97F1"
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
    "description": "Every new entry in Printavo lands here. Despite the name it is not a quote being chased; it means a new order that still needs to be built.",
    "flavor": "nudge",
    "automation": "The catch-all landing spot for every new Printavo entry, so nothing customer-facing is sent from here. It rarely sits here; the 3-day PM nudge is only a safety net so a new order never falls through the cracks.",
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
        "why": "Quiet for 3 business days",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Quote",
        "totalDays": "Box age: 8 days / days in status: 3 days"
      }
    },
    "streakFactor": "The box lives in Streak (project name, owner). The nudge watches Streak's Last Email Date - both outgoing and incoming; that's how it knows there's been no reply.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "30 days with no movement. In practice an order should almost never get here."
          },
          {
                "label": "What happens",
                "body": "The order is archived AUTOMATICALLY into 🗄️ Archived Quote (427400). No customer email, and no final PM nudge — the 3-day nudge has already fired roughly ten times by then, so one more adds nothing. Only this status and 💬 Quote Approval — Customer Replied 🔔 auto-archive; every other stall status drafts a notice and pings the PM."
          },
          {
                "label": "Close Date",
                "body": "Stamped on arrival in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "None. This is the placeholder every new Printavo entry lands in, not a quote lane, so no archive notice and no Missed Opportunity email go out."
          }
    ],
      "text": "30 days no movement \u2192 the order is archived AUTOMATICALLY into Archived Quote (427400). No customer email, and no final PM nudge either: the 3-day nudge has already fired roughly ten times by then, so one more adds nothing. This is the placeholder every new Printavo entry lands in, not a quote lane, so there is no archive notice and no Missed Opportunity email. In practice an order should almost never reach 30 days here. Only this status and Quote Approval — Customer Replied auto-archive; every other stall status drafts an archive notice and pings the PM instead."
    },
    "timed": false
  },
  "390317": {
    "id": "390317",
    "phase": "Quote & Chase",
    "description": "Quote approval sent — the auto-chase starts here.",
    "flavor": "customer",
    "automation": "Sends the customer the quote automatically — this is the auto-chase (auto-send) lane. A PM can move an order into an auto status at any point mid-sequence to switch it from drafting to auto-send. 🔴 never delete. 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_quote_sent"
    ],
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "The auto-chase runs itself on +1 / +2 / +5 working days. It stalls when the customer never replies."
          },
          {
                "label": "What happens",
                "body": "The archive notice is AUTO-SENT — no draft, no PM ping, this lane is hands-off. The order then moves itself to 🗄️ Archived Quote (427400)."
          },
          {
                "label": "Close Date",
                "body": "Stamped when the order lands in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "The auto-chase runs by itself (+1 / +2 / +5 working days). If the customer never replies, the final archive-notice email is AUTO-SENT (not drafted - this lane is hands-off), using the ^ot_missed_opportunity copy, then the order moves to Archived Quote (427400). T1 AND new customers only - return customers are handled by the retention pipeline - get the Missed Opportunity email +2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "archiveSendMode": "AUTO-SENT",
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    }
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
    "description": "Customer clicked Decline with a note and the quote needs a revision. Open troubleshoot: this reliably lands here only when the customer clicked Decline with a note; usually they just reply.",
    "flavor": "nudge",
    "automation": "DRAFTS a generic \"your updated quote is here\" email with the approve link/button, then posts an ACTION REQUIRED nudge to the 📮 Draft chat: (1) here's the change the customer asked for, (2) the revision draft is in your inbox - send or edit+send, then (3) move the status to one of the Revised Quote statuses.",
    "scriptCodes": [
      "^ot_quote_revised"
    ],
    "scriptPreviews": {
      "^ot_quote_revised": {
        "code": "^ot_quote_revised",
        "name": "Updated Quote",
        "subject": "your updated quote is here",
        "bodyText": "Hi [FIRST NAME],\n\nYour updated quote is ready to review. If everything is correct, click the approve button and we'll move to the next phase - creating your mockup. Or just reply to this email and let us know any updates you'd like.\n\n[QUOTE LINK]"
      }
    },
    "nudge": {
      "trigger": "DECLINED",
      "chatKey": "DRAFT",
      "chatName": "Draft",
      "chatEmoji": "📮",
      "chatColor": "#2D97F1",
      "ruleText": "On entry, ACTION REQUIRED in the Draft chat: send or edit+send the revision draft, then move the status to a Revised Quote status.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "ACTION REQUIRED: customer asked for a change; revision draft is ready.",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Quote Declined - Update Needed",
        "totalDays": "Box age: 12 days / days in status: 3 days"
      }
    },
    "endGame": {
      "rows": [
          {
                "label": "No archive here",
                "body": "This status never archives."
          },
          {
                "label": "What happens",
                "body": "The PM makes the requested change, then moves the order to a Revised status (📮 Quote Revised - Drafted or 🚀 Quote Revised - Auto Sent)."
          }
    ],
      "text": "No archive here - the PM makes the requested change and moves the order to a Revised status (Quote Revised - Drafted or Quote Revised - Auto Sent)."
    }
  },
  "427399": {
    "id": "427399",
    "phase": "Quote & Chase",
    "description": "A revised quote, auto-sent, that re-enters the chase. NEW name for 427399. 🔴 never delete (chase start-trigger).",
    "flavor": "customer",
    "automation": "Native emails the revised quote. Script: “Your updated quote is ready for approval. Click to approve, or let us know any changes you need.” 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_quote_revised"
    ],
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "The auto-chase runs itself on +1 / +2 / +5 working days. It stalls when the customer never replies."
          },
          {
                "label": "What happens",
                "body": "The archive notice is AUTO-SENT — no draft, no PM ping, this lane is hands-off. The order then moves itself to 🗄️ Archived Quote (427400)."
          },
          {
                "label": "Close Date",
                "body": "Stamped when the order lands in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "The auto-chase runs by itself (+1 / +2 / +5 working days). If the customer never replies, the final archive-notice email is AUTO-SENT (not drafted - this lane is hands-off), using the ^ot_missed_opportunity copy, then the order moves to Archived Quote (427400). T1 AND new customers only - return customers are handled by the retention pipeline - get the Missed Opportunity email +2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "archiveSendMode": "AUTO-SENT",
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    }
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Approval request for terms customers.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
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
    "automation": "Printavo auto-moves here on decline. PM alert.",
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Art or invoice declined; needs an update.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Paid; ready to build.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
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
    "description": "Moving an order here triggers a DRAFT — the quote email with the native approve/pay button is drafted (One Thread drafts ^ot_quote_sent into the existing thread) for the PM to review and send. Manual to enter; the sequence then auto-advances.",
    "flavor": "nudge",
    "automation": "It DRAFTS the email + sends a draft nudge to the 📮 Draft chat. The statuses AUTO-ADVANCE on a +1 / +2 / +5 working-day ladder (same cadence as the auto-chase), creating a fresh draft + nudge at each step — but they never auto-SEND. The PM sends each draft. If a draft isn't sent, the sequence still advances; to stop it, move the order out (e.g. to Quote Sent Manually 548877, or In Conversation). 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_quote_sent"
    ],
    "cadence": "Quote Approval - Drafted → +1wd → 1st Check In → +2wd → 2nd → +5wd → 3rd. Draft-mode: auto-drafts + auto-advances the status, never auto-sends.",
    "endGame": {
      "rows": [
          {
                "label": "No archive here",
                "body": "This is a mid-ladder step, not an ending."
          },
          {
                "label": "What happens",
                "body": "Auto-advances to the next check-in draft after the ladder interval. The end game lives at 📮 Quote 3rd Check In."
          }
    ],
      "text": "Auto-advances to the next check-in draft after the ladder interval."
    },
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "First quote send — the draft is ready; the PM reviews and sends it.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
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
    "automation": "#1150 auto-sends at +1 / +2 / +5 wd. 🔴 never delete. 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_chase_2"
    ],
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "The auto-chase runs itself on +1 / +2 / +5 working days. It stalls when the customer never replies."
          },
          {
                "label": "What happens",
                "body": "The archive notice is AUTO-SENT — no draft, no PM ping, this lane is hands-off. The order then moves itself to 🗄️ Archived Quote (427400)."
          },
          {
                "label": "Close Date",
                "body": "Stamped when the order lands in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "The auto-chase runs by itself (+1 / +2 / +5 working days). If the customer never replies, the final archive-notice email is AUTO-SENT (not drafted - this lane is hands-off), using the ^ot_missed_opportunity copy, then the order moves to Archived Quote (427400). T1 AND new customers only - return customers are handled by the retention pipeline - get the Missed Opportunity email +2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "archiveSendMode": "AUTO-SENT",
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": true
  },
  "433066": {
    "id": "433066",
    "phase": "Quote & Chase",
    "description": "Automatic follow-ups on the timer.",
    "flavor": "customer",
    "automation": "#1150 auto-sends at +1 / +2 / +5 wd. 🔴 never delete. 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_chase_3"
    ],
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "The auto-chase runs itself on +1 / +2 / +5 working days. It stalls when the customer never replies."
          },
          {
                "label": "What happens",
                "body": "The archive notice is AUTO-SENT — no draft, no PM ping, this lane is hands-off. The order then moves itself to 🗄️ Archived Quote (427400)."
          },
          {
                "label": "Close Date",
                "body": "Stamped when the order lands in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "The auto-chase runs by itself (+1 / +2 / +5 working days). If the customer never replies, the final archive-notice email is AUTO-SENT (not drafted - this lane is hands-off), using the ^ot_missed_opportunity copy, then the order moves to Archived Quote (427400). T1 AND new customers only - return customers are handled by the retention pipeline - get the Missed Opportunity email +2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "archiveSendMode": "AUTO-SENT",
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": true
  },
  "433067": {
    "id": "433067",
    "phase": "Quote & Chase",
    "description": "Automatic follow-ups on the timer.",
    "flavor": "customer",
    "automation": "#1150 auto-sends at +1 / +2 / +5 wd. 🔴 never delete. 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_missed_opportunity"
    ],
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "The auto-chase runs itself on +1 / +2 / +5 working days. It stalls when the customer never replies."
          },
          {
                "label": "What happens",
                "body": "The archive notice is AUTO-SENT — no draft, no PM ping, this lane is hands-off. The order then moves itself to 🗄️ Archived Quote (427400)."
          },
          {
                "label": "Close Date",
                "body": "Stamped when the order lands in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "The auto-chase runs by itself (+1 / +2 / +5 working days). If the customer never replies, the final archive-notice email is AUTO-SENT (not drafted - this lane is hands-off), using the ^ot_missed_opportunity copy, then the order moves to Archived Quote (427400). T1 AND new customers only - return customers are handled by the retention pipeline - get the Missed Opportunity email +2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "archiveSendMode": "AUTO-SENT",
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": true
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
    "description": "A new sample-pack order holding spot while the PM gets the samples ready to ship.",
    "flavor": "customer",
    "automation": "It AUTO-SENDS, triggered by the purchase itself — nobody presses anything and there is no draft to review. Generic order-confirmation copy only at order time: we've got your sample pack request, we'll send it within 48 hours, and reply with any color/sample notes. Mark's automation drops every new sample-pack order here as the prep-and-ship holding spot. PM nudge if it is still in Prep & Ship after 2 days.",
    "scriptCodes": [
      "^sample_confirm"
    ],
    "streakFactor": "The sample pack joins an existing open Streak box matched by EMAIL. A new standalone sample-pack box is created only on first contact. Holly's Streak \"sample pack\" column marks that a sample pack was purchased on whichever box it joins.",
    "endGame": {
      "rows": [
          {
                "label": "No archive here",
                "body": "This status is never archived."
          },
          {
                "label": "What happens",
                "body": "Archiving happens at the next status, 🛒 Sample Pack Purchased → Samples Sent."
          }
    ],
      "text": "This status is never archived; archiving happens at the next status (Samples Sent)."
    },
    "timed": false,
    "nudge": {
      "trigger": "SAMPLE_PREP_SHIP_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "Still in Prep & Ship after 2 days → nudge the PM to ship the samples.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Still not shipped after 2 days",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co Sample Pack",
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Sample Pack - Prep & Ship",
        "visualId": "27612",
        "totalDays": "Box age: 2 days / days in status: 2 days",
        "stub": false
      }
    }
  },
  "548869": {
    "id": "548869",
    "phase": "Quote & Chase",
    "description": "Live back-and-forth with the customer, before an official quote is sent.",
    "flavor": "nudge",
    "automation": "PM nudge only after 3 business days of quiet. This stage may not have a quote number yet, so identify it by the Streak box, not a Printavo visual ID.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "IN_CONVERSATION_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "3 business days with no email in or out → the owner gets nudged.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quiet for 3 business days",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "In Conversation",
        "totalDays": "Box age: 12 days / days in status: 3 days"
      }
    },
    "streakFactor": "The box lives in Streak (project name, owner, and sometimes no quote # yet). The nudge watches Streak's Last Email Date - both outgoing and incoming; that's how it knows the pre-quote conversation has gone quiet.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "30 days with no movement."
          },
          {
                "label": "What happens",
                "body": "The archive notice is DRAFTED, never sent, and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it. Your call. Nothing archives on its own."
          },
          {
                "label": "Nudge",
                "body": "The 3-day nudge keeps running forever until the order is moved out. There is no safe status."
          },
          {
                "label": "Close Date",
                "body": "Not stamped here. The PM moving the order into 🗄️ Archived Quote (427400) is what stamps it — that status has its own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "No movement for 30 days → we do NOT archive it automatically. The archive-notice email is DRAFTED (not sent) and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it - your call. The 3-day nudge keeps going forever until the order is moved out (there is no safe status). The Close Date is NOT stamped here - it is stamped by a trigger on the Archived Quote (427400) status when the order is actually moved there, and the Missed Opportunity email (T1 AND new customers only - return customers are handled by the retention pipeline) is sent 2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": false
  },
  "548870": {
    "id": "548870",
    "phase": "Quote & Chase",
    "description": "Customer asked for time - the ball is on their side.",
    "flavor": "nudge",
    "automation": "A PM nudge only - no customer email. Plain recurring 7-day nudge on Last Email Date, outgoing or incoming; repeats every 7 days until the PM moves it or dismisses the interval.",
    "scriptCodes": [],
    "streakFactor": "The box lives in Streak (project name, owner). The nudge watches Streak's Last Email Date - both outgoing and incoming; that's how it knows there's been no reply.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "30 days with no movement."
          },
          {
                "label": "What happens",
                "body": "The archive notice is DRAFTED, never sent, and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it. Your call. Nothing archives on its own."
          },
          {
                "label": "Nudge",
                "body": "The 7-day nudge keeps running forever until the order is moved out. There is no safe status."
          },
          {
                "label": "Close Date",
                "body": "Not stamped here. The PM moving the order into 🗄️ Archived Quote (427400) is what stamps it — that status has its own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "No movement for 30 days → we do NOT archive it automatically. The archive-notice email is DRAFTED (not sent) and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it - your call. The 7-day nudge keeps going forever until the order is moved out (there is no safe status). The Close Date is NOT stamped here - it is stamped by a trigger on the Archived Quote (427400) status when the order is actually moved there, and the Missed Opportunity email (T1 AND new customers only - return customers are handled by the retention pipeline) is sent 2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": false,
    "nudge": {
      "trigger": "WAITING_ON_CUSTOMER_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "7 days with no email in or out → the owner gets nudged; repeats every 7 days while it stays here.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quiet for 7 days",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Waiting on Customer",
        "visualId": "27612",
        "totalDays": "Box age: 19 days / days in status: 7 days",
        "stub": false
      }
    }
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
    "description": "The PM sent a follow-up, the client replied with a future date / something custom, so the PM created a Streak task for the next follow-up. Their manual check-in comfort zone.",
    "flavor": "nudge",
    "automation": "PM nudge only. Watches outgoing and incoming email; if there is no movement for 14 days, the owner gets nudged.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "FOLLOW_UP_DUE",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "Follow-Up Pre-Quote (Streak Task): no movement for 14 days → the owner gets nudged.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quiet for 14 days",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Follow-Up Pre-Quote (Streak Task)",
        "totalDays": "Box age: 32 days / days in status: 14 days"
      }
    },
    "streakFactor": "The box lives in Streak (project name, owner). The nudge watches Streak's Last Email Date - both outgoing and incoming; that's how it knows there's been no reply.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "30 days with no movement."
          },
          {
                "label": "What happens",
                "body": "The archive notice is DRAFTED, never sent, and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it. Your call. Nothing archives on its own."
          },
          {
                "label": "Nudge",
                "body": "The 14-day nudge keeps running forever until the order is moved out. There is no safe status."
          },
          {
                "label": "Close Date",
                "body": "Not stamped here. The PM moving the order into 🗄️ Archived Quote (427400) is what stamps it — that status has its own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "No movement for 30 days → we do NOT archive it automatically. The archive-notice email is DRAFTED (not sent) and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it - your call. The 14-day nudge keeps going forever until the order is moved out (there is no safe status). The Close Date is NOT stamped here - it is stamped by a trigger on the Archived Quote (427400) status when the order is actually moved there, and the Missed Opportunity email (T1 AND new customers only - return customers are handled by the retention pipeline) is sent 2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": false
  },
  "548873": {
    "id": "548873",
    "phase": "Quote & Chase",
    "description": "Samples have shipped; the PM has a draft to fill with tracking number and estimated arrival, then the timed check-in ladder runs if there is no reply.",
    "flavor": "nudge",
    "automation": "Draft only on entry: PM fills tracking # + estimated arrival date, then sends. After that, the +3 / +2 / +5 day sample-pack check-in ladder is a PM NUDGE, not an auto-send: \"you got your pack, do your check-in.\" Custom T1 follow-ups get kicked to Follow-Up Pre-Quote (Streak Task).",
    "scriptCodes": [
      "^ot_sample_shipped",
      "^ot_sample_arrival_checkin",
      "^ot_sample_arrival_checkin_plus2",
      "^ot_sample_arrival_checkin_plus5"
    ],
    "streakFactor": "The sample pack joins an existing open Streak box matched by EMAIL. A new standalone sample-pack box is created only on first contact. The ladder watches Streak's Last Email Date - both outgoing and incoming - so any customer reply stops the check-ins. Holly's Streak \"sample pack\" column marks it.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "30 days in the status."
          },
          {
                "label": "What happens",
                "body": "The archive notice is DRAFTED, never sent, and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it. Your call. Nothing archives on its own."
          },
          {
                "label": "Nudge",
                "body": "The sample check-in nudge keeps running forever until the order is moved out. There is no safe status."
          },
          {
                "label": "Close Date",
                "body": "Not stamped here. The PM moving the order into 🗄️ Archived Quote (427400) is what stamps it — that status has its own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "30 days in the status → archive-notice email is DRAFTED; it never archives automatically. The PM is pinged in the 📮 Draft chat: send it, move the status, or leave it - your call. The sample check-in nudge keeps going forever until the order is moved out. The Close Date is NOT stamped here - it is stamped by a trigger on the Archived Quote (427400) status when the order is actually moved there, and the Missed Opportunity email (T1 AND new customers only - return customers are handled by the retention pipeline) is sent 2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "Printavo template",
        "t1Only": true
      }
    },
    "timed": false,
    "copyNote": "Copy being revised: sample arrival check-in needs two paths - ask for quantity, art, and needed-by date if they have not given project info yet; otherwise just ask which sample they want.",
    "nudge": {
      "trigger": "SAMPLE_SENT_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "+3 / +2 / +5 day check-in ladder → PM nudge, not auto-send; any customer reply stops it.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Sample pack check-in: you got your pack, do your check-in.",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co Sample Pack",
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Sample Pack Purchased → Samples Sent",
        "visualId": "27612",
        "totalDays": "Box age: 15 days / days in status: 10 days",
        "stub": false
      }
    }
  },
  "548874": {
    "id": "548874",
    "phase": "Quote & Chase",
    "description": "Moving an order here triggers a DRAFT — the quote email with the native approve/pay button is drafted (One Thread drafts ^ot_quote_sent into the existing thread) for the PM to review and send. Manual to enter; the sequence then auto-advances.",
    "flavor": "nudge",
    "automation": "It DRAFTS the email + sends a draft nudge to the 📮 Draft chat. The statuses AUTO-ADVANCE on a +1 / +2 / +5 working-day ladder (same cadence as the auto-chase), creating a fresh draft + nudge at each step — but they never auto-SEND. The PM sends each draft. If a draft isn't sent, the sequence still advances; to stop it, move the order out (e.g. to Quote Sent Manually 548877, or In Conversation). 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_chase_2"
    ],
    "cadence": "Quote Approval - Drafted → +1wd → 1st Check In → +2wd → 2nd → +5wd → 3rd. Draft-mode: auto-drafts + auto-advances the status, never auto-sends.",
    "endGame": {
      "rows": [
          {
                "label": "No archive here",
                "body": "This is a mid-ladder step, not an ending."
          },
          {
                "label": "What happens",
                "body": "Auto-advances to the next check-in draft after the ladder interval. The end game lives at 📮 Quote 3rd Check In."
          }
    ],
      "text": "Auto-advances to the next check-in draft after the ladder interval."
    },
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Timed quote follow-ups, drafted for the PM to send.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
      }
    }
  },
  "548875": {
    "id": "548875",
    "phase": "Quote & Chase",
    "description": "Moving an order here triggers a DRAFT — the quote email with the native approve/pay button is drafted (One Thread drafts ^ot_quote_sent into the existing thread) for the PM to review and send. Manual to enter; the sequence then auto-advances.",
    "flavor": "nudge",
    "automation": "It DRAFTS the email + sends a draft nudge to the 📮 Draft chat. The statuses AUTO-ADVANCE on a +1 / +2 / +5 working-day ladder (same cadence as the auto-chase), creating a fresh draft + nudge at each step — but they never auto-SEND. The PM sends each draft. If a draft isn't sent, the sequence still advances; to stop it, move the order out (e.g. to Quote Sent Manually 548877, or In Conversation). 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_chase_3"
    ],
    "cadence": "Quote Approval - Drafted → +1wd → 1st Check In → +2wd → 2nd → +5wd → 3rd. Draft-mode: auto-drafts + auto-advances the status, never auto-sends.",
    "endGame": {
      "rows": [
          {
                "label": "No archive here",
                "body": "This is a mid-ladder step, not an ending."
          },
          {
                "label": "What happens",
                "body": "Auto-advances to the next check-in draft after the ladder interval. The end game lives at 📮 Quote 3rd Check In."
          }
    ],
      "text": "Auto-advances to the next check-in draft after the ladder interval."
    },
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Timed quote follow-ups, drafted for the PM to send.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
      }
    }
  },
  "548876": {
    "id": "548876",
    "phase": "Quote & Chase",
    "description": "Moving an order here triggers a DRAFT — the quote email with the native approve/pay button is drafted (One Thread drafts ^ot_quote_sent into the existing thread) for the PM to review and send. Manual to enter; the sequence then auto-advances.",
    "flavor": "nudge",
    "automation": "It DRAFTS the email + sends a draft nudge to the 📮 Draft chat. The statuses AUTO-ADVANCE on a +1 / +2 / +5 working-day ladder (same cadence as the auto-chase), creating a fresh draft + nudge at each step — but they never auto-SEND. The PM sends each draft. If a draft isn't sent, the sequence still advances; to stop it, move the order out (e.g. to Quote Sent Manually 548877, or In Conversation). 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_quote_sent"
    ],
    "cadence": "Quote Approval - Drafted → +1wd → 1st Check In → +2wd → 2nd → +5wd → 3rd. Draft-mode: auto-drafts + auto-advances the status, never auto-sends.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "5 working days after the 3rd check-in draft."
          },
          {
                "label": "What happens",
                "body": "The archive notice is DRAFTED, never sent, and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it. Your call. Nothing archives on its own. From here the PM moves it to 🗄️ Archived Quote (427400) or takes it manual."
          },
          {
                "label": "Close Date",
                "body": "Not stamped here. The PM moving the order into 🗄️ Archived Quote (427400) is what stamps it — that status has its own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "5 working days after the 3rd check-in draft → the archive-notice email is DRAFTED (^ot_missed_opportunity) and the PM is pinged in the 📮 Draft chat → move it to Archived Quote (427400) or take it manual. No auto-send.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      }
    },
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Timed quote follow-ups, drafted for the PM to send.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
      }
    }
  },
  "548877": {
    "id": "548877",
    "phase": "Quote & Chase",
    "description": "The PM's comfort-zone status - custom dates/info gathered and managed on their Streak tasks.",
    "flavor": "nudge",
    "automation": "No customer email. PM nudge only, mimicking Follow-Up Pre-Quote (Streak Task): if there is no movement for 14 days, the owner gets nudged in the 🐌 Stale chat.",
    "scriptCodes": [],
    "nudge": {
      "trigger": "QUOTE_SENT_MANUAL_STALLED",
      "chatKey": "STALE",
      "chatName": "Stale Status",
      "chatEmoji": "🐌",
      "chatColor": "#F0932B",
      "ruleText": "Quote Sent Manually (Streak Task): no movement for 14 days → the owner gets nudged; repeats forever until moved out.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Quiet for 14 days",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Quote Sent Manually (Streak Task)",
        "totalDays": "Box age: 32 days / days in status: 14 days"
      }
    },
    "streakFactor": "The box lives in Streak (project name, owner). The nudge watches Streak's Last Email Date - both outgoing and incoming; that's how it knows there's been no reply.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "30 days with no movement."
          },
          {
                "label": "What happens",
                "body": "The archive notice is DRAFTED, never sent, and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it. Your call. Nothing archives on its own."
          },
          {
                "label": "Nudge",
                "body": "The 14-day nudge keeps running forever until the order is moved out. There is no safe status."
          },
          {
                "label": "Close Date",
                "body": "Not stamped here. The PM moving the order into 🗄️ Archived Quote (427400) is what stamps it — that status has its own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "No movement for 30 days → archive-notice email is DRAFTED (not sent) and the PM is pinged in the 📮 Draft chat. The status is never auto-archived. The 14-day nudge recurs forever until the order is moved out. The Close Date is NOT stamped here - it is stamped by a trigger on the Archived Quote (427400) status when the order is actually moved there, and the Missed Opportunity email (T1 AND new customers only - return customers are handled by the retention pipeline) is sent 2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": false
  },
  "548878": {
    "id": "548878",
    "phase": "Quote & Chase",
    "description": "Customer clicked decline and said this project is not moving forward.",
    "flavor": "customer",
    "automation": "Auto-sends a gracious customer email, no nudge, then moves the order to Archived Quote (427400).",
    "scriptCodes": [
      "^ot_declined_lost"
    ],
    "scriptPreviews": {
      "^ot_declined_lost": {
        "code": "^ot_declined_lost",
        "name": "Declined Lost",
        "subject": "thanks for letting us know",
        "bodyText": "Hi [FIRST NAME],\n\nThank you for letting us know this project isn't moving forward, and thank you for considering us. If anything else comes up down the road, keep us in mind - we handle custom apparel, embroidery, and promo products all in one place. We're here whenever you're ready.\n"
      }
    },
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "Nothing stalls — this fires on entry, as soon as the order lands here."
          },
          {
                "label": "What happens",
                "body": "^ot_declined_lost is AUTO-SENT (the gracious close), then the order moves to 🗄️ Archived Quote (427400)."
          },
          {
                "label": "Close Date",
                "body": "Stamped when the order lands in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "On entry, auto-send ^ot_declined_lost, then move to Archived Quote (427400). T1 AND new customers only - return customers are handled by the retention pipeline - get the Missed Opportunity email +2 weeks after the Close Date.",
      "archiveScript": "^ot_declined_lost",
      "archiveSendMode": "AUTO-SENT",
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "Printavo template",
        "t1Only": true
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Mockup sent, waiting on customer feedback.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
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
    "automation": "Nudge system flags non-retention accounts for the archive path.",
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Declined and dead.",
        "totalDays": "Box age: 12 days / days in status: 3 days"
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
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Approved, no payment needed (terms / DWC).",
        "totalDays": "Box age: 12 days / days in status: 3 days"
      }
    }
  },
  "548883": {
    "id": "548883",
    "phase": "Paid & Pre-Production",
    "description": "Kicked back to the PM for a fix.",
    "flavor": "internal",
    "automation": "PM alert.",
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
    "automation": "Workflow state - no customer email, no notification.",
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
  "549571": {
      "id": "549571",
      "phase": "Quote & Chase",
      "description": "The customer replied to the quote and is engaging, but has not approved yet. Parking them here stops the chase so nobody gets chased while they are mid-conversation with you.",
      "flavor": "nudge",
      "automation": "Moving an order in STOPS the chase ladder in both lanes, the 📮 draft one and the 🚀 auto one. All you get is a 2-day nudge until you move it forward. Today the PM moves the order here when a reply lands; automatic reply-detection arrives with the Streak last-email work.",
      "scriptCodes": [],
      "nudge": {
        "trigger": "QUOTE_CUSTOMER_REPLIED",
        "chatKey": "STALE",
        "chatName": "Stale Status",
        "chatEmoji": "🐌",
        "chatColor": "#F0932B",
        "ruleText": "2 days with no movement since the customer's last reply → the owner gets nudged. The clock resets every time they reply again.",
        "example": {
          "tierBadge": "🥇 T1",
          "why": "Replied 2 days ago, nothing since",
          "buttons": [
            {
              "label": "Open in Streak",
              "kind": "link"
            },
            {
              "label": "Done",
              "kind": "action"
            }
          ],
          "projectName": "Summit Trading Co",
          "visualId": "27612",
          "stub": false,
          "customerName": "Summit Trading Co",
          "contactName": "Jessica Ramos",
          "statusName": "💬 Quote Approval — Customer Replied 🔔",
          "totalDays": "Box age: 11 days / days in status: 2 days"
        }
      },
      "streakFactor": "The reply itself is the signal. The nudge should watch Streak's Last Email Date INCOMING and reset the 2-day clock on each new one, so an active back-and-forth never gets nudged. Until that Streak wiring lands the nudge falls back to time in status.",
      "endGame": {
        "rows": [
          {
            "label": "Stalls at",
            "body": "30 days with no movement. Reaching this would be very unusual: the 2-day nudge has fired around fifteen times by then."
          },
          {
            "label": "What happens",
            "body": "The order is archived AUTOMATICALLY into 🗄️ Archived Quote (427400). No customer email and no final PM nudge. This status has no send mode, so it cannot draft or auto-send a notice, and the archive notice would be wrong here anyway: it says \"I have not heard back\", and this customer did reply."
          },
          {
            "label": "Close Date",
            "body": "Stamped on arrival in 🗄️ Archived Quote (427400), by that status's own trigger."
          },
          {
            "label": "Missed Opportunity email",
            "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
        ],
        "text": "30 days no movement → the order is archived AUTOMATICALLY into Archived Quote (427400). No customer email and no final PM nudge: this status has no send mode so it cannot draft or auto-send, and by then the 2-day nudge has fired around fifteen times. T1 AND new customers still get the Missed Opportunity email 2 weeks after the Close Date."
      },
      "timed": false
    },
  "548987": {
    "id": "548987",
    "phase": "Quote & Chase",
    "description": "A revised quote, drafted for the PM to send, after the customer replied asking for an update.",
    "flavor": "nudge",
    "automation": "Drafts the new ^ot_quote_revised script and nudges the PM in the 📮 Draft chat. Cadence is 1 / 2 / 5 working days, then a recurring 5-day nudge; it resets on any customer reply and keeps going until moved out. 🔴 If the customer replies, move the order to 💬 Quote Approval — Customer Replied 🔔 (549571). That stops the chase in this lane. From there the PM either leaves it and lets the 2-day nudge run, or updates the quote and moves it to the right Revised status.",
    "scriptCodes": [
      "^ot_quote_revised"
    ],
    "scriptPreviews": {
      "^ot_quote_revised": {
        "code": "^ot_quote_revised",
        "name": "Quote Revised",
        "subject": "your revised quote is ready",
        "bodyText": "Hi [FIRST NAME],\n\nYour adjusted quote is ready to review. If everything is correct, click the approve button and we'll move to the next phase - creating your mockup. Or just reply to this email and let us know any updates you'd like.\n\n[QUOTE LINK]"
      }
    },
    "cadence": "Quote Revised - Drafted: +1wd / +2wd / +5wd check-in nudges, then recurring +5wd nudge. Resets on any customer reply and continues until moved out.",
    "nudge": {
      "trigger": "QUOTE_REVISED_DRAFT_READY",
      "chatKey": "DRAFT",
      "chatName": "Draft",
      "chatEmoji": "📮",
      "chatColor": "#2D97F1",
      "ruleText": "On entry and then 1 / 2 / 5 working days, then recurring 5-day nudge until moved out; resets on any customer reply.",
      "example": {
        "tierBadge": "🥇 T1",
        "why": "Revised quote draft is ready for PM review.",
        "buttons": [
          {
            "label": "Open in Streak",
            "kind": "link"
          },
          {
            "label": "Done",
            "kind": "action"
          }
        ],
        "projectName": "Summit Trading Co",
        "visualId": "27612",
        "stub": false,
        "customerName": "Summit Trading Co",
        "contactName": "Jessica Ramos",
        "statusName": "Quote Revised - Drafted",
        "totalDays": "Box age: 16 days / days in status: 5 days"
      }
    },
    "streakFactor": "The nudge watches Streak's Last Email Date - both outgoing and incoming; any customer reply resets the 1 / 2 / 5 / recurring 5-day cadence.",
    "endGame": {
      "rows": [
          {
                "label": "Stalls at",
                "body": "30 days in the status."
          },
          {
                "label": "What happens",
                "body": "The archive notice is DRAFTED, never sent, and the PM is pinged in the 📮 Draft chat: send it, move the status, or leave it. Your call. Nothing archives on its own."
          },
          {
                "label": "Close Date",
                "body": "Not stamped here. The PM moving the order into 🗄️ Archived Quote (427400) is what stamps it — that status has its own trigger."
          },
          {
                "label": "Missed Opportunity email",
                "body": "Sent 2 weeks after that Close Date, by the Archived Quote automation, and only if the customer is T1 AND new. Return customers skip it — the retention pipeline has them."
          }
    ],
      "text": "30 days IN the status → archive-notice email is DRAFTED (^ot_missed_opportunity), not auto-send. The PM is pinged in the 📮 Draft chat to send it and move the status. The Missed Opportunity email (T1 AND new customers only - return customers are handled by the retention pipeline) is sent 2 weeks after the Close Date.",
      "archiveScript": "^ot_archive_notice",
      "archiveScriptPreview": {
        "code": "^ot_archive_notice",
        "name": "Archive notice",
        "subject": "setting your [PROJECT NAME] aside for now",
        "bodyText": "Hi [FIRST NAME],\n\nI have not heard back on [PROJECT NAME], so I am setting it aside for now. Nothing is lost on our end.\n\nWhenever you are ready to pick it back up, just reply to this email and we will start right where we left off. If something new comes along in the meantime, I am happy to price that out for you too."
      },
      "missedOppScript": {
        "name": "Missed Opportunity email",
        "source": "CC script ^ot_missed_opportunity",
        "t1Only": true
      }
    },
    "timed": false
  }
};

if (typeof module !== "undefined") module.exports = { SIM_FALLBACK_STATUSES, SIM_OVERLAY };
