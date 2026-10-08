# NPD Tracker — Open Questions

Questions waiting on Adam before the related features can be built.
Tick a box and write the answer underneath when decided.

_Last updated: 8 Oct 2026 (V77.5)_

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

## 2. Inquiry 5-day SLA — built in V77.5 (same rules as the Wally SLA skill)

Decided / built: day 0 = inquiry date; Send Mold Inquiry by day 2; Send IML Inquiry
by day 2 only if that task exists; NPD Input Compiled / Sent to Finance 2 days after
the mold inquiry is sent and never later than day 5; applies to all OPEN inquiries
without an outcome; "stalled" = all tasks done but still open. New inquiries get the
harmonised task names automatically.

Still to confirm:
- [ ] **2.1 "At risk" threshold.** The tracker flags a step as at risk when it's due
      **today or tomorrow**. The Wally skill says **within 2 days** — on a 5-day SLA
      that makes almost every new inquiry amber on day 0. Keep 1 day, or match Wally (2)?
- [ ] **2.2 Calendar or working days?** Currently calendar days (weekends count).
- [ ] **2.3 "Send IML Inquiry" auto-task** is ticked by default on new inquiries.
      Untick by default (only needed when the product has a label)?
- [ ] **2.4 Any target after NPD input is sent** (costing → price submission)?

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
