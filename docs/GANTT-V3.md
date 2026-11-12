# Gantt V3 (customer status book)

`gantt.html` is Gantt V3: one **book per customer**, holding that customer's projects. A project is either a
**Timeline** (task table + timeline, dashboard) or **Status only** (needed from the customer, done, next, stage gates).
The book is saved to the same Google Sheet as the NPD Tracker (the "Gantt" tab) and a copy stays in the browser.
Mockup and review: the "NPD Gantt V3 Rework" artifact.

## Saving (Sheet + this browser)
Editing a plan saves it to the tracker's spreadsheet, tab **Gantt**, through the same Apps Script bridge the
tracker already uses (`ganttRead` / `ganttWrite`). There is no second spreadsheet. The header rests on
"Saved to the Sheet". The customer Excel file (⋯ → Customer file) still exports and imports the whole book,
and that Open button still accepts a single-plan JSON file. `ganttSavePlanFile` still downloads the open plan.

What a row holds:

- **Project row.** Key = the project id (the same id V2 puts in `?project=`). Value = that project's plan JSON
  (`tasks`, header fields, `status`, `savedAt`, …). This is the shape already on the tab from the plans last
  updated around 23 Sep 2026, so those rows still open.
- **Book row.** Key = `book-` + the book id (`book-cust-nestle`, `book-default`). Value = a small index only:
  customer, meeting dates, project ids, and removals. The plans themselves stay in the project rows.
