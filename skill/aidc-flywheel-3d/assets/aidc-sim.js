/* AIDC x Flywheel — shared simulation engine for the scenario artboards.
 * Part A: plant + control models (pure JS, runs headless in Node too).
 * Part B: three.js campus scene, overlay labels, charts, mount().
 * All plant parameters are illustrative (示意參數), not vendor data. */
(function (root) {
  'use strict';

  var COL = {
    bg: '#0A0E13', text: '#E6EAF0', muted: '#8C99A8', faint: '#2A3644',
    load: '#E6EAF0', grid: '#4DA3FF', fw: '#FF9F43', bat: '#B48CFF',
    red: '#FF5D5D', green: '#3DDC97', volt: '#7FE3D0'
  };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // ---------------------------------------------------------------- Ring
  function Ring(n) { this.n = n; this.a = new Float32Array(n); this.i = 0; this.len = 0; }
  Ring.prototype.push = function (v) { this.a[this.i] = v; this.i = (this.i + 1) % this.n; if (this.len < this.n) this.len++; };
  Ring.prototype.at = function (k) { var s = (this.i - this.len + this.n) % this.n; return this.a[(s + k) % this.n]; };
  Ring.prototype.last = function () { return this.len ? this.a[(this.i - 1 + this.n) % this.n] : 0; };
  Ring.prototype.range = function (m) {
    m = Math.min(m || this.len, this.len); var lo = Infinity, hi = -Infinity;
    for (var k = this.len - m; k < this.len; k++) { var v = this.at(k); if (v < lo) lo = v; if (v > hi) hi = v; }
    return m ? [lo, hi] : [0, 0];
  };
  Ring.prototype.maxSlope = function (m, lag, dt) {
    m = Math.min(m, this.len); var best = 0;
    for (var k = this.len - m + lag; k < this.len; k++) {
      if (k - lag < 0) continue;
      var s = Math.abs(this.at(k) - this.at(k - lag)) / (lag * dt); if (s > best) best = s;
    }
    return best;
  };

  // ------------------------------------------------- GPU training load
  // P = base (cooling, CPU, network) + gpuPeak * gpu, gpu ∈ [0,1]
  function LoadModel(p) {
    p = Object.assign({ base: 15, gpuPeak: 85, comm: 0.22, idle: 0.12, ckpt: 0.25, Titer: 1.4, duty: 0.64, tau: 0.012, jitter: 0.05, noise: 0.015, seed: 7 }, p || {});
    var r = rng(p.seed);
    var st = { job: 'train', ph: 0, T: p.Titer, gpu: 1, P: p.base + p.gpuPeak, nz: 0 };
    function step(dt) {
      var tgt;
      if (st.job === 'off') tgt = p.idle;
      else if (st.job === 'ckpt') tgt = p.ckpt;
      else {
        st.ph += dt / st.T;
        if (st.ph >= 1) { st.ph -= 1; st.T = p.Titer * (1 + p.jitter * (2 * r() - 1)); }
        tgt = st.ph < p.duty ? 1 : p.comm;
      }
      st.nz += ((r() - 0.5) - st.nz) * Math.min(1, dt / 0.05);
      st.gpu += (tgt - st.gpu) * Math.min(1, dt / p.tau);
      st.P = p.base + p.gpuPeak * clamp(st.gpu + p.noise * st.nz, 0, 1.05);
      return st.P;
    }
    return { p: p, st: st, step: step, set: function (j) { st.job = j; if (j === 'train') st.ph = 0; } };
  }

  // ------------------------------------------------ Flywheel aggregate
  // E = ½Jω²; usable window rpmMin..rpmMax. Pmax MW, Euse MWh.
  function Flywheel(p) {
    p = Object.assign({ units: 160, Pmax: 80, Euse: 0.8, rpmMax: 15000, rpmMin: 7500, eta: 0.955, standby: 0.01, tau: 0.002, soe0: 0.5 }, p || {});
    var k = Math.pow(p.rpmMin / p.rpmMax, 2);
    var Emax = p.Euse * 3600 / (1 - k), Emin = Emax * k; // MJ
    var st = { E: Emin + p.soe0 * (Emax - Emin), P: 0, soe: p.soe0, rpm: 0, Eout: 0, Ein: 0, loss: 0, flips: 0, lastSign: 0 };
    function lim() {
      var b = 0.05;
      return { dis: p.Pmax * clamp(st.soe / b, 0, 1), chg: p.Pmax * clamp((1 - st.soe) / b, 0, 1) };
    }
    function step(dt, Pref) {
      var L = lim(), r = clamp(Pref, -L.chg, L.dis);
      st.P += (r - st.P) * Math.min(1, dt / p.tau);
      var Pm = st.P > 0 ? st.P / p.eta : st.P * p.eta;          // MW at rotor
      var sb = p.standby * st.E / 3600;                          // MW standby loss (≈1 %/h)
      st.E = clamp(st.E - (Pm + sb) * dt, Emin * 0.99, Emax * 1.001);
      st.soe = (st.E - Emin) / (Emax - Emin);
      st.rpm = p.rpmMax * Math.sqrt(st.E / Emax);
      if (st.P > 0) st.Eout += st.P * dt; else st.Ein -= st.P * dt;
      st.loss += (Math.abs(Pm - st.P) + sb) * dt;
      var sg = st.P > 0.5 ? 1 : st.P < -0.5 ? -1 : 0;
      if (sg && sg !== st.lastSign) { st.flips++; st.lastSign = sg; }
      return st.P;
    }
    return { p: p, st: st, step: step, lim: lim, Emax: Emax, Emin: Emin };
  }

  // -------------------------------- L1 controller: smoothing + ramp limit + SoE recovery
  // P_grid* = RateLimit( LPF2(P_load) + Ksoe·(SoE* − SoE)·Pmax ),  P_fw* = P_load − P_grid*
  function SmoothCtl(p) {
    p = Object.assign({ tau1: 2.5, tau2: 2.5, ramp: 2, ksoe: 0.25, soeRef: 0.5 }, p || {});
    var st = { l1: null, l2: null, ref: null, soeRef: p.soeRef };
    function step(dt, Pl, soe, Pmax) {
      if (st.l1 === null) { st.l1 = st.l2 = st.ref = Pl; }
      st.l1 += (Pl - st.l1) * dt / p.tau1;
      st.l2 += (st.l1 - st.l2) * dt / p.tau2;
      var tgt = st.l2 + p.ksoe * (st.soeRef - soe) * Pmax;
      st.ref += clamp(tgt - st.ref, -p.ramp * dt, p.ramp * dt);
      return st.ref;
    }
    return { p: p, st: st, step: step, reset: function (v) { st.l1 = st.l2 = st.ref = v; } };
  }

  // --------------------------------- Area frequency (swing eq. + droop governor)
  function GridArea(p) {
    p = Object.assign({ S: 40000, H: 4.5, R: 0.05, tg: 4, D: 1, f0: 60 }, p || {});
    var st = { df: 0, pm: 0, f: p.f0, rocof: 0 };
    function step(dt, dPload) {
      var acc = ((st.pm - dPload) / p.S - p.D * st.df) / (2 * p.H);
      st.df += acc * dt;
      st.pm += (-st.df / p.R * p.S - st.pm) * dt / p.tg;
      st.f = p.f0 * (1 + st.df); st.rocof = acc * p.f0;
      return st.f - p.f0;
    }
    return { p: p, st: st, step: step };
  }

  // ======================================================= Scenario runs

  // ---- S1: synchronous training swing, none vs flywheel smoothing
  function runS1(o) {
    o = o || {};
    var load = LoadModel(Object.assign({ seed: 11 }, o.load)), fw = Flywheel(o.fw), ctl = SmoothCtl({ ramp: o.ramp || 2 });
    var R = { kind: 's1', h: 0.001, speed: 1, mode: o.mode || 'fw', t: 0, load: load, fw: fw, ctl: ctl };
    var rl = new Ring(500), rg = new Ring(500), rf = new Ring(500), sl = new Ring(512), sg = new Ring(512);
    var a1 = 0, a2 = 0, lpL = null, lpG = null, msL = 0, msG = 0, sumL = 0, sumG = 0;
    var cur = { pl: 0, pg: 0, pf: 0 };
    R.step = function (dt) {
      R.t += dt;
      var pl = load.step(dt), ref = ctl.step(dt, pl, fw.st.soe, fw.p.Pmax);
      var pf = fw.step(dt, R.mode === 'fw' ? pl - ref : 0), pg = pl - pf;
      cur.pl = pl; cur.pg = pg; cur.pf = pf;
      if (lpL === null) { lpL = pl; lpG = pg; }
      var a = dt / 1.6, b = dt / 8;
      lpL += (pl - lpL) * a; lpG += (pg - lpG) * a;
      msL += ((pl - lpL) * (pl - lpL) - msL) * b; msG += ((pg - lpG) * (pg - lpG) - msG) * b;
      a1 += dt; if (a1 >= 0.02) { a1 -= 0.02; rl.push(pl); rg.push(pg); rf.push(pf); }
      a2 += dt; sumL += pl * dt; sumG += pg * dt;
      if (a2 >= 0.05) { sl.push(sumL / a2); sg.push(sumG / a2); a2 = 0; sumL = 0; sumG = 0; }
    };
    R.setMode = function (m) { R.mode = m; };
    R.kpi = function () {
      var gl = sl.range(200), gg = sg.range(200);
      var rmsL = Math.sqrt(msL), rmsG = Math.sqrt(msG);
      return {
        mode: R.mode, pl: cur.pl, pg: cur.pg, pf: cur.pf, soe: fw.st.soe, rpm: fw.st.rpm,
        ptpL: gl[1] - gl[0], ptpG: gg[1] - gg[0], rmsL: rmsL, rmsG: rmsG,
        att: rmsG > 1e-4 ? 20 * Math.log10(rmsL / rmsG) : 99,
        rampL: sl.maxSlope(200, 2, 0.05), rampG: sg.maxSlope(200, 2, 0.05)
      };
    };
    R.view = function () { return { pl: cur.pl, pg: cur.pg, pf: cur.pf, gpu: load.st.gpu, soe: fw.st.soe, rpm: fw.st.rpm, Pmax: fw.p.Pmax }; };
    R.chart = {
      window: 10, dt: 0.02,
      lanes: [
        { w: 0.64, min: 0, max: 110, unit: 'MW', title: '功率', series: [
          { ring: rl, color: COL.load, width: 1.2, label: 'AIDC 負載' },
          { ring: rg, color: COL.grid, width: 2.4, label: '電網側' }] },
        { w: 0.36, min: -70, max: 70, unit: 'MW', title: '飛輪', zero: true, series: [
          { ring: rf, color: COL.fw, width: 1.6, label: '飛輪 (+放電 / −充電)' }] }
      ]
    };
    var freqs = []; for (var i = 0; i < 44; i++) freqs.push(0.05 * Math.pow(8 / 0.05, i / 43));
    R.spectrum = function () { return { freqs: freqs, load: dft(sl, 20, freqs), grid: dft(sg, 20, freqs) }; };
    return R;
  }

  function dft(ring, fs, freqs) {
    var N = ring.len; if (N < 128) return null;
    var x = new Float32Array(N), mean = 0, k;
    for (k = 0; k < N; k++) { x[k] = ring.at(k); mean += x[k]; } mean /= N;
    for (k = 0; k < N; k++) x[k] = (x[k] - mean) * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (N - 1)));
    var out = new Float32Array(freqs.length);
    for (var j = 0; j < freqs.length; j++) {
      var w = 2 * Math.PI * freqs[j] / fs, re = 0, im = 0;
      for (k = 0; k < N; k++) { re += x[k] * Math.cos(w * k); im -= x[k] * Math.sin(w * k); }
      out[j] = 4 * Math.sqrt(re * re + im * im) / N; // hann-corrected amplitude (MW)
    }
    return out;
  }

  // ---- S2: 230 kV fault + auto-reclose; legacy UPS transfer vs flywheel ride-through
  function runS2(o) {
    o = o || {};
    var N = o.N || 15;
    var fw = Flywheel(o.fw), area = GridArea(o.area), r = rng(5);
    var R = { kind: 's2', h: 0.0005, speed: o.speed || 0.25, mode: o.mode || 'fw', t: 0, N: N, fw: fw };
    var st = { V: 1, ev: -1, ups: false, cnt: 0, pg: 80, pgRef: 80, pl: 80, pf: 0, q: 0, nz: 0, reconnect: -1, evE: 0, peakDf: 0, peakLoss: 0, crash: false, nextAuto: 1.0 };
    var rv = new Ring(750), rg = new Ring(750), rf = new Ring(750), rl = new Ring(750), rd = new Ring(750), rq = new Ring(750), acc = 0;
    var marks = [];
    function vProfile(tt) {
      if (tt < 0) return 1;
      if (tt < 0.15) return 0.25;
      if (tt < 1.15) return 0.97;
      if (tt < 1.30) return 0.22;
      if (tt < 3.0) return lerp(0.97, 1.0, (tt - 1.3) / 1.7);
      return 1;
    }
    R.trigger = function () {
      if (st.ev >= 0 && R.t - st.ev < 9) return;
      st.ev = R.t; st.evE = 0; st.peakDf = 0; st.peakLoss = 0; st.crash = false;
      marks.push({ t: R.t, label: '230 kV 故障' }, { t: R.t + 1.15, label: '重合閘失敗' });
    };
    R.setMode = function (m) { R.mode = m; st.ups = false; st.cnt = 0; st.reconnect = -1; };
    R.step = function (dt) {
      R.t += dt;
      if (R.t >= st.nextAuto) { st.nextAuto = R.t + 10; R.trigger(); }
      var tt = st.ev >= 0 ? R.t - st.ev : -1;
      st.V = vProfile(tt);
      st.nz += ((r() - 0.5) - st.nz) * Math.min(1, dt / 0.08);
      st.pl = 80 + 2.5 * st.nz;
      var sag = st.V < 0.85, pgT, pfRef = 0;
      if (R.mode === 'ups') {
        st.cnt = sag ? st.cnt + dt : 0;
        if (!st.ups && st.cnt > 0.004) { st.ups = true; st.reconnect = R.t + 6; st.crash = true; marks.push({ t: R.t, label: 'UPS 轉供 · 負載脫網' }); }
        if (st.ups && st.reconnect > 0 && R.t >= st.reconnect) { st.ups = false; st.reconnect = -1; marks.push({ t: R.t, label: '人工復歸（實際可能數小時）' }); }
        pgT = st.ups ? 0 : st.pl * (sag ? st.V / 0.9 : 1);
        st.pg += (pgT - st.pg) * Math.min(1, dt / 0.006);
        st.q = 0;
        fw.step(dt, 0); st.pf = 0;
      } else {
        var cap = st.pl * clamp(st.V / 0.9, 0, 1);
        if (sag) st.pgRef = Math.min(st.pgRef, cap);
        else st.pgRef = Math.min(st.pl, st.pgRef + 60 * dt);   // controlled re-pickup 60 MW/s
        pfRef = st.pl - st.pgRef;
        st.pf = fw.step(dt, pfRef);
        st.pg = st.pl - st.pf;
        st.q = sag ? clamp(2 * (0.9 - st.V), 0, 1) * fw.p.Pmax : 0;
        if (st.pf > 0) st.evE += st.pf * dt;
      }
      var df = area.step(dt, N * (st.pg - 80));
      if (tt >= 0 && tt < 9) {
        st.peakDf = Math.max(st.peakDf, Math.abs(df));
        if (tt > 2.5) st.peakLoss = Math.max(st.peakLoss, N * (st.pl - st.pg)); // sustained loss after 2nd clearance
      }
      acc += dt; if (acc >= 0.004) { acc -= 0.004; rv.push(st.V); rg.push(st.pg); rf.push(st.pf); rl.push(st.pl); rd.push(df); rq.push(st.q); }
      while (marks.length && marks[0].t < R.t - 20) marks.shift();
    };
    R.kpi = function () {
      return { mode: R.mode, V: st.V, pg: st.pg, pf: st.pf, pl: st.pl, q: st.q, ups: st.ups, df: area.st.f - 60, peakDf: st.peakDf, peakLoss: st.peakLoss, evE: st.evE * 1000 / 3600, soe: fw.st.soe, rpm: fw.st.rpm, crash: st.crash, N: N };
    };
    R.view = function () {
      var tt = st.ev >= 0 ? R.t - st.ev : -1;
      return { pl: st.pl, pg: st.pg, pf: st.pf, gpu: st.pl / 100, soe: fw.st.soe, rpm: fw.st.rpm, Pmax: fw.p.Pmax, fault: st.V < 0.85 ? 1 : 0, faultGlow: tt >= 0 && tt < 3 ? Math.max(0, 1 - tt / 3) : 0, ups: st.ups, V: st.V, q: st.q };
    };
    R.chart = {
      window: 3, dt: 0.004, marks: marks,
      lanes: [
        { w: 0.26, min: 0, max: 1.15, unit: 'pu', title: '電壓', fmt: 1, series: [{ ring: rv, color: COL.volt, width: 1.8, label: '併接點電壓' }], hlines: [{ y: 0.85, label: '0.85 pu' }] },
        { w: 0.46, min: -10, max: 110, unit: 'MW', title: '功率 (單座)', series: [
          { ring: rl, color: COL.load, width: 1.2, label: 'AIDC 負載' },
          { ring: rg, color: COL.grid, width: 2.4, label: '電網側' },
          { ring: rf, color: COL.fw, width: 1.8, label: '飛輪' }] },
        { w: 0.28, min: -0.05, max: 0.3, unit: 'Hz', title: 'Δf (×' + N + ' 座)', fmt: 2, zero: true, series: [{ ring: rd, color: COL.red, width: 1.8, label: '區域頻率偏差' }] }
      ]
    };
    return R;
  }

  // ---- S3: job start / checkpoint / crash with ramp-rate limit; none vs GPU burn vs flywheel
  function runS3(o) {
    o = o || {};
    var load = LoadModel(Object.assign({ seed: 23 }, o.load)), fw = Flywheel(o.fw), ctl = SmoothCtl({ ramp: o.ramp || 2 });
    var R = { kind: 's3', h: 0.001, speed: o.speed || 2, mode: o.mode || 'fw', t: 0, ff: o.ff !== false, ramp: o.ramp || 2 };
    var script = [{ t: 0, ev: 'off', label: '' }, { t: 8, ev: 'train', label: '作業啟動' }, { t: 34, ev: 'ckpt', label: 'Checkpoint 寫入' }, { t: 44, ev: 'train', label: '恢復訓練' }, { t: 64, ev: 'off', label: '作業異常中止' }];
    var cycle = 78, si = 0, phaseJob = 'off';
    load.set('off'); load.st.gpu = load.p.idle;
    var pgB = null, cum = { waste: 0, throttle: 0, loadE: 0, viol: 0, fwLoss0: 0 };
    var rl = new Ring(600), rg = new Ring(600), rs = new Ring(600), sg = new Ring(1200), acc = 0, acc2 = 0, sumG = 0, marks = [];
    var cur = { pl: 0, pg: 0, pf: 0 };
    R.set = function (k, v) { if (k === 'ramp') { R.ramp = v; ctl.p.ramp = v; } if (k === 'ff') R.ff = v; };
    R.setMode = function (m) { R.mode = m; pgB = null; cum.waste = cum.throttle = cum.loadE = cum.viol = 0; cum.fwLoss0 = fw.st.loss; cum.t0 = R.t; };
    cum.t0 = 0;
    R.step = function (dt) {
      R.t += dt;
      var tc = R.t % cycle;
      if (tc < dt * 1.5) si = 0;
      while (si < script.length && tc >= script[si].t) {
        phaseJob = script[si].ev; load.set(phaseJob);
        if (script[si].label) marks.push({ t: R.t, label: script[si].label });
        si++;
      }
      var pl = load.step(dt), pg, pf = 0;
      ctl.st.soeRef = R.ff ? (phaseJob === 'off' ? 0.85 : 0.4) : 0.5;
      var ref = ctl.step(dt, pl, fw.st.soe, fw.p.Pmax);
      if (R.mode === 'fw') { pf = fw.step(dt, pl - ref); pg = pl - pf; }
      else if (R.mode === 'burn') {
        fw.step(dt, 0);
        if (pgB === null) pgB = pl;
        var active = phaseJob !== 'off';
        var want = active ? Math.max(pl, load.p.base + load.p.gpuPeak * 0.9) : pl;
        pgB += clamp(want - pgB, -R.ramp * dt, R.ramp * dt);
        if (!active && pgB < pl) pgB = pl;
        pg = pgB;
        if (pg > pl) cum.waste += (pg - pl) * dt; else cum.throttle += (pl - pg) * dt;
      } else { fw.step(dt, 0); pg = pl; }
      cum.loadE += pl * dt;
      cur.pl = pl; cur.pg = pg; cur.pf = pf;
      acc += dt; if (acc >= 0.1) { acc -= 0.1; rl.push(pl); rg.push(pg); rs.push(fw.st.soe * 100); }
      acc2 += dt; sumG += pg * dt; if (acc2 >= 0.05) {
        sg.push(sumG / acc2); acc2 = 0; sumG = 0;
        if (sg.len > 2) { var sl = Math.abs(sg.at(sg.len - 1) - sg.at(sg.len - 3)) / 0.1; if (sl > R.ramp * 1.25) cum.viol += 0.05; }
      }
      while (marks.length && marks[0].t < R.t - 70) marks.shift();
    };
    R.kpi = function () {
      var hrs = Math.max(1e-6, (R.t - cum.t0) / 3600), s = rs.range(600);
      return {
        mode: R.mode, ff: R.ff, ramp: R.ramp, pl: cur.pl, pg: cur.pg, pf: cur.pf, soe: fw.st.soe, rpm: fw.st.rpm,
        rampG: sg.maxSlope(1200, 2, 0.05), viol: cum.viol, wasteMWh: cum.waste / 3600, throttleMWh: cum.throttle / 3600,
        wastePct: cum.loadE > 0 ? 100 * cum.waste / cum.loadE : 0, fwLossPct: cum.loadE > 0 ? 100 * (fw.st.loss - cum.fwLoss0) / cum.loadE : 0,
        soeMin: s[0], soeMax: s[1], job: phaseJob, elapsed: R.t - cum.t0
      };
    };
    R.view = function () { return { pl: cur.pl, pg: cur.pg, pf: cur.pf, gpu: load.st.gpu, soe: fw.st.soe, rpm: fw.st.rpm, Pmax: fw.p.Pmax, burn: R.mode === 'burn' && cur.pg > cur.pl + 1 }; };
    R.chart = {
      window: 60, dt: 0.1, marks: marks,
      lanes: [
        { w: 0.66, min: 0, max: 110, unit: 'MW', title: '功率', series: [
          { ring: rl, color: COL.load, width: 1.1, label: 'AIDC 需求' },
          { ring: rg, color: COL.grid, width: 2.4, label: '電網側' }] },
        { w: 0.34, min: 0, max: 100, unit: '%', title: '飛輪 SoE', series: [{ ring: rs, color: COL.fw, width: 2, label: 'SoE' }] }
      ]
    };
    return R;
  }

  // ---- Lifecycle: same duty on LFP vs flywheel, 20-year view
  function dutyFromS1(seconds) {
    var R = runS1({ mode: 'fw' }); var dt = 0.001, n = Math.round(seconds / dt);
    for (var i = 0; i < 2000; i++) R.step(dt); // settle
    var e0 = R.fw.st.Eout, i0 = R.fw.st.Ein, f0 = R.fw.st.flips;
    for (i = 0; i < n; i++) R.step(dt);
    var hr = seconds / 3600;
    return { dischargeMWhPerH: (R.fw.st.Eout - e0) / 3600 / hr, chargeMWhPerH: (R.fw.st.Ein - i0) / 3600 / hr, flipsPerH: (R.fw.st.flips - f0) / hr };
  }
  function lifecycle(o) {
    o = Object.assign({ years: 20, batMWh: 20, efcRated: 6000, kdod: 0.5, cal: 0.015, eol: 0.8, rteBat: 0.92, rteFw: 0.955 * 0.955, fwStandbyMW: 0.0067, util: 0.8 }, o || {});
    var d = o.duty || dutyFromS1(120);
    var hYear = 8760 * o.util;
    var dis = d.dischargeMWhPerH * hYear;                 // MWh discharged / yr
    var efcYear = dis / o.batMWh;                         // equivalent full cycles / yr
    var bat = [], fwS = [], lossB = [], lossF = [], swaps = [];
    var soh = 1, lb = 0, lf = 0, steps = o.years * 12;
    for (var m = 0; m <= steps; m++) {
      var y = m / 12;
      bat.push([y, soh * 100]); fwS.push([y, 100]); lossB.push([y, lb]); lossF.push([y, lf]);
      soh -= 0.2 * (efcYear / 12) * o.kdod / o.efcRated + o.cal / 12;
      if (soh <= o.eol) { swaps.push(y + 1 / 12); soh = 1; }
      lb += dis / 12 * (1 / o.rteBat - 1);
      lf += dis / 12 * (1 / o.rteFw - 1) + o.fwStandbyMW * 8760 / 12;
    }
    return { o: o, duty: d, efcYear: efcYear, fwCyclesYear: d.flipsPerH / 2 * hYear, disYear: dis, bat: bat, fw: fwS, lossB: lossB, lossF: lossF, swaps: swaps,
      batLife: efcYear > 0 ? (1 - o.eol) / (0.2 * efcYear * o.kdod / o.efcRated + o.cal) : 99 };
  }
  function runS4(o) {
    o = o || {};
    var base = runS1({ mode: 'fw', fw: o.fw, load: o.load });
    var L = lifecycle(o);
    var R = { kind: 's4', h: 0.002, speed: 1, mode: 'fw', t: 0, L: L, yps: 0.8 };
    var lastSwapIdx = -1, swapAnim = 0, yearPrev = 0;
    R.set = function (k, v) {
      var oo = Object.assign({}, L.o, { duty: L.duty }); oo[k] = v; L = lifecycle(oo); R.L = L; R.chart.lanes = lanes();
    };
    R.step = function (dt) {
      R.t += dt; base.step(dt);
      var y = (R.t * R.yps) % (L.o.years + 1.5);
      if (y < yearPrev) lastSwapIdx = -1;
      yearPrev = y;
      for (var i = lastSwapIdx + 1; i < L.swaps.length; i++) { if (L.swaps[i] <= y) { lastSwapIdx = i; swapAnim = 1; } }
      swapAnim = Math.max(0, swapAnim - dt * 0.9);
    };
    function sohAt(y) { var b = L.bat, i = clamp(Math.round(y * 12), 0, b.length - 1); return b[i][1]; }
    function at(arr, y) { var i = clamp(Math.round(y * 12), 0, arr.length - 1); return arr[i][1]; }
    R.year = function () { return Math.min(L.o.years, (R.t * R.yps) % (L.o.years + 1.5)); };
    R.kpi = function () {
      var y = R.year(), k = base.kpi();
      var sw = 0; for (var i = 0; i < L.swaps.length; i++) if (L.swaps[i] <= y) sw++;
      return { year: y, soh: sohAt(y), swaps: sw, swapsTotal: L.swaps.length, efcYear: L.efcYear, fwCycles: L.fwCyclesYear, batLife: L.batLife,
        lossB: at(L.lossB, y), lossF: at(L.lossF, y), lossBTot: L.lossB[L.lossB.length - 1][1], lossFTot: L.lossF[L.lossF.length - 1][1],
        disYear: L.disYear, pf: k.pf, soe: k.soe, rpm: k.rpm, kdod: L.o.kdod, efcRated: L.o.efcRated };
    };
    R.view = function () {
      var v = base.view(); v.pb = v.pf; v.batSOH = sohAt(R.year()) / 100; v.batSwap = swapAnim; v.battery = true; return v;
    };
    function lanes() {
      return [
        { w: 0.56, min: 60, max: 110, unit: '%', title: '容量健康度 SOH', series: [
          { pts: L.bat, color: COL.bat, width: 2, label: 'LFP 鋰電（20 MWh）' },
          { pts: L.fw, color: COL.fw, width: 2.4, label: '飛輪（0.8 MWh）' }], hlines: [{ y: 80, label: '更換門檻 80%' }] },
        { w: 0.44, min: 0, max: Math.ceil(Math.max(L.lossB[L.lossB.length - 1][1], L.lossF[L.lossF.length - 1][1]) / 500) * 500, unit: 'MWh', title: '累積損耗', series: [
          { pts: L.lossB, color: COL.bat, width: 2, label: '鋰電（往返效率 92%）' },
          { pts: L.lossF, color: COL.fw, width: 2, label: '飛輪（往返 91% + 待機 ~1%/h）' }] }
      ];
    }
    R.chart = { mode: 'static', xmin: 0, xmax: L.o.years, xunit: '年', cursor: function () { return R.year(); }, lanes: lanes() };
    return R;
  }

  function makeRun(kind, o) {
    if (kind === 's1') return runS1(o);
    if (kind === 's2') return runS2(o);
    if (kind === 's3') return runS3(o);
    if (kind === 's4') return runS4(o);
    throw new Error('unknown scenario ' + kind);
  }

  // ===================================================== Part B: 3D scene
  function buildScene(canvas, opts) {
    var T = root.THREE;
    if (T.ColorManagement) T.ColorManagement.legacyMode = false; // hex colours are sRGB
    var W = opts.w, H = opts.h, dpr = Math.min(root.devicePixelRatio || 1, 2);
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene();
    scene.background = new T.Color(0x0A0E13);
    scene.fog = new T.Fog(0x0A0E13, 150, 300);
    var cam = new T.PerspectiveCamera(34, W / H, 1, 800);

    scene.add(new T.HemisphereLight(0xA9C1E0, 0x0A0E13, 0.75));
    var sun = new T.DirectionalLight(0xFFFFFF, 1.05);
    sun.position.set(-50, 90, 60); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 260;
    scene.add(sun);
    scene.add(new T.AmbientLight(0x334455, 0.35));

    var ground = new T.Mesh(new T.PlaneGeometry(500, 500), new T.MeshStandardMaterial({ color: 0x0E141B, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    var gh = new T.GridHelper(260, 52, 0x1A2430, 0x131B24); gh.position.y = 0.02; scene.add(gh);

    var mMetal = new T.MeshStandardMaterial({ color: 0x8A96A3, metalness: 0.55, roughness: 0.38 });
    var mDark = new T.MeshStandardMaterial({ color: 0x1E2834, roughness: 0.75, metalness: 0.1 });
    var mPad = new T.MeshStandardMaterial({ color: 0x18212B, roughness: 0.95 });
    var mWhite = new T.MeshStandardMaterial({ color: 0xC9D2DC, roughness: 0.5, metalness: 0.2 });
    function box(w, h, d, mat, x, y, z, parent) {
      var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m;
    }
    function pad(x, z, w, d) { box(w, 0.25, d, mPad, x, 0.125, z); }

    // ---- transmission towers + conductors (grid side, x<-40)
    var towerMat = new T.LineBasicMaterial({ color: 0x6B7A8A });
    function tower(x, z, h) {
      var g = new T.EdgesGeometry(new T.CylinderGeometry(0.6, 2.4, h, 4, 6, true));
      var l = new T.LineSegments(g, towerMat); l.position.set(x, h / 2, z); l.rotation.y = Math.PI / 4; scene.add(l);
      var arm = new T.EdgesGeometry(new T.BoxGeometry(0.4, 0.5, 9));
      [h * 0.82, h * 0.66].forEach(function (yy) { var a = new T.LineSegments(arm, towerMat); a.position.set(x, yy, z); scene.add(a); });
      return [h * 0.82, h * 0.66];
    }
    var tz = -10, t1 = -96, t2 = -68, th = 16;
    tower(t1, tz, th); tower(t2, tz, th);
    var condMat = new T.MeshBasicMaterial({ color: 0x4DA3FF, transparent: true, opacity: 0.55 });
    var gantryX = -44;
    var conds = [];
    [-3.6, 0, 3.6].forEach(function (dz) {
      [[t1 - 30, t1], [t1, t2], [t2, gantryX]].forEach(function (seg) {
        var y0 = seg[1] === gantryX ? th * 0.82 : th * 0.82, y1 = seg[1] === gantryX ? 7 : th * 0.82;
        var a = new T.Vector3(seg[0], y0, tz + dz), b = new T.Vector3(seg[1], y1, tz + dz);
        var mid = a.clone().lerp(b, 0.5); mid.y -= 2.2;
        var c = new T.QuadraticBezierCurve3(a, mid, b);
        var m = new T.Mesh(new T.TubeGeometry(c, 24, 0.09, 5, false), condMat); scene.add(m); conds.push(m);
      });
    });

    // ---- substation
    pad(-34, -10, 22, 16);
    var gant = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 8, 10)), towerMat); gant.position.set(gantryX, 4, tz); scene.add(gant);
    var mTx = new T.MeshStandardMaterial({ color: 0x5C6B7A, roughness: 0.5, metalness: 0.4 });
    [-6, 0].forEach(function (dz, i) {
      var g = new T.Group(); g.position.set(-34 + (i ? 6 : -2), 0, tz + dz + 3);
      box(4.2, 3.6, 3.2, mTx, 0, 2.05, 0, g);
      for (var f = -1.5; f <= 1.5; f += 0.5) box(0.12, 2.8, 3.8, mTx, f, 1.9, 0, g);
      for (var b = -1; b <= 1; b++) { var bu = new T.Mesh(new T.CylinderGeometry(0.16, 0.22, 1.6, 10), mWhite); bu.position.set(b * 1.2, 4.6, 0); g.add(bu); }
      scene.add(g);
    });
    var sagRing = new T.Mesh(new T.RingGeometry(9, 10.5, 64), new T.MeshBasicMaterial({ color: 0xFF5D5D, transparent: true, opacity: 0, side: T.DoubleSide }));
    sagRing.rotation.x = -Math.PI / 2; sagRing.position.set(-34, 0.3, tz); scene.add(sagRing);

    // ---- MV bus trench
    var busMat = new T.MeshBasicMaterial({ color: 0x23415F });
    box(70, 0.12, 0.7, busMat, 5, 0.3, tz).castShadow = false;

    // ---- GPU halls
    var halls = [], hallX = [-8, 11, 30], hz = -26;
    var ledMat = new T.MeshBasicMaterial({ color: 0xFFB347 });
    var fanMats = [];
    var fans = [];
    hallX.forEach(function (hx) {
      pad(hx, hz, 17, 15);
      var b = box(15, 7, 12, mDark, hx, 3.5 + 0.25, hz);
      box(15.2, 0.3, 12.2, new T.MeshStandardMaterial({ color: 0x2B3846, roughness: 0.6 }), hx, 7.4, hz);
      var cols = 12, rows = 4, inst = new T.InstancedMesh(new T.BoxGeometry(0.75, 0.42, 0.06), ledMat, cols * rows);
      var mtx = new T.Matrix4(), k = 0;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        mtx.makeTranslation(hx - 6.6 + c * 1.2, 1.6 + r * 1.3, hz + 6.04); inst.setMatrixAt(k, mtx);
        var v = 0.7 + 0.3 * ((c * 7 + r * 3) % 5) / 4; inst.setColorAt(k, new T.Color(v, v, v)); k++;
      }
      inst.instanceMatrix.needsUpdate = true; scene.add(inst);
      for (var f = 0; f < 6; f++) {
        var fx = hx - 5 + (f % 3) * 5, fz = hz - 2.5 + Math.floor(f / 3) * 5;
        var hous = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 0.6, 20), mMetal); hous.position.set(fx, 7.85, fz); scene.add(hous);
        var bl = new T.Group(); bl.position.set(fx, 8.2, fz);
        box(2.4, 0.06, 0.35, mDark, 0, 0, 0, bl); box(0.35, 0.06, 2.4, mDark, 0, 0, 0, bl);
        scene.add(bl); fans.push(bl);
      }
      var feed = box(0.5, 0.12, 8, busMat, hx, 0.3, -14); feed.castShadow = false;
      halls.push(b);
    });

    // ---- flywheel array
    var fwCols = 10, fwRows = 4, sp = 3.0, fx0 = 3, fz0 = 7;
    pad(fx0 + (fwCols - 1) * sp / 2, fz0 + (fwRows - 1) * sp / 2, fwCols * sp + 3, fwRows * sp + 3);
    var housing = new T.InstancedMesh(new T.CylinderGeometry(1.05, 1.1, 2.3, 28), mMetal, fwCols * fwRows);
    housing.castShadow = true; housing.receiveShadow = true;
    var discTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
      x.fillStyle = '#2B3540'; x.fillRect(0, 0, 128, 128);
      for (var i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#FF9F43' : '#E6EAF0'; x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, 64, i * Math.PI / 3, i * Math.PI / 3 + 0.35); x.closePath(); x.fill(); }
      x.fillStyle = '#0A0E13'; x.beginPath(); x.arc(64, 64, 14, 0, 7); x.fill();
      var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
    })();
    var discs = new T.InstancedMesh(new T.CylinderGeometry(0.88, 0.88, 0.1, 32), new T.MeshStandardMaterial({ map: discTex, roughness: 0.4, metalness: 0.3 }), fwCols * fwRows);
    var ringMat = new T.MeshBasicMaterial({ color: 0x3A4654, transparent: true, opacity: 0.9 });
    var rings = new T.InstancedMesh(new T.TorusGeometry(1.25, 0.08, 8, 40), ringMat, fwCols * fwRows);
    var fwPos = [], m4 = new T.Matrix4(), q = new T.Quaternion(), s1 = new T.Vector3(1, 1, 1), e = new T.Euler();
    for (var r = 0; r < fwRows; r++) for (var c = 0; c < fwCols; c++) {
      var i = r * fwCols + c, px = fx0 + c * sp, pz = fz0 + r * sp; fwPos.push([px, pz]);
      m4.makeTranslation(px, 1.4, pz); housing.setMatrixAt(i, m4);
      e.set(Math.PI / 2, 0, 0); q.setFromEuler(e); m4.compose(new T.Vector3(px, 0.35, pz), q, s1); rings.setMatrixAt(i, m4);
    }
    housing.instanceMatrix.needsUpdate = true; rings.instanceMatrix.needsUpdate = true;
    scene.add(housing); scene.add(discs); scene.add(rings);
    var mPcs = new T.MeshStandardMaterial({ color: 0x2E4458, roughness: 0.6, metalness: 0.2 });
    for (var p = 0; p < 4; p++) { box(5.6, 2.6, 2.4, mPcs, fx0 + 1.5 + p * 7.2, 1.55, 2.2); box(5.6, 0.18, 2.42, new T.MeshBasicMaterial({ color: 0xFF9F43 }), fx0 + 1.5 + p * 7.2, 2.4, 2.2); }
    box(0.5, 0.12, 9, busMat, 16, 0.3, -5.5).castShadow = false;

    // ---- battery yard (compare layout)
    var batMat = null, bats = [];
    if (opts.battery) {
      pad(-22, 11, 26, 12);
      batMat = new T.MeshStandardMaterial({ color: 0x3DDC97, roughness: 0.55, metalness: 0.15, emissive: 0x000000 });
      for (var br = 0; br < 2; br++) for (var bc = 0; bc < 4; bc++) {
        var bm = box(5.6, 2.6, 2.4, batMat, -31 + bc * 6.2, 1.55, 7.5 + br * 6); bats.push(bm);
      }
      box(0.5, 0.12, 12, busMat, -12, 0.3, -3.5).castShadow = false;
    }

    // ---- power-flow particles
    var dotTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
      var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
    })();
    function Flow(pts, color, n) {
      var vs = pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); });
      var segL = [], L = 0; for (var i = 1; i < vs.length; i++) { var d = vs[i].distanceTo(vs[i - 1]); segL.push(d); L += d; }
      var pos = new Float32Array(n * 3), g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      var mat = new T.PointsMaterial({ color: new T.Color(color), size: 1.4, map: dotTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
      var pts3 = new T.Points(g, mat); pts3.frustumCulled = false; scene.add(pts3);
      var off = []; for (i = 0; i < n; i++) off.push(i / n);
      var tmp = new T.Vector3();
      function place(u, out) {
        var d = u * L; for (var i = 0; i < segL.length; i++) { if (d <= segL[i] || i === segL.length - 1) { return out.copy(vs[i]).lerp(vs[i + 1], clamp(d / segL[i], 0, 1)); } d -= segL[i]; }
        return out;
      }
      return {
        update: function (dt, P, Pref) {
          var a = clamp(Math.abs(P) / Pref, 0, 1.2), dir = P >= 0 ? 1 : -1;
          var v = (4 + 22 * a) / L;
          mat.opacity = a < 0.02 ? 0 : 0.25 + 0.75 * Math.min(1, a);
          mat.size = 0.9 + 1.5 * Math.min(1, a);
          for (var i = 0; i < n; i++) {
            off[i] = (off[i] + dir * v * dt + 1) % 1;
            place(off[i], tmp); pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
          }
          g.attributes.position.needsUpdate = true;
        }
      };
    }
    var y0 = 0.75;
    var flows = {
      grid: [-3.6, 0, 3.6].map(function (dz) { return Flow([[t1 - 30, th * 0.82 - 0.4, tz + dz], [t1, th * 0.82 - 0.4, tz + dz], [t2, th * 0.82 - 0.4, tz + dz], [gantryX, 6.6, tz + dz]], COL.grid, 26); }),
      halls: hallX.map(function (hx) { return Flow([[-28, y0, tz], [hx, y0, tz], [hx, y0, -18.5]], COL.load, 34); }),
      fw: Flow([[fx0 + 13.5, y0, 6], [16, y0, 2.6], [16, y0, tz]], COL.fw, 30),
      bat: opts.battery ? Flow([[-12, y0, 6], [-12, y0, tz]], COL.bat, 26) : null
    };

    // ---- camera orbit (drag to rotate, double-click to reset)
    var target = new T.Vector3(opts.tx != null ? opts.tx : -8, 0, opts.tz != null ? opts.tz : -6);
    var orb = { th0: opts.theta != null ? opts.theta : 0.42, th: 0, ph: opts.phi != null ? opts.phi : 0.98, r: opts.r || 118, auto: true, drag: false, lx: 0, ly: 0, idle: 0, t: 0 };
    orb.th = orb.th0;
    function onDown(ev) { orb.drag = true; orb.auto = false; orb.lx = ev.clientX; orb.ly = ev.clientY; try { canvas.setPointerCapture(ev.pointerId); } catch (x) {} canvas.style.cursor = 'grabbing'; }
    function onMove(ev) { if (!orb.drag) return; orb.th -= (ev.clientX - orb.lx) * 0.006; orb.ph = clamp(orb.ph - (ev.clientY - orb.ly) * 0.005, 0.3, 1.38); orb.lx = ev.clientX; orb.ly = ev.clientY; orb.idle = 0; }
    function onUp() { orb.drag = false; canvas.style.cursor = 'grab'; }
    function onDbl() { orb.th = orb.th0; orb.ph = opts.phi != null ? opts.phi : 0.98; orb.auto = true; }
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('dblclick', onDbl);

    var tmpC = new T.Color(), cAmber = new T.Color(0xFFB347), cDim = new T.Color(0x2A2016), cUps = new T.Color(0xB48CFF);
    var cOr = new T.Color(0xFF9F43), cBl = new T.Color(0x4DA3FF), cIdle = new T.Color(0x3A4654), cGrid = new T.Color(0x4DA3FF), cRed = new T.Color(0xFF5D5D);
    var cGood = new T.Color(0x3DDC97), cMid = new T.Color(0xF5C451), cBad = new T.Color(0xFF5D5D);
    var discAng = 0, fanAng = 0, lpLoad = 0.7, clock = 0;

    function update(v, dt) {
      clock += dt; orb.t += dt;
      if (!orb.drag) { orb.idle += dt; if (orb.idle > 8) orb.auto = true; }
      if (orb.auto) orb.th = orb.th0 + 0.32 * Math.sin(orb.t * 0.07);
      cam.position.setFromSphericalCoords(orb.r, orb.ph, orb.th).add(target); cam.lookAt(target);

      // halls
      var lvl = clamp(v.gpu, 0, 1.05);
      if (v.ups) tmpC.copy(cUps).multiplyScalar(0.35 + 0.65 * lvl); else tmpC.copy(cDim).lerp(cAmber, 0.15 + 0.85 * lvl);
      ledMat.color.copy(tmpC);
      lpLoad += (v.pl / 100 - lpLoad) * Math.min(1, dt / 3);
      fanAng += dt * (2 + 9 * lpLoad); fans.forEach(function (f, i) { f.rotation.y = fanAng + i; });

      // flywheels
      var spin = 9 * v.rpm / 15000; discAng += dt * spin;
      for (var i = 0; i < fwPos.length; i++) {
        e.set(0, discAng + i * 0.37, 0); q.setFromEuler(e); m4.compose(new T.Vector3(fwPos[i][0], 2.6, fwPos[i][1]), q, s1); discs.setMatrixAt(i, m4);
      }
      discs.instanceMatrix.needsUpdate = true;
      var a = clamp(Math.abs(v.pf) / v.Pmax, 0, 1);
      if (v.pf > 0.5) ringMat.color.copy(cIdle).lerp(cOr, 0.35 + 0.65 * Math.sqrt(a)); else if (v.pf < -0.5) ringMat.color.copy(cIdle).lerp(cBl, 0.35 + 0.65 * Math.sqrt(a)); else ringMat.color.copy(cIdle);

      // grid conductors + fault
      var fg = v.faultGlow || 0, fl = v.fault ? (0.6 + 0.4 * Math.sin(clock * 60)) : 0;
      condMat.color.copy(cGrid).lerp(cRed, Math.max(fl, fg * 0.6)); condMat.opacity = 0.55 + 0.4 * Math.max(fl, fg);
      sagRing.material.opacity = Math.max(fl * 0.9, fg * 0.35); sagRing.scale.setScalar(1 + (1 - fg) * 0.6);

      // battery yard
      if (batMat) {
        var s = clamp((v.batSOH - 0.8) / 0.2, 0, 1);
        if (s > 0.5) batMat.color.copy(cMid).lerp(cGood, (s - 0.5) * 2); else batMat.color.copy(cBad).lerp(cMid, s * 2);
        var sw = v.batSwap || 0;
        batMat.emissive.setRGB(sw * 0.5, sw * 0.5, sw * 0.5);
        bats.forEach(function (b) { b.position.y = 1.55 + 14 * sw * sw; });
      }

      // flows
      flows.grid.forEach(function (f) { f.update(dt, v.pg / 3, 30); });
      flows.halls.forEach(function (f) { f.update(dt, v.ups ? 0 : v.pl / 3, 30); });
      flows.fw.update(dt, v.pf, 60);
      if (flows.bat) flows.bat.update(dt, v.pb || 0, 60);
    }

    var anchors = {
      grid: new T.Vector3(t2, th + 2, tz), sub: new T.Vector3(-34, 6, tz), halls: new T.Vector3(hallX[1], 9.5, hz),
      fw: new T.Vector3(fx0 + 13.5, 4, fz0 + 4.5), pcs: new T.Vector3(fx0 + 22, 3.4, 2.2), bat: new T.Vector3(-22, 4, 10.5)
    };
    function project(v3, ow, oh) {
      var p = v3.clone().project(cam); if (p.z > 1) return null;
      return [(p.x + 1) / 2 * ow, (1 - p.y) / 2 * oh];
    }
    function dispose() {
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('dblclick', onDbl);
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (x) {}
    }
    return { update: update, render: function () { renderer.render(scene, cam); }, anchors: anchors, project: project, dispose: dispose };
  }

  // ----------------------------------------------------- 2D drawing helpers
  var MONO = '"JetBrains Mono", ui-monospace, monospace', SANS = '"Noto Sans TC", system-ui, sans-serif';
  function prep(cv) {
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var w = +cv.getAttribute('width'), h = +cv.getAttribute('height');
    if (!cv._css) cv._css = [w, h];
    if (cv.width !== Math.round(cv._css[0] * dpr)) { cv.width = Math.round(cv._css[0] * dpr); cv.height = Math.round(cv._css[1] * dpr); }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv._css[0], cv._css[1]);
    return { ctx: ctx, w: cv._css[0], h: cv._css[1] };
  }
  function chip(ctx, x, y, title, value, color) {
    ctx.font = '500 12px ' + SANS; var tw = ctx.measureText(title).width;
    ctx.font = '600 12px ' + MONO; var vw = value ? ctx.measureText(value).width : 0;
    var w = tw + (value ? vw + 18 : 0) + 20, h = 26, bx = Math.round(x - w / 2), by = Math.round(y - 40);
    ctx.strokeStyle = 'rgba(230,234,240,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, by + h); ctx.stroke();
    ctx.fillStyle = 'rgba(10,14,19,0.86)'; ctx.strokeStyle = color || 'rgba(230,234,240,0.25)';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 6); else ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E6EAF0'; ctx.font = '500 12px ' + SANS; ctx.textBaseline = 'middle'; ctx.fillText(title, bx + 10, by + h / 2 + 0.5);
    if (value) { ctx.fillStyle = color || '#E6EAF0'; ctx.font = '600 12px ' + MONO; ctx.fillText(value, bx + 10 + tw + 12, by + h / 2 + 0.5); }
    ctx.fillStyle = color || '#E6EAF0'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
  }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }

  function drawOverlay(cv, sc, kind, v, k) {
    var o = prep(cv), ctx = o.ctx, A = sc.anchors, p;
    function put(a, t, val, col) { var q = sc.project(a, o.w, o.h); if (q) chip(ctx, q[0], q[1], t, val, col); }
    put(A.grid, '電網 161/230 kV', f1(v.pg) + ' MW', COL.grid);
    put(A.halls, v.ups ? 'GPU 機房 · UPS 孤島' : 'GPU 訓練機房', f1(v.pl) + ' MW', v.ups ? COL.bat : COL.load);
    put(A.fw, '飛輪陣列 ' + Math.round(v.Pmax) + ' MW', (v.pf >= 0 ? '+' : '') + f1(v.pf) + ' MW · ' + Math.round(v.rpm).toLocaleString('en-US') + ' rpm', COL.fw);
    if (kind === 's2') put(A.sub, '主變電站', 'V ' + v.V.toFixed(2) + ' pu', v.V < 0.85 ? COL.red : COL.volt);
    else put(A.sub, '主變電站', '', null);
    if (v.battery) put(A.bat, '對照：LFP 20 MWh', 'SOH ' + Math.round(v.batSOH * 100) + '%', COL.bat);
  }

  function niceTicks(min, max, n) {
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var t = [], v = Math.ceil(min / step) * step; for (; v <= max + 1e-9; v += step) t.push(+v.toFixed(6)); return t;
  }

  function drawChart(cv, ch, tNow) {
    var o = prep(cv), ctx = o.ctx, W = o.w, H = o.h;
    var L = 56, Rr = 14, top = 6, bot = 22, gap = 14;
    var pw = W - L - Rr, avail = H - top - bot - gap * (ch.lanes.length - 1);
    var y = top, isStatic = ch.mode === 'static';
    var xOf = isStatic ? function (x) { return L + (x - ch.xmin) / (ch.xmax - ch.xmin) * pw; } : function (age) { return L + pw - age / ch.window * pw; };
    ch.lanes.forEach(function (ln) {
      var lh = avail * ln.w, Y = function (val) { return y + lh - (clamp(val, ln.min - (ln.max - ln.min) * 0.05, ln.max + (ln.max - ln.min) * 0.05) - ln.min) / (ln.max - ln.min) * lh; };
      ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(L, y, pw, lh);
      ctx.font = '11px ' + MONO; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      niceTicks(ln.min, ln.max, Math.max(2, Math.round(lh / 34))).forEach(function (t) {
        var yy = Math.round(Y(t)) + 0.5; ctx.strokeStyle = t === 0 && ln.zero ? 'rgba(230,234,240,0.28)' : 'rgba(230,234,240,0.07)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + pw, yy); ctx.stroke();
        ctx.fillStyle = '#8C99A8'; ctx.fillText(ln.fmt ? t.toFixed(ln.fmt) : String(t), L - 8, yy);
      });
      (ln.hlines || []).forEach(function (hl) {
        var yy = Math.round(Y(hl.y)) + 0.5; ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,93,93,0.6)';
        ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + pw, yy); ctx.stroke(); ctx.setLineDash([]);
        ctx.textAlign = 'left'; ctx.fillStyle = '#FF8A8A'; ctx.fillText(hl.label, L + 6, yy - 8); ctx.textAlign = 'right';
      });
      ctx.save(); ctx.beginPath(); ctx.rect(L, y - 2, pw, lh + 4); ctx.clip();
      ln.series.forEach(function (s) {
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.5; ctx.lineJoin = 'round'; ctx.beginPath();
        if (isStatic) { s.pts.forEach(function (p, i) { var xx = xOf(p[0]), yy = Y(p[1]); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }); }
        else {
          var r = s.ring, n = r.len, first = true;
          for (var k = 0; k < n; k++) { var age = (n - 1 - k) * ch.dt; if (age > ch.window) continue; var xx = xOf(age), yy = Y(r.at(k)); if (first) { ctx.moveTo(xx, yy); first = false; } else ctx.lineTo(xx, yy); }
        }
        ctx.stroke();
      });
      ctx.restore();
      // lane title + legend
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '600 11px ' + SANS; ctx.fillStyle = '#A7B2BF';
      var lx = L + 8; ctx.fillText(ln.title + ' (' + ln.unit + ')', lx, y + 5); lx += ctx.measureText(ln.title + ' (' + ln.unit + ')').width + 16;
      ctx.font = '11px ' + SANS;
      ln.series.forEach(function (s) { ctx.fillStyle = s.color; ctx.fillRect(lx, y + 10, 12, 2.5); ctx.fillStyle = '#C9D2DC'; ctx.fillText(s.label, lx + 17, y + 5); lx += ctx.measureText(s.label).width + 34; });
      y += lh + gap;
    });
    // x axis
    ctx.font = '11px ' + MONO; ctx.fillStyle = '#8C99A8'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    if (isStatic) {
      niceTicks(ch.xmin, ch.xmax, 10).forEach(function (t) { ctx.fillText(t + (t === ch.xmax ? ' ' + ch.xunit : ''), xOf(t), H - bot + 6); });
      var cx = xOf(ch.cursor()); ctx.strokeStyle = 'rgba(230,234,240,0.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx + 0.5, top); ctx.lineTo(cx + 0.5, H - bot); ctx.stroke(); ctx.setLineDash([]);
    } else {
      niceTicks(0, ch.window, 6).forEach(function (t) { ctx.fillText(t === 0 ? '現在' : '−' + t + ' s', xOf(t), H - bot + 6); });
      (ch.marks || []).forEach(function (m) {
        var age = tNow - m.t; if (age < 0 || age > ch.window) return; var xx = Math.round(xOf(age)) + 0.5;
        ctx.strokeStyle = 'rgba(255,93,93,0.55)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, H - bot); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.font = '600 11px ' + SANS; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; var tw = ctx.measureText(m.label).width;
        var lxm = Math.min(xx + 4, L + pw - tw - 4); ctx.fillStyle = 'rgba(10,14,19,0.85)'; ctx.fillRect(lxm - 3, H - bot - 18, tw + 6, 16); ctx.fillStyle = '#FF8A8A'; ctx.fillText(m.label, lxm, H - bot - 4); ctx.restore();
      });
    }
  }

  function drawSpectrum(cv, sp) {
    var o = prep(cv), ctx = o.ctx, W = o.w, H = o.h, L = 44, Rr = 10, top = 28, bot = 34, pw = W - L - Rr, ph = H - top - bot;
    var f0 = sp.freqs[0], f1v = sp.freqs[sp.freqs.length - 1];
    var X = function (f) { return L + Math.log(f / f0) / Math.log(f1v / f0) * pw; };
    var mx = 40, Y = function (a) { return top + ph - clamp(a / mx, 0, 1) * ph; };
    ctx.fillStyle = 'rgba(255,93,93,0.08)'; ctx.fillRect(X(0.1), top, X(f1v) - X(0.1), ph);
    ctx.fillStyle = '#FF8A8A'; ctx.font = '600 11px ' + SANS; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText('電網敏感頻段 0.1–20 Hz →', X(0.1) + 4, top + 4);
    ctx.font = '11px ' + MONO; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    [0, 10, 20, 30, 40].forEach(function (t) { var yy = Math.round(Y(t)) + 0.5; ctx.strokeStyle = 'rgba(230,234,240,0.07)'; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + pw, yy); ctx.stroke(); ctx.fillStyle = '#8C99A8'; ctx.fillText(String(t), L - 6, yy); });
    var bw = pw / sp.freqs.length * 0.8;
    if (sp.load) { ctx.fillStyle = 'rgba(230,234,240,0.28)'; sp.freqs.forEach(function (f, i) { var a = sp.load[i]; ctx.fillRect(X(f) - bw / 2, Y(a), bw, top + ph - Y(a)); }); }
    if (sp.grid) { ctx.fillStyle = COL.grid; sp.freqs.forEach(function (f, i) { var a = sp.grid[i]; ctx.fillRect(X(f) - bw / 4, Y(a), bw / 2, top + ph - Y(a)); }); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#8C99A8';
    [0.05, 0.1, 0.3, 1, 3, 8].forEach(function (f) { ctx.fillText(String(f), X(f), top + ph + 6); });
    ctx.fillText('Hz', L + pw - 6, top + ph + 20);
    ctx.textAlign = 'left'; ctx.font = '11px ' + SANS; ctx.fillStyle = 'rgba(230,234,240,0.6)'; ctx.fillRect(L, 8, 10, 10); ctx.fillStyle = '#C9D2DC'; ctx.fillText('負載', L + 15, 7);
    ctx.fillStyle = COL.grid; ctx.fillRect(L + 56, 8, 10, 10); ctx.fillStyle = '#C9D2DC'; ctx.fillText('電網側', L + 71, 7);
    ctx.fillStyle = '#8C99A8'; ctx.textAlign = 'right'; ctx.fillText('振幅 MW', W - Rr, 7);
  }

  // ------------------------------------------------------------- mount
  var SCENE_OPTS = {
    s1: { theta: 0.5, phi: 0.98, r: 116, tx: -6, tz: -6 },
    s2: { theta: 0.2, phi: 0.95, r: 118, tx: -24, tz: -8 },
    s3: { theta: 0.62, phi: 1.0, r: 112, tx: -2, tz: -6 },
    s4: { theta: 0.08, phi: 0.92, r: 124, tx: -4, tz: -4, battery: true }
  };
  function mount(kind, els, onKpi, o) {
    var sim = makeRun(kind, o);
    var so = Object.assign({}, SCENE_OPTS[kind] || {}, { w: +els.view.getAttribute('width'), h: +els.view.getAttribute('height') });
    var sc = buildScene(els.view, so);
    var raf = 0, alive = true, last = 0, kpiT = 1, specT = 1, spec = null, paused = false;
    function frame(now) {
      if (!alive) return;
      var dtR = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      if (!paused) {
        var simDt = dtR * sim.speed, n = Math.max(1, Math.ceil(simDt / sim.h)), h = simDt / n;
        for (var i = 0; i < n; i++) sim.step(h);
      }
      var v = sim.view();
      sc.update(v, paused ? 0 : dtR); sc.render();
      if (els.overlay) drawOverlay(els.overlay, sc, kind, v);
      if (els.chart) drawChart(els.chart, sim.chart, sim.t);
      if (els.spec && sim.spectrum) { specT += dtR; if (specT > 0.5) { specT = 0; spec = sim.spectrum(); } if (spec) drawSpectrum(els.spec, spec); }
      kpiT += dtR; if (kpiT > 0.25) { kpiT = 0; try { onKpi(sim.kpi()); } catch (x) {} }
      raf = root.requestAnimationFrame(frame);
    }
    raf = root.requestAnimationFrame(frame);
    return {
      sim: sim,
      setMode: function (m) { sim.setMode(m); },
      trigger: function () { if (sim.trigger) sim.trigger(); },
      setSpeed: function (s) { sim.speed = s; },
      set: function (k, v) { if (sim.set) sim.set(k, v); },
      setPaused: function (p) { paused = p; },
      destroy: function () { alive = false; root.cancelAnimationFrame(raf); sc.dispose(); }
    };
  }

  var API = { COL: COL, LoadModel: LoadModel, Flywheel: Flywheel, SmoothCtl: SmoothCtl, GridArea: GridArea, makeRun: makeRun, lifecycle: lifecycle, dutyFromS1: dutyFromS1, mount: mount };
  root.AIDCSim = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
