# NPD Tracker V2 (beta)

The usual address `https://mtwmakki.github.io/NPD-Project-Tracker/` now opens V2 directly
(V2 itself lives at `…/v2/`). **V1 is retired (30 Oct 2026):** the root page only forwards to V2, old `/?v1`
bookmarks land in V2, and V2 has no links to V1. V1's code is in git history (root `index.html` before the
retirement commit). `gantt.html` stays at the root: V2's Gantt button opens it and each device keeps its plans there.

## Same data, same account
- Signs in with the same Firebase account V1 used. The first sign-in of a new person creates their profile in
  Firestore `users` (member role and permissions; the master email always gets master), as V1 did.
- Reads and writes the same Google Sheet through the same Apps Script bridge. No new fields are added.
- V2's style, theme and motion are stored only on the device (`npd2-*` keys). Snoozes are kept on the device and on
  your Firestore profile (`users/{uid}.snoozes`), so a snooze on one device hides the item on all of them.
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
- Ball in court, inquiry outcome, pin / unpin
- Inquiries page:
  - each row reads left to right: name (customer · factory · received · code · priority, tags), the next step and
    when it is due, "Day N of 5" with a 5-part SLA meter, and the status top right ("2 days over", "Due today",
    "On track", "SLA met", "On hold", "Won"…); no coloured edge on every row
  - filters with zero items are greyed; tag filter; sort by SLA (most urgent), received (newest), customer or
    estimated value (remembered on the device)
  - on screens wider than about 1280px the panel docks beside the list: the list narrows, the open row is
    highlighted, and clicking another row switches the panel. Tablets and phones keep the sliding panel
  - panel: "Day 7 of 5" with the status and meter, when the SLA was due, the SLA steps with their dates, then one
    task list (SLA tasks carry an "SLA" tag) with "+" in each section header
  - Turn into project (footer): opens New project prefilled from the inquiry (name, customer, factory, brief from
    the remark, tags, Improvement for IMP inquiries; the project code is yours to fill). Saving creates the
    project with `fromInquiry`, sets the inquiry's `projectId`, marks it Won if no outcome was set, and logs it.
    The inquiry then shows "Open project"; the project's Details link back to the inquiry; Excel has both columns
- My work (replaces the Tasks and Notifications pages; old links open it): one dense list of everything assigned
  to you: project actions, inquiry tasks and next actions, personal tasks.
  - groups: Overdue, Today, This week, Later, No date, Awaiting reply, Done this week (folded); each group folds
  - columns: task, from (project / inquiry code and name, or Personal), owner (Everyone view), due, status (Awaiting
    reply, In progress, SLA, Next action, Trial, priority, category); a bell marks an awaiting reply whose chase
    date has come
  - the circle completes (with Undo and Follow up), the due date opens the calendar to move it (or the chase
    date), hover shows Snooze until tomorrow, tapping the row opens the inquiry, project or task
  - filters: Mine / Everyone (managers and the master), All / Projects / Inquiries / Personal with counts, search,
    Compact (36px rows) or Comfortable; the factory filter applies too (personal tasks show only for All factories)
  - phones: two-line rows; swipe right = done, swipe left = snooze until tomorrow (a hint shows until the first
    swipe); the type filter is a dropdown
  - personal tasks keep their tools: Archived (restore) and Select (archive or delete several); category and
    priority show as tags and are set in the task form. Snoozes follow you to every device (saved on your profile)
