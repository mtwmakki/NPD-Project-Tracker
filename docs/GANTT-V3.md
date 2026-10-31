# Gantt V3 (customer status book)

`gantt.html` is Gantt V3: one **book per customer**, holding that customer's projects. A project is either a
**Timeline** (task table + timeline, dashboard) or **Status only** (needed from the customer, done, next, stage gates).
Everything is saved in the browser of the device that made it (localStorage); nothing goes to the Sheet yet.
Mockup and review: the "NPD Gantt V3 Rework" artifact.

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

## Next phases
2. Gantt editor: task table (status chips "Not started / In progress / Running late / Late start / Done", owner
   avatars, "23 Nov" dates, V2's date picker) and timeline (header, Today pill, segment colours, legend).
3. Customer status page and Present mode.
4. Dashboard: four tiles, task bar, stage gates with remarks.
Later: phone layout.
