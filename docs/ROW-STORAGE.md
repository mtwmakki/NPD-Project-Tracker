# Row storage for the NPD Tracker

Moves the Sheet from one JSON blob to **one row per record**. Brief: `NPD_Tracker_storage_brief.md`.
Nothing here is live until Adam switches it on. Do every step first on a **copy** of the Sheet with its own Apps Script deployment.

## What changes

| | Before | After |
|---|---|---|
| Sheet | `Sheet1` rows 1-3: one 400 KB text blob | Tabs `Projects`, `Inquiries`, `MTasks`, `Bin`, `Tasks`, `NextActions`, `Milestones`, `SubStatuses`, `ActivityLog`, `Meta`; `Backup_Blob` holds the old blob; `Gantt` untouched |
| Save | whole blob rewritten | only changed rows rewritten, each stamped `updatedAt` / `updatedBy` |
| Two saves at once | last write wins (re-read reduces it) | row-level merge under a script lock; same row changed by both = the second is warned |
| `?action=read` | `{_data,_updatedAt,_updatedBy}` | same, plus `_rev`, `_format:'rows-v1'` (bots keep working) |

Files: `docs/apps-script/RowStore.gs` (engine), `docs/apps-script/RowBridge.gs` (doGet/doPost + migration/rollback functions), `v2/index.html` (row-level client), `tools/`, `tests/`.

## Sheet layout

One header row (frozen, bold), plain-text cells so `2026-11-10` stays `2026-11-10`, no formulas.

* `Projects`, `Inquiries`: the columns in the brief, then `updatedAt`, `updatedBy`, `pos`, `extra`…`extra8`.
* `Tasks`, `NextActions`, `Milestones`, `SubStatuses`, `ActivityLog`: child rows with `parentType` (project / inquiry), `parentId`, `parentCode`, then their own fields. Row order inside a parent is kept by `pos`.
* `Meta`: `key` / `value` rows (tags, schedule, `schemaVersion`).
* **`extra` columns** hold every field that has no readable column, as JSON (`links`, `pics`, `pipeline`, `brief`, unknown future fields…). A cell is capped at 45,000 characters; longer values continue in `extra2`…`extra8`. Nothing is dropped.
* `parentCode` is a convenience copy. Hand-editing it does nothing; it is refreshed when the project code changes.
* `pos` is the sort order. Leave it alone unless you want to reorder (smaller number = higher).

Hand editing is safe: edit any readable cell, or add / delete a row. The next refresh shows it. If the app has an unsaved change on the same row, the app warns instead of overwriting.

## Set-up on a copy (test)

