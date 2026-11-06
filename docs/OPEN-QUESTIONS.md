# NPD Tracker — Open Questions

Questions waiting on Adam before the related features can be built.
Tick a box and write the answer underneath when decided.

_Last updated: 6 Nov 2026_

---

## 1. Project stages & Gantt link (stage aging on project cards)

Plan: the tracker reads each project's Gantt (read-only) and shows on the card:
current phase + days in phase vs plan, next gate, number of delayed tasks,
progress and Gantt finish vs target delivery. No copying Gantt tasks into the tracker.

- [ ] **1.1 Read Gantt on project cards?** As of 6 Nov 2026 the plans themselves
      save to the Gantt tab of the tracker Sheet (see docs/GANTT-V3.md), so another
      device can open them. The tracker still does not read those rows onto the
      project card. Build that read next, or leave the card as it is?
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

Decided (8 Oct): at risk = step due **today or the next working day**;
SLA counts **working days** (Mon–Fri). Built in V77.6.

Still to confirm:
- [ ] **2.1 Weekend days.** Currently Saturday + Sunday are skipped. Correct for your
      office? (Johor/Kedah/Kelantan/Terengganu use Fri–Sat.)
- [ ] **2.2 Public holidays.** Not excluded yet — add a holiday list in Settings?
- [ ] **2.3 "Send IML Inquiry" auto-task** is ticked by default on new inquiries.
      Untick by default (only needed when the product has a label)?
- [ ] **2.4 Any target after NPD input is sent** (costing → price submission)?

## 3. Postponed — needs Google Apps Script (Code.gs) changes

- [ ] **3.0 People (done Nov 2026):** Firestore rules now allow only signed-in people; only the master changes roles and
      permissions. Settings › People (master only) edits each person's display name and role; a role change resets their
      saved permissions to that role's defaults. Accounts are still created in the Firebase console.
- [ ] **3.1 Secure saving:** Apps Script should only accept saves/loads from Adam's
      signed-in account (and retire the current shared access key). Needs: Code.gs,
      Firestore rules, list of allowed emails.
- [x] **3.2 Gantt cloud saving:** so Gantt plans are available on every device
      (and the tracker can read them everywhere).
      Decided 6 Nov 2026: save into the existing Gantt tab of NPD Tracker Data Store,
      through the bridge the tracker already uses. A book index row plus one row per
      project. The deployed web app already answers `ganttRead`; redeploy only if a
      save reports that the Sheet has no Gantt handler (`docs/apps-script/Gantt.gs`).
      The tracker reading those rows onto project cards is still 1.1.
- [ ] **3.3 Weekly management summary email** — every Monday? To whom?
- [ ] **3.4 Read-only progress link** for management / factories / customers —
      which fields may each audience see (hide prices? other customers?).

## 4. Other ideas parked

- [ ] **4.1 Morning-only banner:** banner currently shows on the first open of the day
      at any time. Restrict to before a set time (e.g. 12pm)?
- [ ] **4.2 Banner across devices:** currently once per day per device.
      Make it once per day across all devices?
