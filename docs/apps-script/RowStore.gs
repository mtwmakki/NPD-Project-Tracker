/**
 * RowStore.gs — row-per-record storage for the NPD Tracker (replaces the single JSON blob).
 *
 * Storage engine only. No doGet/doPost here: RowBridge.gs has the web-app entry points and
 * docs/ROW-STORAGE.md has set-up, migration and rollback.
 *
 * Tabs (one row per record, frozen header, plain-text cells so 2026-11-10 stays 2026-11-10):
 *   Projects, Inquiries, MTasks (standalone tasks), Bin (recycle bin)   top-level records
 *   Tasks, NextActions, Milestones, SubStatuses, ActivityLog             child rows, keyed by parentType + parentId
 *   Meta                                                                 key / value (tags, schedule, schema version)
 *   Backup_Blob                                                          read-only copy of the old blob
 *   Gantt                                                                untouched (Gantt.gs)
 *
 * Lossless rule: every field of a record is either a readable column or lands in the JSON `extra` cell of
 * its row (spilling into extra2..extra8 so no cell passes the 50,000-character limit). Nothing is dropped.
 * Empty strings, null and empty lists are not stored; an empty text cell reads back as ''.
 */

var RS_CELL_MAX = 45000;
var RS_EXTRA_COLS = 8;
var RS_SCHEMA_VERSION = 2;
var RS_SYN = '~~';                 // prefix of a generated row id (record had no usable id)
var RS_SEP = '\u0001';

/* column kinds: s text, n number, b boolean, m derived (written, never read back) */
var RS_DEFS = {
  Projects:    { cols: [['id','s'],['code','s'],['name','s'],['customer','s'],['factory','s'],['status','s'],['stage','s'],['deliveryDate','s'],['ballWith','s'],['ballSince','s'],['salesPerson','s'],['classification','s'],['date','s']] },
  Inquiries:   { cols: [['id','s'],['code','s'],['name','s'],['customer','s'],['factory','s'],['status','s'],['type','s'],['priority','s'],['material','s'],['moldCost','n'],['bdPerson','s'],['outcome','s'],['outcomeDate','s'],['outcomeReason','s'],['remark','s'],['date','s']] },
  MTasks:      { cols: [['id','s'],['title','s'],['description','s'],['category','s'],['priority','s'],['deadline','s'],['status','s'],['reminder','s'],['owner','s'],['createdAt','s'],['completedAt','s'],['archived','b']] },
  Bin:         { cols: [['id','s'],['kind','s'],['code','s'],['name','s'],['deletedAt','s']] },
  Tasks:       { child: true, cols: [['id','s'],['parentType','m'],['parentId','m'],['parentCode','m'],['name','s'],['owner','s'],['pic','s'],['deadline','s'],['done','b'],['completedAt','s'],['status','s'],['dependsOn','s'],['classification','s'],['addedOn','s']] },
  NextActions: { child: true, cols: [['id','s'],['parentType','m'],['parentId','m'],['parentCode','m'],['action','s'],['pic','s'],['deadline','s'],['done','b'],['completedAt','s'],['addedOn','s']] },
  Milestones:  { child: true, cols: [['id','s'],['parentType','m'],['parentId','m'],['parentCode','m'],['title','s'],['date','s'],['category','s'],['status','s'],['note','s'],['createdAt','s']] },
  SubStatuses: { child: true, cols: [['id','s'],['parentType','m'],['parentId','m'],['parentCode','m'],['title','s'],['status','s'],['date','s'],['note','s'],['createdAt','s']] },
  ActivityLog: { child: true, cols: [['id','s'],['parentType','m'],['parentId','m'],['parentCode','m'],['type','s'],['icon','s'],['text','s'],['by','s'],['date','s'],['time','s']] },
  Meta:        { cols: [['key','s']] }
};
/* blob collection → tab, parent type, and nested lists that get their own tab */
var RS_COLL = {
  projects:  { tab: 'Projects',  parentType: 'project', children: [['tasks','Tasks'],['milestones','Milestones'],['subStatuses','SubStatuses'],['activityLog','ActivityLog']] },
  inquiries: { tab: 'Inquiries', parentType: 'inquiry', children: [['tasks','Tasks'],['nextActions','NextActions'],['activityLog','ActivityLog']] },
  mtasks:    { tab: 'MTasks',    parentType: 'mtask',   children: [] },
  bin:       { tab: 'Bin',       parentType: 'bin',     children: [] }
};
var RS_COLL_ORDER = ['inquiries', 'projects', 'mtasks', 'bin'];
var RS_TAB_ORDER = ['Projects','Inquiries','MTasks','Bin','Tasks','NextActions','Milestones','SubStatuses','ActivityLog','Meta'];
var RS_CHILD_FIELDS = { tasks: 1, nextActions: 1, milestones: 1, subStatuses: 1, activityLog: 1 };

