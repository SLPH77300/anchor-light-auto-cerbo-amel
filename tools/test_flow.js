#!/usr/bin/env node
/* Unit tests for the function nodes of flow/anchor-light-auto-cerbo_v3.1.json
 * Run from the repository root:  node tools/test_flow.js
 * No dependency: the Node-RED objects (msg, global, context, node) are mocked. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const flowPath = path.join(__dirname, '..', 'flow', 'anchor-light-auto-cerbo_v3.1.json');
const flow = JSON.parse(fs.readFileSync(flowPath, 'utf8'));

// ---------- 1. structural checks of the flow file ---------------------------
const ids = new Set();
for (const n of flow) { assert(!ids.has(n.id), 'duplicate id ' + n.id); ids.add(n.id); }
const tab = flow.find(n => n.type === 'tab');
for (const n of flow) {
  if (n.type === 'tab' || n.type === 'victron-client') continue;
  assert.strictEqual(n.z, tab.id, 'node ' + n.id + ' not on the tab');
  for (const port of (n.wires || [])) for (const target of port) assert(ids.has(target), n.id + ' wires to unknown ' + target);
}
const byName = Object.fromEntries(flow.filter(n => n.type === 'function').map(n => [n.name, n.func]));
console.log('flow file OK:', flow.length, 'nodes,', Object.keys(byName).length, 'function nodes');

// ---------- 2. Node-RED mocks -------------------------------------------------
function makeEnv() {
  const g = new Map(), c = new Map();
  const node = { statuses: [], status(s) { this.statuses.push(s); }, warn() {}, error() {} };
  return {
    global: { get: k => g.get(k), set: (k, v) => g.set(k, v) },
    context: { get: k => c.get(k), set: (k, v) => c.set(k, v) },
    node,
    last: () => node.statuses[node.statuses.length - 1],
  };
}
function fixedDate(iso) {                 // Date replacement with a frozen "now"
  const fixed = new Date(iso).getTime();
  class FDate extends Date { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }
  return FDate;
}
function run(code, msg, env, DateImpl) {
  const f = new Function('msg', 'global', 'context', 'node', 'Date', code);
  return f(msg, env.global, env.context, env.node, DateImpl || Date);
}
const sk = (lat, lon, sogKn) => ({ payload: {
  navigation: { position: { value: { latitude: lat, longitude: lon } },
                speedOverGround: sogKn == null ? undefined : { value: sogKn * 0.514444 } } } });

// Termini Imerese (home port of Haku) and a spot ~5 NM east of it
const PORT = { lat: 37.986, lon: 13.704, radius: 3 };
const AWAY = { lat: 37.986, lon: 13.81 };
const NIGHT = '2026-09-13T22:00:00Z', DAY = '2026-09-13T10:00:00Z';
const DEC = byName['Decision (night + away from port + stationary)'];
let n = 0; const ok = m => { n++; console.log('  ok', m); };

// ---------- 3. decision node --------------------------------------------------
{ // no home port -> OFF even at night, away and stationary (safe default), relay told OFF once
  const e = makeEnv();
  const r = run(DEC, sk(AWAY.lat, AWAY.lon, 0.2), e, fixedDate(NIGHT));
  assert.deepStrictEqual(r[0], { payload: 0 }); assert.strictEqual(e.last().fill, 'red');
  assert(e.last().text.includes('HOME PORT NOT SET')); ok('no home port -> light OFF, red status');
}
{ // night + away + stationary -> ON
  const e = makeEnv(); e.global.set('homePort', PORT);
  const r = run(DEC, sk(AWAY.lat, AWAY.lon, 0.2), e, fixedDate(NIGHT));
  assert.deepStrictEqual(r[0], { payload: 1 }); assert.strictEqual(e.last().fill, 'green'); ok('night + away + stationary -> ON');
}
{ // moving -> OFF
  const e = makeEnv(); e.global.set('homePort', PORT);
  const r = run(DEC, sk(AWAY.lat, AWAY.lon, 3.0), e, fixedDate(NIGHT));
  assert.deepStrictEqual(r[0], { payload: 0 }); ok('night + away + 3 kn -> OFF');
}
{ // in port -> OFF
  const e = makeEnv(); e.global.set('homePort', PORT);
  const r = run(DEC, sk(PORT.lat + 0.005, PORT.lon, 0), e, fixedDate(NIGHT));
  assert.deepStrictEqual(r[0], { payload: 0 }); assert(e.last().text.includes('in port')); ok('night + in port -> OFF');
}
{ // day -> OFF
  const e = makeEnv(); e.global.set('homePort', PORT);
  const r = run(DEC, sk(AWAY.lat, AWAY.lon, 0), e, fixedDate(DAY));
  assert.deepStrictEqual(r[0], { payload: 0 }); assert(e.last().text.includes('day')); ok('day -> OFF');
}
{ // 20 min before sunset -> already ON ; 50 min before -> still OFF (find sunset with the same formula)
  const e = makeEnv(); e.global.set('homePort', PORT);
  // scan 13/09/2026 for the sunset instant at AWAY (sun altitude crossing -0.833 downwards)
  const probe = new Function('lat', 'lon', 't', DEC.split('// ---- great-circle')[0].replace(/^var SUN[\s\S]*?var PERSIST_MAX_MS[^\n]*\n/m, '') + 'return sunAlt(new Date(t), lat, lon);');
  let t = Date.parse('2026-09-13T15:00:00Z'); while (probe(AWAY.lat, AWAY.lon, t) > -0.833) t += 60000;
  const sunset = t;
  const r1 = run(DEC, sk(AWAY.lat, AWAY.lon, 0), makeEnvWith(PORT), fixedDate(new Date(sunset - 20 * 60000).toISOString()));
  const r2 = run(DEC, sk(AWAY.lat, AWAY.lon, 0), makeEnvWith(PORT), fixedDate(new Date(sunset - 50 * 60000).toISOString()));
  assert.deepStrictEqual(r1[0], { payload: 1 }); assert.deepStrictEqual(r2[0], { payload: 0 });
  ok('ON 20 min before sunset, OFF 50 min before (sunset ' + new Date(sunset).toISOString().slice(11, 16) + ' UTC)');
  function makeEnvWith(p) { const x = makeEnv(); x.global.set('homePort', p); return x; }
}
{ // GPS off: falls back on the last known position
  const e = makeEnv(); e.global.set('homePort', PORT); e.global.set('lastPos', AWAY);
  const r = run(DEC, { payload: {} }, e, fixedDate(NIGHT));
  assert.deepStrictEqual(r[0], { payload: 1 }); assert(e.last().text.includes('last pos')); ok('no GPS -> last position used -> ON');
}
{ // no position at all -> nothing sent
  const e = makeEnv(); e.global.set('homePort', PORT);
  const r = run(DEC, { payload: {} }, e, fixedDate(NIGHT));
  assert.strictEqual(r, null); assert.strictEqual(e.last().fill, 'grey'); ok('no position at all -> null, grey status');
}
{ // relay written on change, then re-asserted every 5th poll
  const e = makeEnv(); e.global.set('homePort', PORT);
  const outs = [];
  for (let i = 1; i <= 10; i++) outs.push(run(DEC, sk(AWAY.lat, AWAY.lon, 0), e, fixedDate(NIGHT))[0]);
  assert.deepStrictEqual(outs.map(o => o ? o.payload : null), [1, null, null, null, 1, null, null, null, null, 1]);
  ok('relay: sent on change, then re-asserted on polls 5 and 10');
}
{ // last-position file: written on first fix, not on the same fix, written again after moving 0.1 NM
  const e = makeEnv(); e.global.set('homePort', PORT); const D = fixedDate(NIGHT);
  const a = run(DEC, sk(AWAY.lat, AWAY.lon, 0), e, D)[1];
  const b = run(DEC, sk(AWAY.lat, AWAY.lon, 0), e, D)[1];
  const c = run(DEC, sk(AWAY.lat + 0.0017, AWAY.lon, 0), e, D)[1];
  assert(a && JSON.parse(a.payload).lat === AWAY.lat); assert.strictEqual(b, null); assert(c); ok('last position persisted only when moved (> 0.05 NM) or every 10 min');
}

// ---------- 4. home-port nodes --------------------------------------------------
const CAP = byName['Set home port'], LOADP = byName['Load home port'], LOADL = byName['Load last position'];
{ const e = makeEnv(); e.global.set('livePos', PORT);
  const r = run(CAP, { payload: 123 }, e); assert.deepStrictEqual(JSON.parse(r.payload), { lat: PORT.lat, lon: PORT.lon, radius: 3 });
  assert.deepStrictEqual(e.global.get('homePort'), { lat: PORT.lat, lon: PORT.lon, radius: 3 }); ok('set home port HERE from the live GPS position'); }
{ const e = makeEnv(); const r = run(CAP, { payload: { lat: 43.27, lon: 5.35, radius: 2 } }, e);
  assert.deepStrictEqual(JSON.parse(r.payload), { lat: 43.27, lon: 5.35, radius: 2 }); ok('set home port MANUALLY'); }
{ const e = makeEnv(); assert.strictEqual(run(CAP, { payload: { lat: 0, lon: 0, radius: 3 } }, e), null); ok('manual inject not edited (0/0) -> refused'); }
{ const e = makeEnv(); assert.strictEqual(run(CAP, { payload: 1 }, e), null); assert.strictEqual(e.last().fill, 'red'); ok('no GPS yet -> refused'); }
{ const e = makeEnv(); run(LOADP, { payload: JSON.stringify(PORT) }, e); assert.deepStrictEqual(e.global.get('homePort'), PORT); ok('load home port from file'); }
{ const e = makeEnv(); run(LOADP, { payload: '' }, e); assert.strictEqual(e.global.get('homePort'), null); assert.strictEqual(e.last().fill, 'red'); ok('empty file -> no home port'); }
{ const e = makeEnv(); run(LOADL, { payload: JSON.stringify(AWAY) }, e); assert.deepStrictEqual(e.global.get('lastPos'), AWAY); ok('load last position from file'); }
{ const e = makeEnv(); run(LOADL, { payload: 'garbage' }, e); assert.strictEqual(e.global.get('lastPos'), undefined); ok('invalid last-position file ignored'); }

console.log('\nALL ' + n + ' TESTS PASSED');
