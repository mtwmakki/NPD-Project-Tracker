/* Run: node tests/rowstore.test.js   — runs the real RowStore.gs + RowBridge.gs against an in-memory sheet. */
'use strict';
const assert = require('assert');
const path = require('path');
const { load } = require('./gas-mock');
const { build } = require('./sample-blob');

const GS = ['RowStore.gs', 'RowBridge.gs'].map(f => path.join(__dirname, '..', 'docs', 'apps-script', f));
const clone = o => JSON.parse(JSON.stringify(o));
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 4).join('\n       ')); }
}

function fresh(extra) {
  const env = load(GS, Object.assign({ props: { BRIDGE_TOKEN: 'tok', STORAGE_MODE: 'rows' } }, extra));
  const blob = build({ malformed: true });
  const text = JSON.stringify(blob);
  const report = env.ctx.rsMigrate_(text, {});
  return Object.assign(env, { blob, text, report });
}
const read = env => JSON.parse(env.ctx.rsRead_()._data);
const J = o => JSON.parse(JSON.stringify(o));                 // bring vm-realm objects into this realm
function writeRows(env, ops, by) { return J(env.ctx.rsWriteRows_({ ops, by: by || 'tester' })); }
function snapshotSheets(env) { const s = {}; Object.keys(env.ss.sheets).forEach(n => { s[n] = JSON.stringify(env.ss.sheets[n].grid); }); return s; }
function changedSheets(a, b) { return Object.keys(b).filter(n => a[n] !== b[n]); }
function rowsChanged(env, before, tab) {
  const g0 = JSON.parse(before[tab]), g1 = env.ss.sheets[tab].grid, out = [];
  for (let i = 0; i < Math.max(g0.length, g1.length); i++) if (JSON.stringify(g0[i]) !== JSON.stringify(g1[i])) out.push(i + 1);
  return out;
}

console.log('migration');
test('migrates with zero diff and matching counts', () => {
  const env = fresh();
  assert.strictEqual(env.report.ok, true);
  assert.deepStrictEqual(J(env.report.diff), []);
  assert.strictEqual(env.report.blobCounts.projects, 39);
  assert.strictEqual(env.report.blobCounts.inquiries, 131);
  assert.deepStrictEqual(J(env.report.blobCounts), J(env.report.tabCounts));
});
test('read-back blob equals the original record by record', () => {
  const env = fresh();
  const back = JSON.parse(env.ctx.rsExportBlob_());
  assert.deepStrictEqual(J(env.ctx.rsDiffBlobs_(env.blob, back)), []);
  assert.deepStrictEqual(back.futureField, { keep: 'me' });      // unknown top-level key survives
  assert.deepStrictEqual(back.tags, ['urgent', 'vip']);
});
test('awkward values survive exactly', () => {
  const env = fresh(), back = read(env);
  assert.strictEqual(back.projects[0].name, 'Project 0 =SUM(A1)');
  assert.strictEqual(back.projects[4].customer, 12345);
  assert.strictEqual(back.inquiries[6].moldCost, '50,000');
  assert.strictEqual(back.projects[6].brief, env.blob.projects[6].brief);
  assert.strictEqual(back.projects[5].activityLog.length, 400);
  assert.strictEqual(back.inquiries[5].tasks.some(t => t.id === 7), true);
  assert.strictEqual(back.projects[3].tasks.length, env.blob.projects[3].tasks.length);
  assert.strictEqual(back.projects[7].tasks, 'not a list');
});
test('no cell passes the 50,000 character limit (mock enforces on write)', () => {
  fresh();
});
test('Backup_Blob holds the original text', () => {
  const env = fresh();
  assert.strictEqual(env.ctx.rsReadBackup_(), env.text);
});
test('headers frozen, dates stay plain text', () => {
  const env = fresh();
  ['Projects', 'Inquiries', 'Tasks', 'NextActions', 'Meta'].forEach(n => assert.strictEqual(env.ss.sheets[n].frozen, 1, n));
  assert.strictEqual(env.ss.sheets.Projects.grid[1][env.ss.sheets.Projects.grid[0].indexOf('date')], '2026-01-01');
});
test('a second migration is refused unless forced', () => {
  const env = fresh();
  assert.throws(() => env.ctx.rsMigrate_(env.text, {}), /tabs_not_empty/);
  assert.strictEqual(env.ctx.rsMigrate_(env.text, { force: true }).ok, true);
});
test('tabs hold one row per record', () => {
  const env = fresh(), r = env.report.blobCounts;
  assert.strictEqual(env.ss.sheets.Projects.getLastRow() - 1, 39);
  assert.strictEqual(env.ss.sheets.Inquiries.getLastRow() - 1, r['inquiries']);
  assert.strictEqual(env.ss.sheets.Tasks.getLastRow() - 1, r['projects.tasks'] + r['inquiries.tasks']);
  assert.strictEqual(env.ss.sheets.NextActions.getLastRow() - 1, r['inquiries.nextActions']);
});

