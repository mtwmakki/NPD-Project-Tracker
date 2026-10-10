# NPD Tracker V2 (beta)

Live at `https://mtwmakki.github.io/NPD-Project-Tracker/v2/` — V1 stays at the usual address.

## Same data, same account
- Signs in with the same Firebase account as V1 (signing in or out in one also affects the other on that device).
- Reads and writes the same Google Sheet through the same Apps Script bridge. No new fields are added.
- V2's style, theme, motion and snoozed notifications are stored only on the device (`npd2-*` keys).

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

Every date is picked from V2's own calendar (never the phone's or Windows' date box): weeks start
on Monday, weekends are dimmed, and shortcuts give Today, Tomorrow, +2 / +5 working days and Next
Monday. Optional dates have a small × to clear them.

Deletes go to V1's Recycle Bin in the same format V1 uses, and every delete has an Undo.
Each change is written to the item's history and to V1's Changelog page, like V1 does.
Still V1-only: Gantt, standalone tasks, Calendar, Bin restore, users, settings, import/export.

## How V2 maps your data
- Projects have no phase field, so the board groups by status (not started / in progress / completed)
  and the project page shows your real milestones as the timeline.
- Project health: Late = an overdue open action or delivery date passed; At risk = action due within
  3 days or delivery within 14 days.
- Inquiry priority 3/2/1 shows as High / Medium / Low. SLA rules are identical to V1.
