'use strict';
var G = require('./gantt-cloud.js');
var failed = 0;
function eq(actual, expected, name) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) { failed++; console.error('FAIL', name, '\n  got ', a, '\n  want', b); }
}
function ok(cond, name) { if (!cond) { failed++; console.error('FAIL', name); } }

function plan(name, savedAt, tasks) {
  return { iProj: name, savedAt: savedAt, tasks: tasks || [] };
}

eq(G.bookKey('cust-nestle'), 'book-cust-nestle', 'book key');
eq(G.partKey('abc', 2), 'abc__p2', 'part key');

var small = G.splitPayload('{"tasks":[]}');
ok(small.parts === null && small.stored === '{"tasks":[]}', 'small plan stays one cell');

var big = '';
for (var i = 0; i < 120000; i++) big += (i % 17 === 0) ? '"' : 'a';
var split = G.splitPayload(big, '2026-11-01T00:00:00.000Z');
ok(split.parts && split.parts.length > 1, 'large plan splits');
split.parts.forEach(function (p, idx) {
  ok(p.length <= G.PART_LIMIT, 'part ' + idx + ' fits in a cell');
  var obj = JSON.parse(p);
  ok(obj.kind === 'gantt-part', 'part wrapper');
});
var manifest = JSON.parse(split.stored);
ok(G.isManifest(manifest) && manifest.n === split.parts.length, 'manifest');
eq(G.joinParts(split.parts), big, 'parts join back to the plan');

var localNewer = plan('Local bottle', '2026-11-01T00:00:00.000Z', [{ id: 1 }]);
var cloudOlder = plan('Old sheet', '2026-09-23T07:28:57.200Z', [{ id: 1 }, { id: 2 }]);
var chosen = G.choosePlan(localNewer, cloudOlder, '2026-09-23T07:28:58.104Z');
eq(chosen.payload.iProj, 'Local bottle', 'newer local work beats an older sheet plan');
eq(chosen.source, 'local', 'source local');

var emptyNewer = { iProj: 'Untitled project', savedAt: '2026-11-06T00:00:00.000Z', tasks: [] };
chosen = G.choosePlan(emptyNewer, cloudOlder, cloudOlder.savedAt);
eq(chosen.payload.iProj, 'Old sheet', 'an empty newer plan does not wipe a real sheet plan');

var meaningfulOlder = plan('Device work', '2026-10-01T00:00:00.000Z', [{ id: 9 }]);
var emptyCloud = { iProj: '', savedAt: '2026-11-02T00:00:00.000Z', tasks: [] };
chosen = G.choosePlan(meaningfulOlder, emptyCloud, emptyCloud.savedAt);
eq(chosen.payload.iProj, 'Device work', 'a blank newer sheet row does not wipe local work');

chosen = G.choosePlan(null, cloudOlder, cloudOlder.savedAt);
eq(chosen.source, 'cloud', 'sheet plan used when this device has none');

var localBook = {
  id: 'cust-acme', customer: 'Acme', customerAt: '2026-10-20T00:00:00.000Z',
  nextMeeting: '', nextMeetingAt: '', lastMeeting: '', lastMeetingAt: '',
  activeId: 'p1', updatedAt: '2026-11-01T00:00:00.000Z', removed: [],
  projects: [{ id: 'p1', payload: localNewer }]
};
var merged = G.mergeBook(localBook, null, { p1: { payload: cloudOlder, sheetUpdatedAt: cloudOlder.savedAt } }, {});
eq(merged.book.projects.length, 1, 'one project after merge');
eq(merged.book.projects[0].payload.iProj, 'Local bottle', 'merge keeps newer local');
ok(merged.uploadProjectIds.indexOf('p1') >= 0, 'newer local is queued for the sheet');
ok(merged.uploadBook, 'missing book index is uploaded');

