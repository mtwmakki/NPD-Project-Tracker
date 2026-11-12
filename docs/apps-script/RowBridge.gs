/**
 * RowBridge.gs — web-app entry points for row storage.
 *
 * Needs RowStore.gs (and Gantt.gs for the Gantt tab) in the same Apps Script project.
 *
 * Script properties (Project Settings → Script properties):
 *   BRIDGE_TOKEN    the shared token the pages send (same one the app uses today)
 *   STORAGE_MODE    'blob' (default, the old behaviour) or 'rows'. Flip this to switch, flip it back to roll back.
 *   OLD_BRIDGE_URL  /exec URL of the old blob bridge (used by the migration and rollback helpers below)
 *
 * Live project: do NOT paste doGet/doPost twice. Rename the existing ones to legacyDoGet_ / legacyDoPost_
 * and put this file next to them; while STORAGE_MODE is 'blob' every call falls through to them unchanged.
 *
 * Calls (all need the token):
 *   GET  ?action=read                          rows mode: { _data, _updatedAt, _updatedBy, _rev, _format:'rows-v1' }
 *   POST { action:'writeRows', by, ops:[…] }   per-record writes, see RowStore.gs rsApplyRecord_
 *   POST { _data, _updatedAt, _updatedBy }     old blob write, diffed into rows (bots and old pages keep working)
 *   GET  ?action=ganttRead / POST ganttWrite   always delegated to legacyDoGet_/legacyDoPost_ (any action starting "gantt")
 */

function rbJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function rbProp_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function rbMode_() { return rbProp_('STORAGE_MODE') === 'rows' ? 'rows' : 'blob'; }
function rbAuth_(t) { var want = rbProp_('BRIDGE_TOKEN'); return !!want && String(t || '') === want; }

function doGet(e) {
  var p = (e && e.parameter) || {}, action = p.action || 'read';
  try {
    if (rbMode_() === 'blob' && typeof legacyDoGet_ === 'function') return legacyDoGet_(e);
    // Gantt always goes to the legacy handlers (ganttRead/ganttWrite live in the old Code.gs, which does its own auth), whatever the storage mode.
    if (/^gantt/.test(String(action)) && typeof legacyDoGet_ === 'function') return legacyDoGet_(e);
    if (!rbAuth_(p.token)) return rbJson_({ error: 'unauthorized' });
    if (action === 'ganttRead' && typeof ganttRead_ === 'function') return ganttJson_(ganttRead_(p.project));
    if (rbMode_() === 'blob') return rbJson_({ error: 'storage_mode_blob_without_legacy_handler' });
    if (action === 'read') return rbJson_(rsRead_());
    return rbJson_({ error: 'unknown_action' });
  } catch (err) { return rbJson_({ error: String(err && err.message || err) }); }
}

function doPost(e) {
  try {
    if (rbMode_() === 'blob' && typeof legacyDoPost_ === 'function') return legacyDoPost_(e);
    var body = {};
    try { body = JSON.parse(e.postData && e.postData.contents || '{}'); } catch (x) { body = {}; }
    var p = (e && e.parameter) || {};
    var action = body.action || p.action;
    if (/^gantt/.test(String(action)) && typeof legacyDoPost_ === 'function') return legacyDoPost_(e);
    if (!rbAuth_(body.token || p.token)) return rbJson_({ error: 'unauthorized' });
    if (action === 'ganttWrite' && typeof ganttWrite_ === 'function') return ganttJson_(ganttWrite_(body.project, body.data));
    if (rbMode_() === 'blob') return rbJson_({ error: 'storage_mode_blob_without_legacy_handler' });
    if (action === 'writeRows') return rbJson_(rsWriteRows_(body));
    if (body._data !== undefined) return rbJson_(rsWriteBlob_(body));
    return rbJson_({ error: 'unknown_action' });
  } catch (err) { return rbJson_({ error: String(err && err.message || err) }); }
}

/* ───────── run these by hand from the Apps Script editor, on a COPY of the sheet first ───────── */

function rbFetchOld_() {
  var url = rbProp_('OLD_BRIDGE_URL'), tok = rbProp_('BRIDGE_TOKEN');
  if (!url) throw new Error('Set the OLD_BRIDGE_URL script property to the old bridge /exec URL');
  var res = UrlFetchApp.fetch(url + '?action=read&token=' + encodeURIComponent(tok) + '&_=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
  var j = JSON.parse(res.getContentText());
  if (j.error || !j._data) throw new Error('old bridge said: ' + (j.error || 'no data'));
  return j;
}

/** Step 1: copy every record from the old bridge's blob into the row tabs, diff, keep Backup_Blob. */
function rsMigrateFromOldBridge() {
  var j = rbFetchOld_(), report = rsMigrate_(j._data, {});
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
/** Same, but reading the blob from a JSON file pasted into a script property named BLOB_JSON (for blobs the fetch cannot reach). */
function rsMigrateFromScriptProperty() {
  var report = rsMigrate_(rbProp_('BLOB_JSON'), {});
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
/** Step 2 (run any time before switching): rows vs the old bridge's current blob. Differences are listed; none = safe. */
function rsVerifyAgainstOldBridge() {
  var j = rbFetchOld_(), diff = rsDiffBlobs_(JSON.parse(j._data), JSON.parse(rsExportBlob_()));
  var out = { identical: diff.length === 0, diff: diff, oldCounts: rsCounts_(JSON.parse(j._data)), rowCounts: rsCounts_(JSON.parse(rsExportBlob_())) };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
/** Step 3: go live on rows. Rollback = rsSwitchToBlob(). */
function rsSwitchToRows() { PropertiesService.getScriptProperties().setProperty('STORAGE_MODE', 'rows'); }

/**
 * Rollback: write the CURRENT rows back into the old blob (through the old bridge, so its safety guard still applies)
 * and flip STORAGE_MODE back to 'blob'. Nothing in the row tabs is deleted.
 */
function rsSwitchToBlob() {
  var url = rbProp_('OLD_BRIDGE_URL'), tok = rbProp_('BRIDGE_TOKEN');
  var blob = rsExportBlob_(), res = null;
  if (typeof legacyWriteBlob_ === 'function') res = legacyWriteBlob_(blob, 'rollback');
  else {
    if (!url) throw new Error('Set OLD_BRIDGE_URL, or define legacyWriteBlob_(jsonText, by) in the project');
    res = JSON.parse(UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain', payload: JSON.stringify({ token: tok, _data: blob, _updatedAt: new Date().toISOString(), _updatedBy: 'rollback from rows' }), muteHttpExceptions: true, followRedirects: true }).getContentText());
  }
  if (res && res.error) throw new Error('old bridge refused the rollback write: ' + res.error);
  PropertiesService.getScriptProperties().setProperty('STORAGE_MODE', 'blob');
  Logger.log('Rolled back. Old blob now holds the latest rows. ' + JSON.stringify(res));
}