- **Overflow rows.** A plan that does not fit in one cell (Google's limit is 50,000 characters) is stored as a
  short manifest in the project row plus `projectId__p1`, `projectId__p2`, … The manifest is JSON
  (`kind: "gantt-parts"`). Older plans are a single cell and are left that way.

The browser copy is `localStorage` key `gantt3:book:<book id>`. It is written first. If the Sheet cannot be
reached, the plan stays there and the header says "Saved on this device". Opening the page again retries.
A failed save does not replace the plan with an empty chart.

First open on a device, when both copies exist:

- Per project, the newer `savedAt` wins. An empty "Untitled" plan does not replace a real plan, and a blank
  Sheet row does not wipe a plan that already has work.
- Projects only on this device are uploaded. Projects only on the Sheet are added. Nothing is deleted from
  either side just because the other side has not seen it yet.
- Removing a project from the customer file records a removal time. A newer edit of that project wins over
  the removal. Opening that project again from V2 brings it back.
- Customer name and meeting dates follow whichever side edited them later.
- A plan from before V3 (a project row, no book index) is pulled into the book the first time that project
  is opened, or when the general book is opened with no project id (the old `default` row). The row is not
  rewritten if the Sheet copy is the one kept.
- The page does not invent a new project while the Sheet could not be read. That avoids uploading a blank
  plan over a book that was simply offline.

The shared access key already in the page can write these Gantt rows as well as tracker data. Locking that
down is still open question 3.1. The key was not copied into any new file.

### What Adam does once
1. Merge this to `main` so GitHub Pages serves the new `gantt.html` and `gantt-cloud.js`.
2. Do **not** create a spreadsheet and do **not** deploy a new Apps Script URL. A read of the current web
   app already returns Gantt plans from the Gantt tab (`{exists, projectId, updatedAt, data}`).
3. Open a Gantt, edit one task, and confirm the header says "Saved to the Sheet". On another device, open
   the same project and confirm the edit is there.
4. Redeploy the bound script only if the header says "Sheet has no Gantt save yet" or a save never sticks.
   Extensions → Apps Script on **NPD Tracker Data Store** → paste the Gantt section from
   `docs/apps-script/Gantt.gs` into the existing script (do not replace the tracker's read/write) →
   Deploy → Manage deployments → the current web app → pencil → New version → Deploy.
   The URL and the access key stay the same. Before deploying, check that column A of the Gantt tab is the
   project id, B the updated time, and C the JSON. The sample matches that layout and will not touch the
   tracker tabs.

## Opening it from V2
V2's Timeline button opens `gantt.html?project=<V2 id>&name=<name>&code=<code>&customer=<customer>` in the same tab.

- The customer picks the book: `gantt3:book:cust-<customer as a slug>` (accents folded, so "Nestlé" → `cust-nestle`).
  No customer → the general `gantt3:book:default`. `?book=<id>` still overrides.
- The project id picks the project inside the book. If the book doesn't have it yet:
  - a plan the earlier Gantt saved on this device (`gantt:plan:<id>`) is brought in once, as it was, with a toast
    ("Brought in this project's plan from the earlier Gantt"); the old copy is left where it is;
  - otherwise it starts as a Timeline from the stage-gate template, like "＋ Project".
- "‹ Project" at the top left goes back to `v2/?project=<id>`; opened on its own it goes back to V2.
- The browser tab reads "Gantt · <project code>" (or "Gantt · NPD Tracker").

## Look
The Gantt wears V2's look and light / dark (same keys: `npd2-look`, `npd2-theme`), painted before first render.
`<style id="v2tokens">` is a copy of V2's look tokens (every look, light and dark); keep it in step when V2's looks
change. `<style id="v2look">` points the Gantt's old palette names (`--blue`, `--text-main`, `--bg-sb`, `--sv-*`,
the status page's `--st-*`) at V2's tokens and holds the new header, tabs and toolbar. Dark mode in the ⋯ menu
changes the same setting V2 uses; a change in another V2 tab is picked up live.
Customer outputs keep the TPAC look: the 1-page PDFs, PowerPoint pictures and print use their own fixed styles, and
Present mode shows the TPAC logo.

## Phase 1 (done)
- Header: "‹ Project", customer name with project count and next meeting (✎ edits both), save status, Edit /
  Present, Share, ⋯ (customer file, preview / export, table columns, NPD template, dark / less colour / greyscale).
- Slim project tabs: health dot, name, kind, open asks; × on hover; "＋ Project".
- One toolbar: Gantt / Dashboard, Plan / Actual (was Baseline / Actual), undo, redo, Today (scrolls to the today
  line), Weeks / Months (was a zoom %; remembered per device as `gantt3:scale`), Project settings.
- Phones: the header stacks and the toolbar shows icons; nothing scrolls sideways. The full phone layout comes later.

## Phase 2 (done): Gantt editor
- Task table, 36px rows, sentence-case header. Default columns: Status, Owner, Start, Finish, Length, Depends on.
  Segment, Milestone, Delay and Linkage are under ⋯ → Table columns. The table's Segment and Depends-on columns use
  their own keys (`gvSeg`, `gvPred`) so the preview / export keeps its own column choice. Plans saved before Phase 2
  get the new defaults once (`colVer: 2` in the plan).
- Status chips with a word and an icon: Not started, In progress, Running late, Late start, Done (V3's statuses 1–5).
  Set from the dates; click a chip to pick Auto or a status by hand (a pin marks a hand-set status). Chip text is
  mixed toward the look's text colour so it passes AA in every look.
- Owner: free text with an initials avatar. Dates read "23 Nov" ("4 Jan ’27" in another year) and open V2's
  calendar (arrow keys move, quick picks Today / Next Monday / +1 wk / +2 wks, or +1 wk / +2 wks / End of month /
  Same as start for a finish; Unpin for a pinned start). Depends on shows row numbers, names on hover.
- Fixed: the Task cell was pushed 58px over the Status column by an old style (relative + left:58px), which is why
  V3 showed status codes cut to "PD", "IP".
- Timeline: colours resolved from the look at draw time. Bars by segment from the look's palette (white or dark text,
  whichever reads), Done bars green, late work outlined red, milestones as diamonds, a red Today pill, month + week
  header, a tooltip on every bar, a 10px inset so a first-day milestone isn't cut. Legend under the plan.

## Phase 3 (done): customer status page and Present
- Status-only projects get a new on-screen page (`stScreenHTML`, `.sv2`); the 1-page status PDF (`statusPagerHTML`)
  and the timeline dashboard still use the older builders, so customer printouts don't change.
- Summary card: health chip (click to change), "Updated …" and "since the last meeting", 24px name, a summary for
  the customer, the 7 stage gates (click a gate to set it).
- Meetings and dates: last meeting, next meeting and decision needed by on the shared calendar, with "in 2 days";
  the decision date turns amber within 3 days and red when passed; target launch as text.
- Needed from <customer>: Decision / Info tag (click to switch), what's needed, who, asked date, due date on the
  calendar and a chip: "N days late", "Due Tue 3 Nov" (amber within 3 days) or "Open · waiting N days"; a count
  in the card header.
- What TPAC has done: everything, newest first. What TPAC will do next: owner avatar, date, the circle moves it to
  done. Other notes when there are any. New tags mark items added since the last meeting.
- Toolbar (status-only projects): Start a timeline, undo, redo, Start next cycle (after a meeting), Project settings.
- The date picker is shared (`gvDpShow`): tasks, meetings, asks and lists all use it.
- Present: the same page read-only, with the TPAC logo; no inputs or add buttons.

## Phase 4 (done): dashboard
- Same blocks and the same gauges as before (your choice), restyled in V2's look: cards, headers in sentence case,
  tile numbers, the health pill, stage-gate bars, remark fields, lists and milestones; the look's background shows
  through. Scoped to `#dashView`, so the 1-page PDF (`onePagerHTML`) is untouched.
- The top block (health, summary for the customer, meetings and dates) keeps its layout; only its look changed.
- "Coming up" replaces "Next steps": tasks that start or are due before the next meeting (the next 3 weeks when no
  meeting is set), with the date, "in 11 days", and starts / due.
- Focus and Key milestones show labelled status chips (Running late, Late start…) instead of a bare number.
- Stage-gate remarks are typed right in the gates table; read-only in Present.
- The timeline's legend and Today button hide on the Dashboard tab.
- The 1-page PDF's "Next steps" card became "Coming up" with the same rule and tasks as the screen (until the next
  meeting, else the next 3 weeks); the rest of the PDF is unchanged.

## Timeline header and Gantt display buttons
- The timeline always shows a year row above the months; month labels no longer carry the year.
- Settings > Gantt display (audit, Oct 2026): every button changes both the timeline on screen and the exported chart:
  Dep. Arrows, Critical Path, Cal. Week No., Today Marker, Grid: Weekly / 2-Week / 4-Week / Month. Variance adds a
  column to the export in Actual mode (greyed out in Baseline). Phase, Segment, Start Week, Duration, Predecessor,
  Year Row, Milestone and Delay left the panel: the export uses the table's columns and always shows the year.
- Critical path (`computeCriticalPath`) uses the same links as the scheduler: every predecessor with its delay and the
  gate rule (a gate waits for every task of the earlier gates); slack under about a day counts as critical. On screen
  it tints the row, marks its left edge and colours the arrows between critical tasks; the legend says "Critical path".

## Exported chart and fonts (Nov 2026)
- The exported chart (Preview, PNG, the chart in the PDFs; `renderGantt`) is drawn like the screen Gantt, in one fixed
  light style for everyone (V2 Glass colours): the TPAC logo header, "TIMELINE" and the customer / project / date /
  prepared-by strip stay on top; below them a light calendar header (year, months, calendar weeks, Today pill),
  sentence-case gate rows with count and dates, the table's columns (Status chip, Owner, Start, Finish, Length,
  Depends on; the same ones the table shows), rounded segment-coloured bars, arrows, critical rows, and a footer with
  the notes and a legend. Greyscale and Less colour (More menu) still apply; dark mode does not change the export.
