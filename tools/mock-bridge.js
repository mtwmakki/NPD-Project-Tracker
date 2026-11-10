#!/usr/bin/env node
/* Local stand-in for the Apps Script bridge, for testing v2/index.html without touching the real Sheet.
 *   node tools/mock-bridge.js [port] [blob.json]
 * Runs the real docs/apps-script/RowStore.gs + RowBridge.gs over an in-memory sheet (tests/gas-mock.js),
 * migrated from blob.json (default: the generated sample data). Serves:
 *   GET/POST /exec        the bridge (token: "test-token")
 *   GET  /sheet/<Tab>     that tab as JSON rows, to see exactly which cells changed
 *   GET  /v2/index.html   the app with its bridge URL pointed here (the file in the repo is not modified)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { load } = require('../tests/gas-mock');
const { build } = require('../tests/sample-blob');

const port = Number(process.argv[2]) || 8765;
const blobText = process.argv[3] ? fs.readFileSync(process.argv[3], 'utf8') : JSON.stringify(build());
const gs = ['RowStore.gs', 'RowBridge.gs'].map(f => path.join(__dirname, '..', 'docs', 'apps-script', f));
const env = load(gs, { props: { BRIDGE_TOKEN: 'test-token', STORAGE_MODE: 'rows' } });
const report = env.ctx.rsMigrate_(blobText, {});
console.log('migrated: ' + JSON.stringify(report.tabCounts));

function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); res.end(body); }
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '');
  if (u.pathname === '/exec') {
    if (req.method === 'GET') return send(res, 200, 'application/json', env.ctx.doGet({ parameter: Object.fromEntries(u.searchParams) }).text);
    let body = ''; req.on('data', c => body += c);
    return req.on('end', () => send(res, 200, 'application/json', env.ctx.doPost({ parameter: {}, postData: { contents: body } }).text));
  }
  const m = u.pathname.match(/^\/sheet\/(\w+)$/);
  if (m && env.ss.sheets[m[1]]) return send(res, 200, 'application/json', JSON.stringify(env.ss.sheets[m[1]].grid.filter(r => r.some(v => v !== ''))));
  if (u.pathname === '/v2/index.html') {
    const html = fs.readFileSync(path.join(__dirname, '..', 'v2', 'index.html'), 'utf8')
      .replace(/const SHEETS_BRIDGE_URL\s*=\s*['"][^'"]+['"]/, "const SHEETS_BRIDGE_URL = 'http://localhost:" + port + "/exec'")
      .replace(/const SHEETS_BRIDGE_TOKEN\s*=\s*['"][^'"]+['"]/, "const SHEETS_BRIDGE_TOKEN = 'test-token'");
    return send(res, 200, 'text/html; charset=utf-8', html);
  }
  send(res, 404, 'text/plain', 'not found');
}).listen(port, () => console.log('mock bridge on http://localhost:' + port + '  (open /v2/index.html)'));
