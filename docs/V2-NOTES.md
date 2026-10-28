# NPD Tracker V2 (beta)

The usual address `https://mtwmakki.github.io/NPD-Project-Tracker/` now opens V2 directly
(V2 itself lives at `…/v2/`). V1 is still available at `https://mtwmakki.github.io/NPD-Project-Tracker/?v1`
for what V2 doesn't have yet; every "Open V1" link in V2 goes there.

## Same data, same account
- Signs in with the same Firebase account as V1 (signing in or out in one also affects the other on that device).
- Reads and writes the same Google Sheet through the same Apps Script bridge. No new fields are added.
- V2's style, theme, motion and snoozed notifications are stored only on the device (`npd2-*` keys).
- Styles include **Liquid Glass** (from the Liquid Glass System design system): frosted glass on every surface, SF
  system font, iOS blue for the main action. Choosing it opens in the device's light or dark mode; the sun/moon button
  still switches it. Studio stays the default.
- Phones (iPhone 15 Pro 393 px, Galaxy Z Fold 7 cover 360 px wide): the top bar and tab bar slide away while you
  scroll down and come back when you scroll up; tighter margins and type under 430 px; sheets open full height there.
  On touch screens, fields use 16 px text (stops iPhone zooming in) and icon buttons are 44 px.

## Merge-safe saving (V1 V77.9 + V2)
Both apps re-read the Sheet right before saving. If someone else saved in between:
- V2 applies only its own changes on top of the latest data. An edit form sends only the fields you
  actually changed, so a different field changed in V1 at the same moment is kept.
- V1 keeps every item changed elsewhere and writes only the items changed in V1.
The only remaining window is the ~1 second between the re-read and the write.

## What V2 can change
- Projects: new project, edit details (code, name, brief, classification, factory, customer, sales
  person, delivery date, status, links, KIV + reason), delete
- Project actions: add, edit (name, person in charge, deadline, status incl. awaiting reply + chase
  date, linked update), delete, tick done / reopen
- Project updates (sub-statuses) and milestones: add, edit, delete; mark a milestone reached
- Inquiries: new inquiry (with the 3 default SLA tasks, same deadlines as V1), edit details (incl.
  products, links, pipeline statuses, mold cost, outcome reason), delete
- Inquiry tasks and next actions: add, edit, delete, tick done
- Ball in court, inquiry outcome, pin / unpin; complete tasks from Notifications (snooze is device-only)
- Standalone tasks (Tasks page): add, edit, duplicate, tick done, archive / restore, select several to
  archive or delete; categories, priority, awaiting reply; master can see everyone's tasks
- Project people (PICs): add, edit, remove; each project links to its Gantt (separate page)
- After ticking anything done, the confirmation offers "Follow up", which opens a prefilled follow-up task
- Notifications include inquiry next actions, filter by person and by next 7 / 30 days, and every row has a
  calendar button to move its deadline (or the chase date of an awaiting reply)
- Settings → Focus → "Projects only" hides inquiries everywhere (menu, Dashboard, alerts, search) on that
  device; the Dashboard switches to a projects view (late/at-risk, upcoming milestones, this week's actions,
  waiting on others, stale projects, factory load)
- Pin button on every project card and on the project page
- Dashboard: V1's My Day panels (waiting on others, stale projects, new tasks on older items) and the
  once-a-day overdue banner

Every date is picked from V2's own calendar (never the phone's or Windows' date box): weeks start
on Monday, weekends are dimmed, and shortcuts give Today, Tomorrow, +2 / +5 working days and Next
Monday. Optional dates have a small × to clear them.

Deletes go to V1's Recycle Bin in the same format V1 uses, and every delete has an Undo.
Each change is written to the item's history and to V1's Changelog page, like V1 does.
Still V1-only: see docs/V2-MIGRATION.md (waves 2–5).

## How V2 maps your data
- Projects have no phase field, so the board groups by status (not started / in progress / completed)
  and the project page shows your real milestones as the timeline.
- Project health: Late = an overdue open action or delivery date passed; At risk = action due within
  3 days or delivery within 14 days.
- Inquiry priority 3/2/1 shows as High / Medium / Low. SLA rules are identical to V1.
