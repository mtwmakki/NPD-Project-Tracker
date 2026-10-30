# NPD Tracker V2 (beta)

The usual address `https://mtwmakki.github.io/NPD-Project-Tracker/` now opens V2 directly
(V2 itself lives at `…/v2/`). **V1 is retired (30 Oct 2026):** the root page only forwards to V2, old `/?v1`
bookmarks land in V2, and V2 has no links to V1. V1's code is in git history (root `index.html` before the
retirement commit). `gantt.html` stays at the root: V2's Gantt button opens it and each device keeps its plans there.

## Same data, same account
- Signs in with the same Firebase account V1 used. The first sign-in of a new person creates their profile in
  Firestore `users` (member role and permissions; the master email always gets master), as V1 did.
- Reads and writes the same Google Sheet through the same Apps Script bridge. No new fields are added.
- V2's style, theme, motion and snoozed notifications are stored only on the device (`npd2-*` keys).
- Styles include **Liquid Glass** (from the Liquid Glass System design system): frosted glass on every surface, SF
  system font, iOS blue for the main action. Choosing it opens in the device's light or dark mode; the sun/moon button
  still switches it.
- Vision is the default style on a new device (dark first); a style someone picked stays picked.
- Navigation is icons only in every style: the phone tab bar has no labels, and on tablets and laptops the sidebar
  is an icon column. Pinned items and the factory filter sit behind one pin button that opens a panel beside it.
- Sign in: a Sign in button (Enter also signs in), show-password, a Caps Lock warning, and errors under the field they
  belong to. With "Keep me signed in" ticked, the device remembers the last email and first name for "Welcome back"
  (`npd2-last-user`; "Switch account" forgets it). Laptops show a brand side next to the form; phones put the form in
  a sheet at the bottom that moves up while the keyboard is open.
- Phones (iPhone 15 Pro 393 px, Galaxy Z Fold 7 cover 360 px wide): the top bar and tab bar slide away while you
  scroll down and come back when you scroll up; tighter margins and type under 430 px; sheets open full height there.
  On touch screens, fields use 16 px text (stops iPhone zooming in) and icon buttons are 44 px.
  Under 430 px everything is more compact (headings, pills, buttons, tabs, task rows with the date beside the title,
  a small progress ring beside the project name). The page is sized from the measured window height to avoid the
  blank band iOS 26.0 Safari leaves under the tab bar.

## Merge-safe saving
V2 re-reads the Sheet right before saving and applies only its own changes on top of the latest data, so
changes saved meanwhile on another device are kept. An edit form sends only the fields you actually changed.
The only remaining window is the ~1 second between the re-read and the write.
The last data seen is kept on the device (`npd2-cache`) for an instant first screen and for when the Sheet
can't be reached; the copy V1 left (`npd_tracker_v3`) is read once and then removed.

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

Deletes go to the recycle bin (`data.bin`, same format V1 used) and every delete has an Undo; V2 has no bin
page yet, so after the Undo is gone a restore means editing the Sheet.
Each change is written to the item's history and to the Firestore changelog (no page reads it yet).
Features V1 had and V2 doesn't yet: see docs/V2-MIGRATION.md.

## How V2 maps your data
- Projects have no phase field, so the board groups by status (not started / in progress / completed)
  and the project page shows your real milestones as the timeline.
- Project health: Late = an overdue open action or delivery date passed; At risk = action due within
  3 days or delivery within 14 days.
- Inquiry priority 3/2/1 shows as High / Medium / Low. SLA rules are identical to V1.