function rsExtraNames_() { var a = ['extra']; for (var i = 2; i <= RS_EXTRA_COLS; i++) a.push('extra' + i); return a; }
function rsHeader_(tab) {
  var h = RS_DEFS[tab].cols.map(function (c) { return c[0]; });
  return h.concat(['updatedAt', 'updatedBy', 'pos'], rsExtraNames_());
}
function rsKinds_(tab) { var k = {}; RS_DEFS[tab].cols.forEach(function (c) { k[c[0]] = c[1]; }); return k; }

/* ───────── helpers ───────── */
function rsStable_(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(rsStable_).join(',') + ']';
  return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + rsStable_(v[k]); }).join(',') + '}';
}
function rsIsEmpty_(v) { return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0); }
function rsIsObj_(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function rsSplit_(str) { var out = []; for (var i = 0; i < str.length; i += RS_CELL_MAX) out.push(str.substr(i, RS_CELL_MAX)); return out; }
function rsUsableId_(id) { return typeof id === 'string' && id !== '' && id.indexOf(RS_SYN) !== 0; }
function rsCellString_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

/* ───────── record ⇄ rows ───────── */
/** Split an object into readable columns and the leftover `extra` object. */
function rsEncode_(tab, obj, skip) {
  var kinds = rsKinds_(tab), fields = {}, extra = {};
  Object.keys(obj).forEach(function (k) {
    if (skip[k] || k === 'id') return;
    var v = obj[k], kd = kinds[k];
    if (rsIsEmpty_(v)) return;
    if (kd === 's' || kd === 'n' || kd === 'b') {
      if (v === '' || v === null) return;
      if (kd === 's' && typeof v === 'string') { fields[k] = v; return; }
      if (kd === 'n' && typeof v === 'number' && isFinite(v)) { fields[k] = v; return; }
      if (kd === 'b' && typeof v === 'boolean') { fields[k] = v; return; }
    }
    extra[k] = v;
  });
  return { fields: fields, extra: extra };
}

/** Flatten one blob record (with its nested lists) into ordered row descriptors; row 0 is the record itself. */
function rsFlatten_(coll, rec, index) {
  var def = RS_COLL[coll], rows = [], skip = {}, kids = [];
  var id = rsUsableId_(rec.id) ? rec.id : RS_SYN + coll + index;
  def.children.forEach(function (ch) {
    var arr = rec[ch[0]];
    if (Array.isArray(arr) && arr.every(rsIsObj_)) { skip[ch[0]] = true; kids.push([ch, arr]); }
  });
  var top = rsEncode_(def.tab, rec, skip);
  if (rec.id !== id && rec.id !== undefined) top.extra.id = rec.id;
  rows.push({ tab: def.tab, key: def.tab + RS_SEP + id, id: id, fields: top.fields, extra: top.extra });
  var code = typeof rec.code === 'string' ? rec.code : '';
  kids.forEach(function (pair) {
    var ch = pair[0], seen = {};
    pair[1].forEach(function (c, i) {
      var cid = rsUsableId_(c.id) && !seen[c.id] ? c.id : RS_SYN + i;
      seen[cid] = true;
      var e = rsEncode_(ch[1], c, {});
      if (c.id !== cid && c.id !== undefined) e.extra.id = c.id;
      e.fields.parentType = def.parentType; e.fields.parentId = id; e.fields.parentCode = code;
      rows.push({ tab: ch[1], key: ch[1] + RS_SEP + def.parentType + RS_SEP + id + RS_SEP + cid, id: cid, parent: id, field: ch[0], fields: e.fields, extra: e.extra });
    });
  });
  return rows;
}

/** What decides "this row changed": text/number/boolean columns and extra. Not derived columns, stamps or position. */
function rsSigOf_(tab, fields, extra) {
  var kinds = rsKinds_(tab), f = {};
  Object.keys(fields).forEach(function (k) { if (kinds[k] !== 'm' && !rsIsEmpty_(fields[k])) f[k] = fields[k]; });
  return rsStable_({ f: f, e: extra || {} });
}
function rsRowSig_(r) { return rsSigOf_(r.tab, r.fields, r.extra); }

function rsReadExtra_(header, vals, warn, where) {
  var parts = [];
  rsExtraNames_().forEach(function (n) { var i = header.indexOf(n); if (i >= 0 && vals[i] !== '' && vals[i] != null) parts.push(String(vals[i])); });
  if (!parts.length) return {};
  try { var o = JSON.parse(parts.join('')); return rsIsObj_(o) ? o : { value: o }; }
  catch (e) { warn.push('unreadable extra cell at ' + where); return {}; }
}
/** Typed column values of a sheet row. Blank cells are absent. */
function rsReadVals_(tab, header, vals, warn, where) {
  var fields = {};
  RS_DEFS[tab].cols.forEach(function (c) {
    var name = c[0], kd = c[1], i = header.indexOf(name); if (i < 0 || kd === 'm' || name === 'id' || name === 'key') return;
    var v = vals[i]; if (v === '' || v === null || v === undefined) return;
    if (kd === 's') fields[name] = rsCellString_(v);
    else if (kd === 'n') { var nn = typeof v === 'number' ? v : (String(v).trim() !== '' ? Number(v) : NaN); if (isFinite(nn)) fields[name] = nn; }
    else if (kd === 'b') { if (typeof v === 'boolean') fields[name] = v; else { var s = String(v).toLowerCase(); if (s === 'true') fields[name] = true; else if (s === 'false') fields[name] = false; } }
  });
  return { fields: fields, extra: rsReadExtra_(header, vals, warn, where) };
}
function rsBuildRecord_(tab, rowId, dec) {
  var rec = {};
  Object.keys(dec.extra).forEach(function (k) { rec[k] = dec.extra[k]; });
  RS_DEFS[tab].cols.forEach(function (c) {
    var name = c[0], kd = c[1]; if (kd === 'm' || name === 'id') return;
    if (dec.fields[name] !== undefined) rec[name] = dec.fields[name];
    else if (kd === 's' && rec[name] === undefined) rec[name] = '';
  });
  if (dec.extra.id === undefined && rowId.indexOf(RS_SYN) !== 0) rec.id = rowId;
  return rec;
}

/* ───────── sheet access ───────── */
function rsSS_() { return SpreadsheetApp.getActiveSpreadsheet(); }

/** Create any missing tab with a bold, frozen header. Existing tabs are left alone. */
function rsEnsureTabs_() {
  var ss = rsSS_();
  RS_TAB_ORDER.forEach(function (tab) {
    var sh = ss.getSheetByName(tab), header = rsHeader_(tab);
    if (!sh) sh = ss.insertSheet(tab);
    if (sh.getLastRow() === 0) {
      if (sh.getMaxColumns() < header.length) sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
      sh.getRange(1, 1, 1, header.length).setValues([header]);
      sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
      sh.setFrozenRows(1);
      var kinds = rsKinds_(tab);
      header.forEach(function (name, i) {                    // text format: dates stay exactly as typed
        if (kinds[name] === 's' || kinds[name] === 'm' || name === 'updatedAt' || name === 'updatedBy' || name.indexOf('extra') === 0) {
          sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
        }
      });
    }
  });
}

/** Load every tab into memory. */
function rsLoad_() {
  var ss = rsSS_(), M = { tabs: {}, warn: [], kids: {} };
  RS_TAB_ORDER.forEach(function (tab) {
    var sh = ss.getSheetByName(tab);
    if (!sh) throw new Error('missing_tab:' + tab);
    var all = sh.getLastRow() > 0 ? sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues() : [];
    var header = all.length ? all[0].map(String) : rsHeader_(tab);
    var T = { name: tab, sh: sh, header: header, rows: [], byKey: {} };
    var d = RS_DEFS[tab];
    var ix = { id: header.indexOf(tab === 'Meta' ? 'key' : 'id'), pt: header.indexOf('parentType'), pid: header.indexOf('parentId'), pos: header.indexOf('pos') };
    for (var r = 1; r < all.length; r++) {
      var vals = all[r], id = rsCellString_(vals[ix.id]);
      if (id === '' && vals.join('') === '') continue;       // blank spacer row
      var pt = d.child ? rsCellString_(vals[ix.pt]) : '', pid = d.child ? rsCellString_(vals[ix.pid]) : '';
      var key = d.child ? tab + RS_SEP + pt + RS_SEP + pid + RS_SEP + id : tab + RS_SEP + id;
      var pos = ix.pos >= 0 && vals[ix.pos] !== '' && !isNaN(Number(vals[ix.pos])) ? Number(vals[ix.pos]) : r;
      if (T.byKey[key]) { M.warn.push('duplicate row ' + key.replace(/\u0001/g, '/') + ' in ' + tab + ' row ' + (r + 1)); continue; }
      var row = { r: r + 1, vals: vals.slice(), key: key, id: id, tab: tab, pos: pos };
      T.rows.push(row); T.byKey[key] = row;
      if (d.child) (M.kids[pt + RS_SEP + pid] = M.kids[pt + RS_SEP + pid] || []).push(row);
    }
    M.tabs[tab] = T;
  });
  return M;
}
function rsDecodeRow_(M, row) { return rsReadVals_(row.tab, M.tabs[row.tab].header, row.vals, M.warn, row.tab + ' row ' + row.r); }
function rsLive_(M, tab, key) { var r = M.tabs[tab].byKey[key]; return r && !r.deleted ? r : null; }
function rsByPos_(a, b) { return (a.pos - b.pos) || ((a.r || 1e9) - (b.r || 1e9)); }
function rsSortedRows_(T) { return T.rows.filter(function (r) { return !r.deleted; }).sort(rsByPos_); }

/** The old blob object, rebuilt from the tabs. */
function rsAssemble_(M) {
  var data = {};
  RS_COLL_ORDER.forEach(function (coll) {
    var def = RS_COLL[coll];
    data[coll] = rsSortedRows_(M.tabs[def.tab]).map(function (row) {
      var rec = rsBuildRecord_(def.tab, row.id, rsDecodeRow_(M, row));
      def.children.forEach(function (ch) { if (rec[ch[0]] === undefined) rec[ch[0]] = []; });
      (M.kids[def.parentType + RS_SEP + row.id] || []).filter(function (k) { return !k.deleted; }).sort(rsByPos_).forEach(function (k) {
        def.children.forEach(function (ch) {
          if (ch[1] !== k.tab) return;
          rec[ch[0]].push(rsBuildRecord_(k.tab, k.id, rsDecodeRow_(M, k)));
        });
      });
      return rec;
    });
  });
  M.tabs.Meta.rows.forEach(function (row) {
    if (row.deleted || row.id === 'schemaVersion') return;
    data[row.id] = rsDecodeRow_(M, row).extra.value;
  });
  return data;
}

function rsStampOf_(M) {
  var best = '', by = '';
  RS_TAB_ORDER.forEach(function (tab) {
    var T = M.tabs[tab], iu = T.header.indexOf('updatedAt'), ib = T.header.indexOf('updatedBy');
    T.rows.forEach(function (row) { var u = rsCellString_(row.vals[iu]); if (u > best) { best = u; by = rsCellString_(row.vals[ib]); } });
  });
  return { at: best, by: by };
}
/** Fingerprint of every cell: changes on any edit, including a hand edit that carries no stamp. */
function rsRevOf_(M) {
  var s = '';
  RS_TAB_ORDER.forEach(function (tab) { s += tab + '|' + M.tabs[tab].rows.map(function (r) { return r.vals.join('\u0002'); }).join('\u0003'); });
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function rsIsMigrated_() {
  var sh = rsSS_().getSheetByName('Meta'); if (!sh || sh.getLastRow() < 2) return false;
  var v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 0; i < v.length; i++) if (v[i][0] === 'schemaVersion') return true;
  return false;
}

/** ?action=read — same shape as the old bridge, plus _rev and _format. */
function rsRead_() {
  var M = rsLoad_(), data = rsAssemble_(M), st = rsStampOf_(M);
  var out = { _data: JSON.stringify(data), _updatedAt: st.at, _updatedBy: st.by, _rev: rsRevOf_(M), _format: 'rows-v1' };
  if (M.warn.length) out._warnings = M.warn.slice(0, 20);
  return out;
}
function rsExportBlob_() { return JSON.stringify(rsAssemble_(rsLoad_())); }

/* ───────── writing ───────── */
function rsRowToVals_(T, row, base) {
  var vals = base ? base.slice() : [], kinds = rsKinds_(T.name);
  while (vals.length < T.header.length) vals.push('');
  T.header.forEach(function (name, i) {
    if (kinds[name] === undefined) return;                 // stamps, extra, and columns somebody added by hand
    vals[i] = row.fields[name] !== undefined ? row.fields[name] : '';
  });
  var chunks = Object.keys(row.extra).length ? rsSplit_(JSON.stringify(row.extra)) : [];
  if (chunks.length > RS_EXTRA_COLS) throw new Error('record_too_large:' + row.key.replace(/\u0001/g, '/'));
  rsExtraNames_().forEach(function (n, k) { var i = T.header.indexOf(n); if (i >= 0) vals[i] = chunks[k] || ''; });
  vals[T.header.indexOf(T.name === 'Meta' ? 'key' : 'id')] = row.id;
  return vals;
}
function rsSetStamp_(T, vals, at, by, pos) {
  var iu = T.header.indexOf('updatedAt'), ib = T.header.indexOf('updatedBy'), ip = T.header.indexOf('pos');
  if (iu >= 0) vals[iu] = at;
  if (ib >= 0) vals[ib] = by;
  if (ip >= 0 && pos !== undefined) vals[ip] = pos;
}
/** Insert or update a row in the in-memory model; rsFlush_ writes it. */
function rsPut_(M, row, pos, at, by) {
  var T = M.tabs[row.tab], cur = T.byKey[row.key];
  if (cur) {
    cur.vals = rsRowToVals_(T, row, cur.vals);
    rsSetStamp_(T, cur.vals, at, by, pos);
    if (pos !== undefined) cur.pos = pos;
    cur.deleted = false; cur.dirty = true; return cur;
  }
  var nr = { r: null, vals: rsRowToVals_(T, row, null), key: row.key, id: row.id, tab: row.tab, pos: pos === undefined ? 1e9 : pos, isNew: true };
  rsSetStamp_(T, nr.vals, at, by, pos);
  T.rows.push(nr); T.byKey[row.key] = nr;
  if (RS_DEFS[row.tab].child) {
    var pk = nr.vals[T.header.indexOf('parentType')] + RS_SEP + nr.vals[T.header.indexOf('parentId')];
    (M.kids[pk] = M.kids[pk] || []).push(nr);
  }
  return nr;
}
function rsDel_(M, tab, key) {
  var cur = M.tabs[tab].byKey[key]; if (!cur) return;
  cur.deleted = true; if (cur.isNew) cur.dropped = true;
}

/** Write the in-memory changes with the fewest calls: updates, then deletes (bottom first), then appends. */
function rsFlush_(M) {
  var written = {};
  RS_TAB_ORDER.forEach(function (tab) {
    var T = M.tabs[tab], n = T.header.length, count = 0;
    T.rows.forEach(function (row) {
      if (row.dirty && !row.deleted && row.r) { T.sh.getRange(row.r, 1, 1, n).setValues([row.vals]); count++; }
      row.dirty = false;
    });
    var del = T.rows.filter(function (r) { return r.deleted && r.r; }).sort(function (a, b) { return b.r - a.r; });
    del.forEach(function (row) { T.sh.deleteRow(row.r); count++; });
    var gone = del.map(function (r) { return r.r; });
    T.rows = T.rows.filter(function (r) { return !r.deleted; });
    T.byKey = {}; T.rows.forEach(function (r) { T.byKey[r.key] = r; });
    Object.keys(M.kids).forEach(function (k) { M.kids[k] = M.kids[k].filter(function (r) { return !r.deleted; }); });
    T.rows.forEach(function (r) { if (r.r) r.r -= gone.filter(function (g) { return g < r.r; }).length; });
    var add = T.rows.filter(function (r) { return r.isNew; });
    if (add.length) {
      var start = Math.max(T.sh.getLastRow(), 1) + 1, need = start + add.length - 1;
      if (need > T.sh.getMaxRows()) T.sh.insertRowsAfter(T.sh.getMaxRows(), need - T.sh.getMaxRows());
      T.sh.getRange(start, 1, add.length, n).setValues(add.map(function (r) { return r.vals; }));
      add.forEach(function (r, i) { r.r = start + i; r.isNew = false; });
      count += add.length;
    }
    if (count) written[tab] = count;
  });
  return written;
}

function rsCurSig_(M, row) { var d = rsDecodeRow_(M, row); return rsSigOf_(row.tab, d.fields, d.extra); }
function rsRowMeta_(M, row) {
  if (!row) return { by: '', at: '' };
  var T = M.tabs[row.tab];
  return { by: rsCellString_(row.vals[T.header.indexOf('updatedBy')]), at: rsCellString_(row.vals[T.header.indexOf('updatedAt')]) };
}

/** Positions for list members: keep existing, put new ones between neighbours; renumber if existing rows were reordered. */
function rsChildPos_(list, curPosOf) {
  var out = {}, prev = -Infinity, reorder = false;
  list.forEach(function (r) { var p = curPosOf(r.key); if (p !== undefined) { if (p <= prev) reorder = true; prev = p; } });
  if (reorder) { list.forEach(function (r, i) { out[r.key] = i + 1; }); return { pos: out, reorder: true }; }
  var last = null;
  list.forEach(function (r, i) {
    var p = curPosOf(r.key);
    if (p === undefined) {
      var next = null;
      for (var j = i + 1; j < list.length; j++) { var q = curPosOf(list[j].key); if (q !== undefined) { next = q; break; } }
      p = last === null ? (next === null ? 1 : next - 1) : (next === null ? last + 1 : (last + next) / 2);
    }
    out[r.key] = p; last = p;
  });
  return { pos: out, reorder: false };
}
/** after: id = right after that record, null = first, undefined = last */
function rsTopPos_(M, tab, after) {
  var rows = rsSortedRows_(M.tabs[tab]);
  if (!rows.length) return 1;
  if (after === null) return rows[0].pos - 1;
  if (after === undefined) return rows[rows.length - 1].pos + 1;
  for (var i = 0; i < rows.length; i++) if (rows[i].id === after) return i + 1 < rows.length ? (rows[i].pos + rows[i + 1].pos) / 2 : rows[i].pos + 1;
  return rows[rows.length - 1].pos + 1;
}

/**
 * One record change as a row-level three-way merge.
 *   op = { coll, id, base, record, after }
 *   base   = the record as the app last read it (null = new record)
 *   record = the record after the user's edit (null = deleted)
 * Only rows the user changed are written. If the sheet's version of such a row is no longer what `base`
 * had, nothing for this record is written and the conflict is reported.
 */
function rsApplyRecord_(M, op, at, by) {
  var def = RS_COLL[op.coll];
  if (!def) throw new Error('bad_coll');
  var baseRows = op.base ? rsFlatten_(op.coll, op.base, 0) : [], newRows = op.record ? rsFlatten_(op.coll, op.record, 0) : [];
  var B = {}, N = {};
  baseRows.forEach(function (r) { B[r.key] = r; });
  newRows.forEach(function (r) { N[r.key] = r; });
  var codeChanged = !!(op.base && op.record && (op.base.code || '') !== (op.record.code || ''));
  var keys = {};
  Object.keys(B).forEach(function (k) { keys[k] = 1; });
  Object.keys(N).forEach(function (k) { keys[k] = 1; });
  if (!op.record) (M.kids[def.parentType + RS_SEP + op.id] || []).forEach(function (r) { if (!r.deleted) keys[r.key] = 1; });
  var plan = [], conflicts = [];
  function clash(tab, key, c, why) {
    var m = rsRowMeta_(M, c);
    conflicts.push({ coll: op.coll, id: op.id, tab: tab, row: key.split(RS_SEP).pop(), by: m.by, at: m.at, reason: why });
  }
  Object.keys(keys).forEach(function (key) {
    var b = B[key], n = N[key], tab = key.split(RS_SEP)[0];
    var c = rsLive_(M, tab, key), csig = c ? rsCurSig_(M, c) : null;
    var bsig = b ? rsRowSig_(b) : null, nsig = n ? rsRowSig_(n) : null;
    if (n && b && nsig === bsig) {                                       // not touched by the user
      if (codeChanged && c && RS_DEFS[tab].child) plan.push({ kind: 'touch', row: n });
      return;
    }
    if (n) {                                                             // changed or added
      if (c && csig === nsig) return;                                    // already in the sheet (a retry)
      if (b ? (!c || csig !== bsig) : !!c) { clash(tab, key, c, c ? 'changed' : 'removed'); return; }
      plan.push({ kind: 'put', row: n });
    } else if (c) {                                                      // deleted
      if (!b || csig !== bsig) { clash(tab, key, c, 'changed'); return; }
      plan.push({ kind: 'del', tab: tab, key: key });
    }
  });
  if (conflicts.length) return { conflicts: conflicts };

  var topKey = def.tab + RS_SEP + op.id;
  var topPos = N[topKey] && !rsLive_(M, def.tab, topKey) ? rsTopPos_(M, def.tab, op.after) : undefined;
  var childPos = {}, rewrite = {};
  def.children.forEach(function (ch) {
    var list = newRows.filter(function (r) { return r.field === ch[0]; });
    if (!list.length) return;
    var res = rsChildPos_(list, function (k) { var r = rsLive_(M, ch[1], k); return r ? r.pos : undefined; });
    list.forEach(function (r) {
      childPos[r.key] = res.pos[r.key];
      if (res.reorder) { var cr = rsLive_(M, ch[1], r.key); if (cr && cr.pos !== res.pos[r.key]) rewrite[r.key] = r; }
    });
  });
  var count = 0, done = {};
  plan.forEach(function (p) {
    if (p.kind === 'del') { rsDel_(M, p.tab, p.key); count++; return; }
    var r = p.row, cur = rsLive_(M, r.tab, r.key);
    if (p.kind === 'touch') {                                            // parent code changed: refresh the readable copy only
      var T = M.tabs[r.tab], ic = T.header.indexOf('parentCode');
      if (ic >= 0) { cur.vals[ic] = r.fields.parentCode || ''; cur.dirty = true; }
      return;
    }
    var pos = r.parent === undefined ? (cur ? undefined : topPos) : (cur ? (rewrite[r.key] ? childPos[r.key] : undefined) : childPos[r.key]);
    rsPut_(M, r, pos, at, by); done[r.key] = 1; count++;
  });
  Object.keys(rewrite).forEach(function (k) { if (!done[k]) { rsPut_(M, rewrite[k], childPos[k], at, by); count++; } });
  return { rows: count };
}

/** Meta key/value change (tags, schedule, ...), same three-way rule. op = { meta, base, value } */
function rsApplyMeta_(M, op, at, by) {
  var key = 'Meta' + RS_SEP + op.meta, cur = rsLive_(M, 'Meta', key);
  var curVal = cur ? rsDecodeRow_(M, cur).extra.value : undefined;
  if (rsStable_(curVal) === rsStable_(op.value)) return { rows: 0 };
  if (rsStable_(curVal) !== rsStable_(op.base)) {
    var m = rsRowMeta_(M, cur);
    return { conflicts: [{ coll: 'meta', id: op.meta, tab: 'Meta', row: op.meta, by: m.by, at: m.at, reason: 'changed' }] };
  }
  rsPut_(M, { tab: 'Meta', key: key, id: op.meta, fields: {}, extra: { value: op.value === undefined ? null : op.value } }, cur ? undefined : 1, at, by);
  return { rows: 1 };
}

/** POST action=writeRows { ops, by } */
function rsWriteRows_(body) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var M = rsLoad_(), at = new Date().toISOString(), by = String(body.by || 'unknown'), conflicts = [], applied = 0;
    (body.ops || []).forEach(function (op) {
      var res = op.meta !== undefined ? rsApplyMeta_(M, op, at, by) : rsApplyRecord_(M, op, at, by);
      if (res.conflicts) conflicts = conflicts.concat(res.conflicts); else applied++;
    });
    var written = rsFlush_(M);
    return { ok: true, applied: applied, conflicts: conflicts, rowsWritten: written, _updatedAt: at, _updatedBy: by, _rev: rsRevOf_(rsLoad_()) };
  } finally { lock.releaseLock(); }
}