console.log('read shape');
test('read returns _data, _updatedAt, _updatedBy', () => {
  const env = fresh(), r = J(env.ctx.rsRead_());
  assert.strictEqual(typeof r._data, 'string');
  assert.ok(r._updatedAt);
  assert.strictEqual(r._updatedBy, 'migration');
  assert.strictEqual(r._format, 'rows-v1');
  assert.ok(r._rev);
});
test('doGet enforces the token and the mode switch', () => {
  const env = fresh();
  assert.strictEqual(JSON.parse(env.ctx.doGet({ parameter: { action: 'read', token: 'bad' } }).text).error, 'unauthorized');
  assert.ok(JSON.parse(env.ctx.doGet({ parameter: { action: 'read', token: 'tok' } }).text)._data);
  env.props.STORAGE_MODE = 'blob';
  assert.strictEqual(JSON.parse(env.ctx.doGet({ parameter: { action: 'read', token: 'tok' } }).text).error, 'storage_mode_blob_without_legacy_handler');
});

console.log('row-level saves');
test('editing one task changes only that row', () => {
  const env = fresh(), before = snapshotSheets(env);
  const p = clone(env.blob.projects[10]);                       // 10 % 6 = 4 tasks
  const base = clone(p);
  p.tasks[1].name = 'Renamed task';
  const res = writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }], 'Adam');
  assert.deepStrictEqual(res.conflicts, []);
  assert.deepStrictEqual(res.rowsWritten, { Tasks: 1 });
  assert.deepStrictEqual(changedSheets(before, snapshotSheets(env)), ['Tasks']);
  assert.strictEqual(rowsChanged(env, before, 'Tasks').length, 1);
  const T = env.ss.sheets.Tasks, h = T.grid[0], row = T.grid.find(r => r[0] === p.tasks[1].id);
  assert.strictEqual(row[h.indexOf('name')], 'Renamed task');
  assert.strictEqual(row[h.indexOf('updatedBy')], 'Adam');
  assert.ok(row[h.indexOf('updatedAt')] > '2026');
  assert.strictEqual(read(env).projects[10].tasks[1].name, 'Renamed task');
});
test('editing a project field leaves its child rows alone', () => {
  const env = fresh(), before = snapshotSheets(env), p = clone(env.blob.projects[11]), base = clone(p);
  p.status = 'completed';
  writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }]);
  assert.deepStrictEqual(changedSheets(before, snapshotSheets(env)), ['Projects']);
});
test('adding a task appends one row, in place', () => {
  const env = fresh(), p = clone(env.blob.projects[16]), base = clone(p);
  p.tasks.splice(1, 0, { id: 'newT', name: 'Inserted', done: false });
  const res = writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }]);
  assert.deepStrictEqual(res.rowsWritten, { Tasks: 1 });
  assert.deepStrictEqual(read(env).projects[16].tasks.map(t => t.id), p.tasks.map(t => t.id));
});
test('deleting a task removes one row', () => {
  const env = fresh(), p = clone(env.blob.projects[16]), base = clone(p), n = p.tasks.length;
  p.tasks.splice(0, 1);
  writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }]);
  const back = read(env);
  assert.strictEqual(back.projects[16].tasks.length, n - 1);
  assert.deepStrictEqual(J(env.ctx.rsDiffBlobs_(Object.assign(clone(env.blob), { projects: env.blob.projects.map((x, i) => i === 16 ? p : x) }), back)), []);
});
test('reordering tasks keeps the new order', () => {
  const env = fresh(), p = clone(env.blob.projects[16]), base = clone(p);
  p.tasks.reverse();
  writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }]);
  assert.deepStrictEqual(read(env).projects[16].tasks.map(t => t.id), p.tasks.map(t => t.id));
});
test('new project and delete project (children go too)', () => {
  const env = fresh(), np = { id: 'pNew', code: 'P-9', name: 'Fresh', tasks: [{ id: 'tN', name: 'x' }], milestones: [], subStatuses: [], activityLog: [] };
  writeRows(env, [{ coll: 'projects', id: 'pNew', base: null, record: np, after: null }]);
  let back = read(env);
  assert.strictEqual(back.projects[0].id, 'pNew');                // after:null = first
  assert.strictEqual(back.projects.length, 40);
  writeRows(env, [{ coll: 'projects', id: 'pNew', base: np, record: null }]);
  back = read(env);
  assert.strictEqual(back.projects.length, 39);
  assert.strictEqual(env.ss.sheets.Tasks.grid.some(r => r[0] === 'tN'), false);
});
test('changing a project code refreshes parentCode on its children', () => {
  const env = fresh(), p = clone(env.blob.projects[14]), base = clone(p);
  p.code = 'P-RENAMED';
  writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }]);
  const T = env.ss.sheets.Tasks, h = T.grid[0], mine = T.grid.filter(r => r[h.indexOf('parentId')] === p.id);
  assert.ok(mine.length > 0);
  mine.forEach(r => assert.strictEqual(r[h.indexOf('parentCode')], 'P-RENAMED'));
});
test('long activityLog writes only the new entry', () => {
  const env = fresh(), p = clone(env.blob.projects[5]), base = clone(p);
  p.activityLog.push({ id: 'logNew', type: 'edit', text: 'hi', by: 'Adam', date: '2026-11-10' });
  const res = writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }]);
  assert.deepStrictEqual(res.rowsWritten, { ActivityLog: 1 });
});
test('meta ops (tags, schedule)', () => {
  const env = fresh(), res = writeRows(env, [{ meta: 'tags', base: ['urgent', 'vip'], value: ['urgent', 'vip', 'new'] }]);
  assert.deepStrictEqual(res.conflicts, []);
  assert.deepStrictEqual(read(env).tags, ['urgent', 'vip', 'new']);
  const stale = writeRows(env, [{ meta: 'tags', base: ['urgent', 'vip'], value: ['zzz'] }]);
  assert.strictEqual(stale.conflicts.length, 1);
});

