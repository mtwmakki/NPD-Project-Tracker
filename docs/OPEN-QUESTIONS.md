# NPD Tracker — Open Questions

Questions waiting on Adam before the related features can be built.
Tick a box and write the answer underneath when decided.

_Last updated: 8 Oct 2026_

---

## 1. Project stages & Gantt link (stage aging on project cards)

Plan: the tracker reads each project's Gantt (read-only) and shows on the card:
current phase + days in phase vs plan, next gate, number of delayed tasks,
progress and Gantt finish vs target delivery. No copying Gantt tasks into the tracker.

- [ ] **1.1 Same-device first?** Gantt plans are currently saved only on the device
      they were made on. OK to start with the tracker reading plans on the same device,
      and add all-devices later (needs Gantt cloud saving via Apps Script)?
- [ ] **1.2 What does ICU stand for?** (Added as a project type already — label only.)
- [ ] **1.3 Phases per project type.** Which of the Gantt's 7 phases does each type use?
      Phases: Design · CAPEX Approval · Pilot Mold · Commercial Mold ·
      Machine (Auxiliary Equipment) · IML Development · Production Ramp-Up
      - New Mold: ?
      - Improvement: ?
      - New Masterbatch: ?
      - New IML: ?
      - ICU: ?

## 2. Inquiry 5-day SLA

Known so far: SLA = 5 days.
1. Send mold request — 1–2 days after inquiry received
2. Compile NPD input — 1–2 days after mold request sent
3. Send NPD input — by day 5 after inquiry received

- [ ] **2.1 Replace the auto-created inquiry tasks** (currently: Send Mold Inquiry,
      Send IML Inquiry, Compile NPD Input) with the 3 steps above?
      Should "Send IML Inquiry" stay?
- [ ] **2.2 Calendar days or working days?** Do weekends / public holidays count?
- [ ] **2.3 Card display OK?** e.g. "Day 3 of 5 · Compiling NPD Input" —
      amber on day 4, red after day 5.
- [ ] **2.4 Apply to inquiries that are already open,** or only new ones?
- [ ] **2.5 Any target after NPD input is sent** (costing → price submission)?

## 3. Postponed — needs Google Apps Script (Code.gs) changes

- [ ] **3.1 Secure saving:** Apps Script should only accept saves/loads from Adam's
      signed-in account (and retire the current shared access key). Needs: Code.gs,
      Firestore rules, list of allowed emails.
- [ ] **3.2 Gantt cloud saving:** so Gantt plans are available on every device
      (and the tracker can read them everywhere).
- [ ] **3.3 Weekly management summary email** — every Monday? To whom?
- [ ] **3.4 Read-only progress link** for management / factories / customers —
      which fields may each audience see (hide prices? other customers?).

## 4. Other ideas parked

- [ ] **4.1 Morning-only banner:** banner currently shows on the first open of the day
      at any time. Restrict to before a set time (e.g. 12pm)?
- [ ] **4.2 Banner across devices:** currently once per day per device.
      Make it once per day across all devices?
