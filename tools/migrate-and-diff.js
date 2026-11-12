#!/usr/bin/env node
/* Dry run of the migration on your own machine. Touches no Sheet.
 *   node tools/migrate-and-diff.js path/to/blob.json
 * blob.json = the `_data` string from  <bridge>?action=read&token=…  (save the text of `_data` as a file;
 * a file holding the whole {"_data": "...", ...} response also works).
 * Runs the real RowStore.gs migration over an in-memory sheet and prints record counts and the record-by-record diff.
 * Exit code 0 only when the diff is zero. */
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('../tests/gas-mock');

const file = process.argv[2];
if (!file) { console.error('usage: node tools/migrate-and-diff.js blob.json'); process.exit(2); }
let text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
try { const o = JSON.parse(text); if (o && typeof o._data === 'string') text = o._data; } catch (e) { console.error('not valid JSON: ' + e.message); process.exit(2); }

const gs = ['RowStore.gs', 'RowBridge.gs'].map(f => path.join(__dirname, '..', 'docs', 'apps-script', f));
const env = load(gs, { props: { BRIDGE_TOKEN: 'x', STORAGE_MODE: 'rows' } });
let report;
try { report = env.ctx.rsMigrate_(text, {}); }
catch (e) { console.error('MIGRATION FAILED\n' + e.message); process.exit(1); }

const rep = JSON.parse(JSON.stringify(report));
console.log('records in blob vs rows read back:');
Object.keys(rep.blobCounts).forEach(k => console.log('  ' + k.padEnd(24) + String(rep.blobCounts[k]).padStart(6) + String(rep.tabCounts[k]).padStart(8) + (rep.blobCounts[k] === rep.tabCounts[k] ? '' : '   <-- MISMATCH')));
console.log('rows written per tab: ' + JSON.stringify(rep.rowsWritten));
console.log('differences: ' + rep.diff.length);
process.exit(rep.ok ? 0 : 1);