- Custom tags: one shared list (`data.tags`: id, name, colour), added and deleted in Settings → Tags by the master
  and managers (9 colours; duplicate names are refused). Projects, inquiries, project actions, inquiry tasks, next
  actions and personal tasks can carry tags (`tags: [tagId, …]`), picked in each form. Deleting a tag removes it
  from every item, with Undo. Tags show on project cards and the board, the project page, inquiry rows and the
  inquiry panel, action and task rows, and My work; Projects, Inquiries and My work have a tag filter (in My work
  it also matches the tags of the task's project or inquiry), search finds tag names, and every Excel sheet with
  tagged items has a Tags column
- Project people (PICs): add, edit, remove; each project links to its Gantt (separate page)
- After ticking anything done, the confirmation offers "Follow up", which opens a prefilled follow-up task
- Settings → Focus → "Projects only" hides inquiries everywhere (menu, Dashboard, My work, search) on that
  device; the Dashboard drops the inquiry rows, the SLA card and Won vs lost
- Projects page:
  - Cards: each card reads name and health (Late red, At risk orange, On track grey, On hold, Completed),
    the next action with its date (red when overdue), progress and stage, then codes, factory and type, muted.
    Filter Active / On hold / Completed / All; sort by most urgent first, delivery date, recently updated or
    name. Pinned projects come first; the pin shows on hover (filled when pinned)
  - Board: real columns. By status: Not started, In progress, On hold, Completed. By stage: Stage not set and the
    7 NPD stages (completed projects left out). Drag a card to another column to change its status or stage
    (mouse: just drag; touch: hold the card, then drag; dragging to the edge scrolls the board). Undo on the toast
  - the view, filter, sort and board grouping are remembered on the device
- Pin from a card (on hover) or from the project page
- Project page, top to bottom:
  - one "Projects" back button; the project name is the title, with Late / At risk / On track and the reason
    ("Delivery date 29 Oct passed · 2 actions overdue, the oldest by 10 working days")
  - Edit, Pin and Timeline (opens the Gantt) beside the name
  - three cards: Next action (complete it with the circle, tap the name to edit), Delivery ("Move date" opens
    the calendar; "1 working day late" / "12 working days left") and Stage
  - Stage: one of the 7 phases of the Gantt's NPD Procedure Template (Design, CAPEX Approval, Pilot Mold,
    Commercial Mold, Machine & Aux Equipment, IML Development, Production Ramp-Up). Tap the card to pick it;
    it is also in the project form. Saved as `stage` (plus `stageSince`) on the project and in the Excel export
  - milestone strip: milestones and the delivery date in date order with a Today marker; missed ones in red;
    tap one to edit it (the delivery date opens the calendar)
  - tabs (Actions, Updates, Overview, History) with the "+" in each section header; done actions fold away
  - right column (below the tabs on tablets and phones): progress, ball in court, people, and a Details block
    (codes, factory, type, sales, start date, links)
  - stage changes and delivery-date moves are written to the project's history
- Dashboard, top to bottom:
  - the greeting is one line beside the title (under it on phones)
  - Needs you: the 5 most urgent items. Late work first (most working days late on top): your overdue actions
    and tasks, inquiries past their SLA, late projects, milestones up to a month past their date. Then what is
    due today, then trials and milestones in the next 3 days. The circle completes an action right there
    (same as My work, with Undo); tapping the row opens the inquiry, project or task
  - four tiles: Overdue actions, Inquiries over SLA (Projects at risk in Projects only), Projects late,
    Due this week. Each says how it compares with a week ago; the number turns red only when above zero
  - This week: today and the next five working days, with milestones (trials get a flask) and deliveries
  - More: factory load (overdue, at risk, on track), inquiry SLA with where open inquiries are waiting,
    and V1's My Day panels (waiting on others, stale projects, new tasks on older items) and Won vs lost
    (12 months, with the win rate) only when they have something; the empty ones are named in one
    "All clear" line
  - the factory filter applies to all of it; the once-a-day overdue banner and the range control are gone
    (the Overdue tile and Needs you carry that now)

Every date is picked from V2's own calendar (never the phone's or Windows' date box): weeks start
on Monday, weekends are dimmed, and shortcuts give Today, Tomorrow, +2 / +5 working days and Next
Monday. Optional dates have a small × to clear them.

Deletes go to the recycle bin (`data.bin`, same format V1 used) and every delete has an Undo.
Settings → Data → Recycle bin (or Ctrl K "Open the recycle bin") lists everything deleted, newest first, with
filters (Inquiries / Projects / Tasks) and search. Restore puts an item back (an action or task back into its
project or inquiry; if that was deleted too, restore it first). Delete forever needs a second tap within 3 s;
managers and the master can empty the whole bin. Restores and deletes are logged and offer Undo.
Settings → Data → Export to Excel downloads a workbook (inquiries, inquiry tasks, next actions, projects, project
actions, milestones, updates, people, personal tasks; real dates, filters on every sheet). The Excel tool (SheetJS
0.18.5) loads from jsDelivr the first time. Backup downloads everything as JSON, including the bin.
Each change is written to the item's history and to the Firestore changelog (no page reads it yet).
Features V1 had and V2 doesn't yet: see docs/V2-MIGRATION.md.

## How V2 maps your data
- Projects now have a `stage` field (new in V2, empty until someone picks one, on the project page or by dragging
  on the stage board). The board groups by status or by stage; the milestone strip shows the real milestones.
- Project health: Late = an overdue open action or delivery date passed; At risk = action due within
  3 days or delivery within 14 days.
- Inquiry priority 3/2/1 shows as High / Medium / Low. SLA rules are identical to V1.
