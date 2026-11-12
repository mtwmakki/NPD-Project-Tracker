/* Deterministic stand-in for the live blob: 39 projects, 131 inquiries, tasks, next actions, plus the awkward cases. */
'use strict';
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const day = n => { const d = new Date(Date.UTC(2026, 0, 1) + n * 86400000); return d.toISOString().slice(0, 10); };
const uid = () => 'u' + Math.floor(rnd() * 1e12).toString(36) + Math.floor(rnd() * 1e6).toString(36);

function build(opts) {
  opts = opts || {};
  seed = 7;
  const log = (n) => Array.from({ length: n }, (_, i) => ({ id: uid(), type: pick(['add', 'edit', 'create']), icon: 'pencil', text: 'Did thing ' + i + ' <b>bold</b> "quoted" ünïcode ✓', by: pick(['Adam', 'Mei']), date: day(i), time: '09:' + String(10 + i % 50) }));
  const projects = Array.from({ length: 39 }, (_, i) => ({
    id: 'p' + i, code: 'P-' + (1000 + i), name: 'Project ' + i + (i % 7 === 0 ? ' =SUM(A1)' : ''), date: day(i), status: pick(['not-started', 'in-progress', 'on-hold', 'completed']),
    classification: pick(['new-mold', 'mold-mod']), brief: i % 5 === 0 ? 'x'.repeat(2000) : '', factory: pick(['TPAC-MY', 'TPAC-TH']), customer: 'Cust ' + (i % 9),
    salesPerson: 'Sam', deliveryDate: i % 4 ? day(100 + i) : '', stage: i % 3 ? 'design' : '', ballWith: i % 2 ? 'Customer' : '', ballSince: i % 2 ? day(i) : '', links: i % 6 ? [] : [{ label: 'Drive', url: 'https://x/y?z=1&q=2' }],
    tags: i % 8 === 0 ? ['urgent'] : undefined,
    subStatuses: Array.from({ length: i % 4 }, (_, k) => ({ id: 'ss' + i + '_' + k, title: 'Update ' + k, status: 'ongoing', date: day(k), note: 'n', createdAt: day(k) })),
    tasks: Array.from({ length: i % 6 }, (_, k) => ({ id: 'pt' + i + '_' + k, name: 'Task ' + k, deadline: day(30 + k), pic: 'Mei', status: k % 2 ? 'done' : 'todo', reminder: '', done: k % 2 === 1, linkedSubStatus: '', addedOn: day(1), ...(k % 2 ? { completedAt: day(5) } : {}), ...(k === 2 ? { dependsOn: ['pt' + i + '_0'] } : {}) })),
    milestones: Array.from({ length: i % 3 }, (_, k) => ({ id: 'ms' + i + '_' + k, title: 'MS ' + k, date: day(60 + k), category: 'Tooling', status: 'upcoming', note: '', createdAt: day(2) })),
    pics: i % 5 ? [] : ['Mei', 'Sam'], expanded: true,
    activityLog: log(i % 9)
  }));
  const inquiries = Array.from({ length: 131 }, (_, i) => ({
    id: 'i' + i, code: 'INQ-' + (2000 + i), name: 'Inquiry ' + i, date: day(i), status: pick(['new', 'quoted', 'won', 'lost']), customer: 'Cust ' + (i % 11), factory: 'TPAC-MY',
    type: pick(['new', 'repeat']), priority: pick(['high', 'medium', 'low']), material: pick(['PP', 'ABS', '']), moldCost: i % 3 ? 10000 + i : (i % 2 ? '' : 'TBC'), bdPerson: 'Bee',
    outcome: i % 10 === 0 ? 'won' : '', outcomeDate: i % 10 === 0 ? day(i + 3) : '', outcomeReason: '', remark: i % 9 === 0 ? 'multi\nline "remark"' : '',
    pipeline: i % 4 ? { stage: 'quote' } : {},
    tasks: Array.from({ length: i % 5 }, (_, k) => ({ id: 'it' + i + '_' + k, name: 'Inq task ' + k, deadline: day(20 + k), pic: 'Bee', status: 'todo', done: false, addedOn: day(1) })),
    nextActions: Array.from({ length: i % 3 }, (_, k) => ({ id: 'na' + i + '_' + k, pic: 'Bee', action: 'Call ' + k, deadline: day(10 + k), dateAdded: day(1), addedOn: day(1), done: k === 1, ...(k === 1 ? { completedAt: day(4) } : {}) })),
    activityLog: log(i % 4)
  }));
  // awkward cases the lossless rule has to survive
  projects[3].tasks.push({ name: 'task without id', deadline: day(9) });                       // no id
  projects[3].tasks.push({ id: 'dup', name: 'dup a' }, { id: 'dup', name: 'dup b' });          // duplicate ids
  inquiries[5].tasks.push({ id: 7, name: 'numeric id', done: true });                           // non-string id
  projects[4].customer = 12345;                                                                 // number in a text column
  inquiries[6].moldCost = '50,000';                                                             // text in a number column
  projects[5].activityLog = log(400);                                                           // big log, many small rows
  projects[6].brief = 'long '.repeat(30000);                                                    // 150k chars: needs extra2..extra4
  if (opts.malformed) projects[7].tasks = 'not a list';                                        // malformed nested field stays in extra (server tests only: the app itself would not render it)
  const mtasks = Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, title: 'My task ' + i, description: '', category: 'general', priority: 'medium', deadline: day(i), status: i % 3 ? 'todo' : 'done', reminder: '', owner: 'Adam', createdAt: day(1), ...(i % 3 ? {} : { completedAt: day(2) }), ...(i === 4 ? { archived: true } : {}) }));
  const bin = [{ id: 'b1', kind: 'project', code: 'P-1', name: 'Gone', item: JSON.parse(JSON.stringify(projects[2])), deletedAt: day(3) }];
  return { inquiries, projects, mtasks, bin, schedule: { weekly: { mon: ['p1'] } }, tags: ['urgent', 'vip'], futureField: { keep: 'me' } };
}
module.exports = { build };
