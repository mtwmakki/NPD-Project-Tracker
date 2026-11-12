/**
 * GoLive.gs — helpers used for the live cut-over on the existing NPD Tracker Apps Script project.
 * Only for a project that still has the old blob Code.gs (with TOKEN, readBlob_, writeBlob_) renamed
 * as described in RowBridge.gs. Not needed on a fresh project.
 */

/** Used by rsSwitchToBlob (rollback): writes the blob through the old writeBlob_, so its safety guard still applies. */
function legacyWriteBlob_(blob, by) {
  try { return { ok: true, updatedAt: writeBlob_(blob, by) }; }
  catch (err) { return { error: String(err && err.message || err) }; }
}

/**
 * Run once. Migrates the blob into the row tabs, checks nothing changed meanwhile, then flips STORAGE_MODE to rows.
 * Aborts (stays in blob mode) on any problem. Also sets BRIDGE_TOKEN from the old TOKEN constant.
 * Rollback: rsSwitchToBlob().
 */
function goLive() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('BRIDGE_TOKEN', TOKEN);
  props.setProperty('STORAGE_MODE', 'blob');
  var b1 = readBlob_(), rep = rsMigrate_(b1.str, {});
  if (!rep.ok) throw new Error('migration not clean: ' + JSON.stringify(rep.diff));
  var b2 = readBlob_();
  if (b2.updatedAt !== b1.updatedAt || b2.str.length !== b1.str.length) throw new Error('blob changed during migration, nothing switched, run again');
  props.setProperty('STORAGE_MODE', 'rows');
  Logger.log('LIVE ON ROWS ' + JSON.stringify(rep.tabCounts));
}