console.log('concurrency');
test('two browsers, different records: both survive', () => {
  const env = fresh();
  const a = clone(env.blob.projects[20]), aBase = clone(a), b = clone(env.blob.projects[21]), bBase = clone(b);
  a.name = 'From A'; b.name = 'From B';
  assert.deepStrictEqual(writeRows(env, [{ coll: 'projects', id: a.id, base: aBase, record: a }], 'A').conflicts, []);
  assert.deepStrictEqual(writeRows(env, [{ coll: 'projects', id: b.id, base: bBase, record: b }], 'B').conflicts, []);
  const back = read(env);
  assert.strictEqual(back.projects[20].name, 'From A');
  assert.strictEqual(back.projects[21].name, 'From B');
});
test('two browsers, different tasks in the same project: both survive', () => {
  const env = fresh();
  const base = clone(env.blob.projects[22]), a = clone(base), b = clone(base);
  a.tasks[0].name = 'A task'; b.tasks[1].name = 'B task';
  writeRows(env, [{ coll: 'projects', id: base.id, base, record: a }], 'A');
  const res = writeRows(env, [{ coll: 'projects', id: base.id, base, record: b }], 'B');
  assert.deepStrictEqual(res.conflicts, []);
  const back = read(env).projects[22];
  assert.strictEqual(back.tasks[0].name, 'A task');
  assert.strictEqual(back.tasks[1].name, 'B task');
});
test('two browsers, same record: second is warned and nothing is written', () => {
  const env = fresh();
  const base = clone(env.blob.projects[23]), a = clone(base), b = clone(base);
  a.tasks[0].name = 'A wins'; b.tasks[0].name = 'B loses';
  writeRows(env, [{ coll: 'projects', id: base.id, base, record: a }], 'A');
  const snap = snapshotSheets(env);
  const res = writeRows(env, [{ coll: 'projects', id: base.id, base, record: b }], 'B');
  assert.strictEqual(res.conflicts.length, 1);
  assert.strictEqual(res.conflicts[0].by, 'A');
  assert.strictEqual(res.conflicts[0].reason, 'changed');
  assert.deepStrictEqual(changedSheets(snap, snapshotSheets(env)), []);
  assert.strictEqual(read(env).projects[23].tasks[0].name, 'A wins');
});
test('top-level field conflict', () => {
  const env = fresh(), base = clone(env.blob.inquiries[30]), a = clone(base), b = clone(base);
  a.remark = 'A said'; b.remark = 'B said';
  writeRows(env, [{ coll: 'inquiries', id: base.id, base, record: a }], 'A');
  assert.strictEqual(writeRows(env, [{ coll: 'inquiries', id: base.id, base, record: b }], 'B').conflicts.length, 1);
});
test('retrying the same save is harmless', () => {
  const env = fresh(), base = clone(env.blob.inquiries[31]), a = clone(base);
  a.remark = 'once';
  const op = { coll: 'inquiries', id: base.id, base, record: a };
  writeRows(env, [op]);
  const r2 = writeRows(env, [op]);
  assert.deepStrictEqual(r2.conflicts, []);
  assert.deepStrictEqual(r2.rowsWritten, {});
});
test('record deleted by someone else conflicts', () => {
  const env = fresh(), base = clone(env.blob.inquiries[32]), a = clone(base);
  writeRows(env, [{ coll: 'inquiries', id: base.id, base, record: null }], 'A');
  a.remark = 'late';
  const res = writeRows(env, [{ coll: 'inquiries', id: base.id, base, record: a }], 'B');
  assert.ok(res.conflicts.length >= 1);
});

