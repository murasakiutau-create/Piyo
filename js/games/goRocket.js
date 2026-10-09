'use strict';
  // =====================================================================
  //  🚀 GO! GO! ROCKET：8F　10秒間 ボタンを連打 → POWER → ロケットが どこまで飛ぶか。SCORE・LIFE・ゲームオーバーなし
  //   ¥100（MONEYのみ）。連打数(POWER)→距離は CONFIG.goRocket.distanceCurve、ランクは rankThresholds。BEST は 距離で保存
  // =====================================================================
  const RKC = CONFIG.goRocket;
  const RK_MACHINE = { machineId: 'rk_goRocket', machineName: 'GO! GO! ROCKET', label: 'GO! GO! ROCKET', isUnlocked: true, gameType: 'goRocket', rk: true };
  if (typeof GLYPHS !== 'undefined') GLYPHS[','] = '000000000010100';
  const RK = { phase: 'intro', t: 0, clock: 0, power: 0, taps: 0, time: 10, lastTapMs: 0, pushT: 0, heat: 0, smoke: [], fx: [], paying: false, final: null, fl: null, banner: null, bgmT: 0, bgmI: 0, smokeAcc: 0, result: null, bestAtStart: 0, dev: {} };
  const RK_PX = 64; const RK_PADY = 198; const RK_ROCKY = 178; const RK_L0 = -2;
  const RK_RANKS = [{ id: 'D', name: 'SKY', col: '#9ad8ff' }, { id: 'C', name: 'STRATOSPHERE', col: '#6aa8ff' }, { id: 'B', name: 'SPACE', col: '#b88aff' }, { id: 'A', name: 'MOON', col: '#ffe070' }, { id: 'S', name: 'PLANET', col: '#ff9a5a' }, { id: 'SS', name: 'GALAXY', col: '#ff6ad0' }];
  const rkRec = () => { const p = P_(); if (!p.goRocket) p.goRocket = { v: 1, plays: 0, bestKm: 0, bestPower: 0 }; const r = p.goRocket; r.plays = r.plays | 0; r.bestKm = +r.bestKm || 0; r.bestPower = r.bestPower | 0; return r; };
  const rkClamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ---- 連打数(POWER)→距離(km)／ランク ----
  function rkKm(power) {
    const cv = RKC.distanceCurve; const p = Math.max(0, power); if (p >= cv[cv.length - 1][0]) return cv[cv.length - 1][1];
    for (let i = 1; i < cv.length; i++) { if (p <= cv[i][0]) { const a = cv[i - 1]; const b = cv[i]; const t = (p - a[0]) / (b[0] - a[0]); return Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * t); } }
    return cv[0][1];
  }
  function rkRankOf(power) { const t = RKC.rankThresholds; return power >= t.SS ? RK_RANKS[5] : power >= t.S ? RK_RANKS[4] : power >= t.A ? RK_RANKS[3] : power >= t.B ? RK_RANKS[2] : power >= t.C ? RK_RANKS[1] : RK_RANKS[0]; }
  const rkComma = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function rkFmt(km) {
    if (km < 1) return Math.max(1, Math.round(km * 1000)) + ' M'; if (km < 1e10) return rkComma(km) + ' KM';
    const ly = km / 9.4607e12; if (ly < 10) return ly.toFixed(3) + ' LY'; if (ly < 1000) return ly.toFixed(1) + ' LY'; return rkComma(ly) + ' LY';
  }
  // ---- 開始 ----
  function rkInsert() {
    if (RK.paying || (RK.phase !== 'intro' && RK.phase !== 'result')) return; if (P_().money < RKC.playCost) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    RK.paying = true; chargeYen(RKC.playCost); rkRec().plays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); rkStart(); RK.paying = false;
  }
  function rkStart() {
    RK.power = 0; RK.taps = 0; RK.time = RKC.tapDuration; RK.heat = 0; RK.smoke = []; RK.fx = []; RK.banner = null; RK.final = null; RK.fl = null; RK.result = null; RK.pushT = 0; RK.bestAtStart = rkRec().bestKm; RK.bgmT = 0; RK.bgmI = 0; RK.smokeAcc = 0; RK.phase = 'ready'; RK.t = 0; RK.cd = -1;
  }
  // ---- タップ（最重要：入力処理は軽く。演出はあとで update が行う） ----
  function rkFinishTap(e) {
    if (RK.phase !== 'tap') return false; if (e && e.isPrimary === false) return false;                                  // 2本目以降の指は数えない
    const now = performance.now(); if (now - RK.lastTapMs < RKC.tapMinGap * 1000) return false; RK.lastTapMs = now;       // 同時発火の二重カウント防止
    RK.power++; RK.taps++; RK.pushT = 0.09; RK.heat += 1; const hz = 380 + Math.min(RK.power, 130) * 5; beep(hz, 0, 0.035, 0.03 * RKC.tapFeedbackStrength, 'square'); return true;
  }
  function rkPointer(e, p) { if (RK.phase === 'tap' && p.y >= 230) rkFinishTap(e); }
  // ---- 煙・演出 ----
  const rkSmokeAdd = (x, y, vx, vy, r, life, col) => { if (RK.smoke.length < 70) RK.smoke.push({ x, y, vx, vy, r, life, t: 0, col: col || '#f0f0f8' }); };
  function rkBanner(text, col, dur, sc) { RK.banner = { text, col: col || '#ffe070', t: 0, dur: dur || 1.1, sc: sc || 3 }; }
  const RK_STAGES = [[0.3, 'CLOUDS!', '#ffffff', 3], [1.3, 'STRATOSPHERE!', '#8fd0ff', 2], [2.0, 'SPACE!!', '#b88aff', 4], [5.4, 'MOON!', '#ffe070', 4], [7.3, 'PLANETS!', '#ff9a5a', 3], [9.2, 'COMET!', '#7dfcff', 4], [12.3, 'GALAXY!!', '#ff6ad0', 4]];
  function rkLaunch() {
    const km = rkKm(RK.power); const rank = rkRankOf(RK.power); const dud = RK.power < 8; const logEnd = Math.max(RK_L0, Math.log10(km));
    const k = rkClamp(RK.power / RKC.rankThresholds.SS, 0, 1); const dur = dud ? 2.4 : RKC.flightAnimationTime.min + (RKC.flightAnimationTime.max - RKC.flightAnimationTime.min) * k;
    RK.final = { km, rank, power: RK.power, logEnd }; RK.fl = { t: 0, dur, logCur: RK_L0, logPrev: RK_L0, logEnd, dud, sub: 'fly', endT: 0, done: {}, rec: false, bestLog: RK.bestAtStart > 0 ? Math.log10(RK.bestAtStart) : null, dy: 0 };
    RK.phase = 'flight'; RK.t = 0; noise(0.7, 0.07); beep(90, 0, 0.7, 0.08, 'sawtooth', 320); beep(60, 0, 0.9, 0.08, 'square', 200);
    if (dud) { beep(150, 0, 0.18, 0.07, 'square', 60); rkBanner('BOFU!', '#ffe070', 1.0, 4); }
  }
  function rkFinishFlight() {
    const f = RK.final; const r = rkRec(); const isNew = f.km > r.bestKm; if (isNew) { r.bestKm = f.km; } r.bestPower = Math.max(r.bestPower, f.power); writeSave();
    RK.result = { km: f.km, power: f.power, rank: f.rank, isNew, best: r.bestKm }; RK.phase = 'result'; RK.t = 0; RK.banner = null; RK.smoke = [];
    [988, 1319, 1568, 1976].forEach((fr, i) => beep(fr, 0.1 + i * 0.09, 0.12, 0.05, 'triangle'));
  }
  // ---- 更新 ----
  function rkUpdate(dt) {
    dt = Math.min(dt, 0.05); RK.clock += dt; RK.t += dt; RK.pushT = Math.max(0, RK.pushT - dt); RK.heat *= Math.exp(-dt * 2.2); if (RK.banner) { RK.banner.t += dt; if (RK.banner.t > RK.banner.dur) RK.banner = null; }
    const ph = RK.phase; const norm = rkClamp(RK.heat / 4, 0, 1);
    if (ph === 'ready') {
      const c0 = RKC.readyText; const st = RKC.countStep; const tt = RK.t; let cd = tt < c0 ? -1 : Math.floor((tt - c0) / st);
      if (cd !== RK.cd) { RK.cd = cd; if (cd >= 0 && cd <= 2) beep(660, 0, 0.12, 0.05, 'square'); else if (cd === 3) { beep(1320, 0, 0.25, 0.06, 'square'); beep(1760, 0.08, 0.3, 0.05, 'square'); } }
      if (cd >= 4) { RK.phase = 'tap'; RK.t = 0; RK.time = RKC.tapDuration; RK.lastTapMs = 0; }
    } else if (ph === 'tap') {
      RK.time -= dt; const prev = RK.time + dt; if (Math.ceil(prev) !== Math.ceil(RK.time) && RK.time <= 3 && RK.time > 0) beep(880, 0, 0.1, 0.05, 'square');
      RK.bgmT -= dt; if (RK.bgmT <= 0) { RK.bgmT = 0.13 - 0.04 * (1 - RK.time / RKC.tapDuration); const seq = [262, 330, 392, 330, 262, 330, 392, 523, 294, 370, 440, 370, 294, 370, 440, 587]; const n = seq[RK.bgmI++ % 16]; beep(n * (1 + 0.1 * (1 - RK.time / RKC.tapDuration)), 0, 0.09, 0.016, 'triangle'); if (RK.bgmI % 2 === 0) beep(n / 4, 0, 0.1, 0.02, 'square'); }
      RK.smokeAcc += dt * (3 + 38 * norm) * RKC.smokeAmount; while (RK.smokeAcc >= 1) { RK.smokeAcc -= 1; rkSmokeAdd(W / 2 + (Math.random() - 0.5) * 14, RK_PADY + 6, (Math.random() - 0.5) * 50 * (0.6 + norm), -6 - Math.random() * 14, 4 + Math.random() * 5, 0.7 + Math.random() * 0.6); }
      if (RK.time <= 0) { RK.time = 0; RK.phase = 'stop'; RK.t = 0; beep(180, 0, 0.35, 0.07, 'square', 120); noise(0.2, 0.05); }
    } else if (ph === 'stop') {
      if (RK.t >= RKC.stopTime) { RK.phase = 'launch'; RK.t = 0; beep(120, 0, 0.8, 0.06, 'sawtooth', 240); }
      RK.smokeAcc += dt * 40 * RKC.smokeAmount; while (RK.smokeAcc >= 1) { RK.smokeAcc -= 1; rkSmokeAdd(W / 2 + (Math.random() - 0.5) * 18, RK_PADY + 6, (Math.random() - 0.5) * 90, -6 - Math.random() * 12, 5 + Math.random() * 6, 0.8); }
    } else if (ph === 'launch') {
      RK.smokeAcc += dt * 70 * RKC.smokeAmount; while (RK.smokeAcc >= 1) { RK.smokeAcc -= 1; rkSmokeAdd(W / 2 + (Math.random() - 0.5) * 22, RK_PADY + 6, (Math.random() - 0.5) * 140, -4 - Math.random() * 10, 6 + Math.random() * 7, 0.9); }
      if (RK.t >= RKC.launchAnimationTime) rkLaunch();
    } else if (ph === 'flight') rkFlightUpdate(dt);
    for (const s of RK.smoke) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 6; s.vx *= 0.97; } RK.smoke = RK.smoke.filter((s) => s.t < s.life);
    for (const q of RK.fx) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 40 * dt; } RK.fx = RK.fx.filter((q) => q.t < q.life);
  }
  function rkFlightUpdate(dt) {
    const f = RK.fl; const fin = RK.final;
    if (f.sub === 'fly') {
      f.t += dt; const u = rkClamp(f.t / f.dur, 0, 1); const e = 0.5 * u + 0.5 * (u * u * (3 - 2 * u)); f.logPrev = f.logCur; f.logCur = RK_L0 + (f.logEnd - RK_L0) * (f.dud ? 0 : e);
      const sp = (f.logCur - f.logPrev) / Math.max(dt, 0.001);
      for (const st of RK_STAGES) { if (f.logCur >= st[0] && !f.done[st[1]] && st[0] <= f.logEnd + 0.01) { f.done[st[1]] = true; rkBanner(st[1], st[2], 1.0, st[3]); [660, 880, 1175].forEach((fr, i) => beep(fr, i * 0.07, 0.1, 0.05, 'square')); } }
      if (f.bestLog !== null && !f.rec && f.logCur >= f.bestLog) { f.rec = true; rkBanner('NEW RECORD!!', '#ffe070', 1.6, 3); [1047, 1319, 1568, 2093, 1568, 2093, 2637].forEach((fr, i) => beep(fr, i * 0.07, 0.1, 0.06, 'square')); }
      RK.bgmT -= dt; if (RK.bgmT <= 0 && !f.dud) { RK.bgmT = 0.12; const seq = [523, 659, 784, 1047, 784, 659, 880, 1109, 1319, 1109, 880, 1109]; beep(seq[RK.bgmI++ % 12], 0, 0.1, 0.02, 'square'); if (RK.bgmI % 2) { noise(0.1, 0.012); beep(70 + 30 * u, 0, 0.14, 0.03, 'sawtooth'); } }
      if (!f.dud) { RK.smokeAcc += dt * 26 * RKC.smokeAmount; while (RK.smokeAcc >= 1) { RK.smokeAcc -= 1; rkSmokeAdd(W / 2 + (Math.random() - 0.5) * 8, RK_ROCKY + 28, (Math.random() - 0.5) * 30, 40 + sp * 20, 3 + Math.random() * 3, 0.6, f.logCur < 1.6 ? '#f0f0f8' : '#ffd08a'); } }
      for (const s of RK.smoke) s.y += sp * RK_PX * dt;
      if (u >= 1) { f.sub = 'end'; f.endT = 0; if (!f.dud) { const id = fin.rank.id; if (id === 'D' || id === 'C') { rkBanner('PUSUN...', '#c8d0e8', 1.6, 4); beep(300, 0, 0.5, 0.06, 'sawtooth', 70); } else if (id === 'B') rkBanner('SPACE!', '#b88aff', 1.4, 4); else if (id === 'A') rkBanner('MOON!', '#ffe070', 1.4, 4); else if (id === 'S') { rkBanner('PLANET!!', '#ff9a5a', 1.6, 4); [880, 1175, 1568, 1760].forEach((fr, i) => beep(fr, i * 0.08, 0.14, 0.06, 'square')); } else { rkBanner('GALAXY!!', '#ff6ad0', 2.0, 5); [784, 988, 1175, 1568, 1976, 2349, 3136].forEach((fr, i) => beep(fr, i * 0.07, 0.16, 0.06, 'square')); for (let i = 0; i < 40; i++) RK.fx.push({ x: Math.random() * W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 60, t: 0, life: 2.4, col: ['#ff6ad0', '#ffe070', '#7dfcff', '#ffffff'][i % 4] }); } } }
    } else {
      f.endT += dt; const id = fin.rank.id; const lim = f.dud ? 0.6 : id === 'SS' ? 2.2 : 1.6; if (id === 'S' || id === 'SS') f.dy = -(f.endT * f.endT) * (id === 'SS' ? 260 : 120); else if (id === 'A' || id === 'B') f.dy = Math.sin(f.endT * 3) * 2;
      if (f.endT >= lim) rkFinishFlight();
    }
  }
  // ---- 描画：ロケット（赤白のおもちゃ風） ----
  function rkDrawRocket(cx, cy, s, flame, shake) {
    const u = Math.max(1, Math.round(2 * s)); const sx = shake ? Math.round((Math.random() - 0.5) * shake) : 0; const sy = shake ? Math.round((Math.random() - 0.5) * shake * 0.6) : 0; const ox = Math.round(cx) + sx; const oy = Math.round(cy - 10 * u) + sy; const t = performance.now() / 1000;
    const cell = (x, y, w, col) => rect(ox + x * u, oy + y * u, w * u, u, col);
    const nose = [1, 2, 2, 3, 3, 4]; const fin = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 1];
    const hw = (r) => (r < 6 ? nose[r] : r < 18 ? 4 : 3);
    if (flame > 0.05) { const L = Math.round(flame * 9 + Math.sin(t * 40) * 1.5); for (let k = 0; k < L; k++) { const q = k / Math.max(1, L); const w = Math.max(1, Math.round(3 - q * 3)); const wob = Math.round(Math.sin(t * 30 + k) * (q * 1.2)); cell(-w + wob, 20 + k, w * 2, '#ff4a1a'); if (w > 1) cell(-w + 1 + wob, 20 + k, (w - 1) * 2, '#ffa020'); if (q < 0.6 && w > 1) cell(-w + 2 + wob, 20 + k, Math.max(2, (w - 2) * 2), '#fff080'); } }
    for (let r = -1; r <= 20; r++) { const rr = rkClamp(r, 0, 19); const h = hw(rr); const e = fin[rr]; cell(-h - e - 1, r, 2 * h + 2 * e + 2, '#2a0e18'); }
    for (let r = 0; r < 20; r++) {
      const h = hw(r); const e = fin[r];
      if (r < 6) { cell(-h, r, 2 * h, '#e8282c'); cell(h - 1, r, 1, '#a01820'); } else if (r < 18) { cell(-h, r, 2 * h, '#f4f4fc'); cell(h - 1, r, 1, '#c4c8d8'); } else { cell(-h, r, 2 * h, r === 18 ? '#8a8a9a' : '#4a4a5a'); }
      if (e > 0) { cell(-h - e, r, e, '#e8282c'); cell(h, r, e, '#c01a22'); }
      if (r === 12 || r === 13) cell(-h, r, 2 * h, '#e8282c');
    }
    cell(-1, 7, 2, '#1a2a8a'); cell(-2, 8, 4, '#1a2a8a'); cell(-2, 9, 4, '#1a2a8a'); cell(-2, 10, 4, '#1a2a8a'); cell(-1, 11, 2, '#1a2a8a'); cell(-1, 8, 2, '#9fe3ff'); cell(-1, 9, 2, '#6ac0f0'); cell(-1, 10, 2, '#6ac0f0'); cell(-1, 8, 1, '#ffffff');
  }
  // ---- 描画：背景（高度＝log10(km) で場面が変わる） ----
  const RK_SKY = [[-2, '#a8e0ff'], [0, '#6cc0f8'], [0.8, '#3a82d8'], [1.3, '#1c3aa0'], [1.8, '#0a1050'], [2.3, '#02030f'], [5, '#02030f'], [8, '#0a0420'], [11, '#14083a'], [13, '#2a0a5a']];
  function rkSkyCol(l) { const a = RK_SKY; if (l <= a[0][0]) return a[0][1]; for (let i = 1; i < a.length; i++) if (l <= a[i][0]) return mixHex(a[i - 1][1], a[i][1], (l - a[i - 1][0]) / (a[i][0] - a[i - 1][0])); return a[a.length - 1][1]; }
  const RK_STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 47 + 13) % 199, y: (i * 83 + 29) % 400, l: 0.5 + (i % 3) * 0.5 }));
  function rkCircle(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  function rkWorld(L, speed, shake) {
    const wy = (lg) => RK_PADY - (lg - L) * RK_PX; const t = RK.clock;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rkSkyCol(L + 0.55)); g.addColorStop(1, rkSkyCol(L - 0.2)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sa = rkClamp((L - 1.5) / 0.8, 0, 1);
    if (sa > 0) { ctx.globalAlpha = sa; for (const s of RK_STARS) { const y = (s.y + L * RK_PX * 0.5 * s.l + (speed > 0.4 ? 0 : 0)) % 300; const len = speed > 0.5 ? Math.min(12, 2 + speed * 4 * s.l) : 1; rect(s.x % W, y, 1, len, s.l > 1 ? '#ffffff' : '#a8b8e8'); } ctx.globalAlpha = 1; }
    if (L > 0.5 && L < 2.4) { const ey = wy(1.9) + 380; ctx.fillStyle = '#2a6ac8'; ctx.beginPath(); ctx.arc(W / 2, ey, 380, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#9ad8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, ey, 380, 0, 6.2832); ctx.stroke(); }
    for (let i = 0; i < 16; i++) { const lg = 0.1 + i * 0.07; const y = wy(lg); if (y < -40 || y > H + 20) continue; const x = (i * 61 + 20) % (W - 20); const w = 26 + (i * 13) % 26; ctx.globalAlpha = 0.95; rect(x, y, w, 6, '#ffffff'); rect(x + 6, y - 5, w - 14, 6, '#ffffff'); rect(x + 3, y + 5, w - 6, 3, '#d8ecff'); ctx.globalAlpha = 1; }
    if (L > 4) {
      let y = wy(5.585); if (y > -40 && y < H + 40) { rkCircle(W * 0.68, y, 24, '#d8d8e0'); rkCircle(W * 0.68 - 8, y - 6, 5, '#b0b0bc'); rkCircle(W * 0.68 + 7, y + 8, 4, '#b0b0bc'); rkCircle(W * 0.68 + 9, y - 10, 3, '#b0b0bc'); }
      y = wy(7.6); if (y > -50 && y < H + 50) { rkCircle(W * 0.3, y, 20, '#e8c070'); ctx.strokeStyle = '#d8a050'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(W * 0.3, y, 34, 8, -0.3, 0, 6.2832); ctx.stroke(); }
      y = wy(8.5); if (y > -30 && y < H + 30) { rkCircle(W * 0.7, y, 14, '#d8503a'); rkCircle(W * 0.7 - 4, y - 3, 3, '#a03020'); }
      y = wy(9.4); if (y > -60 && y < H + 60) { const cx = W * 0.5 + Math.sin(t * 2) * 4; ctx.strokeStyle = '#7dfcff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 40, y - 60); ctx.lineTo(cx, y); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 25, y - 36); ctx.lineTo(cx, y); ctx.stroke(); rkCircle(cx, y, 6, '#ffffff'); }
      y = wy(10.4); if (y > -60 && y < H + 60) { rkCircle(W * 0.4, y, 36, '#5a8ae8'); ctx.fillStyle = '#8ab0ff'; ctx.fillRect(W * 0.4 - 33, y - 10, 66, 6); ctx.fillStyle = '#3a5ac0'; ctx.fillRect(W * 0.4 - 30, y + 8, 60, 6); }
      y = wy(11.3); if (y > -30 && y < H + 30) { rkCircle(W * 0.75, y, 10, '#6ad87a'); }
      y = wy(12.8); if (y > -120 && y < H + 120) { for (let a = 0; a < 3; a++) for (let k = 0; k < 40; k++) { const r = 4 + k * 1.6; const ang = a * 2.0944 + k * 0.18 + t * 0.4; ctx.globalAlpha = 1 - k / 52; rect(W / 2 + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.6, 2, 2, k % 3 ? '#ffd8ff' : '#7dfcff'); } ctx.globalAlpha = 1; rkCircle(W / 2, y, 6, '#fff8d0'); }
    }
    const gy = wy(RK_L0) + 10; if (gy < H + 40) {
      for (let i = 0; i < 14; i++) { const bw = 12 + (i * 7) % 8; const bh = 16 + (i * 37) % 44; const bx = i * 15 - 4; rect(bx, gy - bh, bw, bh, i % 2 ? '#8a9ac0' : '#a8b4d0'); for (let wy2 = 4; wy2 < bh - 3; wy2 += 7) rect(bx + 3, gy - bh + wy2, 2, 3, '#ffe9a0'); }
      rect(0, gy, W, 400, '#4aa84a'); rect(0, gy, W, 3, '#6ad06a'); const tx = Math.round(W / 2 + 36); rect(tx, gy - 56, 7, 56, '#8a8a9a'); for (let k = 0; k < 7; k++) rect(tx, gy - 54 + k * 8, 7, 1, '#5a5a6a'); rect(tx - 2, gy - 60, 11, 5, '#e8282c'); rect(tx - 26, gy - 34, 26, 3, '#b0b0c0');
      const px0 = Math.round(W / 2 - 20 + (shake ? (Math.random() - 0.5) * shake * 0.5 : 0)); rect(px0, gy - 12, 40, 12, '#5a5a6a'); for (let k = 0; k < 5; k++) rect(px0 + 2 + k * 8, gy - 12, 4, 3, '#ffd84a'); rect(px0, gy - 12, 40, 1, '#8a8a9a');
    }
  }
  function rkSmokeDraw() { for (const s of RK.smoke) { const a = 1 - s.t / s.life; ctx.globalAlpha = Math.max(0, a * 0.85); rkCircle(Math.round(s.x), Math.round(s.y), s.r, s.col); } ctx.globalAlpha = 1; }
  // ---- HUD ----
  function rkPanel(x, y, w, h) { rect(x, y, w, h, 'rgba(8,2,30,0.8)'); }
  function rkDrawButton(on) {
    const cx = Math.round(W / 2); const cy = 318 + (RK.pushT > 0 ? 4 : 0); const r = 38; rect(0, 232, W, H - 232, '#17163a'); for (let x = 0; x < W; x += 10) rect(x, 232, 5, 2, '#ffd84a');
    rkCircle(cx, 322, r + 3, '#6a0e14'); rkCircle(cx, cy, r, RK.pushT > 0 ? '#c01820' : on ? '#ff3a3a' : '#8a5a5a'); rkCircle(cx - 8, cy - 12, 14, RK.pushT > 0 ? '#d82a30' : on ? '#ff7a6a' : '#9a7a7a'); drawTextCenter(on ? 'PUSH!' : 'WAIT', cx, cy - 5, '#ffffff', 2, '#6a0e14');
  }
  function rkGauge() {
    const k = rkClamp(RK.power / RKC.gaugeMax, 0, 1); const lv = RK.power >= RKC.rankThresholds.SS ? 'MAX!?' : RK.power >= RKC.rankThresholds.A ? 'GREAT' : RK.power >= RKC.rankThresholds.C ? 'GOOD' : 'LOW'; const col = lv === 'MAX!?' ? '#ff6ad0' : lv === 'GREAT' ? '#ff9a3a' : lv === 'GOOD' ? '#ffe070' : '#7dfcff';
    const x = 14; const w = W - 28; rect(x - 1, 252, w + 2, 14, '#000010'); rect(x, 253, w, 12, '#2a2a5a'); const fw = Math.round(w * k); rect(x, 253, fw, 12, col); rect(x, 253, fw, 4, mixHex(col, '#ffffff', 0.5));
    for (let i = 1; i < 10; i++) rect(x + Math.round(w * i / 10), 253, 1, 12, '#17163a'); drawText('POWER', x, 241, '#c8d0ff', 1); drawText(lv, x + w - textWidth(lv, 1), 241, col, 1);
  }
  function rkDrawTap() {
    const ph = RK.phase; rkWorld(RK_L0, 0, ph === 'tap' ? Math.min(6, 1 + RK.heat) * RKC.rocketShakeStrength : ph === 'stop' || ph === 'launch' ? 6 : 0);
    const sh = (ph === 'tap' ? (0.6 + Math.min(RK.power, 120) / 14 + RK.heat * 0.6) : ph === 'stop' ? 7 : ph === 'launch' ? 9 + RK.t * 6 : 0) * RKC.rocketShakeStrength; const fl = ph === 'tap' ? rkClamp(RK.heat / 5, 0, 0.7) : ph === 'stop' ? 0.9 : ph === 'launch' ? 1.2 : 0;
    rkDrawRocket(W / 2, RK_ROCKY, 1, fl, sh); rkSmokeDraw(); rkDrawButton(ph === 'tap');
    if (ph === 'tap' || ph === 'stop' || ph === 'ready') {
      rkPanel(8, 6, W - 16, 34); drawText('POWER', 12, 9, '#c8a0ff', 1); drawText(String(RK.power), 12, 19, '#ffffff', 2, '#4a2a9a'); const tm = RK.time.toFixed(1); drawText('TIME', W - 12 - textWidth('TIME', 1), 9, '#c8a0ff', 1); const low = RK.time <= 3 && ph === 'tap'; drawText(tm, W - 12 - textWidth(tm, 2), 19, low ? '#ff7a7a' : '#ffffff', 2, low ? '#3a0a0a' : '#4a2a9a');
      rkGauge();
    }
    if (ph === 'ready' && RK.cd >= 0) { const s = RK.cd <= 2 ? String(3 - RK.cd) : 'GO!!'; drawTextCenter(s, W / 2, 70, RK.cd <= 2 ? '#ffffff' : '#ffe070', RK.cd <= 2 ? 10 : 8, '#e8282c'); }
    if (ph === 'tap' && RK.time <= 3 && RK.time > 0) { const n = String(Math.ceil(RK.time)); ctx.globalAlpha = 0.9; drawTextCenter(n + '!', W / 2, 62, '#ffe070', 9, '#e8282c'); ctx.globalAlpha = 1; }
    if (ph === 'stop') drawTextCenter('STOP!!', W / 2, 78, '#ff5a5a', 6, '#3a0a0a');
    if (ph === 'launch') drawTextCenter('LAUNCH!!', W / 2, 78, '#ffe070', 5, '#e8282c');
  }
  function rkDrawFlight() {
    const f = RK.fl; const fin = RK.final; const sp = f.sub === 'fly' ? (f.logCur - f.logPrev) * 60 : 0; const fr = RK.final; let L = f.logCur; let ry = RK_ROCKY + f.dy; let fl = 1.1; const id = fin.rank.id;
    if (f.dud) { const u = rkClamp(f.t / f.dur, 0, 1) * 0 + (f.sub === 'fly' ? rkClamp(f.t / 1.4, 0, 1) : 1); const hop = Math.sin(u * Math.PI) * 16; ry = RK_ROCKY - hop; L = RK_L0; fl = f.sub === 'fly' && f.t < 0.5 ? 0.5 : 0; }
    else if (f.sub === 'end' && (id === 'D' || id === 'C' || id === 'B' || id === 'A')) fl = rkClamp(0.9 - f.endT * 1.2, 0, 1);
    rkWorld(L, sp, 0);
    if (sp > 0.5 && L > 0 && L < 1.8) { ctx.globalAlpha = 0.5; for (let i = 0; i < 10; i++) { const x = (i * 37 + Math.floor(RK.clock * 30) * 11) % W; const y = (i * 71 + RK.clock * 900) % 260; rect(x, y, 1, 14, '#ffffff'); } ctx.globalAlpha = 1; }
    if (f.bestLog !== null && !f.dud) { const y = RK_PADY - (f.bestLog - L) * RK_PX; if (y > 44 && y < H - 10) { for (let x = 0; x < W; x += 8) rect(x, y, 5, 2, '#ffe070'); drawText('BEST', 6, y - 8, '#ffe070', 1, '#3a2a00'); drawText(rkFmt(fr.km > 0 ? RK.bestAtStart : 0), W - 6 - textWidth(rkFmt(RK.bestAtStart), 1), y - 8, '#ffe070', 1, '#3a2a00'); } }
    rkSmokeDraw(); const tilt = 0; rkDrawRocket(W / 2, ry, 1, fl, f.dud ? 0 : 1.2 * RKC.rocketShakeStrength + (id === 'SS' ? 2 : 0));
    const cur = f.dud ? fin.km * rkClamp(Math.sin(rkClamp(f.t / 1.4, 0, 1) * Math.PI), 0, 1) : Math.pow(10, L); rkPanel(8, 6, W - 16, 34); drawTextCenter('ALTITUDE', W / 2, 9, '#c8a0ff', 1); const txt = f.dud ? rkFmt(Math.max(0.001, cur)) : rkFmt(Math.min(cur, fin.km)); drawTextCenter(txt, W / 2, 20, '#ffffff', txt.length > 14 ? 1 : 2, '#4a2a9a');
    for (const q of RK.fx) rect(q.x, q.y, 2, 3, q.col);
    if (RK.banner) rkBannerDraw();
  }
  function rkBannerDraw() { const b = RK.banner; const a = Math.min(1, b.t * 8, (b.dur - b.t) * 6); ctx.globalAlpha = Math.max(0, a); const y = b.sc >= 4 ? 84 : 92; drawTextCenter(b.text, W / 2, y, b.col, Math.min(b.sc, Math.floor((W - 16) / (b.text.length * 4))), '#10042a'); ctx.globalAlpha = 1; }
  function rkDrawIntro() {
    rkWorld(RK_L0, 0, 0); const bob = Math.round(Math.sin(RK.clock * 3) * 2); rkDrawRocket(W / 2, RK_ROCKY + bob, 1, 0, 0); rkPanel(0, 0, W, 76);
    drawTextCenter('GO! GO!', W / 2, 10, '#ffe070', 5, '#e8282c'); drawTextCenter('ROCKET', W / 2, 38, '#ffffff', 5, '#e8282c');
    rect(0, 232, W, H - 232, '#17163a'); const r = rkRec(); drawTextCenter('YEN ' + P_().money, W / 2, 242, '#a8b8ff', 1); drawTextCenter(r.bestKm > 0 ? 'BEST ' + rkFmt(r.bestKm) : 'BEST ---', W / 2, 254, '#ffe070', 1); drawTextCenter('1 PLAY  YEN ' + RKC.playCost, W / 2, 304, '#a8b8ff', 1);
  }
  function rkDrawResult() {
    const R = RK.result; const L = Math.max(RK_L0, Math.log10(R.km)); rkWorld(L, 0, 0); rect(0, 0, W, H, 'rgba(8,2,30,0.72)'); drawFrame(); for (const q of RK.fx) rect(q.x, q.y, 2, 3, q.col);
    drawTextCenter('RESULT', W / 2, 16, '#ffe070', 3, '#e8282c'); drawText('POWER', 20, 54, '#c8a0ff', 1); const ps = String(R.power); drawText(ps, W - 20 - textWidth(ps, 2), 51, '#ffffff', 2, '#4a2a9a');
    drawText('DISTANCE', 20, 80, '#c8a0ff', 1); const ds = rkFmt(R.km); drawTextCenter(ds, W / 2, 94, '#ffffff', ds.length > 12 ? 1 : 2, '#4a2a9a'); rect(16, 114, W - 32, 1, '#4a2a7a');
    drawTextCenter('RANK', W / 2, 124, '#c8a0ff', 1); drawTextCenter(R.rank.id, W / 2, 138, R.rank.col, 7, '#10042a'); drawTextCenter(R.rank.name, W / 2, 182, R.rank.col, Math.min(3, Math.floor((W - 20) / (R.rank.name.length * 4))), '#10042a');
    if (R.isNew) { drawTextCenter('NEW RECORD!', W / 2, 214, '#ffe070', 3, '#a0481a'); } else { drawTextCenter('BEST ' + rkFmt(R.best), W / 2, 218, '#ffe070', 1); }
    drawTextCenter('YEN ' + P_().money, W / 2, 252, '#a8b8ff', 1);
  }
  // ---- DOM ----
  const RK_DOM = {};
  function rkBuildDom() {
    if (RK_DOM.play) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); RK_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    mk('rk-play', 'PLAY　¥' + RKC.playCost, 'hb-go', rkInsert); mk('rk-retry', 'もういちど　¥' + RKC.playCost, 'hb-go', rkInsert);
    const say = document.createElement('div'); say.className = 'nk-say'; say.id = 'rk-say'; say.innerHTML = 'ボタンを れんだして ロケットを とばせ！<br>' + RKC.tapDuration + 'びょうかんの れんだで どこまで とぶ？<br>くも → うちゅう → つき → わくせい → ぎんが！<br><span class="nk-dim">1ぽんゆびで タップ・おしっぱなしは 1かい</span>'; screenEl.appendChild(say); RK_DOM.say = say;
    const rd = document.createElement('div'); rd.className = 'nk-say'; rd.id = 'rk-ready'; rd.innerHTML = RKC.tapDuration + 'びょうかん　れんだせよ！'; screenEl.appendChild(rd); RK_DOM.ready = rd;
  }
  function rkUi() {
    rkBuildDom(); const ph = RK.phase; const show = (k, on) => RK_DOM[k].classList.toggle('is-show', !!on); show('play', ph === 'intro'); show('say', ph === 'intro'); show('retry', ph === 'result'); show('ready', ph === 'ready' && RK.cd < 0);
    crPlace(RK_DOM.play, { x: 24, y: 318, w: W - 48, h: 34 }); crPlace(RK_DOM.say, { x: 12, y: 84, w: W - 24, h: 80 }); crPlace(RK_DOM.retry, { x: 20, y: 300, w: W - 40, h: 34 }); crPlace(RK_DOM.ready, { x: 12, y: 84, w: W - 24, h: 34 });
    for (const k of ['play', 'retry']) RK_DOM[k].style.fontSize = Math.max(10, parseFloat(RK_DOM[k].style.fontSize) * 0.95) + 'px'; RK_DOM.say.style.fontSize = Math.max(10, parseFloat(RK_DOM.say.style.fontSize) * 0.86) + 'px';
  }
  function rkHide() { if (!RK_DOM.play) return; Object.keys(RK_DOM).forEach((k) => RK_DOM[k].classList.remove('is-show')); }
  function rkDraw() { const ph = RK.phase; if (ph === 'intro') rkDrawIntro(); else if (ph === 'result') rkDrawResult(); else if (ph === 'flight') rkDrawFlight(); else rkDrawTap(); rkUi(); }
  function rkLeaveMid() {
    if (RK.phase === 'intro' || RK.phase === 'result') return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ・BESTも きろくされないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { RK.phase = 'intro'; RK.smoke = []; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  function openRkDev() {
    const again = (f) => () => { f(); setTimeout(openRkDev, 0); }; const table = [0, 5, 20, 40, 60, 85, 100, 118, 130].map((p) => p + ':' + rkFmt(rkKm(p)) + '/' + rkRankOf(p).id).join('  ');
    const fly = (p) => () => { rkStart(); RK.power = p; RK.phase = 'launch'; RK.t = RKC.launchAnimationTime; };
    showDialog({ title: 'GO! GO! ROCKET DEV', wide: true, lines: [{ text: 'PHASE ' + RK.phase + ' / POWER ' + RK.power + ' / TAPS ' + RK.taps + ' / TIME ' + RK.time.toFixed(1), cls: 'dim' }, { text: table, cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) }, { label: 'ゲーム即開始（料金なし）', onClick: () => { rkStart(); } },
      { label: 'POWER 30 で発射', onClick: fly(30) }, { label: 'POWER 50 で発射', onClick: fly(50) }, { label: 'POWER 70 で発射', onClick: fly(70) }, { label: 'POWER 90 で発射', onClick: fly(90) }, { label: 'POWER 105 で発射', onClick: fly(105) }, { label: 'POWER 125 で発射', onClick: fly(125) }, { label: 'POWER 3 で発射（ボフッ）', onClick: fly(3) },
      { label: 'BEST 記録 リセット', onClick: again(() => { const r = rkRec(); r.bestKm = 0; r.bestPower = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('goRocket', {
    reset() { RK.phase = 'intro'; RK.smoke = []; }, phase: () => (RK.phase === 'intro' || RK.phase === 'result' ? 'idle' : 'play'),
    enter() { rkBuildDom(); RK.phase = 'intro'; RK.paying = false; RK.smoke = []; RK.fx = []; RK.banner = null; setMessage('', C.cyan); },
    update: rkUpdate, draw: rkDraw, hint: 'ボタンを れんだ！れんだ！れんだ！',
    pointer: rkPointer, pointerUp() {}
  });
  GAME_TYPES.goRocket.canLeave = () => RK.phase === 'intro' || RK.phase === 'result';
  GAME_TYPES.goRocket.beforeLeave = () => rkLeaveMid();
  GAME_TYPES.goRocket.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });
