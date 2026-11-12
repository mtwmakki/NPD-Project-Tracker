/* Minimal in-memory stand-ins for the Apps Script services RowStore.gs uses, so the real .gs files run under Node. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

class MockSheet {
  constructor(name) { this.name = name; this.grid = []; this.maxRows = 1000; this.maxCols = 26; this.frozen = 0; this.writes = []; }
  _need(r, c) { while (this.grid.length < r) this.grid.push([]); this.grid.forEach(row => { while (row.length < Math.max(c, this.maxCols)) row.push(''); }); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  getLastRow() { for (let i = this.grid.length - 1; i >= 0; i--) if (this.grid[i].some(v => v !== '')) return i + 1; return 0; }
  getLastColumn() { let m = 0; this.grid.forEach(row => row.forEach((v, i) => { if (v !== '') m = Math.max(m, i + 1); })); return m; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  insertColumnsAfter(after, n) { this.maxCols += n; }
  setFrozenRows(n) { this.frozen = n; }
  clear() { this.grid = []; }
  protect() { const p = { setWarningOnly() { return p; }, setDescription() { return p; } }; return p; }
  deleteRow(r) { this.grid.splice(r - 1, 1); this.maxRows--; }
  deleteRows(r, n) { this.grid.splice(r - 1, n); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this;
    if (r < 1 || c < 1 || r + nr - 1 > sh.maxRows || c + nc - 1 > sh.maxCols) throw new Error(`Range out of bounds: ${sh.name} r${r} c${c} ${nr}x${nc} (max ${sh.maxRows}x${sh.maxCols})`);
    return {
      getValues() { sh._need(r + nr - 1, c + nc - 1); const out = []; for (let i = 0; i < nr; i++) out.push(sh.grid[r - 1 + i].slice(c - 1, c - 1 + nc)); return out; },
      getValue() { sh._need(r, c); return sh.grid[r - 1][c - 1]; },
      setValues(v) {
        if (v.length !== nr || v.some(row => row.length !== nc)) throw new Error('setValues size mismatch on ' + sh.name);
        v.forEach(row => row.forEach(x => { if (typeof x === 'string' && x.length > 50000) throw new Error('cell over 50,000 characters in ' + sh.name); }));
        sh._need(r + nr - 1, c + nc - 1);
        for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.grid[r - 1 + i][c - 1 + j] = (typeof v[i][j] === 'string' && v[i][j].charAt(0) === "'") ? v[i][j].slice(1) : v[i][j]; /* real Sheets drops one leading apostrophe */
        sh.writes.push({ r, nr });
      },
      setNumberFormat() {}, setFontWeight() {}
    };
  }
}
class MockSpreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new MockSheet(n)); }
}

/** Load .gs files into one context with mocked Google services. Returns { ctx, ss }. */
function load(files, opts = {}) {
  const ss = opts.ss || new MockSpreadsheet();
  const props = Object.assign({}, opts.props);
  let lockHeld = false;
  const ctx = {
    console, JSON, Math, Date, Object, Array, String, Number, isNaN, isFinite, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() { if (lockHeld) throw new Error('lock busy'); lockHeld = true; }, releaseLock() { lockHeld = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ text: s, setMimeType() { return this; } }) },
    Utilities: {
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('md5').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: d => d.toISOString().slice(0, 10)
    },
    Logger: { log() {} },
    Session: { getScriptTimeZone: () => 'UTC' },
    UrlFetchApp: opts.UrlFetchApp
  };
  vm.createContext(ctx);
  files.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.basename(f) }));
  return { ctx, ss, props };
}
module.exports = { load, MockSheet, MockSpreadsheet };