/**
 * Old-style POST { _data, _updatedBy }: diff the blob against the tabs and write only what differs, so bots
 * and any other blob writer keep working. Same safety guard as the old bridge (a write that would drop
 * more than 70% of the records is refused).
 */
function rsWriteBlob_(body) {
  var incoming = typeof body._data === 'string' ? JSON.parse(body._data) : body._data;
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var M = rsLoad_(), cur = rsAssemble_(M), at = new Date().toISOString(), by = String(body._updatedBy || 'blob-writer');
    var before = 0, after = 0;
    ['inquiries', 'projects', 'mtasks'].forEach(function (c) { before += (cur[c] || []).length; after += Array.isArray(incoming[c]) ? incoming[c].length : (cur[c] || []).length; });
    if (before >= 5 && after < before * 0.3) return { error: 'write_blocked' };
    var ops = [];
    RS_COLL_ORDER.forEach(function (coll) {
      if (!Array.isArray(incoming[coll])) return;
      var curById = {}, seen = {}, prevId = null;
      (cur[coll] || []).forEach(function (r) { curById[r.id] = r; });
      incoming[coll].forEach(function (rec) {
        if (!rsUsableId_(rec.id)) return;
        seen[rec.id] = true;
        var c = curById[rec.id];
        if (!c || rsDiff1_(c, rec)) ops.push({ coll: coll, id: rec.id, base: c || null, record: rec, after: prevId });
        prevId = rec.id;
      });
      (cur[coll] || []).forEach(function (r) { if (!seen[r.id]) ops.push({ coll: coll, id: r.id, base: r, record: null }); });
    });
    Object.keys(incoming).forEach(function (k) {
      if (RS_COLL[k]) return;
      if (rsStable_(incoming[k]) !== rsStable_(cur[k])) ops.push({ meta: k, base: cur[k], value: incoming[k] });
    });
    var conflicts = [], applied = 0;
    ops.forEach(function (op) {
      var res = op.meta !== undefined ? rsApplyMeta_(M, op, at, by) : rsApplyRecord_(M, op, at, by);
      if (res.conflicts) conflicts = conflicts.concat(res.conflicts); else applied++;
    });
    var written = rsFlush_(M);
    return { ok: true, applied: applied, conflicts: conflicts, rowsWritten: written, _updatedAt: at, _updatedBy: by };
  } finally { lock.releaseLock(); }
}