1. File → Make a copy of "NPD Tracker Data Store". Open Extensions → Apps Script on the **copy** (a copy brings its own bound script).
2. Paste `RowStore.gs`, `RowBridge.gs` (and keep `Gantt.gs`). In the existing `Code.gs`, rename `doGet` to `legacyDoGet_` and `doPost` to `legacyDoPost_`. While `STORAGE_MODE` is `blob`, every call falls through to them unchanged.
3. Script properties: `BRIDGE_TOKEN` (same token as today), `OLD_BRIDGE_URL` (the copy's current `/exec` URL, or the live one for a read-only comparison), `STORAGE_MODE` = `blob`.
4. Deploy → New deployment → Web app (execute as me, anyone with the link). Use that URL in a test copy of `v2/index.html`.
5. Run `rsMigrateFromOldBridge` once. The log shows record counts and `diff: []`. It reads the old blob, writes the tabs, saves `Backup_Blob`, reads the tabs back and diffs them against the blob. Any difference empties the new tabs and stops with an error.
6. Run `rsVerifyAgainstOldBridge` any time: rows vs the old blob, record by record.
7. Run `rsSwitchToRows` (sets `STORAGE_MODE` = `rows`). The test page now saves rows.

Dry run without touching any Sheet: save the `_data` text from `?action=read` as `blob.json` and run

```
node tools/migrate-and-diff.js blob.json
```

It prints counts for every collection and exits non-zero on any difference. Run this first on the real data.

## Going live (after Adam signs off)

Repeat steps 2-7 on the live project: take a Drive copy of the Sheet and save `Code.gs` as the next `Code_V*.gs` in "Apps Script Versions" first, then Deploy → Manage deployments → pencil → New version (keeps the same URL, so `index.html` / `gantt.html` need no change). Pages that still send the old blob (`_data`) keep working: the bridge diffs the blob into rows and applies the same 30% safety guard (`write_blocked`).

## Rollback

Fast, no data loss:

1. Apps Script editor → run **`rsSwitchToBlob`**. It writes the current rows back into the old blob through the old bridge (its safety guard still applies) and sets `STORAGE_MODE` = `blob`. The row tabs stay as they are.
2. Pages keep working unchanged. Reload the open tabs.

Hard rollback (the old blob is gone or wrong): `Backup_Blob` row 2 holds the blob taken at migration (cells joined left to right). Paste it into `Sheet1` the way `Code.gs` stores it, or `rsReadBackup_()` returns it as text. Everything saved after migration is only in the row tabs, so prefer `rsSwitchToBlob`.

If the old `Code.gs` is not reachable via `OLD_BRIDGE_URL`, define `legacyWriteBlob_(jsonText, by)` in the project and `rsSwitchToBlob` uses it instead.

## How conflicts work

* The app remembers every record as it read it. On save it sends only records that differ, with that remembered version as `base`.
* The bridge compares each changed **row** (a task, a next action, the project row itself…) with `base`. If the sheet's row still equals `base`, it writes. If someone changed that row since, **nothing for that record is written** and the app asks: *OK = keep my version, Cancel = show theirs*.
* Different rows of the same project (two people editing two different tasks) merge without a warning. The brief asks for a warning on the same *record*; row granularity is gentler and loses nothing. Say if you want a stricter record-level warning.
* Tags / schedule are one `Meta` row each; two people changing the tag list at once also warn.

## Test notes

`node tests/rowstore.test.js` (35 tests, no dependencies) runs the real `.gs` files against an in-memory sheet:

| Acceptance item | Test |
|---|---|
| migrate, diff = 0, counts match | "migrates with zero diff…", "tabs hold one row per record" (39 projects, 131 inquiries + tasks, next actions, logs) |
| edit one task → one row changes | "editing one task changes only that row" (checks the only sheet touched, one row, stamps) |
| two browsers, different records | "two browsers, different records: both survive", "…different tasks in the same project…" |
| two browsers, same record | "…same record: second is warned and nothing is written" |
| hand edit shows after refresh | "a hand-edited cell shows in the next read, and changes _rev", "hand-added row appears…" |
| reversible | "rsSwitchToBlob posts the current rows…", "rollback aborts… if the old bridge refuses" |
| awkward data | `=SUM()` text, numeric ids, duplicate / missing child ids, 150 K character field, 400-entry log, number-as-text |

`tools/mock-bridge.js` serves the real bridge code over an in-memory sheet plus a copy of the app pointed at it. The row-level client was run against it in a browser: one edit changes one `Tasks` row stamped with the editor; an edit and an other-browser edit of different records both survive; an edit of a row someone else changed first shows the warning and both choices end clean.

### Not tested here (needs Adam)

* Nothing ran in real Google Apps Script or on a copy of the real Sheet. The code uses only standard Apps Script calls, but run `rsMigrateFromOldBridge` on a copy and check `diff: []` before anything else.
* The live blob was not available to me. Run `node tools/migrate-and-diff.js blob.json` on the real `_data` first.
* The Sheet UI (frozen header, hand-edit feel) is unseen. Check it on the copy.
* Timing: a save is a few Sheet calls; a very large first migration may need a second run if Apps Script's 6-minute limit is hit (it fails clean and empties the tabs).
* Gantt cloud save, Excel export and offline cache use the same data object as before; the app code for them is unchanged. Offline: edits queue and retry; the cache (`npd2-cache`) is written after each save as before.

## Deviations from the brief (please confirm)

1. Extra columns: `pos`, `extra`…`extra8`, and tabs `MTasks`, `Bin`, `ActivityLog` (the brief lists neither; they hold data the app uses today).
2. Empty strings, `null` and empty lists are not stored; an empty cell reads back as empty. The diff counts them as equal.
3. Warning is per row, see above.
4. Edits to `futureField`-style unknown top-level keys are not tracked per row; they are migrated and kept in `Meta`.
