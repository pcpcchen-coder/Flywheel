#!/usr/bin/env node
/* Run a scenario headless (no browser) and print its KPIs as JSON.
 * Use these numbers in any text you write — never invent results.
 *
 *   node scripts/check_engine.js --engine sim --kind s1 --seconds 40 --modes none,fw
 *   node scripts/check_engine.js --engine ripple --kind ripple --seconds 30 --modes none,gpu,fw --opts '{"bw":500,"Titer":1.4}'
 *   node scripts/check_engine.js --engine ripple --kind ramp --seconds 280 --modes none,gpu,fw,hyb --opts '{"ramp":2}'
 *   node scripts/check_engine.js --engine sim --kind s4 --seconds 5 --opts '{"kdod":0.5,"efcRated":6000}'
 *
 * Suggested durations: s1 40, s2 8, s3 234 (3 cycles), s4 5, ripple 30, ramp 280 (2 cycles).
 */
const path = require('path');
const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) if (av[i].startsWith('--')) { args[av[i].slice(2)] = av[i + 1]; i++; }
const engine = args.engine || 'sim', kind = args.kind || 's1', secs = +(args.seconds || 30);
const opts = args.opts ? JSON.parse(args.opts) : {};
const E = require(path.join(__dirname, '..', 'assets', engine === 'ripple' ? 'aidc-ripple.js' : 'aidc-sim.js'));
const modes = args.modes ? args.modes.split(',') : [opts.mode || null];
const round = (v) => typeof v === 'number' ? +v.toFixed(v !== 0 && Math.abs(v) < 1 ? 4 : 3) : v;
const out = {};
for (const m of modes) {
  const o = Object.assign({}, opts); if (m) o.mode = m;
  const R = E.makeRun(kind, o); const h = R.h || 0.001; const n = Math.round(secs / h);
  for (let i = 0; i < n; i++) R.step(h);
  const k = R.kpi(); const r = {}; for (const key of Object.keys(k)) r[key] = round(k[key]);
  out[m || 'default'] = r;
}
console.log(JSON.stringify({ engine, kind, seconds: secs, opts, results: out }, null, 1));