/* ───────── comparing ───────── */
function rsCanonShallow_(rec) { var o = {}; Object.keys(rec).forEach(function (k) { if (!rsIsEmpty_(rec[k])) o[k] = rec[k]; }); return o; }
function rsCanon1_(rec) {
  var o = {};
  Object.keys(rec).forEach(function (k) {
    var v = rec[k];
    if (rsIsEmpty_(v)) return;
    o[k] = RS_CHILD_FIELDS[k] && Array.isArray(v) && v.every(rsIsObj_) ? v.map(rsCanonShallow_) : v;
  });
  return o;
}
function rsDiff1_(a, b) { return rsStable_(rsCanon1_(a)) !== rsStable_(rsCanon1_(b)); }

/** Record-by-record diff of two blob objects. [] = identical (an empty value counts the same as a missing one). */
function rsDiffBlobs_(a, b, limit) {
  var out = [], max = limit || 50;
  function add(s) { if (out.length < max) out.push(s); }
  RS_COLL_ORDER.forEach(function (coll) {
    var A = a[coll] || [], B = b[coll] || [], bi = {}, ai = {};
    B.forEach(function (r) { bi[r.id] = r; });
    A.forEach(function (r) { ai[r.id] = r; });
    if (A.length !== B.length) add(coll + ': count ' + A.length + ' vs ' + B.length);
    A.forEach(function (r, i) {
      if (!bi[r.id]) { add(coll + ' ' + r.id + ': missing in second'); return; }
      if (rsDiff1_(r, bi[r.id])) add(coll + ' ' + r.id + ': content differs');
      if (B[i] && B[i].id !== r.id) add(coll + ' ' + r.id + ': order differs at ' + i);
    });
    B.forEach(function (r) { if (!ai[r.id]) add(coll + ' ' + r.id + ': missing in first'); });
  });
  var seen = {};
  Object.keys(a).concat(Object.keys(b)).forEach(function (k) {
    if (RS_COLL[k] || seen[k]) return; seen[k] = 1;
    if (rsIsEmpty_(a[k]) && rsIsEmpty_(b[k])) return;
    if (rsStable_(a[k]) !== rsStable_(b[k])) add('meta ' + k + ': differs');
  });
  return out;
}
function rsCounts_(data) {
  var c = {};
  RS_COLL_ORDER.forEach(function (coll) {
    c[coll] = (data[coll] || []).length;
    RS_COLL[coll].children.forEach(function (ch) {
      c[coll + '.' + ch[0]] = (data[coll] || []).reduce(function (n, r) { return n + (Array.isArray(r[ch[0]]) ? r[ch[0]].length : 0); }, 0);
    });
  });
  return c;
}

