/* Gantt cloud storage for the NPD Tracker spreadsheet.
   The Apps Script bridge already stores one JSON plan per project id on the
   "Gantt" tab (ganttRead / ganttWrite). V3 keeps that shape so those older
   rows still open, and adds a small book index at book-<customer id> on the
   same tab. A plan that does not fit in one cell is split into book-keeping
   JSON in the main row plus <id>__pN rows. No token lives in this file. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GanttCloud = api;
})(typeof window !== 'undefined' ? window : this, function () {
  var PART_LIMIT = 45000; /* under the 50,000 character cell limit */
  var BOOK_PREFIX = 'book-';

  function bookKey(id) { return BOOK_PREFIX + (id || 'default'); }
  function partKey(id, n) { return String(id) + '__p' + n; }

  function timeOf(iso) {
    var t = Date.parse(iso || '');
    return isNaN(t) ? 0 : t;
  }

  function planTime(payload, fallbackIso) {
    var t = timeOf(payload && payload.savedAt);
    return t || timeOf(fallbackIso);
  }

  function isEnvelope(obj) {
    return !!(obj && obj.kind === 'gantt-book' && Array.isArray(obj.projects));
  }

  function isManifest(obj) {
    return !!(obj && obj.kind === 'gantt-parts' && obj.n > 0);
  }

  function isPart(obj) {
    return !!(obj && obj.kind === 'gantt-part' && typeof obj.s === 'string');
  }

  function planMeaningful(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
    if (p.kind === 'gantt-book' || p.kind === 'gantt-parts' || p.kind === 'gantt-part') return false;
    if (Array.isArray(p.tasks) && p.tasks.length) return true;
    if (Array.isArray(p.notes) && p.notes.length) return true;
    if (Array.isArray(p.timelineLogs) && p.timelineLogs.length) return true;
    var s = p.status;
    if (s && typeof s === 'object') {
      if (String(s.headline || '').trim()) return true;
      if (Array.isArray(s.asks) && s.asks.length) return true;
      if (Array.isArray(s.done) && s.done.length) return true;
      if (Array.isArray(s.next) && s.next.length) return true;
      if (Array.isArray(s.notes) && s.notes.length) return true;
    }
    var name = String(p.iProj || '').trim();
    return !!(name && name !== 'Untitled project');
  }

  /* One cell when the plan fits (same shape as the Sep 2026 rows). Larger
     plans become a manifest plus part rows, each itself valid JSON. */
  function splitPayload(json, savedAt) {
    json = String(json || '');
    if (json.length <= PART_LIMIT) return { parts: null, stored: json };
    var parts = [], i = 0, n = 1;
    while (i < json.length) {
      var lo = 1, hi = Math.min(40000, json.length - i), best = 1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        var wrapped = JSON.stringify({ kind: 'gantt-part', i: n, s: json.slice(i, i + mid) });
        if (wrapped.length <= PART_LIMIT) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      parts.push(JSON.stringify({ kind: 'gantt-part', i: n, s: json.slice(i, i + best) }));
      i += best;
      n++;
    }
    return {
      parts: parts,
      stored: JSON.stringify({ kind: 'gantt-parts', v: 1, n: parts.length, savedAt: savedAt || '' })
    };
  }

  function joinParts(storedParts) {
    var bits = [];
    (storedParts || []).forEach(function (raw) {
      if (raw == null || raw === '') return;
      var text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      var obj = null;
      try { obj = JSON.parse(text); } catch (e) { obj = null; }
      if (isPart(obj)) bits.push(obj);
      else if (typeof text === 'string') bits.push({ i: bits.length + 1, s: text });
    });
    bits.sort(function (a, b) { return (a.i || 0) - (b.i || 0); });
    return bits.map(function (p) { return p.s; }).join('');
  }

  function clone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function choosePlan(localP, cloudP, cloudSheetAt) {
    if (localP && (isEnvelope(localP) || isManifest(localP))) localP = null;
    if (cloudP && (isEnvelope(cloudP) || isManifest(cloudP))) cloudP = null;
    if (!localP && !cloudP) return null;
    if (!localP) return { payload: cloudP, source: 'cloud' };
    if (!cloudP) return { payload: localP, source: 'local' };
    var lt = planTime(localP, 0), ct = planTime(cloudP, cloudSheetAt);
    var lm = planMeaningful(localP), cm = planMeaningful(cloudP);
    if (lt > ct && !(!lm && cm)) return { payload: localP, source: 'local' };
    if (ct > lt && !(!cm && lm)) return { payload: cloudP, source: 'cloud' };
    if (!lm && cm) return { payload: cloudP, source: 'cloud' };
    if (lm && !cm) return { payload: localP, source: 'local' };
    if (ct > lt) return { payload: cloudP, source: 'cloud' };
    return { payload: localP, source: 'local' };
  }

  function mergeRemoved(a, b) {
    var map = {};
    function take(list) {
      (list || []).forEach(function (r) {
        if (!r || !r.id || !r.at) return;
        var id = String(r.id), t = timeOf(r.at);
        if (!map[id] || t > map[id].t) map[id] = { id: id, at: r.at, t: t };
      });
    }
    take(a); take(b);
    return Object.keys(map).map(function (id) { return { id: id, at: map[id].at }; });
  }

  function pickField(localVal, localAt, cloudVal, cloudAt) {
    var lt = timeOf(localAt), ct = timeOf(cloudAt);
    if (ct > lt) return { v: cloudVal || '', at: cloudAt || '' };
    if (lt > ct) return { v: localVal || '', at: localAt || '' };
    if (!String(localVal || '').trim() && String(cloudVal || '').trim()) return { v: cloudVal || '', at: cloudAt || '' };
    return { v: localVal || '', at: localAt || '' };
  }

  function mergeMeta(localBook, cloudEnv) {
    localBook = localBook || {};
    if (!cloudEnv) {
      return {
        customer: localBook.customer || '', customerAt: localBook.customerAt || '',
        nextMeeting: localBook.nextMeeting || '', nextMeetingAt: localBook.nextMeetingAt || '',
        lastMeeting: localBook.lastMeeting || '', lastMeetingAt: localBook.lastMeetingAt || '',
        updatedAt: localBook.updatedAt || ''
      };
    }
    var c = pickField(localBook.customer, localBook.customerAt, cloudEnv.customer, cloudEnv.customerAt);
    var n = pickField(localBook.nextMeeting, localBook.nextMeetingAt, cloudEnv.nextMeeting, cloudEnv.nextMeetingAt);
    var l = pickField(localBook.lastMeeting, localBook.lastMeetingAt, cloudEnv.lastMeeting, cloudEnv.lastMeetingAt);
    var updated = timeOf(cloudEnv.updatedAt) > timeOf(localBook.updatedAt) ? (cloudEnv.updatedAt || '') : (localBook.updatedAt || cloudEnv.updatedAt || '');
    return {
      customer: c.v, customerAt: c.at, nextMeeting: n.v, nextMeetingAt: n.at,
      lastMeeting: l.v, lastMeetingAt: l.at, updatedAt: updated
    };
  }

  function envelopeFromBook(book) {
    book = book || {};
    return {
      kind: 'gantt-book', v: 3, id: book.id || 'default',
      customer: book.customer || '', customerAt: book.customerAt || '',
      nextMeeting: book.nextMeeting || '', nextMeetingAt: book.nextMeetingAt || '',
      lastMeeting: book.lastMeeting || '', lastMeetingAt: book.lastMeetingAt || '',
      activeId: book.activeId || null,
      updatedAt: book.updatedAt || '',
      removed: (book.removed || []).map(function (r) { return { id: String(r.id), at: r.at }; }),
      projects: (book.projects || []).filter(function (p) { return p && p.id; }).map(function (p) {
        return { id: String(p.id), savedAt: (p.payload && p.payload.savedAt) || '', name: (p.payload && p.payload.iProj) || '' };
      })
    };
  }

  function indexSignature(env) {
    if (!env) return '';
    return JSON.stringify({
      customer: env.customer || '', nextMeeting: env.nextMeeting || '', lastMeeting: env.lastMeeting || '',
      activeId: env.activeId || null,
      removed: (env.removed || []).map(function (r) { return { id: String(r.id), at: r.at }; }),
      projects: (env.projects || []).map(function (p) { return { id: String(p.id), savedAt: p.savedAt || '' }; })
    });
  }

  function envelopeChanged(cloudEnv, nextEnv) {
    return indexSignature(cloudEnv) !== indexSignature(nextEnv);
  }

  /* localBook is the device book (full payloads). cloudEnv is the sheet index
     or null. cloudPlans[id] is {payload, sheetUpdatedAt} | {missing:true} | {error:true}.
     A project id that was never fetched is left untouched only when the local
     book already has it and the cloud read failed. */
  function mergeBook(localBook, cloudEnv, cloudPlans, opts) {
    opts = opts || {};
    localBook = localBook || { id: opts.bookId || 'default', projects: [] };
    var bookId = localBook.id || opts.bookId || 'default';
    var resurrect = opts.resurrectId ? String(opts.resurrectId) : '';
    var localById = {};
    (localBook.projects || []).forEach(function (p) {
      if (p && p.id && p.payload && typeof p.payload === 'object' && !Array.isArray(p.payload)) localById[String(p.id)] = p.payload;
    });
    var cloudList = (cloudEnv && Array.isArray(cloudEnv.projects)) ? cloudEnv.projects : [];
    var inIndex = {};
    cloudList.forEach(function (p) { if (p && p.id) inIndex[String(p.id)] = true; });

    var order = [], seen = {};
    function add(pid) {
      pid = String(pid || '');
      if (!pid || seen[pid]) return;
      seen[pid] = true;
      order.push(pid);
    }
    (localBook.projects || []).forEach(function (p) { if (p && p.id) add(p.id); });
    cloudList.forEach(function (p) { if (p && p.id) add(p.id); });
    Object.keys(cloudPlans || {}).forEach(add);

    var removed = mergeRemoved(localBook.removed, cloudEnv && cloudEnv.removed);
    var tomb = {};
    removed.forEach(function (r) { tomb[r.id] = timeOf(r.at); });
    if (resurrect && tomb[resurrect]) {
      removed = removed.filter(function (r) { return r.id !== resurrect; });
      delete tomb[resurrect];
    }

    var env = isEnvelope(cloudEnv) ? cloudEnv : null;
    var projects = [], uploadProjectIds = [], importedLegacy = [], incomplete = false;
    order.forEach(function (pid) {
      var entry = cloudPlans ? cloudPlans[pid] : undefined;
      var localP = localById[pid] || null;
      if (!entry || entry.error) {
        if (entry && entry.error) incomplete = true;
        if (!localP) return;
        var keptT = planTime(localP, 0);
        if (tomb[pid] && (!keptT || tomb[pid] >= keptT)) return;
        projects.push({ id: pid, payload: clone(localP) });
        return;
      }
      var cloudP = entry.payload || null;
      var chosen = choosePlan(localP, cloudP, entry.sheetUpdatedAt);
      if (!chosen) return;
      var t = planTime(chosen.payload, chosen.source === 'cloud' ? entry.sheetUpdatedAt : 0);
      if (tomb[pid] && (!t || tomb[pid] >= t)) return;
      projects.push({ id: pid, payload: clone(chosen.payload) });
      if (!localP && chosen.source === 'cloud' && !inIndex[pid]) importedLegacy.push(pid);
      if (chosen.source === 'local') {
        var same = !!(cloudP && JSON.stringify(chosen.payload) === JSON.stringify(cloudP));
        if (!same) uploadProjectIds.push(pid);
      }
    });

    var meta = mergeMeta(localBook, env);

    var active = opts.activeId || localBook.activeId || null;
    if (resurrect && projects.some(function (p) { return p.id === resurrect; })) active = resurrect;
    else if (!projects.some(function (p) { return p.id === active; })) {
      var cloudActive = cloudEnv && cloudEnv.activeId;
      active = (cloudActive && projects.some(function (p) { return p.id === String(cloudActive); })) ? String(cloudActive) : ((projects[0] && projects[0].id) || null);
    }

    var book = {
      id: bookId, customer: meta.customer, customerAt: meta.customerAt,
      nextMeeting: meta.nextMeeting, nextMeetingAt: meta.nextMeetingAt,
      lastMeeting: meta.lastMeeting, lastMeetingAt: meta.lastMeetingAt,
      activeId: active, updatedAt: meta.updatedAt, removed: removed, projects: projects
    };
    var envNow = envelopeFromBook(book);
    var uploadBook = false;
    if (!incomplete) {
      if (!env) uploadBook = !!(projects.length || book.customer || book.nextMeeting || book.lastMeeting);
      else uploadBook = envelopeChanged(env, envNow);
    }
    return { book: book, uploadProjectIds: uploadProjectIds, uploadBook: uploadBook, incomplete: incomplete, importedLegacy: importedLegacy };
  }

  /* Save-time index merge: keep a project another device added, and honour
     whichever tombstone or field stamp is newer. Payloads stay in their own rows. */
  function mergeEnvelope(localBook, cloudEnv) {
    var localEnv = envelopeFromBook(localBook);
    if (!cloudEnv || !Array.isArray(cloudEnv.projects)) {
      localEnv.updatedAt = localEnv.updatedAt || new Date().toISOString();
      return { envelope: localEnv, changed: true };
    }
    var ids = [], seen = {};
    function add(id) { id = String(id || ''); if (!id || seen[id]) return; seen[id] = true; ids.push(id); }
    localEnv.projects.forEach(function (p) { add(p.id); });
    cloudEnv.projects.forEach(function (p) { if (p && p.id) add(p.id); });
    var removed = mergeRemoved(localEnv.removed, cloudEnv.removed);
    var tomb = {};
    removed.forEach(function (r) { tomb[r.id] = timeOf(r.at); });
    var localMap = {}, cloudMap = {};
    localEnv.projects.forEach(function (p) { localMap[p.id] = p; });
    cloudEnv.projects.forEach(function (p) { if (p && p.id) cloudMap[String(p.id)] = p; });
    var projects = [];
    ids.forEach(function (id) {
      var L = localMap[id], C = cloudMap[id];
      var useLocal = timeOf(L && L.savedAt) >= timeOf(C && C.savedAt);
      var savedAt = useLocal ? ((L && L.savedAt) || (C && C.savedAt) || '') : ((C && C.savedAt) || (L && L.savedAt) || '');
      var name = useLocal ? ((L && L.name) || (C && C.name) || '') : ((C && C.name) || (L && L.name) || '');
      var t = timeOf(savedAt);
      if (tomb[id] && (!t || tomb[id] >= t)) return;
      if (!L && !C) return;
      projects.push({ id: id, savedAt: savedAt, name: name });
    });
    var meta = mergeMeta(localBook, cloudEnv);
    var active = localBook.activeId && projects.some(function (p) { return p.id === String(localBook.activeId); })
      ? String(localBook.activeId)
      : ((projects[0] && projects[0].id) || null);
    var envelope = {
      kind: 'gantt-book', v: 3, id: localBook.id || 'default',
      customer: meta.customer, customerAt: meta.customerAt,
      nextMeeting: meta.nextMeeting, nextMeetingAt: meta.nextMeetingAt,
      lastMeeting: meta.lastMeeting, lastMeetingAt: meta.lastMeetingAt,
      activeId: active, updatedAt: new Date().toISOString(),
      removed: removed, projects: projects
    };
    return { envelope: envelope, changed: envelopeChanged(cloudEnv, envelope) };
  }

  return {
    PART_LIMIT: PART_LIMIT,
    bookKey: bookKey,
    partKey: partKey,
    timeOf: timeOf,
    planTime: planTime,
    isEnvelope: isEnvelope,
    isManifest: isManifest,
    isPart: isPart,
    planMeaningful: planMeaningful,
    splitPayload: splitPayload,
    joinParts: joinParts,
    choosePlan: choosePlan,
    mergeBook: mergeBook,
    mergeEnvelope: mergeEnvelope,
    envelopeFromBook: envelopeFromBook
  };
});