console.log('hand edits');
test('a hand-edited cell shows in the next read, and changes _rev', () => {
  const env = fresh(), rev0 = J(env.ctx.rsRead_())._rev;
  const P = env.ss.sheets.Projects, h = P.grid[0];
  P.grid[1][h.indexOf('customer')] = 'Typed by hand';
  const r = J(env.ctx.rsRead_());
  assert.notStrictEqual(r._rev, rev0);
  assert.strictEqual(JSON.parse(r._data).projects[0].customer, 'Typed by hand');
});
test('app edit on a hand-edited row is a conflict (no silent overwrite)', () => {
  const env = fresh(), base = clone(env.blob.projects[1]), a = clone(base);
  const P = env.ss.sheets.Projects, h = P.grid[0];
  P.grid[2][h.indexOf('customer')] = 'Hand';
  a.customer = 'App';
  assert.strictEqual(writeRows(env, [{ coll: 'projects', id: base.id, base, record: a }]).conflicts.length, 1);
});
test('hand-added row appears; hand-deleted row disappears', () => {
  const env = fresh(), M = env.ss.sheets.MTasks, h = M.grid[0];
  const nr = h.map(() => ''); nr[h.indexOf('id')] = 'mHand'; nr[h.indexOf('title')] = 'Added in sheet';
  M.grid.push(nr);
  assert.strictEqual(read(env).mtasks.some(t => t.id === 'mHand' && t.title === 'Added in sheet'), true);
  M.grid.splice(1, 1);
  assert.strictEqual(read(env).mtasks.some(t => t.id === 'm0'), false);
});
test('hand-typed true/false and numbers read back typed', () => {
  const env = fresh(), T = env.ss.sheets.Tasks, h = T.grid[0];
  T.grid[1][h.indexOf('done')] = 'TRUE';
  const back = read(env);
  const all = back.projects.concat(back.inquiries).reduce((a, r) => a.concat(r.tasks), []);
  assert.strictEqual(all.some(t => t.done === true), true);
});