/* ───────── migration: blob → tabs ───────── */
/**
 * Writes every record of the blob into the row tabs, keeps a copy of the blob in Backup_Blob, reads the tabs
 * back and diffs them against the blob. Any difference empties the new tabs again and throws.
 * The old blob tab is never touched. opts.force = overwrite tabs that already hold rows.
 */
function rsMigrate_(blobText, opts) {
  opts = opts || {};
  var blob = JSON.parse(blobText);
  rsEnsureTabs_();
  var M = rsLoad_(), existing = 0;
  RS_TAB_ORDER.forEach(function (t) { existing += M.tabs[t].rows.length; });
  if (existing && !opts.force) throw new Error('tabs_not_empty');
  if (existing) { rsClearData_(); M = rsLoad_(); }
  var at = new Date().toISOString(), by = 'migration', counter = {};
  function add(row, pos) {
    var T = M.tabs[row.tab], nr = { r: null, vals: rsRowToVals_(T, row, null), key: row.key, id: row.id, tab: row.tab, pos: pos, isNew: true };
    rsSetStamp_(T, nr.vals, at, by, pos);
    T.rows.push(nr); T.byKey[row.key] = nr;
  }
  RS_COLL_ORDER.forEach(function (coll) {
    (blob[coll] || []).forEach(function (rec, i) {
      rsFlatten_(coll, rec, i).forEach(function (row) {
        var ck = row.tab + '|' + (row.parent || ''), pos = row.parent === undefined ? i + 1 : (counter[ck] = (counter[ck] || 0) + 1);
        add(row, pos);
      });
    });
  });
  Object.keys(blob).forEach(function (k) {
    if (!RS_COLL[k]) add({ tab: 'Meta', key: 'Meta' + RS_SEP + k, id: k, fields: {}, extra: { value: blob[k] } }, 1);
  });
  add({ tab: 'Meta', key: 'Meta' + RS_SEP + 'schemaVersion', id: 'schemaVersion', fields: {}, extra: { value: RS_SCHEMA_VERSION } }, 1);
  var written = rsFlush_(M);
  rsWriteBackup_(blobText, at);
  var back = rsAssemble_(rsLoad_()), diff = rsDiffBlobs_(blob, back);
  var report = { ok: diff.length === 0, at: at, blobCounts: rsCounts_(blob), tabCounts: rsCounts_(back), rowsWritten: written, diff: diff };
  if (diff.length) { rsClearData_(); throw new Error('migration_diff_not_zero: ' + JSON.stringify(report)); }
  return report;
}
function rsClearData_() {
  var ss = rsSS_();
  RS_TAB_ORDER.forEach(function (t) { var sh = ss.getSheetByName(t); if (sh && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1); });
}
function rsWriteBackup_(blobText, at) {
  var ss = rsSS_(), sh = ss.getSheetByName('Backup_Blob') || ss.insertSheet('Backup_Blob'), chunks = [];
  sh.clear();
  for (var i = 0; i < blobText.length; i += 40000) chunks.push(blobText.substr(i, 40000));
  if (chunks.length > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), chunks.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, 3).setValues([['Read-only backup of the JSON blob taken before the move to row storage. Do not edit.', at, blobText.length + ' characters in ' + chunks.length + ' cells (row 2, left to right)']]);
  sh.getRange(2, 1, 1, chunks.length).setNumberFormat('@');
  sh.getRange(2, 1, 1, chunks.length).setValues([chunks]);
  try { sh.protect().setWarningOnly(true).setDescription('Backup of the old JSON blob'); } catch (e) {}
}
function rsReadBackup_() {
  var sh = rsSS_().getSheetByName('Backup_Blob');
  if (!sh) throw new Error('no_backup');
  return sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0].join('');
}