- Export fonts: Geist and Geist Mono (the Glass look's fonts) for the chart image, the PDFs and the slide pictures,
  embedded in the chart image (`SVG_FONTS`). DM Sans, DM Mono, Tomorrow and Google Sans are gone; Excel stays Calibri.
  The in-app preview shows the export's own fonts. The old default note about bar colours now says "Bar colours show
  the segment (see the legend)".
- Screen type like V2 (`#v2type`): card headings, panel titles and the date picker month use the look's heading font
  and weight; codes, dates and day counts use the look's mono font. The old V3 stylesheet's fixed fonts are removed.

## SOP master template (Nov 2026)
- File menu › **Start from SOP master**: replaces the open project's tasks with a template from the NPD Master Task List
  v0.8 (IML injection molding, EBM / ISBM / IBM, injection without artwork; options for the pilot mold and conditional
  tasks). Task codes are the master IDs, so an exported Excel can be matched back to the master list. Ctrl+Z undoes it.
  It saves through the normal save, so it reaches the Sheet like any other edit (big plans use the overflow rows).
- The timeline header stays pinned while you scroll the plan.
- The **#** column is the task's real number in the whole plan (the same number Depends on and its dropdown use),
  even when a gate is collapsed. Before, it counted only the rows on screen, so a collapsed gate made # and
  Depends on disagree. Deleting or moving a task renumbers both together.
- Start and Finish columns are wider so 2027 dates ("11 Jan ’27") are not cut off in the mono font.

## Next phases
Later: phone layout.
