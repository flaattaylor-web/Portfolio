/* ===========================================================================
   Taylor Money — static demo shim

   The real app is Express + a JSON store on disk. GitHub Pages serves static
   files only, so this intercepts window.fetch and answers the same /api routes
   from a snapshot captured off a locally seeded instance. The app code itself
   (app.js, styles.css) is byte-for-byte the real thing.

   Every record here came from the app's own `npm run demo` generator: 18
   months of invented transactions. No real account, no real institution.
   =========================================================================== */
(function () {
  var D = window.__TMDEMO;
  if (!D) { console.error('[demo] data bundle missing'); return; }

  var CATS = {};
  (D.meta.categories || []).forEach(function (c) { CATS[c.id] = c; });
  var FALLBACK = { id: 'OTHER', label: 'Other', kind: 'expense', icon: 'circle', chip: '#888' };
  function cat(id) { return CATS[id] || FALLBACK; }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  // working copy so in-demo edits feel real for the session
  var TXNS = D.transactions.map(function (t) { return Object.assign({}, t); });

  function transactions(qs) {
    var from = qs.get('from'), to = qs.get('to'), category = qs.get('category'),
        account = qs.get('account'), q = qs.get('q'), direction = qs.get('direction');
    var limit = Math.min(Number(qs.get('limit')) || 200, 2000);
    var offset = Number(qs.get('offset')) || 0;
    var needle = q ? String(q).toLowerCase() : null;

    var rows = TXNS.filter(function (t) {
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (category && t.category !== category) return false;
      if (account && t.accountId !== account) return false;
      if (direction === 'out' && !(t.amount > 0)) return false;
      if (direction === 'in' && !(t.amount < 0)) return false;
      if (needle) {
        var hay = ((t.merchant || '') + ' ' + (t.rawName || '') + ' ' + (t.notes || '')).toLowerCase();
        if (hay.indexOf(needle) === -1) return false;
      }
      return true;
    });

    rows.sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.amount || 0) - (a.amount || 0);
    });

    var sum = round2(rows.reduce(function (acc, t) {
      return acc + (!t.excluded && cat(t.category).kind === 'expense' ? t.amount : 0);
    }, 0));

    return {
      total: rows.length, sum: sum, offset: offset, limit: limit,
      transactions: rows.slice(offset, offset + limit).map(function (t) {
        var c = cat(t.category);
        return Object.assign({}, t, {
          categoryLabel: c.label, categoryIcon: c.icon, categoryChip: c.chip,
        });
      }),
    };
  }

  function patchTxn(id, body) {
    var t = TXNS.filter(function (x) { return x.id === id; })[0];
    if (!t) return { status: 404, body: { error: 'Not found' } };
    if (body.category !== undefined) {
      if (!CATS[body.category]) return { status: 400, body: { error: 'Unknown category' } };
      t.category = body.category; t.categoryLocked = true; t.categoryConfidence = 'high';
    }
    if (body.excluded !== undefined) t.excluded = Boolean(body.excluded);
    if (body.notes !== undefined) t.notes = String(body.notes).slice(0, 500);
    if (body.merchant !== undefined) t.merchant = String(body.merchant).slice(0, 120);
    var c = cat(t.category);
    return { status: 200, body: Object.assign({}, t, {
      categoryLabel: c.label, categoryIcon: c.icon, categoryChip: c.chip }) };
  }

  var READONLY = { status: 200, body: { ok: true, demo: true,
    message: 'This is a read-only demo. In the real app this change is saved to disk.' } };

  function route(method, path, qs, body) {
    if (method === 'GET') {
      if (path === '/meta')          return { status: 200, body: D.meta };
      if (path === '/accounts')      return { status: 200, body: D.accounts };
      if (path === '/budgets')       return { status: 200, body: D.budgets };
      if (path === '/goals')         return { status: 200, body: D.goals };
      if (path === '/recurring')     return { status: 200, body: D.recurring };
      if (path === '/rules')         return { status: 200, body: D.rules };
      if (path === '/imports')       return { status: 200, body: D.imports };
      if (path === '/plaid/status')  return { status: 200, body: D.plaidStatus };
      if (path === '/transactions')  return { status: 200, body: transactions(qs) };
      if (path === '/dashboard') {
        var m = qs.get('month');
        var keys = Object.keys(D.dashboards).sort();
        var pick = (m && D.dashboards[m]) ? D.dashboards[m] : D.dashboards[keys[keys.length - 1]];
        return { status: 200, body: pick };
      }
    }
    if (method === 'PATCH' && path.indexOf('/transactions/') === 0) {
      return patchTxn(path.slice('/transactions/'.length), body || {});
    }
    return READONLY;
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf('/api/');
    if (idx === -1) return realFetch(input, init);

    var rest = url.slice(idx + 4);
    var qmark = rest.indexOf('?');
    var path = qmark === -1 ? rest : rest.slice(0, qmark);
    var qs = new URLSearchParams(qmark === -1 ? '' : rest.slice(qmark + 1));
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var body = null;
    try { if (init && init.body) body = JSON.parse(init.body); } catch (e) {}

    var r = route(method, path, qs, body);
    return Promise.resolve(new Response(JSON.stringify(r.body), {
      status: r.status, headers: { 'Content-Type': 'application/json' },
    }));
  };

  // export links are plain anchors, so fetch never sees them
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="/api/export/"]');
    if (!a) return;
    e.preventDefault();
    var json = a.getAttribute('href').indexOf('json') !== -1;
    var text, name;
    if (json) { text = JSON.stringify({ demo: true, transactions: TXNS }, null, 2); name = 'taylor-money-demo.json'; }
    else {
      var cols = ['date','merchant','amount','categoryLabel','accountName','notes'];
      text = cols.join(',') + '\n' + TXNS.map(function (t) {
        return cols.map(function (c) {
          return '"' + String(t[c] === undefined || t[c] === null ? '' : t[c]).replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\n');
      name = 'taylor-money-demo.csv';
    }
    try {
      var url = URL.createObjectURL(new Blob([text], { type: json ? 'application/json' : 'text/csv' }));
      var dl = document.createElement('a');
      dl.href = url; dl.download = name; document.body.appendChild(dl); dl.click();
      setTimeout(function () { URL.revokeObjectURL(url); dl.remove(); }, 1000);
    } catch (err) { console.warn('[demo] export blocked in this context', err); }
  }, true);

  console.log('[demo] Taylor Money running on a static snapshot:',
    TXNS.length, 'invented transactions,', Object.keys(D.dashboards).length, 'months');
})();
