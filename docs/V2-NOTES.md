# NPD Tracker V2 (beta)

Live at `https://mtwmakki.github.io/NPD-Project-Tracker/v2/` — V1 stays at the usual address.

## Same data, same account
- Signs in with the same Firebase account as V1 (signing in or out in one also affects the other on that device).
- Reads and writes the same Google Sheet through the same Apps Script bridge. No new fields are added.
- V2's style, theme, motion and snoozed notifications are stored only on the device (`npd2-*` keys).

## Merge-safe saving (V1 V77.9 + V2)
Both apps re-read the Sheet right before saving. If someone else saved in between:
- V2 applies only its own small changes (task done, ball in court, outcome, pin) on top of the latest data.
- V1 keeps every item changed elsewhere and writes only the items changed in V1.
The only remaining window is the ~1 second between the re-read and the write.

## What V2 can change (first release)
- Tick inquiry tasks (including the 5-day SLA steps) and project actions done / reopen
- Ball in court (inquiries and projects), inquiry outcome (won / lost / dropped), pin / unpin
- Complete tasks from Notifications; snooze is device-only
Everything else (creating, editing text, deleting, Gantt) still happens in V1 — every detail view has an "Edit in V1" link.

## How V2 maps your data
- Projects have no phase field, so the board groups by status (not started / in progress / completed)
  and the project page shows your real milestones as the timeline.
- Project health: Late = an overdue open action or delivery date passed; At risk = action due within
  3 days or delivery within 14 days.
- Inquiry priority 3/2/1 shows as High / Medium / Low. SLA rules are identical to V1.
