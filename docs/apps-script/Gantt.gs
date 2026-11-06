/**
 * Gantt rows on the NPD Tracker spreadsheet (tab name: "Gantt").
 *
 * The web app already deployed for the tracker answers ganttRead against this
 * tab. Leave that deployment alone unless a Gantt save reports
 * "Sheet has no Gantt save yet".
 *
 * If you do have to paste this in:
 *   1. Open the spreadsheet "NPD Tracker Data Store" → Extensions → Apps Script.
 *   2. Confirm the Gantt tab: column A is the project id, B the updated time,
 *      C the JSON. Do not deploy a replacement if those columns differ.
 *   3. Paste the two `if (action === 'gantt…')` branches into the existing
 *      doGet and doPost, next to the tracker's own actions. Paste the helper
 *      functions at the bottom. Do not replace the tracker's read/write,
 *      and do not create a new web app or a new spreadsheet.
 *   4. Deploy → Manage deployments → pencil on the current web app →
 *      New version → Deploy. The URL stays the same.
 *   5. Run ganttCloudSelfCheck once from the editor. It only reads.
 *      It should report the legacy "default" row (or exists: false if that
 *      row was removed). It must not say "no Gantt tab".
 *
 * Keys the page sends (all stored as ordinary rows on this same tab):
 *   <project id>          one plan JSON object (the rows already on the tab)
 *   book-<book id>        small index: {kind:'gantt-book', projects:[…], …}
 *   <project id>__p1 …    extra pieces when a plan does not fit in one cell
 */

// --- inside the existing doGet, after the token check and after `action` is known ---
// if (action === 'ganttRead') return ganttJson_(ganttRead_(e.parameter.project));

// --- inside the existing doPost, after the token check ---
// var body = {};
// try { body = JSON.parse(e.postData && e.postData.contents || '{}'); } catch (err) { body = {}; }
// if ((body.action || e.parameter.action) === 'ganttWrite') {
//   return ganttJson_(ganttWrite_(body.project, body.data));
// }

function ganttJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ganttSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Gantt');
  if (!sh) {
    sh = ss.insertSheet('Gantt');
    sh.getRange(1, 1, 1, 3).setValues([['projectId', 'updatedAt', 'data']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** A=id, B=updatedAt, C=JSON, unless row 1 is a header that names them. */
function ganttLayout_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 3);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim().toLowerCase();
  });
  function find(names) {
    for (var i = 0; i < names.length; i++) {
      var at = head.indexOf(names[i]);
      if (at >= 0) return at + 1;
    }
    return 0;
  }
  var idCol = find(['projectid', 'project id', 'project', 'id']);
  var header = idCol > 0;
  return {
    header: header,
    idCol: header ? idCol : 1,
    atCol: header ? (find(['updatedat', 'updated', 'updated_at']) || 2) : 2,
    dataCol: header ? (find(['data', 'json', 'payload']) || 3) : 3,
    startRow: header ? 2 : 1
  };
}

function ganttFindRow_(sh, layout, projectId) {
  var last = sh.getLastRow();
  if (last < layout.startRow) return 0;
  var ids = sh.getRange(layout.startRow, layout.idCol, last - layout.startRow + 1, 1).getValues();
  var want = String(projectId);
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === want) return layout.startRow + i;
  }
  return 0;
}

function ganttRead_(projectId) {
  if (!projectId) return { error: 'missing_project' };
  var sh = ganttSheet_();
  var layout = ganttLayout_(sh);
  var row = ganttFindRow_(sh, layout, projectId);
  if (!row) return { exists: false, projectId: String(projectId) };
  var at = sh.getRange(row, layout.atCol).getValue();
  var data = sh.getRange(row, layout.dataCol).getValue();
  return {
    exists: true,
    projectId: String(projectId),
    updatedAt: at instanceof Date ? at.toISOString() : String(at || ''),
    data: data == null ? '' : String(data)
  };
}

function ganttWrite_(projectId, data) {
  if (!projectId) return { error: 'missing_project' };
  if (data == null) return { error: 'missing_data' };
  var text = String(data);
  if (text.length > 50000) return { error: 'too_large' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return { error: 'busy' };
  }
  try {
    var sh = ganttSheet_();
    var layout = ganttLayout_(sh);
    var row = ganttFindRow_(sh, layout, projectId);
    var stamp = new Date().toISOString();
    if (!row) {
      row = Math.max(sh.getLastRow(), layout.header ? 1 : 0) + 1;
      sh.getRange(row, layout.idCol).setValue(String(projectId));
    }
    sh.getRange(row, layout.atCol).setValue(stamp);
    sh.getRange(row, layout.dataCol).setValue(text);
    return { ok: true, projectId: String(projectId), updatedAt: stamp };
  } finally {
    lock.releaseLock();
  }
}

/** Editor-only. Reads one row and returns its size. Does not write. */
function ganttCloudSelfCheck() {
  var res = ganttRead_('default');
  if (res && res.data) res.bytes = String(res.data).length;
  if (res) delete res.data;
  Logger.log(JSON.stringify(res));
  return res;
}