console.log('legacy blob write and guard');
test('old-style blob POST is diffed into rows', () => {
  const env = fresh(), b = clone(env.blob);
  b.projects[2].name = 'Via blob';
  const before = snapshotSheets(env);
  const out = J(env.ctx.rsWriteBlob_({ _data: JSON.stringify(b), _updatedBy: 'bot' }));
  assert.strictEqual(out.ok, true);
  assert.deepStrictEqual(changedSheets(before, snapshotSheets(env)), ['Projects']);
  assert.strictEqual(read(env).projects[2].name, 'Via blob');
});
test('doPost routes writeRows and legacy _data', () => {
  const env = fresh(), b = clone(env.blob);
  b.tags = ['only'];
  const r = JSON.parse(env.ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify({ token: 'tok', _data: JSON.stringify(b), _updatedBy: 'bot' }) } }).text);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(read(env).tags, ['only']);
  assert.strictEqual(JSON.parse(env.ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify({ token: 'no', action: 'writeRows', ops: [] }) } }).text).error, 'unauthorized');
});
test('blob write that drops >70% of records is blocked', () => {
  const env = fresh(), b = clone(env.blob);
  b.projects = b.projects.slice(0, 2); b.inquiries = b.inquiries.slice(0, 2); b.mtasks = [];
  const before = snapshotSheets(env);
  assert.strictEqual(J(env.ctx.rsWriteBlob_({ _data: JSON.stringify(b) })).error, 'write_blocked');
  assert.deepStrictEqual(changedSheets(before, snapshotSheets(env)), []);
});

console.log('rollback');
test('rsSwitchToBlob posts the current rows to the old bridge and flips the mode', () => {
  let posted = null;
  const env = fresh({ UrlFetchApp: { fetch: (url, o) => { posted = { url, o }; return { getContentText: () => '{"ok":true}' }; } } });
  env.props.OLD_BRIDGE_URL = 'https://old/exec';
  const p = clone(env.blob.projects[3]), base = clone(p); p.name = 'Edited before rollback';
  writeRows(env, [{ coll: 'projects', id: p.id, base, record: p }]);
  env.ctx.rsSwitchToBlob();
  assert.strictEqual(env.props.STORAGE_MODE, 'blob');
  const sent = JSON.parse(posted.o.payload);
  assert.strictEqual(sent.token, 'tok');
  assert.strictEqual(JSON.parse(sent._data).projects[3].name, 'Edited before rollback');
  assert.strictEqual(env.ss.sheets.Projects.getLastRow() - 1, 39);   // row tabs kept
});
test('rollback aborts, staying in rows mode, if the old bridge refuses', () => {
  const env = fresh({ UrlFetchApp: { fetch: () => ({ getContentText: () => '{"error":"write_blocked"}' }) } });
  env.props.OLD_BRIDGE_URL = 'https://old/exec';
  assert.throws(() => env.ctx.rsSwitchToBlob(), /refused/);
  assert.strictEqual(env.props.STORAGE_MODE, 'rows');
});
test('verify against old bridge reports identical', () => {
  const env = fresh({ UrlFetchApp: { fetch: () => ({ getContentText: () => JSON.stringify({ _data: JSON.stringify(build({ malformed: true })) }) }) } });
  env.props.OLD_BRIDGE_URL = 'https://old/exec';
  assert.strictEqual(J(env.ctx.rsVerifyAgainstOldBridge()).identical, true);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
