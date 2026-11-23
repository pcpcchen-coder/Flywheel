/* AIDC × Flywheel v2 — AC current ripple & ramp / LVRT compliance engine.
 * Part A: plant + control (pure JS, runs in Node).  Part B: three.js scene, charts, mount().
 * All parameters are illustrative (示意參數). Base: 100 MW, 161 kV PCC → I_base ≈ 358.6 A rms. */
(function (root) {
  'use strict';
  var COL = { load: '#E6EAF0', grid: '#4DA3FF', fw: '#FF9F43', red: '#FF5D5D', green: '#3DDC97', volt: '#7FE3D0', bat: '#B48CFF', muted: '#8C99A8' };
  var PR = 100, IB = PR * 1e6 / (Math.sqrt(3) * 161e3), W0 = 2 * Math.PI * 60;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function Ring(n) { this.n = n; this.a = new Float32Array(n); this.i = 0; this.len = 0; }
  Ring.prototype.push = function (v) { this.a[this.i] = v; this.i = (this.i + 1) % this.n; if (this.len < this.n) this.len++; };
  Ring.prototype.at = function (k) { var s = (this.i - this.len + this.n) % this.n; return this.a[(s + k) % this.n]; };
  Ring.prototype.last = function () { return this.len ? this.a[(this.i - 1 + this.n) % this.n] : 0; };
  Ring.prototype.range = function (m) { m = Math.min(m || this.len, this.len); var lo = Infinity, hi = -Infinity; for (var k = this.len - m; k < this.len; k++) { var v = this.at(k); if (v === v) { if (v < lo) lo = v; if (v > hi) hi = v; } } return m ? [lo, hi] : [0, 0]; };
  Ring.prototype.mean = function (m) { m = Math.min(m || this.len, this.len); var s = 0; for (var k = this.len - m; k < this.len; k++) s += this.at(k); return m ? s / m : 0; };

  // ------------------------------------------------------------- models
  function Load(p) {
    p = Object.assign({ base: 15, gpuPeak: 85, comm: 0.22, idle: 0.12, ckpt: 0.25, Titer: 1.4, duty: 0.64, edge: 0.005, jitter: 0.04, seed: 3 }, p || {});
    var r = rng(p.seed), st = { job: 'train', ph: 0, T: p.Titer, gpu: 1, P: p.base + p.gpuPeak, nz: 0 };
    function step(dt) {
      var tgt;
      if (st.job === 'off') tgt = p.idle; else if (st.job === 'ckpt') tgt = p.ckpt;
      else { st.ph += dt / st.T; if (st.ph >= 1) { st.ph -= 1; st.T = p.Titer * (1 + p.jitter * (2 * r() - 1)); } tgt = st.ph < p.duty ? 1 : p.comm; }
      st.nz += ((r() - 0.5) - st.nz) * Math.min(1, dt / 0.05);
      st.gpu += (tgt - st.gpu) * Math.min(1, dt / p.edge);
      st.P = p.base + p.gpuPeak * clamp(st.gpu + 0.01 * st.nz, 0, 1.05);
      return st.P;
    }
    return { p: p, st: st, step: step, set: function (j) { st.job = j; if (j === 'train') st.ph = 0; } };
  }
  function Flywheel(p) {
    p = Object.assign({ Pmax: 80, Euse: 0.8, rpmMax: 15000, rpmMin: 7500, eta: 0.955, standby: 0.01, soe0: 0.5 }, p || {});
    var k = Math.pow(p.rpmMin / p.rpmMax, 2), Emax = p.Euse * 3600 / (1 - k), Emin = Emax * k;
    var st = { E: Emin + p.soe0 * (Emax - Emin), P: 0, soe: p.soe0, rpm: 0, loss: 0 };
    function lim() { var b = 0.04; return { dis: p.Pmax * clamp(st.soe / b, 0, 1), chg: p.Pmax * clamp((1 - st.soe) / b, 0, 1) }; }
    function step(dt, ref, tau) {
      var L = lim(), rr = clamp(ref, -L.chg, L.dis);
      st.P += (rr - st.P) * Math.min(1, dt / tau);
      var Pm = st.P > 0 ? st.P / p.eta : st.P * p.eta, sb = p.standby * st.E / 3600;
      st.E = clamp(st.E - (Pm + sb) * dt, Emin * 0.99, Emax * 1.001);
      st.soe = (st.E - Emin) / (Emax - Emin); st.rpm = p.rpmMax * Math.sqrt(st.E / Emax);
      st.loss += (Math.abs(Pm - st.P) + sb) * dt;
      return st.P;
    }
    return { p: p, st: st, step: step, lim: lim };
  }
  // 2nd-order mode driven by ΔP (pu): ẍ + 2ζωẋ + ω²x = ω²u
  function Mode(f, z) {
    var w = 2 * Math.PI * f, x = 0, v = 0, ms = 0;
    return { step: function (dt, u) { v += (w * w * (u - x) - 2 * z * w * v) * dt; x += v * dt; ms += (x * x - ms) * Math.min(1, dt / 6); return x; }, rms: function () { return Math.sqrt(ms); }, x: function () { return x; } };
  }

  // ----------------------------------------------------------------- run
  // kind 'ripple': continuous training.  kind 'ramp': scripted job start / checkpoint / fault / crash.
  function makeRun(kind, o) {
    o = o || {};
    var L = Load(Object.assign({ Titer: o.Titer || 1.4, edge: o.edge || 0.005, seed: kind === 'ramp' ? 9 : 3 }, o.load));
    var F = Flywheel(o.fw);
    var R = { kind: kind, h: 0.00025, speed: o.speed || (kind === 'ramp' ? 2 : 1), t: 0, mode: o.mode || 'fw', ramp: o.ramp || 2, bw: o.bw || 500, V: 1 };
    var md = { loc: Mode(1.0, 0.05), tor: Mode(12, 0.01), loc0: Mode(1.0, 0.05), tor0: Mode(12, 0.01) };
    var c = { l1: null, l2: null, ref: null, soeRef: 0.5 };
    var st = { pl: 0, pg: 0, pf: 0, pc: 0, q: 0, waste: 0, thr: 0, loadE: 0, pgB: null, ups: false, upsP: 0,
      ev: -1, vUp: -1, pPre: 80, rec: null, recDone: true, imax: 1, iav: 1, viol: 0, exemptUntil: -1, jobs: 'train', mPg: null, mPl: null };
    var marks = [];
    // rings
    var envG = new Ring(2048), envL = new Ring(2048), acc200 = 0, sG = 0, sL = 0;  // 200 Hz envelope (pu current)
    var wL = new Ring(2400), wG = new Ring(2400), wF = new Ring(2400), acc1k2 = 0;  // 1.2 kHz waveforms (A)
    var rbL = new Ring(180), rbG = new Ring(180), rbF = new Ring(180), acc60 = 0;    // 60 Hz ribbons
    var NT = kind === 'ramp' ? 2800 : 1200, pL = new Ring(NT), pG = new Ring(NT), pS = new Ring(NT), pV = new Ring(NT), pR = new Ring(NT), pRv = new Ring(NT), pE = new Ring(NT), acc20 = 0, sumG = 0, a40 = new Ring(40); // 20 Hz trends
    var lv = { V: new Float32Array(700), P: new Float32Array(700), n: 0, tv: -1, rec: null, have: false };
    var lp01 = null, lp20 = null, msB = 0, lp01L = null, lp20L = null, msBL = 0;
    var script = kind === 'ramp' ? [{ t: 0, ev: 'off' }, { t: 4, ev: 'train', label: '作業啟動' }, { t: 74, ev: 'ckpt', label: 'Checkpoint' }, { t: 82, ev: 'train', label: '恢復訓練' }, { t: 100, ev: 'fault', label: '230 kV 故障' }, { t: 120, ev: 'off', label: '作業異常中止' }] : [];
    var cycle = 140, si = 0;
    if (kind === 'ramp') { L.set('off'); L.st.gpu = L.p.idle; st.jobs = 'off'; }

    function vAt(tt) { if (tt < 0) return 1; if (tt < 0.15) return 0.3; if (tt < 0.35) return lerp(0.9, 1.0, (tt - 0.15) / 0.2); return 1; }
    R.trigger = function (what) {
      if (what === 'fault') { if (st.ev >= 0 && R.t - st.ev < 4) return; st.ev = R.t; st.vUp = -1; st.pPre = st.pg; st.recDone = false; st.imax = 0; st.exemptUntil = R.t + 6; lv.n = 0; lv.have = true; lv.rec = null; lv.tv = -1; marks.push({ t: R.t, label: '230 kV 故障' }); }
      else { st.jobs = what; L.set(what); marks.push({ t: R.t, label: what === 'train' ? '作業啟動' : what === 'off' ? '作業中止' : 'Checkpoint' }); }
    };
    R.setMode = function (m) { R.mode = m; st.pgB = null; st.ups = false; st.waste = st.thr = st.loadE = st.viol = 0; };
    R.set = function (k, v) {
      if (k === 'ramp') { R.ramp = v; st.viol = 0; }
      if (k === 'bw') R.bw = v;
      if (k === 'Titer') { L.p.Titer = v; L.st.T = v; }
      if (k === 'edge') L.p.edge = v;
    };

    R.step = function (dt) {
      R.t += dt;
      if (kind === 'ramp') {
        var tc = R.t % cycle; if (tc < dt * 1.5) si = 0;
        while (si < script.length && tc >= script[si].t) { var e = script[si]; if (e.ev === 'fault') R.trigger('fault'); else if (si > 0 || R.t > 1) { st.jobs = e.ev; L.set(e.ev); if (e.label) marks.push({ t: R.t, label: e.label }); } si++; }
      }
      var tt = st.ev >= 0 ? R.t - st.ev : -1; R.V = vAt(tt);
      var V = R.V, sag = V < 0.85;
      var pl = L.step(dt), plEff = pl, pg, pf = 0, q = 0;
      // L1 reference (ramp limited LPF + SoE recovery); post-fault recovery is exempt (90 MW/s)
      if (c.l1 === null) { c.l1 = c.l2 = c.ref = kind === 'ripple' ? L.p.base + L.p.gpuPeak * (L.p.duty + (1 - L.p.duty) * L.p.comm) : pl; }
      c.l1 += (pl - c.l1) * dt / 2.5; c.l2 += (c.l1 - c.l2) * dt / 2.5;
      c.soeRef = kind === 'ramp' ? (st.jobs === 'off' ? 0.85 : 0.4) : 0.5;
      var tgt = c.l2 + 0.25 * (c.soeRef - F.st.soe) * F.p.Pmax;
      var rr = R.t < st.exemptUntil ? 90 : R.ramp;
      if (R.mode === 'fw' || R.mode === 'hyb') {
        if (sag) c.ref = Math.min(c.ref, pl * clamp(V / 0.9, 0, 1));
        else c.ref += clamp(tgt - c.ref, -rr * dt, rr * dt);
      } else c.ref += clamp(tgt - c.ref, -rr * dt, rr * dt);
      var tau = 1 / (2 * Math.PI * R.bw);
      if (R.mode === 'fw') {
        pf = F.step(dt, pl - c.ref, tau); pg = pl - pf;
      } else if (R.mode === 'hyb') {
        var lm = F.lim(), d = pl - c.ref;
        if (d > lm.dis * 0.97) plEff = c.ref + lm.dis * 0.97; else if (d < -lm.chg * 0.97) plEff = c.ref - lm.chg * 0.97;
        if (plEff < pl) st.thr += (pl - plEff) * dt; else if (plEff > pl) st.waste += (plEff - pl) * dt;
        pf = F.step(dt, plEff - c.ref, tau); pg = plEff - pf;
      } else {
        F.step(dt, 0, tau);
        var want = pl;
        if (R.mode === 'gpu') {
          if (st.pgB === null) st.pgB = pl;
          var active = st.jobs !== 'off', floor = L.p.base + L.p.gpuPeak * 0.9;
          var w = active ? Math.max(pl, floor) : pl;
          st.pgB += clamp(w - st.pgB, -R.ramp * dt, R.ramp * dt);
          if (!active && st.pgB < pl) st.pgB = pl;
          want = st.pgB; plEff = want;
          if (want > pl) st.waste += (want - pl) * dt; else st.thr += (pl - want) * dt;
        }
        // legacy UPS: transfer on sag, walk-in at 10 %/s after V recovers
        if (sag) { st.ups = true; st.upsP = 0; }
        if (st.ups) { if (V >= 0.9) { st.upsP += 0.1 * PR * dt; if (st.upsP >= want) st.ups = false; } pg = Math.min(st.upsP, want); }
        else pg = want;
      }
      if ((R.mode === 'fw' || R.mode === 'hyb') && sag) q = clamp(2 * (0.9 - V), 0, 1) * F.p.Pmax;
      st.pl = pl; st.pg = pg; st.pf = pf; st.pc = plEff; st.q = q; st.loadE += pl * dt;

      // fault recovery bookkeeping (ERCOT-style: ≥90 % of pre-fault within 1 s after V > 0.9)
      var Ipu = pg / (PR * Math.max(V, 0.05));
      st.iav += (Ipu - st.iav) * Math.min(1, dt / 0.0083);   // ≈ one-cycle RMS window
      if (st.ev >= 0 && tt < 8) {
        st.imax = Math.max(st.imax, st.iav);
        if (st.vUp < 0 && tt > 0.15 && V >= 0.9) st.vUp = R.t;
        if (!st.recDone && st.vUp >= 0 && pg >= 0.9 * st.pPre) { st.rec = R.t - st.vUp; st.recDone = true; lv.rec = st.rec; }
        if (lv.have && lv.n < 700 && Math.floor(tt / 0.005) >= lv.n) { lv.V[lv.n] = V; lv.P[lv.n] = pg / Math.max(1, st.pPre); lv.n++; if (st.vUp >= 0 && lv.tv < 0) lv.tv = st.vUp - st.ev; }
        if (tt > 7.9 && !st.recDone) { st.rec = 99; st.recDone = true; lv.rec = 99; }
      }

      // modal response (ΔP relative to slow mean)
      if (st.mPg === null) { st.mPg = pg; st.mPl = pl; }
      st.mPg += (pg - st.mPg) * dt / 2; st.mPl += (pl - st.mPl) * dt / 2;
      md.tor.step(dt, (pg - st.mPg) / PR); md.loc.step(dt, (pg - st.mPg) / PR);
      md.tor0.step(dt, (pl - st.mPl) / PR); md.loc0.step(dt, (pl - st.mPl) / PR);

      // ripple band metric on current envelope: 0.1–20 Hz RMS / mean
      var Ig = Ipu, Il = plEff / (PR * Math.max(V, 0.05));
      if (lp01 === null) { lp01 = lp20 = Ig; lp01L = lp20L = Il; }
      lp20 += (Ig - lp20) * Math.min(1, dt * 2 * Math.PI * 20); lp01 += (Ig - lp01) * dt * 2 * Math.PI * 0.1;
      lp20L += (Il - lp20L) * Math.min(1, dt * 2 * Math.PI * 20); lp01L += (Il - lp01L) * dt * 2 * Math.PI * 0.1;
      msB += ((lp20 - lp01) * (lp20 - lp01) - msB) * dt / 8; msBL += ((lp20L - lp01L) * (lp20L - lp01L) - msBL) * dt / 8;

      acc200 += dt; sG += Ig * dt; sL += Il * dt;
      if (acc200 >= 0.005) { envG.push(sG / acc200); envL.push(sL / acc200); acc200 = 0; sG = sL = 0; }
      acc1k2 += dt;
      if (acc1k2 >= 1 / 1200) { acc1k2 -= 1 / 1200; var sn = Math.sqrt(2) * Math.sin(W0 * R.t); wL.push(sn * Il * IB); wG.push(sn * Ig * IB); wF.push(sn * (pf / (PR * Math.max(V, 0.05))) * IB); }
      acc60 += dt; if (acc60 >= 1 / 60) { acc60 -= 1 / 60; rbL.push(Il); rbG.push(Ig); rbF.push(pf / PR); }
      acc20 += dt; sumG += pg * dt;
      if (acc20 >= 0.05) {
        var avg = sumG / acc20; acc20 = 0; sumG = 0;
        a40.push(avg); var slope = 0;
        if (a40.len === 40) { var s1 = 0, s2 = 0; for (var q2 = 0; q2 < 20; q2++) { s1 += a40.at(q2); s2 += a40.at(q2 + 20); } slope = (s2 - s1) / 20; } // 1 s moving-average difference
        var exempt = R.t < st.exemptUntil;
        pL.push(plEff); pG.push(avg); pS.push(F.st.soe * 100); pV.push(V); pR.push(slope); pE.push(exempt ? 1 : 0);
        var bad = !exempt && Math.abs(slope) > R.ramp * 1.1 + 0.2;
        pRv.push(bad ? slope : NaN); if (bad) st.viol += 0.05;
      }
      while (marks.length && marks[0].t < R.t - 150) marks.shift();
    };

    var fr = []; for (var i = 1; i <= 160; i++) fr.push(i * 0.25); // 0.25..40 Hz
    function envSpec(ring) {
      var N = ring.len; if (N < 256) return null;
      var x = new Float32Array(N), m = 0, k; for (k = 0; k < N; k++) { x[k] = ring.at(k); m += x[k]; } m /= N;
      for (k = 0; k < N; k++) x[k] = (x[k] - m) * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (N - 1)));
      var out = new Float32Array(fr.length);
      for (var j = 0; j < fr.length; j++) { var w = 2 * Math.PI * fr[j] / 200, re = 0, im = 0, cw = Math.cos(w), sw = Math.sin(w), c0 = 1, s0 = 0;
        for (k = 0; k < N; k++) { re += x[k] * c0; im -= x[k] * s0; var c1 = c0 * cw - s0 * sw; s0 = s0 * cw + c0 * sw; c0 = c1; }
        var a = 4 * Math.sqrt(re * re + im * im) / N; out[j] = 20 * Math.log10(Math.max(1e-6, 0.5 * a / Math.max(1e-3, m))); }
      return out;
    }
    R.spectrum = function () { return { fr: fr, grid: envSpec(envG), load: envSpec(envL) }; };

    R.kpi = function () {
      var eg = envG.range(1000), el = envL.range(1000), mg = envG.mean(1000), ml = envL.mean(1000);
      var sp = R.spectrum(), mx = -200, mf = 0;
      if (sp.grid) for (var j = 0; j < sp.fr.length; j++) if (sp.grid[j] > mx) { mx = sp.grid[j]; mf = sp.fr[j]; }
      var mxl = -200; if (sp.load) for (j = 0; j < sp.fr.length; j++) mxl = Math.max(mxl, sp.load[j]);
      return {
        mode: R.mode, pl: st.pl, pg: st.pg, pf: st.pf, q: st.q, V: R.V, soe: F.st.soe, rpm: F.st.rpm,
        dIg: mg > 0 ? 100 * (eg[1] - eg[0]) / mg : 0, dIl: ml > 0 ? 100 * (el[1] - el[0]) / ml : 0,
        bandG: mg > 0 ? 100 * Math.sqrt(msB) / mg : 0, bandL: ml > 0 ? 100 * Math.sqrt(msBL) / ml : 0,
        ihMax: mx, ihF: mf, ihMaxL: mxl,
        tor: md.tor0.rms() > 1e-7 ? 100 * md.tor.rms() / md.tor0.rms() : 100, loc: md.loc0.rms() > 1e-7 ? 100 * md.loc.rms() / md.loc0.rms() : 100,
        torAbs: 100 * md.tor.rms(), locAbs: 100 * md.loc.rms(),
        ifw: Math.abs(st.pf) / PR * IB, igA: st.pg / (PR * Math.max(R.V, 0.05)) * IB,
        wastePct: st.loadE > 0 ? 100 * st.waste / st.loadE : 0, thrPct: st.loadE > 0 ? 100 * st.thr / st.loadE : 0,
        rampMax: rampMax(), viol: st.viol, rec: st.rec, imax: st.imax, ups: st.ups, job: st.jobs, ramp: R.ramp, bw: R.bw
      };
    };
    function rampMax() { var b = 0; for (var k = 0; k < pR.len; k++) { if (pE.at(k)) continue; var v = Math.abs(pR.at(k)); if (v > b) b = v; } return b; }

    R.view = function () {
      var tt = st.ev >= 0 ? R.t - st.ev : -1;
      return { pl: st.pc, pg: st.pg, pf: st.pf, Pmax: F.p.Pmax, gpu: L.st.gpu, soe: F.st.soe, rpm: F.st.rpm, V: R.V, fault: R.V < 0.85 ? 1 : 0, faultGlow: tt >= 0 && tt < 3 ? 1 - tt / 3 : 0, ups: st.ups,
        tor: md.tor.x(), torR: md.tor.rms(), rbL: rbL, rbG: rbG, rbF: rbF, burn: st.pc > st.pl + 1 };
    };
    if (kind === 'ripple') {
      R.chart = { window: 2, dt: 1 / 1200, lanes: [
        { w: 0.34, min: -800, max: 800, unit: 'A', title: 'AIDC 負載電流 i_load', series: [{ ring: wL, color: COL.load, width: 1 }] },
        { w: 0.33, min: -800, max: 800, unit: 'A', title: '飛輪補償電流 i_fw', series: [{ ring: wF, color: COL.fw, width: 1 }] },
        { w: 0.33, min: -800, max: 800, unit: 'A', title: '電網電流 i_grid = i_load − i_fw', series: [{ ring: wG, color: COL.grid, width: 1.2 }] }] };
    } else {
      R.chart = { window: 140, dt: 0.05, marks: marks, lanes: [
        { w: 0.42, min: 0, max: 110, unit: 'MW', title: '功率', series: [{ ring: pL, color: COL.load, width: 1.1, label: 'AIDC 實際用電' }, { ring: pG, color: COL.grid, width: 2.2, label: '電網側' }] },
        { w: 0.3, min: -20, max: 20, unit: 'MW/s', title: '電網 ramp（1 s 平均）', zero: true, series: [{ ring: pR, color: '#7D8B99', width: 1.2, label: 'dP/dt' }, { ring: pRv, color: COL.red, width: 2.4, label: '超限' }], hl: function () { return [R.ramp, -R.ramp]; } },
        { w: 0.28, min: 0, max: 100, unit: '%', title: '飛輪 SoE', series: [{ ring: pS, color: COL.fw, width: 2, label: 'SoE' }] }] };
    }
    R.lvrt = lv;
    return R;
  }

  // ====================================================== 3D scene
  function buildScene(canvas, opts) {
    var T = root.THREE; if (T.ColorManagement) T.ColorManagement.legacyMode = false;
    var W = opts.w, H = opts.h;
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
    renderer.outputEncoding = T.sRGBEncoding; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene(); scene.background = new T.Color(0x0A0E13); scene.fog = new T.Fog(0x0A0E13, 160, 320);
    var cam = new T.PerspectiveCamera(34, W / H, 1, 800);
    scene.add(new T.HemisphereLight(0xA9C1E0, 0x0A0E13, 0.75));
    var sun = new T.DirectionalLight(0xffffff, 1.05); sun.position.set(-40, 90, 60); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -110; sc.right = 80; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 260; scene.add(sun);
    scene.add(new T.AmbientLight(0x334455, 0.35));
    var ground = new T.Mesh(new T.PlaneGeometry(500, 500), new T.MeshStandardMaterial({ color: 0x0E141B, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    var gh = new T.GridHelper(300, 60, 0x1A2430, 0x131B24); gh.position.y = 0.02; scene.add(gh);
    var mMetal = new T.MeshStandardMaterial({ color: 0x8A96A3, metalness: 0.55, roughness: 0.38 });
    var mDark = new T.MeshStandardMaterial({ color: 0x1E2834, roughness: 0.75, metalness: 0.1 });
    var mPad = new T.MeshStandardMaterial({ color: 0x18212B, roughness: 0.95 });
    var busMat = new T.MeshBasicMaterial({ color: 0x23415F });
    function box(w, h, d, m, x, y, z, par) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (par || scene).add(o); return o; }
    function pad(x, z, w, d) { box(w, 0.25, d, mPad, x, 0.125, z); }
    function stripeTex(a, b) { var c = document.createElement('canvas'); c.width = 128; c.height = 16; var x = c.getContext('2d'); for (var i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * 16, 0, 16, 16); } var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }

    // ---- power plant: turbine-generator shaft train along x
    var zP = -6; pad(-84, zP, 36, 16);
    var shaft = []; var masses = [{ n: 'HP', r: 1.5, l: 3 }, { n: 'IP', r: 1.9, l: 3.4 }, { n: 'LP', r: 2.6, l: 4.6 }, { n: 'GEN', r: 2.3, l: 6.5 }];
    var sx = -98, couplings = [], cplMat = new T.MeshStandardMaterial({ color: 0x5B6876, emissive: 0x000000, metalness: 0.4, roughness: 0.4 });
    var shaftMats = [stripeTex('#9AA6B2', '#5D6A77'), stripeTex('#9AA6B2', '#5D6A77'), stripeTex('#9AA6B2', '#5D6A77'), stripeTex('#C9D2DC', '#4DA3FF')];
    masses.forEach(function (m, i) {
      var g = new T.Mesh(new T.CylinderGeometry(m.r, m.r, m.l, 32), new T.MeshStandardMaterial({ map: shaftMats[i], metalness: 0.4, roughness: 0.45 }));
      g.rotation.z = Math.PI / 2; var grp = new T.Group(); grp.add(g); grp.position.set(sx + m.l / 2, 3.4, zP); scene.add(grp); g.castShadow = true;
      shaft.push(grp); sx += m.l;
      box(m.l * 0.6, 0.9, m.r * 1.6, mDark, sx - m.l / 2, 0.7, zP);
      if (i < masses.length - 1) { var cp = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 1.4, 16), cplMat); cp.rotation.z = Math.PI / 2; cp.position.set(sx + 0.7, 3.4, zP); scene.add(cp); couplings.push(cp); sx += 1.4; }
    });
    var stepUp = box(4, 4, 4, new T.MeshStandardMaterial({ color: 0x5C6B7A, roughness: 0.5, metalness: 0.4 }), -66, 2.25, zP);

    // ---- transmission line
    var towerMat = new T.LineBasicMaterial({ color: 0x6B7A8A });
    function tower(x, h) { var l = new T.LineSegments(new T.EdgesGeometry(new T.CylinderGeometry(0.6, 2.4, h, 4, 6, true)), towerMat); l.position.set(x, h / 2, zP); l.rotation.y = Math.PI / 4; scene.add(l); var a = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(0.4, 0.5, 8)), towerMat); a.position.set(x, h * 0.85, zP); scene.add(a); }
    tower(-50, 14); tower(-28, 14);
    var condMat = new T.MeshBasicMaterial({ color: 0x4DA3FF, transparent: true, opacity: 0.5 });
    [-2.8, 0, 2.8].forEach(function (dz) {
      [[-64, 4.5, -50, 11.9], [-50, 11.9, -28, 11.9], [-28, 11.9, -8, 6]].forEach(function (s) {
        var a = new T.Vector3(s[0], s[1], zP + dz), b = new T.Vector3(s[2], s[3], zP + dz), m = a.clone().lerp(b, 0.5); m.y -= 1.6;
        scene.add(new T.Mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(a, m, b), 20, 0.08, 5, false), condMat));
      });
    });
    // ---- PCC substation
    pad(-2, zP, 16, 14);
    box(3.6, 3.4, 3, new T.MeshStandardMaterial({ color: 0x5C6B7A, roughness: 0.5, metalness: 0.4 }), -4, 1.95, zP - 3);
    var pccMat = new T.MeshBasicMaterial({ color: 0x4DA3FF });
    var pcc = new T.Mesh(new T.SphereGeometry(1.1, 24, 16), pccMat); pcc.position.set(2, 2.5, zP); scene.add(pcc);
    var ringM = new T.MeshBasicMaterial({ color: 0xFF5D5D, transparent: true, opacity: 0, side: T.DoubleSide });
    var sagRing = new T.Mesh(new T.RingGeometry(6, 7.2, 64), ringM); sagRing.rotation.x = -Math.PI / 2; sagRing.position.set(0, 0.3, zP); scene.add(sagRing);
    // ---- AIDC halls
    var ledMat = new T.MeshBasicMaterial({ color: 0xFFB347 }), hallX = [22, 41], hz = -26;
    hallX.forEach(function (hx) {
      pad(hx, hz, 18, 14); box(16, 7, 11, mDark, hx, 3.75, hz);
      var cols = 13, rows = 4, inst = new T.InstancedMesh(new T.BoxGeometry(0.75, 0.42, 0.06), ledMat, cols * rows), m4 = new T.Matrix4(), k = 0;
      for (var r = 0; r < rows; r++) for (var c2 = 0; c2 < cols; c2++) { m4.makeTranslation(hx - 7.2 + c2 * 1.2, 1.7 + r * 1.3, hz + 5.54); inst.setMatrixAt(k++, m4); }
      inst.instanceMatrix.needsUpdate = true; scene.add(inst);
      box(0.5, 0.12, 9, busMat, hx, 0.3, -15.5).castShadow = false;
    });
    box(42, 0.12, 0.6, busMat, 21, 0.3, zP).castShadow = false;
    // ---- flywheel array
    var fwPos = [], fc = 8, frw = 3, f0x = 16, f0z = 8;
    pad(f0x + 10.5, f0z + 3, 28, 10);
    var housing = new T.InstancedMesh(new T.CylinderGeometry(1.0, 1.05, 2.2, 24), mMetal, fc * frw); housing.castShadow = true;
    var discTex = (function () { var cv = document.createElement('canvas'); cv.width = cv.height = 128; var x = cv.getContext('2d'); x.fillStyle = '#2B3540'; x.fillRect(0, 0, 128, 128); for (var i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#FF9F43' : '#E6EAF0'; x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, 64, i * Math.PI / 3, i * Math.PI / 3 + 0.35); x.closePath(); x.fill(); } var t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t; })();
    var discs = new T.InstancedMesh(new T.CylinderGeometry(0.85, 0.85, 0.1, 32), new T.MeshStandardMaterial({ map: discTex, roughness: 0.4 }), fc * frw);
    var fwRingMat = new T.MeshBasicMaterial({ color: 0x3A4654 });
    var rings = new T.InstancedMesh(new T.TorusGeometry(1.2, 0.08, 8, 36), fwRingMat, fc * frw);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), one = new T.Vector3(1, 1, 1);
    for (var r = 0; r < frw; r++) for (var c3 = 0; c3 < fc; c3++) { var i2 = r * fc + c3, px = f0x + c3 * 3, pz = f0z + r * 3; fwPos.push([px, pz]); m4.makeTranslation(px, 1.35, pz); housing.setMatrixAt(i2, m4); e.set(Math.PI / 2, 0, 0); q.setFromEuler(e); m4.compose(new T.Vector3(px, 0.35, pz), q, one); rings.setMatrixAt(i2, m4); }
    housing.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true; scene.add(housing); scene.add(discs); scene.add(rings);
    var mPcs = new T.MeshStandardMaterial({ color: 0x2E4458, roughness: 0.6 });
    for (var p = 0; p < 3; p++) { box(5.6, 2.6, 2.4, mPcs, f0x + 2 + p * 7.5, 1.55, 3); box(5.6, 0.18, 2.42, new T.MeshBasicMaterial({ color: 0xFF9F43 }), f0x + 2 + p * 7.5, 2.4, 3); }
    box(0.5, 0.12, 8, busMat, 10, 0.3, -2).castShadow = false;

    // ---- current ribbons (scrolling oscilloscope traces laid along each conductor)
    function Ribbon(pts, color, lambda) {
      var vs = pts.map(function (a) { return new T.Vector3(a[0], a[1], a[2]); }), seg = [], Ltot = 0;
      for (var i = 1; i < vs.length; i++) { var d = vs[i].distanceTo(vs[i - 1]); seg.push(d); Ltot += d; }
      var N = Math.max(80, Math.round(Ltot * 6)), pos = new Float32Array(N * 2 * 3), idx = [];
      for (i = 0; i < N - 1; i++) { var a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx);
      var mat = new T.MeshBasicMaterial({ color: new T.Color(color), side: T.DoubleSide, transparent: true, opacity: 0.95 });
      var mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
      var base = [], side = [], up = new T.Vector3(0, 1, 0);
      for (i = 0; i < N; i++) {
        var s = i / (N - 1), dd = s * Ltot, j = 0; while (j < seg.length - 1 && dd > seg[j]) { dd -= seg[j]; j++; }
        var pt = vs[j].clone().lerp(vs[j + 1], clamp(dd / seg[j], 0, 1)); base.push(pt);
        var dir = vs[j + 1].clone().sub(vs[j]).normalize(); side.push(new T.Vector3().crossVectors(dir, up).normalize().multiplyScalar(0.16));
      }
      return { N: N, L: Ltot, update: function (ring, scale, t, ref) {
        var n = ring.len;
        for (var i = 0; i < N; i++) {
          var s = i / (N - 1), ageIdx = Math.round((1 - s) * (Math.min(n, 150) - 1)), env = n ? ring.at(n - 1 - ageIdx) : 0;
          var amp = scale * env / ref, y = amp * Math.sin(2 * Math.PI * (s * Ltot / lambda - t * 0.9));
          var b = base[i], sd = side[i], o = i * 6;
          pos[o] = b.x + sd.x; pos[o + 1] = b.y + y; pos[o + 2] = b.z + sd.z; pos[o + 3] = b.x - sd.x; pos[o + 4] = b.y + y; pos[o + 5] = b.z - sd.z;
        }
        g.attributes.position.needsUpdate = true;
      }, mat: mat };
    }
    var rG = Ribbon([[-62, 9, zP], [-50, 14.5, zP], [-28, 14.5, zP], [-6, 8.5, zP]], COL.grid, 2.6);
    var rL = Ribbon([[3, 4.2, zP - 1.2], [41, 4.2, zP - 1.2], [41, 4.2, -19.5]], COL.load, 2.6);
    var rF = Ribbon([[3, 4.2, zP + 1.6], [10, 4.2, zP + 1.6], [10, 4.2, 4.5], [24, 4.2, 4.5]], COL.fw, 2.6);

    // ---- camera orbit
    var target = new T.Vector3(opts.tx != null ? opts.tx : -22, 0, -4);
    var orb = { th0: opts.theta != null ? opts.theta : 0.3, th: 0, ph: opts.phi != null ? opts.phi : 0.98, r: opts.r || 132, auto: true, drag: false, lx: 0, ly: 0, idle: 0, t: 0 }; orb.th = orb.th0;
    function dn(ev) { orb.drag = true; orb.auto = false; orb.lx = ev.clientX; orb.ly = ev.clientY; try { canvas.setPointerCapture(ev.pointerId); } catch (x) {} canvas.style.cursor = 'grabbing'; }
    function mv(ev) { if (!orb.drag) return; orb.th -= (ev.clientX - orb.lx) * 0.006; orb.ph = clamp(orb.ph - (ev.clientY - orb.ly) * 0.005, 0.3, 1.38); orb.lx = ev.clientX; orb.ly = ev.clientY; orb.idle = 0; }
    function upf() { orb.drag = false; canvas.style.cursor = 'grab'; }
    function dbl() { orb.th = orb.th0; orb.ph = opts.phi != null ? opts.phi : 0.98; orb.auto = true; }
    canvas.addEventListener('pointerdown', dn); canvas.addEventListener('pointermove', mv); canvas.addEventListener('pointerup', upf); canvas.addEventListener('pointercancel', upf); canvas.addEventListener('dblclick', dbl);

    var cAmber = new T.Color(0xFFB347), cDim = new T.Color(0x2A2016), cUps = new T.Color(0xB48CFF), cOr = new T.Color(0xFF9F43), cBl = new T.Color(0x4DA3FF), cIdle = new T.Color(0x3A4654), cRed = new T.Color(0xFF5D5D);
    var discAng = 0, spin = 0, clock = 0, twistPh = 0;
    function update(v, dt) {
      clock += dt; orb.t += dt;
      if (!orb.drag) { orb.idle += dt; if (orb.idle > 8) orb.auto = true; }
      if (orb.auto) orb.th = orb.th0 + 0.28 * Math.sin(orb.t * 0.07);
      cam.position.setFromSphericalCoords(orb.r, orb.ph, orb.th).add(target); cam.lookAt(target);
      var lvl = clamp(v.gpu, 0, 1.05);
      if (v.ups) ledMat.color.copy(cUps).multiplyScalar(0.4 + 0.6 * lvl); else ledMat.color.copy(cDim).lerp(cAmber, 0.15 + 0.85 * lvl);
      // shaft: steady rotation + exaggerated torsional twist (visual 1.6 Hz, amplitude ∝ modal rms)
      spin += dt * 2.2; twistPh += dt * 2 * Math.PI * 1.6;
      var tw = clamp(v.torR * 40, 0, 0.9), shape = [1, 0.45, -0.35, -0.8];
      shaft.forEach(function (g, i) { g.rotation.x = spin + tw * shape[i] * Math.sin(twistPh); });
      cplMat.emissive.setRGB(clamp(tw * 1.4, 0, 1), 0.05, 0.05);
      // flywheels
      discAng += dt * 9 * v.rpm / 15000;
      for (var i = 0; i < fwPos.length; i++) { e.set(0, discAng + i * 0.37, 0); q.setFromEuler(e); m4.compose(new T.Vector3(fwPos[i][0], 2.5, fwPos[i][1]), q, one); discs.setMatrixAt(i, m4); }
      discs.instanceMatrix.needsUpdate = true;
      var a = clamp(Math.abs(v.pf) / (v.Pmax || 80), 0, 1);
      if (v.pf > 0.5) fwRingMat.color.copy(cIdle).lerp(cOr, 0.35 + 0.65 * Math.sqrt(a)); else if (v.pf < -0.5) fwRingMat.color.copy(cIdle).lerp(cBl, 0.35 + 0.65 * Math.sqrt(a)); else fwRingMat.color.copy(cIdle);
      // fault visuals
      var fl = v.fault ? 0.6 + 0.4 * Math.sin(clock * 60) : 0, fg = v.faultGlow || 0;
      condMat.color.copy(cBl).lerp(cRed, Math.max(fl, fg * 0.6)); ringM.opacity = Math.max(fl * 0.9, fg * 0.3); sagRing.scale.setScalar(1 + (1 - fg) * 0.5);
      pccMat.color.copy(cBl).lerp(cRed, Math.max(fl, fg * 0.5));
      // ribbons
      rG.update(v.rbG, 2.0, clock, 1); rL.update(v.rbL, 2.0, clock, 1); rF.update(v.rbF, 2.0, clock, 1);
    }
    var anchors = { plant: new T.Vector3(-88, 7, zP), grid: new T.Vector3(-39, 17.5, zP), pcc: new T.Vector3(2, 4, zP), halls: new T.Vector3(31.5, 9, hz), fw: new T.Vector3(f0x + 10.5, 4, f0z + 6) };
    function project(v3, ow, oh) { var pp = v3.clone().project(cam); if (pp.z > 1) return null; return [(pp.x + 1) / 2 * ow, (1 - pp.y) / 2 * oh]; }
    function dispose() {
      canvas.removeEventListener('pointerdown', dn); canvas.removeEventListener('pointermove', mv); canvas.removeEventListener('pointerup', upf); canvas.removeEventListener('pointercancel', upf); canvas.removeEventListener('dblclick', dbl);
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (x) {}
    }
    return { update: update, render: function () { renderer.render(scene, cam); }, anchors: anchors, project: project, dispose: dispose };
  }

  // ============================================================ 2D drawing
  var MONO = '"JetBrains Mono", ui-monospace, monospace', SANS = '"Noto Sans TC", system-ui, sans-serif';
  function prep(cv) {
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    if (!cv._css) cv._css = [+cv.getAttribute('width'), +cv.getAttribute('height')];
    if (cv.width !== Math.round(cv._css[0] * dpr)) { cv.width = Math.round(cv._css[0] * dpr); cv.height = Math.round(cv._css[1] * dpr); }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv._css[0], cv._css[1]);
    return { ctx: ctx, w: cv._css[0], h: cv._css[1] };
  }
  function chip(ctx, x, y, title, value, color) {
    ctx.font = '500 12px ' + SANS; var tw = ctx.measureText(title).width; ctx.font = '600 12px ' + MONO; var vw = value ? ctx.measureText(value).width : 0;
    var w = tw + (value ? vw + 18 : 0) + 20, h = 26, bx = Math.round(x - w / 2), by = Math.round(y - 40);
    ctx.strokeStyle = 'rgba(230,234,240,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, by + h); ctx.stroke();
    ctx.fillStyle = 'rgba(10,14,19,0.86)'; ctx.strokeStyle = color || 'rgba(230,234,240,0.25)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 6); else ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#E6EAF0'; ctx.font = '500 12px ' + SANS; ctx.fillText(title, bx + 10, by + h / 2 + 0.5);
    if (value) { ctx.fillStyle = color || '#E6EAF0'; ctx.font = '600 12px ' + MONO; ctx.fillText(value, bx + 10 + tw + 12, by + h / 2 + 0.5); }
    ctx.fillStyle = color || '#E6EAF0'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
  }
  function drawOverlay(cv, sc, v, k) {
    var o = prep(cv), ctx = o.ctx, A = sc.anchors;
    function put(a, t, val, col) { var p = sc.project(a, o.w, o.h); if (p) chip(ctx, p[0], p[1], t, val, col); }
    k = k || {};
    put(A.plant, '汽輪發電機軸系', k.tor != null ? '扭振 ' + Math.round(k.tor) + '%' : '', k.tor > 50 ? COL.red : COL.green);
    put(A.grid, '電網電流 i_grid', Math.round(k.igA || 0) + ' A', COL.grid);
    put(A.pcc, 'PCC', 'V ' + v.V.toFixed(2) + ' pu', v.V < 0.85 ? COL.red : COL.volt);
    put(A.halls, v.ups ? 'AIDC · UPS 轉供' : 'AIDC 負載', (v.pl).toFixed(1) + ' MW', v.ups ? COL.bat : COL.load);
    put(A.fw, '飛輪 i_fw', (v.pf >= 0 ? '+' : '') + v.pf.toFixed(1) + ' MW', COL.fw);
  }
  function niceTicks(min, max, n) { var span = max - min, st = Math.pow(10, Math.floor(Math.log10(span / n))), er = span / n / st; if (er >= 7.5) st *= 10; else if (er >= 3.5) st *= 5; else if (er >= 1.5) st *= 2; var t = [], v = Math.ceil(min / st) * st; for (; v <= max + 1e-9; v += st) t.push(+v.toFixed(6)); return t; }
  function drawChart(cv, ch, tNow) {
    var o = prep(cv), ctx = o.ctx, W = o.w, H = o.h, L = 58, Rr = 12, top = 4, bot = 22, gap = 12;
    var pw = W - L - Rr, avail = H - top - bot - gap * (ch.lanes.length - 1), y = top;
    var X = function (age) { return L + pw - age / ch.window * pw; };
    ch.lanes.forEach(function (ln) {
      var lh = avail * ln.w, Y = function (v) { return y + lh - (clamp(v, ln.min, ln.max) - ln.min) / (ln.max - ln.min) * lh; };
      ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(L, y, pw, lh);
      ctx.font = '11px ' + MONO; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      niceTicks(ln.min, ln.max, Math.max(2, Math.round(lh / 30))).forEach(function (t) { var yy = Math.round(Y(t)) + 0.5; ctx.strokeStyle = t === 0 ? 'rgba(230,234,240,0.25)' : 'rgba(230,234,240,0.07)'; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + pw, yy); ctx.stroke(); ctx.fillStyle = '#8C99A8'; ctx.fillText(String(t), L - 8, yy); });
      if (ln.hl) ln.hl().forEach(function (hv) { var yy = Math.round(Y(hv)) + 0.5; ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,93,93,0.7)'; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + pw, yy); ctx.stroke(); ctx.setLineDash([]); });
      ctx.save(); ctx.beginPath(); ctx.rect(L, y - 1, pw, lh + 2); ctx.clip();
      ln.series.forEach(function (s) {
        var r = s.ring, n = r.len, pen = false; ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.4; ctx.lineJoin = 'round'; ctx.beginPath();
        for (var k = 0; k < n; k++) { var age = (n - 1 - k) * ch.dt; if (age > ch.window) continue; var v = r.at(k); if (v !== v) { pen = false; continue; } var xx = X(age), yy = Y(v); if (pen) ctx.lineTo(xx, yy); else { ctx.moveTo(xx, yy); pen = true; } }
        ctx.stroke();
      });
      ctx.restore();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '600 11px ' + SANS; var lx = L + 8;
      var ttl = ln.title + ' (' + ln.unit + ')'; ctx.fillStyle = 'rgba(10,14,19,0.75)'; ctx.fillRect(lx - 4, y + 2, ctx.measureText(ttl).width + 8, 16); ctx.fillStyle = '#C9D2DC'; ctx.fillText(ttl, lx, y + 4); lx += ctx.measureText(ttl).width + 16;
      ctx.font = '11px ' + SANS; ln.series.forEach(function (s) { if (!s.label) return; ctx.fillStyle = s.color; ctx.fillRect(lx, y + 9, 12, 2.5); ctx.fillStyle = '#C9D2DC'; ctx.fillText(s.label, lx + 17, y + 4); lx += ctx.measureText(s.label).width + 32; });
      y += lh + gap;
    });
    ctx.font = '11px ' + MONO; ctx.fillStyle = '#8C99A8'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    niceTicks(0, ch.window, 6).forEach(function (t) { ctx.fillText(t === 0 ? '現在' : '−' + t + ' s', X(t), H - bot + 6); });
    (ch.marks || []).forEach(function (m) { var age = tNow - m.t; if (age < 0 || age > ch.window) return; var xx = Math.round(X(age)) + 0.5; ctx.strokeStyle = 'rgba(255,93,93,0.55)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, H - bot); ctx.stroke(); ctx.setLineDash([]); ctx.save(); ctx.font = '600 11px ' + SANS; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; var tw = ctx.measureText(m.label).width, lx2 = Math.min(xx + 4, L + pw - tw - 4); ctx.fillStyle = 'rgba(10,14,19,0.85)'; ctx.fillRect(lx2 - 3, H - bot - 18, tw + 6, 16); ctx.fillStyle = '#FF8A8A'; ctx.fillText(m.label, lx2, H - bot - 4); ctx.restore(); });
  }
  // stator-current spectrum around 60 Hz (dBc), built from the current envelope: AM → sidebands at 60 ± f
  function drawSpectrum(cv, sp) {
    var o = prep(cv), ctx = o.ctx, W = o.w, H = o.h, L = 46, Rr = 10, top = 44, bot = 34, pw = W - L - Rr, ph = H - top - bot;
    var X = function (f) { return L + (f - 20) / 80 * pw; }, Y = function (db) { return top + (-clamp(db, -90, 0)) / 90 * ph; };
    ctx.fillStyle = 'rgba(255,93,93,0.08)'; ctx.fillRect(X(40), top, X(80) - X(40), ph);
    [[48, '60−12'], [72, '60+12']].forEach(function (a) { var xx = Math.round(X(a[0])) + 0.5; ctx.strokeStyle = 'rgba(255,93,93,0.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, top + ph); ctx.stroke(); ctx.setLineDash([]); });
    ctx.font = '11px ' + MONO; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    [0, -20, -40, -60, -80].forEach(function (d) { var yy = Math.round(Y(d)) + 0.5; ctx.strokeStyle = 'rgba(230,234,240,0.07)'; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + pw, yy); ctx.stroke(); ctx.fillStyle = '#8C99A8'; ctx.fillText(String(d), L - 6, yy); });
    function bars(arr, color, w) { if (!arr) return; ctx.fillStyle = color; sp.fr.forEach(function (f, i) { var yy = Y(arr[i]); [60 - f, 60 + f].forEach(function (ff) { if (ff < 20 || ff > 100) return; ctx.fillRect(X(ff) - w / 2, yy, w, top + ph - yy); }); }); }
    bars(sp.load, 'rgba(230,234,240,0.35)', 2.4); bars(sp.grid, COL.grid, 1.4);
    ctx.fillStyle = '#E6EAF0'; ctx.fillRect(X(60) - 1.5, Y(0), 3, ph);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#8C99A8'; [20, 40, 60, 80, 100].forEach(function (f) { ctx.fillText(String(f), X(f), top + ph + 6); }); ctx.fillText('Hz', L + pw - 8, top + ph + 19);
    ctx.textAlign = 'left'; ctx.font = '11px ' + SANS; ctx.fillStyle = 'rgba(230,234,240,0.6)'; ctx.fillRect(L, 8, 10, 10); ctx.fillStyle = '#C9D2DC'; ctx.fillText('負載電流', L + 15, 7);
    ctx.fillStyle = COL.grid; ctx.fillRect(L + 80, 8, 10, 10); ctx.fillStyle = '#C9D2DC'; ctx.fillText('電網電流', L + 95, 7);
    ctx.fillStyle = '#FF8A8A'; ctx.textAlign = 'left'; ctx.fillText('虛線 60±12 Hz＝軸系模態耦合點', L, 25);
    ctx.save(); ctx.translate(12, top + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = '#8C99A8'; ctx.fillText('dBc', 0, 0); ctx.restore();
  }
  // LVRT window: V and P/Ppre vs time since fault, with ride-through boundary and 90 %-in-1 s check
  function drawLvrt(cv, lv) {
    var o = prep(cv), ctx = o.ctx, W = o.w, H = o.h, L = 40, Rr = 10, top = 28, bot = 32, pw = W - L - Rr, ph = H - top - bot, TM = 3.5;
    var X = function (t) { return L + t / TM * pw; }, Y = function (v) { return top + ph - clamp(v, 0, 1.25) / 1.25 * ph; };
    var bnd = [[0, 0], [0.15, 0], [0.15, 0.2], [0.25, 0.2], [0.25, 0.5], [0.5, 0.5], [0.5, 0.8], [2.0, 0.8], [2.0, 0.9], [TM, 0.9]];
    ctx.fillStyle = 'rgba(255,93,93,0.10)'; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); bnd.forEach(function (p) { ctx.lineTo(X(p[0]), Y(p[1])); }); ctx.lineTo(X(TM), Y(0)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,93,93,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); bnd.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); }); ctx.stroke();
    ctx.font = '11px ' + MONO; ctx.fillStyle = '#8C99A8'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    [0, 0.5, 0.9, 1.2].forEach(function (v) { var yy = Math.round(Y(v)) + 0.5; ctx.strokeStyle = 'rgba(230,234,240,0.07)'; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + pw, yy); ctx.stroke(); ctx.fillText(v.toFixed(1), L - 6, yy); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; [0, 1, 2, 3].forEach(function (t) { ctx.fillText(t + ' s', X(t), top + ph + 6); });
    function line(arr, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); for (var i = 0; i < lv.n; i++) { var xx = X(i * 0.005), yy = Y(arr[i]); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); }
    if (lv.n) { line(lv.V, COL.volt, 1.8); line(lv.P, COL.grid, 2.2); }
    if (lv.tv >= 0) {
      var t1 = lv.tv + 1, xx = Math.round(X(t1)) + 0.5; ctx.strokeStyle = 'rgba(230,234,240,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(Math.round(X(lv.tv)) + 0.5, top); ctx.lineTo(Math.round(X(lv.tv)) + 0.5, top + ph); ctx.moveTo(xx, top); ctx.lineTo(xx, top + ph); ctx.stroke(); ctx.setLineDash([]);
      var idx = Math.min(lv.n - 1, Math.round(t1 / 0.005)), pv = idx >= 0 ? lv.P[idx] : 0, ok = lv.rec != null && lv.rec <= 1;
      if (idx < lv.n && lv.n > 0) { ctx.fillStyle = ok ? COL.green : COL.red; ctx.beginPath(); ctx.arc(xx, Y(pv), 5, 0, 7); ctx.fill(); }
      ctx.strokeStyle = ok ? COL.green : COL.red; ctx.beginPath(); ctx.moveTo(xx - 18, Y(0.9)); ctx.lineTo(xx + 18, Y(0.9)); ctx.stroke();
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '11px ' + SANS;
    ctx.fillStyle = COL.volt; ctx.fillRect(L, 10, 10, 3); ctx.fillStyle = '#C9D2DC'; ctx.fillText('V (pu)', L + 14, 5);
    ctx.fillStyle = COL.grid; ctx.fillRect(L + 66, 10, 10, 3); ctx.fillStyle = '#C9D2DC'; ctx.fillText('P / P_pre', L + 80, 5);
    ctx.fillStyle = '#FF8A8A'; ctx.textAlign = 'right'; ctx.fillText('紅區＝允許跳脫', W - Rr, 5);
    if (!lv.n) { ctx.textAlign = 'center'; ctx.fillStyle = '#8C99A8'; ctx.font = '12px ' + SANS; ctx.fillText('等待故障事件…', L + pw / 2, top + ph / 2); }
  }

  // ---------------------------------------------------------------- mount
  function mount(kind, els, onKpi, o) {
    var sim = makeRun(kind, o);
    var sc = buildScene(els.view, Object.assign({ w: +els.view.getAttribute('width'), h: +els.view.getAttribute('height') }, kind === 'ramp' ? { theta: 0.42, tx: -18 } : {}));
    var raf = 0, alive = true, last = 0, kT = 1, sT = 1, spec = null, paused = false, kpi = null;
    function frame(now) {
      if (!alive) return;
      var dtR = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      if (!paused) { var simDt = dtR * sim.speed, n = Math.max(1, Math.ceil(simDt / sim.h)), h = simDt / n; for (var i = 0; i < n; i++) sim.step(h); }
      kT += dtR; if (kT > 0.25 || !kpi) { kT = 0; kpi = sim.kpi(); try { onKpi(kpi); } catch (x) {} }
      var v = sim.view(); sc.update(v, paused ? 0 : dtR); sc.render();
      if (els.overlay) drawOverlay(els.overlay, sc, v, kpi);
      if (els.chart) drawChart(els.chart, sim.chart, sim.t);
      if (els.spec && sim.spectrum) { sT += dtR; if (sT > 0.5) { sT = 0; spec = sim.spectrum(); } if (spec) drawSpectrum(els.spec, spec); }
      if (els.lvrt) drawLvrt(els.lvrt, sim.lvrt);
      raf = root.requestAnimationFrame(frame);
    }
    raf = root.requestAnimationFrame(frame);
    return { sim: sim, setMode: function (m) { sim.setMode(m); }, trigger: function (w) { sim.trigger(w); }, set: function (k, v) { sim.set(k, v); }, setSpeed: function (s) { sim.speed = s; }, setPaused: function (p) { paused = p; }, destroy: function () { alive = false; root.cancelAnimationFrame(raf); sc.dispose(); } };
  }

  var API = { makeRun: makeRun, mount: mount, IB: IB };
  root.AIDCRipple = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