var cloudEnv = {
  kind: 'gantt-book', v: 3, id: 'cust-acme', customer: 'Acme', customerAt: '2026-10-20T00:00:00.000Z',
  nextMeeting: '2026-11-12', nextMeetingAt: '2026-11-03T00:00:00.000Z',
  lastMeeting: '', lastMeetingAt: '', activeId: 'p1', updatedAt: '2026-11-03T00:00:00.000Z',
  removed: [], projects: [
    { id: 'p1', savedAt: '2026-11-04T00:00:00.000Z', name: 'Sheet bottle' },
    { id: 'p2', savedAt: '2026-11-04T00:00:00.000Z', name: 'Other device' }
  ]
};
var sheetPlan = plan('Sheet bottle', '2026-11-04T00:00:00.000Z', [{ id: 3 }]);
var other = plan('Other device', '2026-11-04T00:00:00.000Z', [{ id: 4 }]);
localBook.projects = [{ id: 'p1', payload: plan('Local bottle', '2026-10-01T00:00:00.000Z', [{ id: 1 }]) }];
merged = G.mergeBook(localBook, cloudEnv, {
  p1: { payload: sheetPlan, sheetUpdatedAt: sheetPlan.savedAt },
  p2: { payload: other, sheetUpdatedAt: other.savedAt }
}, { activeId: 'p1' });
eq(merged.book.projects.map(function (p) { return p.id; }), ['p1', 'p2'], 'other device project is kept');
eq(merged.book.projects[0].payload.iProj, 'Sheet bottle', 'newer sheet plan replaces older local');
eq(merged.uploadProjectIds, [], 'newer sheet plan is not uploaded back');
eq(merged.book.nextMeeting, '2026-11-12', 'newer meeting stamp wins');
ok(!merged.importedLegacy.length, 'indexed projects are not announced as a legacy import');

var legacy = plan('September plan', '2026-09-23T07:28:57.200Z', [{ id: 7 }]);
merged = G.mergeBook({ id: 'default', customer: '', projects: [], removed: [] }, null, {
  default: { payload: legacy, sheetUpdatedAt: '2026-09-23T07:28:58.104Z' }
}, {});
eq(merged.importedLegacy, ['default'], 'old per-project row is imported when no book index lists it');
eq(merged.book.projects[0].payload.iProj, 'September plan', 'legacy payload kept');
ok(merged.uploadBook && !merged.uploadProjectIds.length, 'index is created, the existing row is not rewritten');

localBook.removed = [{ id: 'p1', at: '2026-11-05T00:00:00.000Z' }];
localBook.projects = [{ id: 'p1', payload: plan('Doomed', '2026-11-01T00:00:00.000Z', [{ id: 1 }]) }];
merged = G.mergeBook(localBook, null, { p1: { payload: localBook.projects[0].payload, sheetUpdatedAt: '' } }, {});
eq(merged.book.projects, [], 'tombstone drops an older plan');

merged = G.mergeBook(localBook, null, { p1: { payload: localBook.projects[0].payload, sheetUpdatedAt: '' } }, { resurrectId: 'p1' });
eq(merged.book.projects.length, 1, 'opening that project from the tracker brings it back');

var envMerge = G.mergeEnvelope({
  id: 'cust-acme', customer: 'Acme', customerAt: '2026-10-01T00:00:00.000Z',
  nextMeeting: '2026-11-20', nextMeetingAt: '2026-11-06T00:00:00.000Z',
  activeId: 'p1', removed: [{ id: 'gone', at: '2026-11-06T00:00:00.000Z' }],
  projects: [{ id: 'p1', payload: plan('A', '2026-11-06T01:00:00.000Z', [{ id: 1 }]) }]
}, {
  kind: 'gantt-book', projects: [
    { id: 'p1', savedAt: '2026-11-01T00:00:00.000Z', name: 'A' },
    { id: 'p9', savedAt: '2026-11-05T00:00:00.000Z', name: 'From elsewhere' },
    { id: 'gone', savedAt: '2026-10-01T00:00:00.000Z', name: 'Removed' }
  ],
  customer: 'Wrong', customerAt: '2026-09-01T00:00:00.000Z',
  nextMeeting: '2026-11-01', nextMeetingAt: '2026-11-01T00:00:00.000Z',
  removed: []
});
eq(envMerge.envelope.projects.map(function (p) { return p.id; }), ['p1', 'p9'], 'index keeps the other device and drops the tombstoned id');
eq(envMerge.envelope.customer, 'Acme', 'newer customer stamp wins');
eq(envMerge.envelope.nextMeeting, '2026-11-20', 'newer meeting wins');
ok(envMerge.changed, 'index write is needed');

merged = G.mergeBook({
  id: 'cust-acme', customer: 'Acme', projects: [{ id: 'p1', payload: plan('Doomed', '2026-11-01T00:00:00.000Z', [{ id: 1 }]) }], removed: []
}, null, { p1: { error: true } }, {});
ok(merged.incomplete && merged.book.projects.length === 1, 'a failed read keeps the local plan');
ok(!merged.uploadBook, 'a partial read does not rewrite the book index');

if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('gantt-cloud tests passed');
